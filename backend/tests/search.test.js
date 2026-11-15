require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const db = require("../db");
const { stub } = require("./stub.helper");

const query = stub(db, "query", async () => ({ rows: [] }));
const searchModel = require("../models/searchModel");

const VIEWER_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  query.calls.length = 0;
  query.setImpl(async () => ({ rows: [] }));
});

describe("searchModel", () => {
  it("searches people using trigrams and full-text search with block exclusion", async () => {
    query.setImpl(async () => ({
      rows: [
        {
          id: "p1",
          full_name: "John Doe",
          username: "johndoe",
          department_name: "Engineering",
        },
      ],
    }));

    const results = await searchModel.searchPeople("john", VIEWER_ID, { limit: 10 });
    assert.equal(results.length, 1);
    assert.equal(results[0].full_name, "John Doe");

    const [sql, params] = query.calls[0];
    assert.match(sql, /similarity\(COALESCE\(pr\.full_name/i);
    assert.match(sql, /plainto_tsquery\('english'/i);
    assert.match(sql, /FROM public\.blocks b/i); // Block filter
    assert.equal(params[0], "john");
    assert.equal(params[1], "%john%");
  });

  it("searches posts strictly bounded by visible_posts", async () => {
    query.setImpl(async () => ({
      rows: [
        {
          id: "post-1",
          title: "React Native Deep Dive",
          content: "Architecture guide",
        },
      ],
    }));

    const results = await searchModel.searchPosts("react", VIEWER_ID, { limit: 10 });
    assert.equal(results.length, 1);

    const [sql, params] = query.calls[0];
    assert.match(sql, /FROM visible_posts\(\$1::text\) p/i);
    assert.equal(params[0], VIEWER_ID);
    assert.equal(params[1], "react");
  });

  it("searches theses strictly bounded by visible_theses", async () => {
    query.setImpl(async () => ({
      rows: [
        {
          id: "thesis-1",
          title: "Autonomous Agentic AI in Higher Education",
          abstract: "A study on software engineering...",
        },
      ],
    }));

    const results = await searchModel.searchTheses("agentic", VIEWER_ID, { limit: 10 });
    assert.equal(results.length, 1);

    const [sql, params] = query.calls[0];
    assert.match(sql, /FROM visible_theses\(\$1::text\) t/i);
    assert.equal(params[0], VIEWER_ID);
    assert.equal(params[1], "agentic");
  });

  it("aggregates searchAll concurrently", async () => {
    query.setImpl(async (sql) => {
      if (sql.includes("profiles pr")) {
        return { rows: [{ id: "p1", full_name: "Alice" }] };
      }
      if (sql.includes("visible_posts")) {
        return { rows: [{ id: "post-1", title: "Alice's Post" }] };
      }
      if (sql.includes("visible_theses")) {
        return { rows: [{ id: "thesis-1", title: "Alice's Paper" }] };
      }
      return { rows: [] };
    });

    const results = await searchModel.searchAll("Alice", VIEWER_ID, { limit: 5 });
    assert.equal(results.query, "Alice");
    assert.equal(results.people.length, 1);
    assert.equal(results.posts.length, 1);
    assert.equal(results.theses.length, 1);
    assert.equal(results.counts.total, 3);
  });

  it("formats topbar search suggestions", async () => {
    query.setImpl(async (sql) => {
      if (sql.includes("profiles pr")) {
        return { rows: [{ id: "p1", full_name: "Jane Smith", username: "jsmith", department_name: "SBIT" }] };
      }
      if (sql.includes("visible_posts")) {
        return { rows: [{ id: "po1", title: "Campus Update", author: { full_name: "Admin" } }] };
      }
      if (sql.includes("visible_theses")) {
        return { rows: [{ id: "th1", title: "Smart Campus IoT", category: "Capstone" }] };
      }
      return { rows: [] };
    });

    const suggestions = await searchModel.searchSuggestions("smart", VIEWER_ID, { limit: 6 });
    assert.equal(suggestions.length, 3);
    assert.equal(suggestions[0].type, "person");
    assert.equal(suggestions[1].type, "post");
    assert.equal(suggestions[2].type, "thesis");
  });
});

