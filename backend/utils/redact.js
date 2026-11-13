/**
 * Log Redaction Utility
 * Recursively scrubs credentials, tokens, query-string secrets, and PII
 * from objects, errors, URLs, and console logging.
 */

const SENSITIVE_KEY_REGEX = /^(password|new_?password|current_?password|confirm_?password|secret|totp_?secret|otp|otp_?code|code|token|access_?token|refresh_?token|temp_?token|challenge_?token|authorization|cookie|api_?key|service_?role_?key)$/i;

const JWT_REGEX = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
const BEARER_REGEX = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const URL_SECRET_PARAM_REGEX = /([?&](?:token|code|secret|password|access_token|refresh_token|otp|otp_code)=)[^&#\s]*/gi;

/**
 * Sanitizes URLs by replacing secret query parameter values with [REDACTED].
 */
function sanitizeUrl(url) {
  if (typeof url !== "string") return url;
  return url.replace(URL_SECRET_PARAM_REGEX, "$1[REDACTED]");
}

/**
 * Redacts sensitive patterns from a string.
 */
function redactString(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(BEARER_REGEX, "Bearer [REDACTED]")
    .replace(JWT_REGEX, "[REDACTED_JWT]")
    .replace(URL_SECRET_PARAM_REGEX, "$1[REDACTED]");
}

/**
 * Recursively redacts sensitive keys and values from objects, arrays, and errors.
 */
function redact(val, seen = new WeakSet()) {
  if (val === null || val === undefined) return val;

  if (typeof val === "string") {
    return redactString(val);
  }

  if (typeof val !== "object") {
    return val;
  }

  // Handle special object types
  if (val instanceof Date || val instanceof RegExp || Buffer.isBuffer(val)) {
    return val;
  }

  // Avoid circular reference infinite loops
  if (seen.has(val)) {
    return "[Circular]";
  }
  seen.add(val);

  // Handle Errors
  if (val instanceof Error) {
    const redactedError = new Error(redactString(val.message));
    redactedError.name = val.name;
    if (val.stack) {
      redactedError.stack = redactString(val.stack);
    }
    // Copy any custom enumerable properties attached to the Error
    for (const key of Object.keys(val)) {
      if (SENSITIVE_KEY_REGEX.test(key)) {
        redactedError[key] = "[REDACTED]";
      } else {
        redactedError[key] = redact(val[key], seen);
      }
    }
    return redactedError;
  }

  // Handle Arrays
  if (Array.isArray(val)) {
    return val.map((item) => redact(item, seen));
  }

  // Handle plain objects
  const output = {};
  for (const [key, item] of Object.entries(val)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      output[key] = "[REDACTED]";
    } else {
      output[key] = redact(item, seen);
    }
  }

  return output;
}

let isConsolePatched = false;
let globalUninstall = null;

/**
 * Installs transparent redaction on console.log, warn, error, info.
 * Supports passing a custom console object (useful for tests).
 */
function installConsoleRedactor(targetConsole = console) {
  const orig = {
    log: targetConsole.log.bind(targetConsole),
    warn: targetConsole.warn.bind(targetConsole),
    error: targetConsole.error.bind(targetConsole),
    info: targetConsole.info.bind(targetConsole),
  };

  const wrapMethod = (origFn) => {
    return function (...args) {
      const sanitizedArgs = args.map((arg) => redact(arg));
      origFn(...sanitizedArgs);
    };
  };

  targetConsole.log = wrapMethod(orig.log);
  targetConsole.warn = wrapMethod(orig.warn);
  targetConsole.error = wrapMethod(orig.error);
  targetConsole.info = wrapMethod(orig.info);

  const uninstall = () => {
    targetConsole.log = orig.log;
    targetConsole.warn = orig.warn;
    targetConsole.error = orig.error;
    targetConsole.info = orig.info;
    if (targetConsole === console) {
      isConsolePatched = false;
      globalUninstall = null;
    }
  };

  if (targetConsole === console) {
    isConsolePatched = true;
    globalUninstall = uninstall;
  }

  return uninstall;
}

/**
 * Restores original global console methods.
 */
function uninstallConsoleRedactor() {
  if (globalUninstall) {
    globalUninstall();
  }
}

module.exports = {
  redact,
  sanitizeUrl,
  installConsoleRedactor,
  uninstallConsoleRedactor,
};
