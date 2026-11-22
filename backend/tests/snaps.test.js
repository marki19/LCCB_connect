require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { stub } = require("./stub.helper");

const auth = require("../middleware/auth");

let session = { id: "test-user-snap-1", role: "student", verified: true };

stub(auth, "requireAuth", (req, res, next) => {
  if (!(req.headers.authorization || "").startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  req.user = { id: session.id };
  return next();
});

// `requireVerified` is deliberately NOT stubbed: the guest read-only rule is
// enforced by that middleware, so these tests must exercise the real one.
stub(auth, "loadProfile", (req, res, next) => {
  req.profile = {
    id: session.id,
    role: session.role,
    department_id: "00000000-0000-0000-0000-000000000001",
    verification_status: session.verified ? "verified" : "pending",
  };
  return next();
});

stub(auth, "requireActiveAccount", (req, res, next) => {
  return next();
});

const app = require("../app");
const snapModel = require("../models/snapModel");
const snapCommentModel = require("../models/snapCommentModel");

describe("Quick Snap endpoints", () => {
  beforeEach(() => {
    session = { id: "test-user-snap-1", role: "student", verified: true };
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
          media_key: "snaps/9f83ab24e10c71a39bd5e0a1b2c3d4e5.jpg",
          media_type: "image",
          caption: "Chilling on campus",
          visibility: "friends",
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.id, "snap-123");
      assert.equal(res.body.media_key, "snaps/9f83ab24e10c71a39bd5e0a1b2c3d4e5.jpg");
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
    const origVisible = snapModel.isSnapVisible;
    snapModel.isSnapVisible = async () => true;
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
      snapModel.isSnapVisible = origVisible;
    }
  });

  it("POST /api/snaps/:id/react records reaction", async () => {
    const origRecordReaction = snapModel.recordReaction;
    const origVisible = snapModel.isSnapVisible;
    snapModel.isSnapVisible = async () => true;
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
      snapModel.isSnapVisible = origVisible;
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

describe("Quick Snap guest read-only rule", () => {
  beforeEach(() => {
    session = { id: "test-guest-1", role: "guest", verified: false };
  });

  it("refuses a guest creating a snap", async () => {
    const res = await request(app)
      .post("/api/snaps")
      .set("Authorization", "Bearer token")
      .send({ media_key: "snaps/9f83ab24e10c71a39bd5e0a1b2c3d4e5.jpg", media_type: "image" });

    assert.equal(res.status, 403);
    assert.equal(res.body.code, "guest_read_only");
  });

  it("refuses a guest reacting to a snap", async () => {
    const res = await request(app)
      .post("/api/snaps/snap-123/react")
      .set("Authorization", "Bearer token")
      .send({ reaction: "heart" });

    assert.equal(res.status, 403);
  });

  it("refuses a guest removing a reaction", async () => {
    const res = await request(app)
      .delete("/api/snaps/snap-123/react")
      .set("Authorization", "Bearer token");

    assert.equal(res.status, 403);
  });

  it("refuses a guest deleting a snap", async () => {
    const res = await request(app)
      .delete("/api/snaps/snap-123")
      .set("Authorization", "Bearer token");

    assert.equal(res.status, 403);
  });

  it("refuses a guest recording a view", async () => {
    const res = await request(app)
      .post("/api/snaps/snap-123/view")
      .set("Authorization", "Bearer token");

    assert.equal(res.status, 403);
  });

  it("still lets a guest read the rail", async () => {
    const origGetRail = snapModel.getRailSnaps;
    snapModel.getRailSnaps = async () => [];

    try {
      const res = await request(app)
        .get("/api/snaps/rail")
        .set("Authorization", "Bearer token");

      assert.equal(res.status, 200);
    } finally {
      snapModel.getRailSnaps = origGetRail;
    }
  });
});

describe("Quick Snap media_key contract", () => {
  const validKey = "snaps/9f83ab24e10c71a39bd5e0a1b2c3d4e5.jpg";

  beforeEach(() => {
    session = { id: "test-user-snap-3", role: "student", verified: true };
  });

  async function postSnap(mediaKey) {
    return request(app)
      .post("/api/snaps")
      .set("Authorization", "Bearer token")
      .send({ media_key: mediaKey, media_type: "image" });
  }

  it("rejects an external URL, so a snap cannot point off-platform", async () => {
    const res = await postSnap("https://tracker.example/pixel.jpg");
    assert.equal(res.status, 400);
  });

  it("rejects a key from another category", async () => {
    const res = await postSnap("posts/9f83ab24e10c71a39bd5e0a1b2c3d4e5.jpg");
    assert.equal(res.status, 400);
  });

  it("rejects a traversal key", async () => {
    const res = await postSnap("snaps/../../../etc/passwd");
    assert.equal(res.status, 400);
  });

  it("accepts a generated snaps key", async () => {
    const origCreate = snapModel.createSnap;
    snapModel.createSnap = async (args) => ({ id: "snap-1", media_key: args.mediaKey });

    try {
      const res = await postSnap(validKey);
      assert.equal(res.status, 201);
    } finally {
      snapModel.createSnap = origCreate;
    }
  });
});

describe("Quick Snap write visibility", () => {
  beforeEach(() => {
    session = { id: "test-user-snap-2", role: "student", verified: true };
  });

  async function withVisibility(visible, fn) {
    const orig = snapModel.isSnapVisible;
    snapModel.isSnapVisible = async () => visible;
    try {
      return await fn();
    } finally {
      snapModel.isSnapVisible = orig;
    }
  }

  it("returns 404 when viewing a snap the caller cannot see", async () => {
    const res = await withVisibility(false, () =>
      request(app).post("/api/snaps/snap-hidden/view").set("Authorization", "Bearer token")
    );
    assert.equal(res.status, 404);
  });

  it("records a view for a visible snap", async () => {
    const orig = snapModel.recordView;
    snapModel.recordView = async (snapId, viewerId) => ({ snap_id: snapId, viewer_id: viewerId });
    try {
      const res = await withVisibility(true, () =>
        request(app).post("/api/snaps/snap-1/view").set("Authorization", "Bearer token")
      );
      assert.equal(res.status, 200);
    } finally {
      snapModel.recordView = orig;
    }
  });

  it("returns 404 when reacting to a snap the caller cannot see", async () => {
    const res = await withVisibility(false, () =>
      request(app)
        .post("/api/snaps/snap-hidden/react")
        .set("Authorization", "Bearer token")
        .send({ reaction: "heart" })
    );
    assert.equal(res.status, 404);
  });

  it("returns 404 when removing a reaction from a snap the caller cannot see", async () => {
    const res = await withVisibility(false, () =>
      request(app).delete("/api/snaps/snap-hidden/react").set("Authorization", "Bearer token")
    );
    assert.equal(res.status, 404);
  });
});

describe("Quick Snap comments", () => {
  beforeEach(() => {
    session = { id: "test-user-snap-4", role: "student", verified: true };
  });

  const comment = {
    id: "comment-1",
    snap_id: "snap-1",
    author_id: "test-user-snap-4",
    parent_id: null,
    body: "Nice shot",
    created_at: "2026-11-20T10:00:00.000Z",
    username: "mark",
    full_name: "Mark Rivera",
    avatar_url: "avatars/abc.jpg",
  };

  async function withVisibility(visible, fn) {
    const orig = snapModel.isSnapVisible;
    snapModel.isSnapVisible = async () => visible;
    try {
      return await fn();
    } finally {
      snapModel.isSnapVisible = orig;
    }
  }

  it("lists comments on a visible snap", async () => {
    const orig = snapCommentModel.listComments;
    snapCommentModel.listComments = async () => [comment];

    try {
      const res = await withVisibility(true, () =>
        request(app).get("/api/snaps/snap-1/comments").set("Authorization", "Bearer token")
      );

      assert.equal(res.status, 200);
      assert.equal(res.body.comments.length, 1);
      assert.equal(res.body.comments[0].body, "Nice shot");
    } finally {
      snapCommentModel.listComments = orig;
    }
  });

  it("returns 404 when the snap is not visible", async () => {
    const res = await withVisibility(false, () =>
      request(app).get("/api/snaps/snap-hidden/comments").set("Authorization", "Bearer token")
    );
    assert.equal(res.status, 404);
  });

  it("refuses a guest writing a comment", async () => {
    session = { id: "test-guest-2", role: "guest", verified: false };

    const res = await request(app)
      .post("/api/snaps/snap-1/comments")
      .set("Authorization", "Bearer token")
      .send({ body: "hello" });

    assert.equal(res.status, 403);
    assert.equal(res.body.code, "guest_read_only");
  });

  it("creates a comment", async () => {
    const orig = snapCommentModel.createComment;
    snapCommentModel.createComment = async (args) => ({
      ...comment,
      body: args.body,
      parent_id: args.parentId,
    });

    try {
      const res = await withVisibility(true, () =>
        request(app)
          .post("/api/snaps/snap-1/comments")
          .set("Authorization", "Bearer token")
          .send({ body: "  Nice shot  " })
      );

      assert.equal(res.status, 201);
      assert.equal(res.body.body, "Nice shot");
    } finally {
      snapCommentModel.createComment = orig;
    }
  });

  it("rejects an empty comment", async () => {
    const res = await request(app)
      .post("/api/snaps/snap-1/comments")
      .set("Authorization", "Bearer token")
      .send({ body: "   " });

    assert.equal(res.status, 400);
  });

  it("rejects a parent that is not a top-level comment on this snap", async () => {
    const orig = snapCommentModel.parentIsTopLevelOfSnap;
    snapCommentModel.parentIsTopLevelOfSnap = async () => false;

    try {
      const res = await withVisibility(true, () =>
        request(app)
          .post("/api/snaps/snap-1/comments")
          .set("Authorization", "Bearer token")
          .send({ body: "replying", parent_id: "00000000-0000-4000-8000-000000000002" })
      );

      assert.equal(res.status, 400);
      assert.match(res.body.error, /parent/i);
    } finally {
      snapCommentModel.parentIsTopLevelOfSnap = orig;
    }
  });

  it("accepts a reply to a top-level comment", async () => {
    const parentId = "00000000-0000-4000-8000-000000000002";
    const origParent = snapCommentModel.parentIsTopLevelOfSnap;
    const origCreate = snapCommentModel.createComment;
    snapCommentModel.parentIsTopLevelOfSnap = async () => true;
    snapCommentModel.createComment = async (args) => ({ ...comment, parent_id: args.parentId });

    try {
      const res = await withVisibility(true, () =>
        request(app)
          .post("/api/snaps/snap-1/comments")
          .set("Authorization", "Bearer token")
          .send({ body: "replying", parent_id: parentId })
      );

      assert.equal(res.status, 201);
      assert.equal(res.body.parent_id, parentId);
    } finally {
      snapCommentModel.parentIsTopLevelOfSnap = origParent;
      snapCommentModel.createComment = origCreate;
    }
  });
});
