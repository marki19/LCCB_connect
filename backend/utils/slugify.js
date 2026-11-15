/**
 * slugify - Convert a string to a URL-safe slug.
 *
 * Rules:
 * - Lowercase
 * - Replace non-alphanumeric with single hyphen
 * - Collapse multiple hyphens
 * - Trim leading/trailing hyphens
 * - Max 100 chars
 */
function slugify(input) {
  if (typeof input !== "string") return "";
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

module.exports = { slugify };