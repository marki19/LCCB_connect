const { withStorageUrls } = require("../services/storageService");

/**
 * Converts file columns from their stored storage keys to the URLs the UI
 * renders. Keeping this at the response boundary means controllers/models stay
 * focused on data and don't have to know where objects live.
 *
 * `withStorageUrls` is async because private buckets (`assets`, `theses`) need
 * a signed URL issued through Supabase, which requires a network round-trip.
 * The middleware awaits it before the response is serialized, so a caller of
 * `res.json` always gets the fully-resolved body.
 *
 * A lock guards against double-send: `res.json`/`res.send` may be called more
 * than once in error paths, and the async resolution means the original
 * serializer runs later than the call that triggered it. Once a body is in
 * flight, duplicate calls are no-ops.
 *
 * After resolution the original serializers are restored, so the call chain
 * (json -> send -> end) terminates at the real Express implementations instead
 * of re-entering this middleware.
 */
function attachStorageUrls(req, res, next) {
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  const originalEnd = res.end.bind(res);
  let sending = false;

  const restoreAndSend = (serializer, body) => {
    sending = false;
    res.json = originalJson;
    res.send = originalSend;
    res.end = originalEnd;
    serializer(body);
  };

  const sendResolved = (body, serializer) => {
    if (sending) return; // duplicate call — first is already in flight
    sending = true;
    Promise.resolve()
      .then(() => withStorageUrls(body))
      .then((resolved) => restoreAndSend(serializer, resolved))
      .catch((err) => {
        // Never let a storage failure take down the whole response. Log and
        // ship the body as-is; private keys stay raw and the client gets a
        // clean 404 when it asks for a signed URL.
        console.error("[storage] URL resolution failed:", err);
        restoreAndSend(serializer, body);
      });
  };

  res.json = (body) => sendResolved(body, originalJson);
  res.send = (body) => sendResolved(body, originalSend);
  next();
}

module.exports = attachStorageUrls;