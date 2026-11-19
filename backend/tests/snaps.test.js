require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { stub } = require("./stub.helper");

const auth = require("../middleware/auth");

let session = { id: "test-user-snap-1", role: "student" };

stub(auth, "requireAuth", (req, res, next) => {
  if (!(req.headers.authorization || "").startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  req.user = { id: session.id };
  return next();
});

stub(auth, "loadProfile", (req, res, next) => {
  req.profile = { id: session.id, role: session.role, department_id: "00000000-0000-0000-0000-000000000001" };
  return next();
});

stub(auth, "requireActiveAccount", (req, res, next) => {
  return next();
});

const app = require("../app");
const snapModel = require("../models/snapModel");

describe("Quick Snap endpoints", () => {
  beforeEach(() => {
    session = { id: "test-user-snap-1", role: "student" };
  });

  it("POST /api/snaps rejects unauthenticated request with 401", async () => {
    const res = await request(app)
      .post("/api/snaps")
      .send({ media_key: "snaps/test.jpg", media_type: "image" });
    assert.equal(res.status, 401);
  });

  it("POST /api/snaps validates required fields", async () => {
    const res = await request(app)
      .post("/api/snaps")
      .set("Authorization", "Bearer token")
      .send({});
    assert.equal(res.status, 400);
  });

  it("POST /api/snaps creates a snap", async () => {
    const origCreate = snapModel.createSnap;
    snapModel.createSnap = async (args) => ({
      id: "snap-123",
      author_id: args.authorId,
      media_key: args.mediaKey,
      media_type: args.mediaType,
      caption: args.caption,
      visibility: args.visibility,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    });

    try {
      const res = await request(app)
        .post("/api/snaps")
        .set("Authorization", "Bearer token")
        .send({
          media_key: "snaps/photo.jpg",
          media_type: "image",
          caption: "Chilling on campus",
          visibility: "friends",
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.id, "snap-123");
      assert.equal(res.body.media_key, "snaps/photo.jpg");
      assert.equal(res.body.caption, "Chilling on campus");
    } finally {
      snapModel.createSnap = origCreate;
    }
  });

  it("GET /api/snaps/rail returns grouped rail", async () => {
    const origGetRail = snapModel.getRailSnaps;
    snapModel.getRailSnaps = async (viewerId) => [
      {
        author_id: viewerId,
        username: "myself",
        full_name: "My Self",
        avatar_url: null,
        has_unviewed: false,
        snaps: [
          { id: "snap-1", media_key: "snaps/1.jpg", is_viewed: true },
        ],
      },
    ];

    try {
      const res = await request(app)
        .get("/api/snaps/rail")
        .set("Authorization", "Bearer token");

      assert.equal(res.status, 200);
      assert.equal(Array.isArray(res.body), true);
      assert.equal(res.body.length, 1);
      assert.equal(res.body[0].author_id, session.id);
    } finally {
      snapModel.getRailSnaps = origGetRail;
    }
  });

  it("POST /api/snaps/:id/view records snap view", async () => {
    const origRecordView = snapModel.recordView;
    snapModel.recordView = async (snapId, viewerId) => ({
      snap_id: snapId,
      viewer_id: viewerId,
    });

    try {
      const res = await request(app)
        .post("/api/snaps/snap-123/view")
        .set("Authorization", "Bearer token");

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    } finally {
      snapModel.recordView = origRecordView;
    }
  });

  it("POST /api/snaps/:id/react records reaction", async () => {
    const origRecordReaction = snapModel.recordReaction;
    snapModel.recordReaction = async (snapId, userId, reaction) => ({
      id: "react-1",
      snap_id: snapId,
      user_id: userId,
      reaction,
    });

    try {
      const res = await request(app)
        .post("/api/snaps/snap-123/react")
        .set("Authorization", "Bearer token")
        .send({ reaction: "heart" });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.reaction.reaction, "heart");
    } finally {
      snapModel.recordReaction = origRecordReaction;
    }
  });

  it("DELETE /api/snaps/:id deletes a snap", async () => {
    const origDelete = snapModel.deleteSnap;
    snapModel.deleteSnap = async (snapId, authorId) => ({
      id: snapId,
      author_id: authorId,
    });

    try {
      const res = await request(app)
        .delete("/api/snaps/snap-123")
        .set("Authorization", "Bearer token");

      assert.equal(res.status, 200);
      assert.equal(res.body.id, "snap-123");
    } finally {
      snapModel.deleteSnap = origDelete;
    }
  });
});
