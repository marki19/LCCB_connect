const { spawn } = require("child_process");

console.log("🚀 Starting LCCB Connect: Backend + Frontend together...\n");

// 1. Start Backend Express server
const backend = spawn("node", ["index.js"], {
  cwd: "backend",
  stdio: "inherit",
  shell: true,
});

// 2. Start Frontend Expo bundler
const frontend = spawn("npx", ["expo", "start"], {
  cwd: "frontend",
  stdio: "inherit",
  shell: true,
});

const cleanup = () => {
  try { backend.kill(); } catch {}
  try { frontend.kill(); } catch {}
  process.exit(0);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);
