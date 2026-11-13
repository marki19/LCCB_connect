const crypto = require("crypto");

// Client-supplied IDs are echoed back and written to logs, so only accept a
// short, printable, log-safe token. Anything else gets a fresh UUID.
const CLIENT_ID_RE = /^[A-Za-z0-9._:-]{1,200}$/;

function requestId(req, res, next) {
  const supplied = req.headers["x-request-id"];
  const id =
    typeof supplied === "string" && CLIENT_ID_RE.test(supplied)
      ? supplied
      : crypto.randomUUID();
  req.id = id;
  res.setHeader("X-Request-ID", id);
  next();
}

module.exports = requestId;
