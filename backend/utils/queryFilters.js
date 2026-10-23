// Shared query-string parsing for list filters.
//
// Controllers use these helpers so every list endpoint trims search terms,
// bounds their length, and rejects malformed UUID filters with a 400 instead of
// letting Postgres raise a cast error (which the central handler would turn into
// a generic 500).

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_SEARCH_LENGTH = 100;
const MAX_TEXT_FILTER_LENGTH = 100;

/** Trim a scalar query value and cap its length. Arrays/objects are ignored. */
function parseTextFilter(raw, maxLength = MAX_TEXT_FILTER_LENGTH) {
  if (typeof raw !== "string") return null;
  const value = raw.trim().slice(0, maxLength);
  return value.length > 0 ? value : null;
}

/** Free-text search term (`?q=`); null when absent/blank. */
function parseSearch(raw) {
  return parseTextFilter(raw, MAX_SEARCH_LENGTH);
}

/**
 * Optional UUID query filter. Returns `{ value, error }`; `error` is a
 * client-safe message (e.g. "Invalid author_id") for a malformed value.
 */
function parseUuidFilter(raw, field) {
  if (raw === undefined || raw === null || raw === "") {
    return { value: null, error: null };
  }
  if (typeof raw !== "string" || !UUID_RE.test(raw.trim())) {
    return { value: null, error: `Invalid ${field}` };
  }
  return { value: raw.trim(), error: null };
}

/**
 * Thesis category filter. The app's current undergraduate label also covers
 * legacy rows stored as plain "Capstone", so return the group the model should
 * match. Any other category is an exact one-value match.
 */
function parseCategoryFilter(raw) {
  const value = parseTextFilter(raw, MAX_TEXT_FILTER_LENGTH);
  if (!value) return null;
  if (value === "Undergraduate Capstone") {
    return ["Undergraduate Capstone", "Capstone"];
  }
  return [value];
}

/** Escape LIKE metacharacters so `?q=100%` searches for a literal percent. */
function escapeLike(value) {
  return value.replace(/[!%_]/g, "!$&");
}

module.exports = {
  MAX_SEARCH_LENGTH,
  parseTextFilter,
  parseSearch,
  parseUuidFilter,
  parseCategoryFilter,
  escapeLike,
};
