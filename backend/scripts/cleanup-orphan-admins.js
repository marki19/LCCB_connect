#!/usr/bin/env node
//
// One-shot cleanup: delete orphan profiles (role = admin/superadmin with no
// matching auth.users row) left behind by test residue.
//
// Usage:
//   node scripts/cleanup-orphan-admins.js            # report only
//   node scripts/cleanup-orphan-admins.js --delete   # actually delete
//
"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const db = require("../db");

const DELETE = process.argv.includes("--delete");

async function main() {
  // Orphan = profile row whose id does not exist in auth.users.
  // Restricted to admin/superadmin roles because those are the ones the
  // verification.test.js suite creates without an Auth user and never cleans up.
  const sql = `
    SELECT p.id, p.email, p.role, p.created_at
    FROM public.profiles p
    WHERE p.role IN ('admin', 'superadmin', 'departmentAdmin', 'department_admin')
      AND NOT EXISTS (
        SELECT 1 FROM auth.users u WHERE u.id::text = p.id
      )
    ORDER BY p.created_at ASC
  `;

  const { rows } = await db.query(sql);

  if (rows.length === 0) {
    console.log("No orphan admin profiles found. Nothing to do.");
    return;
  }

  console.log(`Found ${rows.length} orphan admin profile(s):`);
  for (const r of rows) {
    console.log(
      `  ${r.id}  ${r.email ?? "(no email)"}  role=${r.role}  created=${r.created_at.toISOString()}`
    );
  }

  if (!DELETE) {
    console.log("\nDry run. Re-run with --delete to remove them.");
    return;
  }

  // Delete in dependency-safe order: verification requests reference profiles
  // (ON DELETE CASCADE handles them), but be explicit to be safe.
  const ids = rows.map((r) => r.id);
  await db.query(
    `DELETE FROM public.profile_verification_requests WHERE user_id = ANY($1::text[])`,
    [ids]
  );
  await db.query(`DELETE FROM public.profiles WHERE id = ANY($1::text[])`, [ids]);

  console.log(`\nDeleted ${rows.length} orphan profile(s).`);
}

main().catch((err) => {
  console.error("cleanup-orphan-admins failed:", err.message);
  process.exit(1);
});