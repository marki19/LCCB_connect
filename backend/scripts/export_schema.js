// One-shot schema export: generates baseline.sql from pg_catalog.
// Builds CREATE TABLE from columns + constraints; policies from pg_policy.
"use strict";
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

async function main() {
  const dotenv = require("dotenv");
  dotenv.config();
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const c = new Client({ connectionString: url, connectionTimeoutMillis: 15000 });
  await c.connect();

  const out = [];

  out.push("-- Baseline schema exported from Supabase (public schema)");
  out.push("-- Generated at: " + new Date().toISOString());
  out.push("-- This file + migrations 001-023 should reconstruct production exactly.");
  out.push("");

  // 1. Types (enums, domains)
  const types = await c.query(`
    SELECT t.typname,
           CASE t.typtype WHEN 'e' THEN 'enum' ELSE 'domain' END AS kind
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype IN ('e', 'd')
    ORDER BY t.typname
  `);
  for (const row of types.rows) {
    if (row.kind === 'enum') {
      const enumVals = await c.query(`
        SELECT enumlabel FROM pg_enum WHERE enumtypid = (
          SELECT oid FROM pg_type WHERE typname = $1 AND typnamespace = (
            SELECT oid FROM pg_namespace WHERE nspname = 'public'
          )
        ) ORDER BY enumsortorder
      `, [row.typname]);
      const labels = enumVals.rows.map(r => "'" + r.enumlabel.replace(/'/g, "''") + "'").join(", ");
      out.push("CREATE TYPE " + row.typname + " AS ENUM (" + labels + ");");
    } else {
      const dom = await c.query(`
        SELECT pg_catalog.format_type(t.typbasetype, t.typtypmod) AS base,
               pg_catalog.pg_get_expr(t.typdefaultbin, t.typnamespace) AS default_expr,
               t.typnotnull
        FROM pg_type t
        WHERE t.typname = $1 AND t.typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      `, [row.typname]);
      if (dom.rows[0]) {
        let d = "CREATE DOMAIN " + row.typname + " AS " + dom.rows[0].base;
        if (dom.rows[0].default_expr) d += " DEFAULT " + dom.rows[0].default_expr;
        if (dom.rows[0].typnotnull) d += " NOT NULL";
        out.push(d + ";");
      }
    }
  }
  if (types.rows.length) out.push("");

  // 2. Tables
  const tables = await c.query(`
    SELECT c.oid, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname
  `);

  for (const t of tables.rows) {
    const cols = await c.query(`
      SELECT a.attname,
             pg_catalog.format_type(a.atttypid, a.atttypmod) AS type,
             a.attnotnull,
             a.atthasdef,
             (SELECT pg_catalog.pg_get_expr(ad.adbin, ad.adrelid)
              FROM pg_attrdef ad WHERE ad.adrelid = a.attrelid AND ad.adnum = a.attnum) AS def,
             a.attidentity
      FROM pg_attribute a
      WHERE a.attrelid = $1 AND a.attnum > 0 AND NOT a.attisdropped
      ORDER BY a.attnum
    `, [t.oid]);

    const pk = await c.query(`
      SELECT a.attname
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1 AND i.indisprimary
      ORDER BY array_position(i.indkey, a.attnum)
    `, [t.oid]);

    const fks = await c.query(`
      SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = $1 AND contype = 'f'
      ORDER BY conname
    `, [t.oid]);

    const checks = await c.query(`
      SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = $1 AND contype = 'c'
      ORDER BY conname
    `, [t.oid]);

    const uniques = await c.query(`
      SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = $1 AND contype = 'u'
      ORDER BY conname
    `, [t.oid]);

    let ddl = "CREATE TABLE public." + t.relname + " (\n";
    const colLines = cols.rows.map(c => {
      let line = "  " + c.attname + " " + c.type;
      if (c.attnotnull) line += " NOT NULL";
      if (c.attidentity) line += " GENERATED ALWAYS AS IDENTITY";
      else if (c.atthasdef && c.def) line += " DEFAULT " + c.def;
      return line;
    });
    if (pk.rows.length) {
      colLines.push("  PRIMARY KEY (" + pk.rows.map(r => r.attname).join(", ") + ")");
    }
    for (const u of uniques.rows) {
      if (!u.def.includes("PRIMARY KEY")) colLines.push("  " + u.def.replace(/^CONSTRAINT\s+/, ""));
    }
    for (const chk of checks.rows) colLines.push("  " + chk.def.replace(/^CONSTRAINT\s+/, ""));
    for (const fk of fks.rows) colLines.push("  " + fk.def.replace(/^CONSTRAINT\s+/, ""));
    ddl += colLines.join(",\n");
    ddl += "\n);";
    out.push(ddl);
    out.push("");
  }

  // 3. Indexes (non-primary, non-unique already covered by constraints)
  const indexes = await c.query(`
    SELECT c2.relname AS index_name, pg_get_indexdef(i.indexrelid) AS def
    FROM pg_index i
    JOIN pg_class c1 ON c1.oid = i.indrelid
    JOIN pg_class c2 ON c2.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c1.relnamespace
    WHERE n.nspname = 'public' AND NOT i.indisprimary AND NOT i.indisunique
    ORDER BY c1.relname, c2.relname
  `);
  for (const row of indexes.rows) {
    out.push(row.def + ";");
  }
  if (indexes.rows.length) out.push("");

  // 4. Functions
  const funcs = await c.query(`
    SELECT pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
    ORDER BY p.proname
  `);
  for (const row of funcs.rows) {
    out.push(row.def + ";");
    out.push("");
  }

  // 5. Triggers
  const triggers = await c.query(`
    SELECT tg.tgname, c.relname AS table_name, pg_get_triggerdef(tg.oid) AS def
    FROM pg_trigger tg
    JOIN pg_class c ON c.oid = tg.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT tg.tgisinternal
    ORDER BY c.relname, tg.tgname
  `);
  for (const row of triggers.rows) {
    out.push(row.def + ";");
  }
  if (triggers.rows.length) out.push("");

  // 6. Policies (use pg_get_expr to convert parse trees to SQL)
  const policies = await c.query(`
    SELECT pol.polname, c.relname AS table_name, pol.polrelid,
           pol.polcmd, pol.polpermissive, pol.polroles,
           pg_get_expr(pol.polqual, pol.polrelid) AS qual_sql,
           pg_get_expr(pol.polwithcheck, pol.polrelid) AS withcheck_sql,
           array_agg(r.rolname) AS roles
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_roles r ON r.oid = ANY(pol.polroles)
    WHERE n.nspname = 'public'
    GROUP BY pol.polname, c.relname, pol.polrelid, pol.polcmd, pol.polpermissive, pol.polroles, pol.polqual, pol.polwithcheck
    ORDER BY c.relname, pol.polname
  `);
  for (const row of policies.rows) {
    const cmdMap = { 'r': 'SELECT', 'a': 'INSERT', 'w': 'UPDATE', 'd': 'DELETE', '*': 'ALL' };
    const cmd = cmdMap[row.polcmd] || 'ALL';
    const permissive = row.polpermissive ? 'PERMISSIVE' : 'RESTRICTIVE';
    const rolesStr = row.roles || "";
    const roles = rolesStr.replace(/[{}]/g, "").split(",").filter(x => x && x !== "NULL").join(", ") || 'PUBLIC';
    // Quote policy name if it contains spaces or special chars
    const policyName = /^[A-Za-z_][A-Za-z0-9_]*$/.test(row.polname) ? row.polname : '"' + row.polname.replace(/"/g, '""') + '"';
    let sql = "CREATE POLICY " + policyName + " ON public." + row.table_name;
    sql += " AS " + permissive + " FOR " + cmd;
    sql += " TO " + roles;
    if (row.qual_sql) sql += " USING (" + row.qual_sql + ")";
    if (row.withcheck_sql) sql += " WITH CHECK (" + row.withcheck_sql + ")";
    out.push(sql + ";");
  }
  if (policies.rows.length) out.push("");

  // 6b. RLS enable (after policies, before grants)
  const rlsTables = await c.query(`
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
    ORDER BY c.relname
  `);
  for (const row of rlsTables.rows) {
    out.push("ALTER TABLE public." + row.table_name + " ENABLE ROW LEVEL SECURITY;");
  }
  if (rlsTables.rows.length) out.push("");

  // 7. Grants (non-default)
  const grants = await c.query(`
    SELECT 'GRANT ' || string_agg(privilege_type, ', ') || ' ON ' || table_name || ' TO ' || grantee || ';' AS def
    FROM information_schema.table_privileges
    WHERE table_schema = 'public' AND grantee NOT IN ('postgres', 'PUBLIC')
    GROUP BY table_name, grantee
    ORDER BY table_name, grantee
  `);
  for (const row of grants.rows) {
    out.push(row.def);
  }
  if (grants.rows.length) out.push("");

  // Write
  const schemaDir = path.join(__dirname, "..", "schema");
  if (!fs.existsSync(schemaDir)) fs.mkdirSync(schemaDir, { recursive: true });
  const outPath = path.join(schemaDir, "baseline.sql");
  fs.writeFileSync(outPath, out.join("\n") + "\n");
  console.log("Written to", outPath, "(" + out.length + " lines)");

  await c.end();
}

main().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});