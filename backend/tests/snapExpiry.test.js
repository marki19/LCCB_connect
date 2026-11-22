require("./env.helper");

const { describe, it, before, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const db = require("../db");
const snapModel = require("../models/snapModel");
const { cleanupExpiredSnaps } = require("../scripts/cleanup-expired-snaps");

/**
 * Replaces the three maintenance queries with an in-memory backlog, so the
 * sweep's ordering and failure handling are tested without touching the real
 * `snaps` table.
 */
function stubExpiredSnaps(rows) {
  const originals = {
    listExpiredSnaps: snapModel.listExpiredSnaps,
    countExpiredSnaps: snapModel.countExpiredSnaps,
    purgeSnapRows: snapModel.purgeSnapRows,
  };

  let pending = rows.map((row) => ({ ...row }));
  const purged = [];

  snapModel.countExpiredSnaps = async () => pending.length;
  snapModel.listExpiredSnaps = async (limit) => pending.slice(0, limit);
  snapModel.purgeSnapRows = async (ids) => {
    purged.push(...ids);
    pending = pending.filter((row) => !ids.includes(row.id));
    return ids.length;
  };

  return {
    purged,
    remaining: () => pending,
    restore() {
      Object.assign(snapModel, originals);
    },
  };
}

/** Counts deletions and can reject chosen keys, like a flaky bucket. */
function fakeStore({ configured = true, failOn = [] } = {}) {
  const deleted = [];
  return {
    deleted,
    isConfigured: () => configured,
    async deleteObject(key) {
      if (failOn.includes(key)) throw new Error(`storage rejected ${key}`);
      deleted.push(key);
    },
  };
}

const snap = (id, key) => ({ id, media_key: key });

describe("expired snap purge", () => {
  let model;

  afterEach(() => {
    model?.restore();
    model = null;
  });

  it("purges every expired snap and its media across batches", async () => {
    model = stubExpiredSnaps([
      snap("snap-a", "snaps/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg"),
      snap("snap-b", "snaps/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.jpg"),
      snap("snap-c", "snaps/cccccccccccccccccccccccccccccccc.mp4"),
    ]);
    const store = fakeStore();

    const result = await cleanupExpiredSnaps({ batchSize: 2, store });

    assert.deepEqual(result, { snaps: 3, objects: 3, failures: 0 });
    assert.deepEqual(model.purged, ["snap-a", "snap-b", "snap-c"]);
    assert.deepEqual(store.deleted, [
      "snaps/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg",
      "snaps/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.jpg",
      "snaps/cccccccccccccccccccccccccccccccc.mp4",
    ]);
    assert.equal(model.remaining().length, 0);
  });

  it("keeps the row when its media could not be deleted", async () => {
    const badKey = "snaps/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.jpg";
    model = stubExpiredSnaps([
      snap("snap-a", "snaps/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg"),
      snap("snap-b", badKey),
    ]);
    const store = fakeStore({ failOn: [badKey] });

    const result = await cleanupExpiredSnaps({ store });

    // The object was never deleted, so the row stays for the next run.
    assert.deepEqual(model.purged, ["snap-a"]);
    assert.deepEqual(model.remaining(), [snap("snap-b", badKey)]);
    assert.deepEqual(store.deleted, ["snaps/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg"]);
    assert.equal(result.failures, 1);
    assert.equal(result.snaps, 1);
  });

  it("deletes nothing on a dry run", async () => {
    model = stubExpiredSnaps([snap("snap-a", "snaps/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg")]);
    const store = fakeStore();

    const result = await cleanupExpiredSnaps({ dryRun: true, store });

    assert.deepEqual(result, { snaps: 0, objects: 0, failures: 0 });
    assert.deepEqual(model.purged, []);
    assert.deepEqual(store.deleted, []);
  });

  it("refuses to purge rows when storage is not configured", async () => {
    model = stubExpiredSnaps([snap("snap-a", "snaps/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg")]);
    const store = fakeStore({ configured: false });

    await assert.rejects(
      () => cleanupExpiredSnaps({ store }),
      /storage is not configured/i
    );
    assert.deepEqual(model.purged, []);
    assert.deepEqual(store.deleted, []);
  });

  it("does nothing when no snap has expired", async () => {
    model = stubExpiredSnaps([]);
    const store = fakeStore();

    const result = await cleanupExpiredSnaps({ store });

    assert.deepEqual(result, { snaps: 0, objects: 0, failures: 0 });
    assert.deepEqual(store.deleted, []);
  });
});

/**
 * The sweep's own queries, exercised against the real table. The stubs above
 * prove the orchestration; these prove the SQL.
 */
describe("expired snap queries", () => {
  const suffix = Math.floor(100000 + Math.random() * 899999);
  const authorId = `snap_purge_${suffix}`;
  let expiredId;
  let activeId;

  before(async () => {
    await db.query(
      `INSERT INTO public.profiles (id, username, full_name, role, course, student_id)
       VALUES ($1, $2, 'Purge Test', 'student', 'BSCS', 'ID_' || $1)`,
      [authorId, `${authorId}_u`]
    );

    const expired = await db.query(
      `INSERT INTO public.snaps (author_id, media_key, media_type, visibility, expires_at)
       VALUES ($1, 'snaps/11111111111111111111111111111111.jpg', 'image', 'public', NOW() - INTERVAL '1 hour')
       RETURNING id`,
      [authorId]
    );
    expiredId = expired.rows[0].id;

    const active = await db.query(
      `INSERT INTO public.snaps (author_id, media_key, media_type, visibility, expires_at)
       VALUES ($1, 'snaps/22222222222222222222222222222222.jpg', 'image', 'public', NOW() + INTERVAL '1 hour')
       RETURNING id`,
      [authorId]
    );
    activeId = active.rows[0].id;
  });

  after(async () => {
    await db.query(`DELETE FROM public.profiles WHERE id = $1`, [authorId]);
  });

  it("lists and counts only snaps past expiry", async () => {
    const rows = await snapModel.listExpiredSnaps(5000);
    const ids = rows.map((row) => row.id);

    assert.ok(ids.includes(expiredId), "expired snap is listed");
    assert.ok(!ids.includes(activeId), "active snap is not listed");
    assert.ok((await snapModel.countExpiredSnaps()) >= 1);
  });

  it("deletes the row and cascades its views", async () => {
    await db.query(`INSERT INTO public.snap_views (snap_id, viewer_id) VALUES ($1, $2)`, [
      expiredId,
      authorId,
    ]);

    assert.equal(await snapModel.purgeSnapRows([expiredId]), 1);

    const snapLeft = await db.query(`SELECT 1 FROM public.snaps WHERE id = $1`, [expiredId]);
    assert.equal(snapLeft.rowCount, 0);

    const viewsLeft = await db.query(`SELECT 1 FROM public.snap_views WHERE snap_id = $1`, [
      expiredId,
    ]);
    assert.equal(viewsLeft.rowCount, 0);

    const activeLeft = await db.query(`SELECT 1 FROM public.snaps WHERE id = $1`, [activeId]);
    assert.equal(activeLeft.rowCount, 1);
  });

  it("treats an empty id list as a no-op", async () => {
    assert.equal(await snapModel.purgeSnapRows([]), 0);
  });
});
