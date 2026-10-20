require("dotenv").config();

// --- boot-time environment validation (fail fast) ---------------------------
const REQUIRED_ENV = ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_ANON_KEY"];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`[boot] Missing required environment variable(s): ${missingEnv.join(", ")}`);
  console.error("[boot] Copy backend/.env.example to backend/.env and fill in the values.");
  process.exit(1);
}

// Required only after the environment is validated: `app` reads env at load
// time (Supabase client, CORS origins, rate limits, validation URL prefix).
const app = require("./app");
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
