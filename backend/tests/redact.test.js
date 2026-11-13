const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  redact,
  sanitizeUrl,
  installConsoleRedactor,
} = require("../utils/redact");

describe("Log Redaction", () => {
  describe("Object and Key Redaction", () => {
    it("redacts sensitive keys at root and nested levels", () => {
      const input = {
        id: "user-123",
        email: "test@lccbonline.edu.ph",
        password: "super-secret-password",
        nested: {
          current_password: "old-password",
          token: "session-token-xyz",
          safeField: "safe-value",
          secret: "totp-secret",
          otp_code: "123456",
        },
        items: [
          { apiKey: "secret-key", name: "public-item" },
          { authorization: "Bearer custom", count: 42 },
        ],
      };

      const result = redact(input);

      assert.equal(result.id, "user-123");
      assert.equal(result.email, "test@lccbonline.edu.ph");
      assert.equal(result.password, "[REDACTED]");
      assert.equal(result.nested.current_password, "[REDACTED]");
      assert.equal(result.nested.token, "[REDACTED]");
      assert.equal(result.nested.safeField, "safe-value");
      assert.equal(result.nested.secret, "[REDACTED]");
      assert.equal(result.nested.otp_code, "[REDACTED]");
      assert.equal(result.items[0].apiKey, "[REDACTED]");
      assert.equal(result.items[0].name, "public-item");
      assert.equal(result.items[1].authorization, "[REDACTED]");
      assert.equal(result.items[1].count, 42);
    });

    it("handles circular references safely without throwing", () => {
      const circular = { id: 1, name: "circle" };
      circular.self = circular;

      const result = redact(circular);
      assert.equal(result.id, 1);
      assert.equal(result.name, "circle");
      assert.equal(result.self, "[Circular]");
    });

    it("redacts Error objects including custom properties and stack", () => {
      const fakeJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozGzETcstPMMpeP";
      const err = new Error(`Request failed with Bearer ${fakeJwt}`);
      err.password = "leaked-in-error";
      err.safeCode = 500;

      const result = redact(err);
      assert.ok(result instanceof Error);
      assert.ok(!result.message.includes(fakeJwt));
      assert.ok(result.message.includes("Bearer [REDACTED]"));
      assert.equal(result.password, "[REDACTED]");
      assert.equal(result.safeCode, 500);
    });
  });

  describe("String Pattern Redaction", () => {
    it("redacts JWT tokens in raw strings", () => {
      const raw = "User token is eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozGzETcstPMMpeP in headers";
      const result = redact(raw);
      assert.ok(!result.includes("eyJhbGciOiJIUzI1Ni"));
      assert.ok(result.includes("[REDACTED_JWT]"));
    });

    it("redacts Bearer tokens in raw strings", () => {
      const raw = "Authorization: Bearer mySecretToken123456789.abc";
      const result = redact(raw);
      assert.equal(result, "Authorization: Bearer [REDACTED]");
    });
  });

  describe("sanitizeUrl", () => {
    it("scrubs secret query parameters from URLs", () => {
      const url = "/api/auth/callback?code=secret_123&token=abc_456&state=safe_state&otp=999999";
      const sanitized = sanitizeUrl(url);
      assert.equal(
        sanitized,
        "/api/auth/callback?code=[REDACTED]&token=[REDACTED]&state=safe_state&otp=[REDACTED]"
      );
    });

    it("leaves safe URLs untouched", () => {
      const url = "/api/posts?limit=20&cursor=12345&filter=academic";
      assert.equal(sanitizeUrl(url), url);
    });
  });

  describe("installConsoleRedactor", () => {
    it("transparently sanitizes console arguments passed to target logger", () => {
      let loggedArgs = [];
      const mockConsole = {
        log: (...args) => {
          loggedArgs = args;
        },
        warn: () => {},
        error: (...args) => {
          loggedArgs = args;
        },
        info: () => {},
      };

      const uninstall = installConsoleRedactor(mockConsole);

      try {
        mockConsole.error("Failed with password:", { password: "plain-text-secret", user: "mark" });
        assert.equal(loggedArgs[0], "Failed with password:");
        assert.equal(loggedArgs[1].password, "[REDACTED]");
        assert.equal(loggedArgs[1].user, "mark");
      } finally {
        uninstall();
      }

      // After uninstall, raw values pass through
      mockConsole.error("Uninstalled:", { password: "raw-secret" });
      assert.equal(loggedArgs[1].password, "raw-secret");
    });
  });
});
