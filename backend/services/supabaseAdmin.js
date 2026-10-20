const { createClient } = require("@supabase/supabase-js");

/**
 * Server-only Supabase client using the service-role key.
 *
 * The key is optional at boot so the app can still run read-only features in
 * environments that do not configure it. Any account action that needs Auth
 * admin rights must call `getSupabaseAdmin()` and surface a 503 when this
 * throws. Never import this module from frontend code.
 */
class AdminAuthUnavailableError extends Error {
  constructor() {
    super("Admin auth service unavailable");
    this.name = "AdminAuthUnavailableError";
    this.code = "admin_auth_unavailable";
  }
}

let client = null;
let warned = false;

function isSupabaseAdminConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getSupabaseAdmin() {
  if (!isSupabaseAdminConfigured()) {
    if (!warned && process.env.NODE_ENV !== "test") {
      warned = true;
      console.warn(
        "[admin-auth] SUPABASE_SERVICE_ROLE_KEY is not set; account actions will return 503."
      );
    }
    throw new AdminAuthUnavailableError();
  }

  if (!client) {
    client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );
  }

  return client;
}

module.exports = {
  AdminAuthUnavailableError,
  getSupabaseAdmin,
  isSupabaseAdminConfigured,
};
