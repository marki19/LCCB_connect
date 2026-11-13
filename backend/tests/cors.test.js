const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../app");
const {
  getAllowedOrigins,
  normalizeOrigin,
  createCorsOptions,
} = require("../utils/corsConfig");

describe("CORS HTTPS Enforcement", () => {
  describe("getAllowedOrigins", () => {
    it("falls back to local development origins when unset in development/test", () => {
      const origins = getAllowedOrigins({ env: "development", corsOrigins: undefined });
      assert.ok(origins.includes("http://localhost:8081"));
      assert.ok(origins.includes("http://localhost:3000"));
    });

    it("returns empty origins when unset in production (never defaults to localhost)", () => {
      const origins = getAllowedOrigins({ env: "production", corsOrigins: undefined });
      assert.deepEqual(origins, []);
    });

    it("filters out insecure http:// origins in production", () => {
      const origins = getAllowedOrigins({
        env: "production",
        corsOrigins: "https://lccbonline.edu.ph, http://insecure.com, https://admin.lccbonline.edu.ph/",
      });
      assert.deepEqual(origins, [
        "https://lccbonline.edu.ph",
        "https://admin.lccbonline.edu.ph",
      ]);
    });

    it("permits http:// origins when explicitly configured in development", () => {
      const origins = getAllowedOrigins({
        env: "development",
        corsOrigins: "http://localhost:4000, https://staging.lccbonline.edu.ph",
      });
      assert.deepEqual(origins, [
        "http://localhost:4000",
        "https://staging.lccbonline.edu.ph",
      ]);
    });
  });

  describe("createCorsOptions", () => {
    it("allows requests without an Origin header (native apps, curl)", (t, done) => {
      const cors = createCorsOptions({ env: "production", corsOrigins: "https://lccbonline.edu.ph" });
      cors.origin(undefined, (err, allow) => {
        assert.equal(err, null);
        assert.equal(allow, true);
        done();
      });
    });

    it("allows configured https origins in production", (t, done) => {
      const cors = createCorsOptions({ env: "production", corsOrigins: "https://lccbonline.edu.ph" });
      cors.origin("https://lccbonline.edu.ph", (err, allow) => {
        assert.equal(err, null);
        assert.equal(allow, true);
        done();
      });
    });

    it("blocks unconfigured origins in production", (t, done) => {
      const cors = createCorsOptions({ env: "production", corsOrigins: "https://lccbonline.edu.ph" });
      cors.origin("https://evil-attacker.com", (err, allow) => {
        assert.equal(err, null);
        assert.equal(allow, false);
        done();
      });
    });

    it("blocks insecure http origins in production", (t, done) => {
      const cors = createCorsOptions({ env: "production", corsOrigins: "http://insecure.lccbonline.edu.ph" });
      cors.origin("http://insecure.lccbonline.edu.ph", (err, allow) => {
        assert.equal(err, null);
        assert.equal(allow, false);
        done();
      });
    });
  });

  describe("Integration with Express App", () => {
    it("returns Access-Control-Allow-Origin for permitted dev origin", async () => {
      const res = await request(app)
        .get("/")
        .set("Origin", "http://localhost:8081");
      assert.equal(res.status, 200);
      assert.equal(res.headers["access-control-allow-origin"], "http://localhost:8081");
    });

    it("omits Access-Control-Allow-Origin for unlisted origin", async () => {
      const res = await request(app)
        .get("/")
        .set("Origin", "https://unauthorized-domain.com");
      assert.equal(res.status, 200);
      assert.equal(res.headers["access-control-allow-origin"], undefined);
    });
  });
});

