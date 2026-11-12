const { slugify } = require("../utils/slugify");
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("slugify", () => {
  it("lowercases", () => {
    assert.equal(slugify("HELLO"), "hello");
  });

  it("replaces spaces with hyphens", () => {
    assert.equal(slugify("hello world"), "hello-world");
  });

  it("collapses multiple separators", () => {
    assert.equal(slugify("hello---world"), "hello-world");
    assert.equal(slugify("hello   world"), "hello-world");
    assert.equal(slugify("hello _ world"), "hello-world");
  });

  it("trims leading/trailing hyphens", () => {
    assert.equal(slugify("-hello"), "hello");
    assert.equal(slugify("hello-"), "hello");
    assert.equal(slugify("-hello-"), "hello");
  });

  it("removes diacritics", () => {
    assert.equal(slugify("café"), "cafe");
    assert.equal(slugify("jalapeño"), "jalapeno");
    assert.equal(slugify("résumé"), "resume");
  });

  it("allows only alphanumeric and hyphens", () => {
    assert.equal(slugify("hello@world!"), "hello-world");
    assert.equal(slugify("a.b_c-d"), "a-b-c-d");
  });

  it("handles empty and non-string", () => {
    assert.equal(slugify(""), "");
    assert.equal(slugify(null), "");
    assert.equal(slugify(undefined), "");
    assert.equal(slugify(123), "");
  });

  it("truncates at 100 chars", () => {
    const long = "a".repeat(120);
    assert.equal(slugify(long).length, 100);
  });

  it("idempotent", () => {
    const s = "Hello World";
    assert.equal(slugify(slugify(s)), slugify(s));
  });
});