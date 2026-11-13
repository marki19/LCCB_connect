require("./env.helper");

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const searchModel = require("../models/searchModel");
const searchController = require("../controllers/searchController");
const { stub } = require("./stub.helper");

describe("searchController - Group 3 Input Caps", () => {
  let searchPeopleStub;
  let searchPostsStub;
  let searchThesesStub;
  let searchAllStub;
  let searchSuggestionsStub;

  beforeEach(() => {
    searchPeopleStub = stub(searchModel, "searchPeople", async () => []);
    searchPostsStub = stub(searchModel, "searchPosts", async () => []);
    searchThesesStub = stub(searchModel, "searchTheses", async () => []);
    searchAllStub = stub(searchModel, "searchAll", async () => ({
      query: "",
      people: [],
      posts: [],
      theses: [],
      counts: { people: 0, posts: 0, theses: 0, total: 0 },
    }));
    searchSuggestionsStub = stub(searchModel, "searchSuggestions", async () => []);
  });

  afterEach(() => {
    searchPeopleStub.restore();
    searchPostsStub.restore();
    searchThesesStub.restore();
    searchAllStub.restore();
    searchSuggestionsStub.restore();
  });

  it("caps overlong query at 100 characters in search", async () => {
    const longQuery = "a".repeat(150);
    const req = {
      query: { q: longQuery, type: "posts" },
      user: { id: "test-user-id" },
    };
    let jsonResult = null;
    const res = {
      json: (data) => {
        jsonResult = data;
      },
    };

    await searchController.search(req, res, () => {});

    assert.equal(searchPostsStub.calls.length, 1);
    const [passedQuery, viewerId, options] = searchPostsStub.calls[0];
    assert.equal(passedQuery.length, 100);
    assert.equal(passedQuery, "a".repeat(100));
    assert.equal(jsonResult.query, "a".repeat(100));
  });

  it("clamps offset to max 1000 in search", async () => {
    const req = {
      query: { q: "test", type: "people", offset: "999999" },
      user: { id: "test-user-id" },
    };
    const res = { json: () => {} };

    await searchController.search(req, res, () => {});

    assert.equal(searchPeopleStub.calls.length, 1);
    const [q, viewerId, options] = searchPeopleStub.calls[0];
    assert.equal(options.offset, 1000);
  });

  it("clamps negative offset to 0 in search", async () => {
    const req = {
      query: { q: "test", type: "theses", offset: "-50" },
      user: { id: "test-user-id" },
    };
    const res = { json: () => {} };

    await searchController.search(req, res, () => {});

    assert.equal(searchThesesStub.calls.length, 1);
    const [q, viewerId, options] = searchThesesStub.calls[0];
    assert.equal(options.offset, 0);
  });

  it("caps overlong query at 100 characters in suggestions", async () => {
    const longQuery = "s".repeat(120);
    const req = {
      query: { q: longQuery },
      user: { id: "test-user-id" },
    };
    const res = { json: () => {} };

    await searchController.suggestions(req, res, () => {});

    assert.equal(searchSuggestionsStub.calls.length, 1);
    const [passedQuery] = searchSuggestionsStub.calls[0];
    assert.equal(passedQuery.length, 100);
    assert.equal(passedQuery, "s".repeat(100));
  });
});
