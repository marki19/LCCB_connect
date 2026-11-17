-- 044_friendship_suggestions.sql
--
-- Friend suggestions (GET /api/friends/suggestions).
--
-- Two things:
--
-- 1. `friendships` previously indexed only the addressee and the unordered pair
--    expression. "My friends" (requester_id = $1) was a sequential scan. The
--    suggestion query needs to exclude every profile already connected to me in
--    either direction, and that exclusion is the dominant cost.
--
-- 2. The suggestion ranking is a single query with a ranked CTE. It needs
--    candidates that are not me, not a guest, not blocked, and not already in a
--    friendship row (pending or accepted, both directions). The friendship
--    exclusion is the hot path, so it is the index above.
--
-- No new tables. Suggestions are computed at request time from existing
-- profiles, friendships, and blocks.

CREATE INDEX IF NOT EXISTS idx_friendships_requester
  ON public.friendships (requester_id, status);

-- Denormalized mutual-count helper for the suggestion query. Without it the
-- mutuals subquery would recompute the intersection per candidate row.
CREATE INDEX IF NOT EXISTS idx_friendships_pair_status
  ON public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id), status);