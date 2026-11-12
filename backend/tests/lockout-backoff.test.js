const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { LOCKOUT_THRESHOLD, lockoutIntervalFor } = require("../utils/lockout");

describe("lockoutIntervalFor", () => {
  it("does not lock below the threshold", () => {
    for (let attempts = 0; attempts < LOCKOUT_THRESHOLD; attempts += 1) {
      assert.equal(lockoutIntervalFor(attempts), null);
    }
  });

  it("locks for one minute at the threshold", () => {
    assert.equal(lockoutIntervalFor(5), "1 minute");
    assert.equal(lockoutIntervalFor(7), "1 minute");
  });

  it("escalates to five minutes, then fifteen", () => {
    assert.equal(lockoutIntervalFor(8), "5 minutes");
    assert.equal(lockoutIntervalFor(9), "5 minutes");
    assert.equal(lockoutIntervalFor(10), "15 minutes");
  });

  it("caps the interval at fifteen minutes", () => {
    assert.equal(lockoutIntervalFor(50), "15 minutes");
    assert.equal(lockoutIntervalFor(1000), "15 minutes");
  });

  it("treats non-numeric input as not locked", () => {
    assert.equal(lockoutIntervalFor(undefined), null);
    assert.equal(lockoutIntervalFor(null), null);
    assert.equal(lockoutIntervalFor("nope"), null);
  });
});
