// Limiter behaviour is exercised against a real Express app. Each test file
// runs in its own process, so tuning the env here cannot leak into other suites.
process.env.NODE_ENV = "test";
process.env.RATE_LIMIT_MFA_CHALLENGE_MAX = "2";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");

const { perUserLimiter } = require("../middleware/actionLimits");
const { mfaChallengeLimiter } = require("../middleware/loginLimits");

function buildApp(limiter) {
  const app = express();
  app.use(express.json());
  app.post(
    "/probe",
    (req, res, next) => {
      if (req.headers["x-user"]) req.user = { id: req.headers["x-user"] };
      next();
    },
    limiter,
    (req, res) => res.json({ ok: true })
  );
  return app;
}

describe("per-user action limiters", () => {
  it("blocks one user without touching another user's budget", async () => {
    const app = buildApp(
      perUserLimiter({ windowMs: 60_000, limit: 2, message: "slow down" })
    );

    const hit = (user) =>
      request(app).post("/probe").set("x-user", user).send({});

    assert.equal((await hit("user-a")).status, 200);
    assert.equal((await hit("user-a")).status, 200);

    const blocked = await hit("user-a");
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.error, "slow down");

    assert.equal((await hit("user-b")).status, 200, "user B keeps its own budget");
  });
});

describe("MFA challenge limiter", () => {
  it("keys on the challenge token, so one token cannot be brute forced", async () => {
    const app = buildApp(mfaChallengeLimiter);
    const attempt = (token) =>
      request(app).post("/probe").send({ challenge_token: token, code: "000000" });

    assert.equal((await attempt("token-1")).status, 200);
    assert.equal((await attempt("token-1")).status, 200);
    assert.equal((await attempt("token-1")).status, 429);

    assert.equal(
      (await attempt("token-2")).status,
      200,
      "a different challenge gets its own budget"
    );
  });
});
