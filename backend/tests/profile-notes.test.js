require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { stub } = require("./stub.helper");

const auth = require("../middleware/auth");

let session = { id: "test-user-note-1", role: "student" };

stub(auth, "requireAuth", (req, res, next) => {
  if (!(req.headers.authorization || "").startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  req.user = { id: session.id };
  return next();
});

stub(auth, "loadProfile", (req, res, next) => {
  req.profile = { id: session.id, role: session.role };
  return next();
});

stub(auth, "requireActiveAccount", (req, res, next) => {
  return next();
});

const app = require("../app");
const { noteSchema } = require("../validation");
const userModel = require("../models/userModel");

describe("Profile Notes policy & endpoints", () => {
  beforeEach(() => {
    session = { id: "test-user-note-1", role: "student" };
  });

  it("validates note length (max 60 characters)", () => {
    const valid = noteSchema.safeParse({ note: "meet?? pass ako jn" });
    assert.equal(valid.success, true);
    assert.equal(valid.data.note, "meet?? pass ako jn");

    const validNull = noteSchema.safeParse({ note: null });
    assert.equal(validNull.success, true);

    const tooLong = noteSchema.safeParse({
      note: "This note is way too long and definitely exceeds sixty characters limit by a lot",
    });
    assert.equal(tooLong.success, false);
  });

  it("PUT /api/users/me/note rejects unauthenticated request with 401", async () => {
    const res = await request(app)
      .put("/api/users/me/note")
      .send({ note: "hello" });
    assert.equal(res.status, 401);
  });

  it("PUT /api/users/me/note updates the user note", async () => {
    const origSetNote = userModel.setNote;
    userModel.setNote = async (id, note) => ({
      id,
      username: "mark",
      full_name: "Mark Antipo",
      note,
      note_updated_at: new Date().toISOString(),
    });

    try {
      const res = await request(app)
        .put("/api/users/me/note")
        .set("Authorization", "Bearer valid-token")
        .send({ note: "meet?? pass ako jn" });

      assert.equal(res.status, 200);
      assert.equal(res.body.note, "meet?? pass ako jn");
    } finally {
      userModel.setNote = origSetNote;
    }
  });

  it("DELETE /api/users/me/note clears the user note", async () => {
    const origSetNote = userModel.setNote;
    userModel.setNote = async (id, note) => ({
      id,
      note: null,
      note_updated_at: null,
    });

    try {
      const res = await request(app)
        .delete("/api/users/me/note")
        .set("Authorization", "Bearer valid-token");

      assert.equal(res.status, 200);
      assert.equal(res.body.note, null);
    } finally {
      userModel.setNote = origSetNote;
    }
  });
});
