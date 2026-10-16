// Shared pagination limits (see Security_plan.md Phase 8).
//
// Every list endpoint clamps its `?limit=` to a sane range so a single request
// can never dump an unbounded table. `cursor` is an opaque keyset marker whose
// exact meaning is per-model (see the models that consume it).

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 100;

/** Clamp a client-supplied `limit` into [1, MAX_LIMIT]. */
function clampLimit(raw) {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

module.exports = { clampLimit, MAX_LIMIT, DEFAULT_LIMIT };
