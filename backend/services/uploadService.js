/**
 * The single write path into object storage.
 *
 * Every upload — post images, avatars, manuscripts — goes through here so that
 * validation, key generation, and the PUT itself happen in one order and one
 * place. Callers only decide which category the bytes belong to.
 */

const objectStorage = require("./objectStorage");
const { resolveUpload, isPublicCategory } = require("./filePolicy");

async function defaultStoreUpload({ category, originalName, buffer }) {
  const resolved = resolveUpload({ category, originalName, buffer });
  const isPublic = isPublicCategory(resolved.category);

  await objectStorage.putObject({
    key: resolved.key,
    body: buffer,
    contentType: resolved.contentType,
    cacheControl: isPublic ? "public, max-age=31536000, immutable" : undefined,
  });

  return resolved;
}

let storeUploadImpl = defaultStoreUpload;

/**
 * Validates a buffer, stores it, and returns the key to persist.
 *
 * @param {object} opts
 * @param {string} opts.category
 * @param {string} opts.originalName Used only to read the extension.
 * @param {Buffer} opts.buffer
 * @returns {Promise<{ key: string, filename: string, category: string, contentType: string, size: number }>}
 * @throws {import("./filePolicy").UploadRejectedError} when the file is unacceptable.
 * @throws {import("./objectStorage").StorageNotConfiguredError | import("./objectStorage").StorageRequestError}
 */
async function storeUpload(opts) {
  return storeUploadImpl(opts);
}

function __setStoreUpload(fn) {
  storeUploadImpl = fn;
}

function __resetStoreUpload() {
  storeUploadImpl = defaultStoreUpload;
}

module.exports = {
  storeUpload,
  __setStoreUpload,
  __resetStoreUpload,
};
