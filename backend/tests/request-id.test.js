const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../app");

describe("X-Request-ID", () => {
  it("generates a request ID when none is provided", async () => {
    const res = await request(app).get("/");
    assert.ok(res.headers["x-request-id"]);
    assert.match(res.headers["x-request-id"], /^[0-9a-f-]{36}$/);
  });

  it("echoes a provided X-Request-ID", async () => {
    const id = "test-req-id-12345";
    const res = await request(app).get("/").set("X-Request-ID", id);
    assert.equal(res.headers["x-request-id"], id);
  });

  it("includes requestId in 404 error responses", async () => {
    const res = await request(app).get("/nonexistent");
    assert.equal(res.status, 404);
    assert.ok(res.body.requestId);
    assert.equal(res.body.requestId, res.headers["x-request-id"]);
  });
});

