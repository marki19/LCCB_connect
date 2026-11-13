# Request IDs & Correlation Headers — Implementation Plan

> **Goal**: Every HTTP request gets a unique `X-Request-ID`. It appears in every log line, every error response, and every outgoing response header so any issue can be traced end-to-end.

## Status: Planned

---

## Architecture

```
Client request ──► requestId middleware ──► route handler ──► response
                    │                         │
                    ├─ req.id = <uuid>         ├─ console.log("[api][<id>] ...")
                    ├─ res.setHeader(          └─ error: { ..., requestId }
                    │    "X-Request-ID", id)
                    └─ honours inbound
                       X-Request-ID if present
```

**Key decisions**:
- Use `crypto.randomUUID()` (Node ≥ 19, zero deps) for ID generation
- Accept inbound `X-Request-ID` from trusted proxies; generate when absent
- Format: `[tag][<8-char-short-id>]` in logs for readability (full UUID in header)
- Error responses include `requestId` field in JSON body for client-side reporting
- No new dependencies

---

## Tasks

### Task 1: Create `middleware/requestId.js` (~10 min)

**File**: `backend/middleware/requestId.js` (new)

```js
const crypto = require("crypto");

function requestId(req, res, next) {
  const id = req.headers["x-request-id"] || crypto.randomUUID();
  req.id = id;
  res.setHeader("X-Request-ID", id);
  next();
}

module.exports = requestId;
```

**Details**:
- `req.id` is the canonical location (Express convention)
- Reuses inbound `X-Request-ID` for proxy correlation
- `crypto.randomUUID()` is built-in, no deps needed

**Verify**: `typeof require("./middleware/requestId")` === `"function"`

---

### Task 2: Mount middleware in `app.js` before all routes (~5 min)

**File**: `backend/app.js`

**Change**: Add `requestId` middleware right after `helmet()` and `cors()`, before the request logger.

```js
// after line 104: app.use(cors(corsOptions));
const requestId = require("./middleware/requestId");
app.use(requestId);
```

**Also update the request logger** (lines 119-128) to include the short ID:

```js
app.use((req, res, next) => {
  if (!logRequests) return next();
  const startedAt = Date.now();
  const short = req.id.slice(0, 8);
  res.on("finish", () => {
    console.log(
      `[api][${short}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - startedAt}ms)`
    );
  });
  return next();
});
```

**Verify**: Start server, `curl -v http://localhost:3000/` → response headers include `X-Request-ID: <uuid>`, terminal log shows `[api][<8chars>]`

---

### Task 3: Include `requestId` in error responses (~5 min)

**File**: `backend/app.js` (error handler, lines 283-299)

**Change**: Add `requestId: req.id` to every error JSON response:

```js
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    console.error(`[api][${req.id?.slice(0, 8)}] Unhandled error:`, err);
    return res.status(500).json({ error: "Internal server error", requestId: req.id });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON body", requestId: req.id });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body too large", requestId: req.id });
  }
  return res.status(status).json({ error: err.message, requestId: req.id });
});
```

**Also**: Update 404 fallback to include `requestId`:

```js
app.use((req, res) => {
  res.status(404).json({ error: "Not found", requestId: req.id });
});
```

**Verify**: `curl http://localhost:3000/nonexistent` → JSON includes `requestId`

---

### Task 4: Propagate short ID to tagged log sites (~10 min)

Update the ~9 `[mfa]` and `[session-age]` log sites in `mfaService.js` and `authController.js` to include `req.id` where `req` is available.

**Pattern**: Where `req` is in scope, change:
```js
console.error("[mfa] Failed to ...", err.message);
```
to:
```js
console.error(`[mfa][${req.id?.slice(0, 8) ?? "no-req"}] Failed to ...`, err.message);
```

**Files to update** (only lines where `req` is in scope):

| File | Line(s) | Tag |
|------|---------|-----|
| `backend/services/mfaService.js` | 350, 424, 521 | `[mfa]`, `[session-age]` |
| `backend/controllers/authController.js` | 343, 669, 760 | `[mfa]` |
| `backend/app.js` | 286 | `[api]` (already done in Task 3) |

**Skip**: Lines where `req` is not in scope (service-internal calls without request context). Those will be addressed in Log Redaction.

**Verify**: Trigger an MFA error → log line includes `[mfa][<8chars>]`

---

### Task 5: Write test (~5 min)

**File**: `backend/tests/request-id.test.js` (new)

```js
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
  });
});
```

**Run**: `cd backend && node --test tests/request-id.test.js`

---

## Files Changed Summary

| File | Action | Lines |
|------|--------|-------|
| `backend/middleware/requestId.js` | **New** | ~10 |
| `backend/app.js` | Edit | ~20 lines changed |
| `backend/services/mfaService.js` | Edit | 3 log lines |
| `backend/controllers/authController.js` | Edit | 3 log lines |
| `backend/tests/request-id.test.js` | **New** | ~25 |

**Total**: ~60 lines of new code, ~10 lines of edits. No migrations. No new dependencies.

---

## Estimated Time: 25-30 minutes

## Verification Checklist

- [ ] `node --test tests/request-id.test.js` passes (3 tests)
- [ ] Full test suite still passes (`node --require dotenv/config --test`)
- [ ] `curl -v http://localhost:3000/` shows `X-Request-ID` header
- [ ] `curl -v -H "X-Request-ID: abc123" http://localhost:3000/` echoes `abc123`
- [ ] Server terminal log shows `[api][<8chars>]` format
- [ ] Error responses contain `requestId` field

