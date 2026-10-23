#!/usr/bin/env node
/**
 * Prints every HTTP route mounted by backend/app.js.
 *
 * Why this exists: docs/BACKEND_CONTRACT.md is written by hand, and a hand-
 * written route list drifts. Run this after changing a router and diff the
 * output against the contract.
 *
 * Usage:
 *   node scripts/list-routes.js           # human-readable, grouped by mount
 *   node scripts/list-routes.js --json    # machine-readable array
 *
 * No database connection is made. Placeholder Supabase env values are used
 * only when backend/.env is absent, because app.js constructs a client at
 * require time.
 */

const path = require("path");
const fs = require("fs");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

if (!process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = "https://placeholder.supabase.co";
}
if (!process.env.SUPABASE_ANON_KEY) {
  process.env.SUPABASE_ANON_KEY = "placeholder";
}

const express = require("express");

// --- record mounts and direct app routes ------------------------------------
// Express 5 drops the mount path from the layer, so intercept `app.use`
// before app.js builds the app. The same app instance and middleware chain
// are used, so the output reflects what actually serves traffic.

const mounts = [];
const directRoutes = [];
const ROUTE_METHODS = ["get", "post", "put", "patch", "delete"];

const originalUse = express.application.use;
express.application.use = function (mountPath, ...handlers) {
  if (typeof mountPath === "string") {
    const router = handlers.find(
      (handler) => typeof handler === "function" && Array.isArray(handler.stack)
    );
    if (router) mounts.push({ mountPath, router });
  }
  return originalUse.apply(this, arguments);
};

const originalRouteMethods = {};
for (const method of ROUTE_METHODS) {
  originalRouteMethods[method] = express.application[method];
  express.application[method] = function (routePath, ...handlers) {
    // app.get("env") is a settings read, not a route.
    if (typeof routePath === "string") {
      directRoutes.push({ method: method.toUpperCase(), path: routePath });
    }
    return originalRouteMethods[method].apply(this, arguments);
  };
}

// db.js reads backend/certs/supabase-root-2021.crt at require time. The cert
// is not guaranteed to exist on a fresh clone, and this script never opens a
// connection, so substitute a placeholder CA only when the file is absent.
const certPath = path.join(__dirname, "..", "certs", "supabase-root-2021.crt");
const originalReadFileSync = fs.readFileSync;
const certMissing = !fs.existsSync(certPath);
if (certMissing) {
  fs.readFileSync = function (file, ...args) {
    if (path.resolve(String(file)) === path.resolve(certPath)) {
      return "-----BEGIN CERTIFICATE-----\nROUTE-INDEX-PLACEHOLDER\n-----END CERTIFICATE-----\n";
    }
    return originalReadFileSync.call(this, file, ...args);
  };
}

let app;
try {
  app = require("../app");
} finally {
  if (certMissing) fs.readFileSync = originalReadFileSync;
}

// Restore the prototypes so requiring this file twice cannot stack wrappers.
express.application.use = originalUse;
for (const method of ROUTE_METHODS) {
  express.application[method] = originalRouteMethods[method];
}

// --- walk routers -----------------------------------------------------------

const joinPath = (prefix, routePath) => {
  const joined = `${prefix}/${routePath}`.replace(/\/+/g, "/");
  return joined !== "/" && joined.endsWith("/") ? joined.slice(0, -1) : joined;
};

function walkRouter(router, prefix, out) {
  for (const layer of router.stack) {
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) {
        out.push({
          method: method.toUpperCase(),
          path: joinPath(prefix, layer.route.path),
        });
      }
    } else if (layer.name === "router" && layer.handle?.stack) {
      // Nested router without a recorded mount: keep its parent prefix. None
      // of the current routers nest, but this keeps the tool honest if one
      // does later.
      walkRouter(layer.handle, prefix, out);
    }
  }
}

const routes = [...directRoutes];
for (const { mountPath, router } of mounts) {
  walkRouter(router, mountPath, routes);
}

// A path can be mounted by two routers (e.g. /api/users serves profiles and
// social settings). Only an identical method+path is a duplicate.
const unique = new Map();
for (const route of routes) {
  unique.set(`${route.method} ${route.path}`, route);
}
const sorted = [...unique.values()].sort(
  (a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method)
);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(sorted, null, 2));
  process.exit(0);
}

const grouped = new Map();
for (const route of sorted) {
  const mount = mounts.find(
    ({ mountPath }) =>
      route.path === mountPath || route.path.startsWith(`${mountPath}/`)
  );
  // Prefer the most specific mount (the old /api rate-limit mount would
  // otherwise swallow every route).
  const specific = [...mounts]
    .filter(
      ({ mountPath }) =>
        route.path === mountPath || route.path.startsWith(`${mountPath}/`)
    )
    .sort((a, b) => b.mountPath.length - a.mountPath.length)[0];
  const key = specific?.mountPath || (mount ? mount.mountPath : "(app)");
  if (!grouped.has(key)) grouped.set(key, []);
  grouped.get(key).push(route);
}

console.log(`LCCB Connect — ${sorted.length} routes\n`);
for (const [mount, list] of [...grouped.entries()].sort((a, b) =>
  a[0].localeCompare(b[0])
)) {
  console.log(mount);
  for (const route of list) {
    console.log(`  ${route.method.padEnd(6)} ${route.path}`);
  }
  console.log("");
}
