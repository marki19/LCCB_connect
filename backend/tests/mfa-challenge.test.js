require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const mfaService = require("../services/mfaService");

const USER = "22222222-2222-4222-8222-222222222222";
const SESSION = {
  access_token: "access-token",
  refresh_token: "refresh-token",
  expires_at: 1_700_000_000,
};

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

describe("MFA challenge tokens", () => {
  beforeEach(() => {
    mfaService._clearPendingMfaChallenges();
  });

  it("resolves a freshly issued token to its pending session", () => {
    const token = mfaService.createMfaChallenge(USER, SESSION);

    const challenge = mfaService.resolveMfaChallenge(token);
    assert.ok(challenge, "signed token resolves");
    assert.equal(challenge.userId, USER);

    const pending = mfaService.consumeMfaChallenge(challenge.jti);
    assert.deepEqual(pending, { userId: USER, session: SESSION });
  });

  it("rejects the legacy unsigned token (empty signature)", () => {
    // The old implementation returned `header.payload.` with no signature.
    const forged = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
      sub: USER,
      type: "mfa_challenge",
      jti: "attacker-chosen",
      iat: 0,
      exp: 9_999_999_999,
    })}.`;

    assert.equal(mfaService.resolveMfaChallenge(forged), null);
  });

  it("rejects a token whose payload was tampered with", () => {
    const token = mfaService.createMfaChallenge(USER, SESSION);
    const [header, , signature] = token.split(".");

    const tamperedPayload = b64({
      sub: "99999999-9999-4999-8999-999999999999",
      type: "mfa_challenge",
      jti: "attacker-chosen",
      iat: 0,
      exp: 9_999_999_999,
    });

    assert.equal(
      mfaService.resolveMfaChallenge(`${header}.${tamperedPayload}.${signature}`),
      null
    );
  });

  it("rejects an expired token", () => {
    const token = mfaService.createMfaChallenge(USER, SESSION);
    const realNow = Date.now;
    Date.now = () => realNow() + 6 * 60 * 1000; // past the 5-minute TTL
    try {
      assert.equal(mfaService.resolveMfaChallenge(token), null);
    } finally {
      Date.now = realNow;
    }
  });

  it("does not consume on resolve, and consumes only once", () => {
    const token = mfaService.createMfaChallenge(USER, SESSION);
    const first = mfaService.resolveMfaChallenge(token);
    const second = mfaService.resolveMfaChallenge(token);
    assert.ok(first && second, "resolve is repeatable while the code is retried");

    assert.ok(mfaService.consumeMfaChallenge(first.jti));
    assert.equal(mfaService.resolveMfaChallenge(token), null, "token is dead after use");
    assert.equal(mfaService.consumeMfaChallenge(first.jti), null);
  });
});
