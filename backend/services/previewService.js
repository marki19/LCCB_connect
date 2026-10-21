const http = require("http");
const https = require("https");
const net = require("net");
const { URL } = require("url");
const dns = require("dns").promises;

/**
 * SSRF-Safe Link Preview Service
 * Fetches Open Graph tags for website/portfolio/app URLs posted by students.
 */

const MAX_REDIRECTS = 3;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "::",
  "0.0.0.0",
  "metadata.google.internal",
  "instance-data",
]);

const blockedIpv4 = new net.BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
]) {
  blockedIpv4.addSubnet(address, prefix, "ipv4");
}

const blockedIpv6 = new net.BlockList();
for (const [address, prefix] of [
  ["::", 96], // unspecified, loopback, and deprecated IPv4-compatible space
  ["::ffff:0:0", 96], // IPv4-mapped addresses
  ["64:ff9b::", 96], // NAT64 well-known prefix
  ["2001::", 32], // Teredo
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
]) {
  blockedIpv6.addSubnet(address, prefix, "ipv6");
}

function normalizeHostname(hostname) {
  return hostname.toLowerCase().replace(/^\[|\]$/g, "");
}

function isPrivateIp(ip) {
  if (!ip) return true;
  if (net.isIPv4(ip)) return blockedIpv4.check(ip, "ipv4");
  if (net.isIPv6(ip)) return blockedIpv6.check(ip, "ipv6");
  return true;
}

async function resolveSafeTarget(targetUrl) {
  const parsed = new URL(targetUrl);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https protocols are supported");
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".home.arpa")
  ) {
    throw new Error("Access to this host is restricted");
  }

  let records;
  try {
    records = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("Failed to resolve host");
  }

  if (records.length === 0) {
    throw new Error("Failed to resolve host");
  }

  // Every answer must be public. This prevents a hostname from mixing a
  // public address with loopback/private ones.
  for (const record of records) {
    if (isPrivateIp(record.address)) {
      throw new Error("Access to private address space is restricted");
    }
  }

  // Pin the address that passed validation. `http.get` must not resolve the
  // hostname a second time, or DNS rebinding can swap in a private address.
  return {
    parsed,
    address: records[0].address,
    family: records[0].family,
  };
}

async function validateUrlSafety(targetUrl) {
  const { parsed } = await resolveSafeTarget(targetUrl);
  return parsed;
}

function extractMeta(html, targetUrl) {
  const getTag = (pattern) => {
    const match = html.match(pattern);
    return match ? match[1].trim() : null;
  };

  let title =
    getTag(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    getTag(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i) ||
    getTag(/<title[^>]*>([^<]+)<\/title>/i);

  let description =
    getTag(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
    getTag(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i) ||
    getTag(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    getTag(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);

  let image =
    getTag(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    getTag(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

  let siteName =
    getTag(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i) ||
    getTag(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i);

  // Normalize relative image URLs
  if (image && !image.startsWith("http://") && !image.startsWith("https://")) {
    try {
      image = new URL(image, targetUrl).href;
    } catch {
      image = null;
    }
  }

  return {
    title: title ? title.slice(0, 200) : null,
    description: description ? description.slice(0, 500) : null,
    image: image || null,
    siteName: siteName || null,
    url: targetUrl,
  };
}

async function fetchLinkPreview(rawUrl, redirectCount = 0) {
  if (redirectCount > MAX_REDIRECTS) {
    throw new Error("Too many redirects");
  }

  const { parsed, address, family } = await resolveSafeTarget(rawUrl);

  return new Promise((resolve, reject) => {
    const client = parsed.protocol === "https:" ? https : http;
    const req = client.get(
      parsed.href,
      {
        headers: {
          "User-Agent": "LCCB-Connect-Bot/1.0 (+http://lccb-connect.edu)",
          Accept: "text/html,application/xhtml+xml",
        },
        lookup: (_hostname, options, callback) => {
          // Node may request all addresses (autoSelectFamily). Keep the
          // already-validated address pinned in both callback shapes.
          if (options && options.all) {
            return callback(null, [{ address, family }]);
          }
          return callback(null, address, family);
        },
        timeout: 5000,
      },
      (res) => {
        // Handle redirects. Every hop is validated and re-pinned by the
        // recursive call, and the chain is capped.
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          if (redirectCount >= MAX_REDIRECTS) {
            return reject(new Error("Too many redirects"));
          }

          try {
            const redirectUrl = new URL(res.headers.location, parsed.href).href;
            return resolve(fetchLinkPreview(redirectUrl, redirectCount + 1));
          } catch {
            return reject(new Error("Invalid redirect location"));
          }
        }

        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`Host returned status ${res.statusCode}`));
        }

        const contentType = res.headers["content-type"] || "";
        if (!contentType.includes("text/html") && !contentType.includes("xhtml")) {
          res.resume();
          return resolve({
            title: parsed.hostname,
            description: null,
            image: null,
            siteName: parsed.hostname,
            url: parsed.href,
          });
        }

        let rawHtml = "";
        let totalBytes = 0;
        const MAX_BYTES = 512 * 1024; // 512KB cap

        res.on("data", (chunk) => {
          totalBytes += chunk.length;
          rawHtml += chunk.toString("utf8");
          if (totalBytes > MAX_BYTES) {
            req.destroy();
            resolve(extractMeta(rawHtml, parsed.href));
          }
        });

        res.on("error", reject);
        res.on("end", () => {
          resolve(extractMeta(rawHtml, parsed.href));
        });
      }
    );

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });

    req.on("error", (err) => {
      reject(err);
    });
  });
}

module.exports = {
  fetchLinkPreview,
  validateUrlSafety,
};
