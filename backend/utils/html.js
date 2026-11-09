/**
 * Escaping for values interpolated into outbound email HTML.
 *
 * Kept in one place so every template uses identical rules. Returns a string
 * for any input; `null`/`undefined` become an empty string.
 */

const ENTITIES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ENTITIES[char]);
}

/** Collapses newlines/control characters for single-line email headers. */
function singleLine(value, maxLength = 80) {
  return String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, maxLength);
}

module.exports = { escapeHtml, singleLine };
