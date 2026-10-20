const http = require("http");
const https = require("https");
const { URL } = require("url");
const dns = require("dns").promises;

/**
 * SSRF-Safe Link Preview Service
 * Fetches Open Graph tags for website/portfolio/app URLs posted by students.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "metadata.google.internal",
  "instance-data",
]);

function isPrivateIp(ip) {
  if (!ip) return false;
  // IPv4 checks
  if (ip.startsWith("127.") || ip.startsWith("10.") || ip === "0.0.0.0") return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("169.254.")) return true; // Link-local / Cloud metadata
  const match172 = ip.match(/^172\.(\d+)\./);
  if (match172) {
    const octet = parseInt(match172[1], 10);
    if (octet >= 16 && octet <= 31) return true;
  }
  // IPv6 checks
  if (ip === "::1" || ip === "::" || ip.startsWith("fe80:") || ip.startsWith("fc00:") || ip.startsWith("fd00:")) {
    return true;
  }
  return false;
}

async function validateUrlSafety(targetUrl) {
  const parsed = new URL(targetUrl);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https protocols are supported");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("Access to this host is restricted");
  }

  // Resolve DNS to verify it doesn't map to a private / loopback IP literal
  try {
    const lookup = await dns.lookup(hostname);
    if (isPrivateIp(lookup.address)) {
      throw new Error("Access to private address space is restricted");
    }
  } catch (err) {
    if (err.message.includes("restricted")) throw err;
    throw new Error("Failed to resolve host");
  }

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

async function fetchLinkPreview(rawUrl) {
  const parsed = await validateUrlSafety(rawUrl);

  return new Promise((resolve, reject) => {
    const client = parsed.protocol === "https:" ? https : http;
    const req = client.get(
      parsed.href,
      {
        headers: {
          "User-Agent": "LCCB-Connect-Bot/1.0 (+http://lccb-connect.edu)",
          Accept: "text/html,application/xhtml+xml",
        },
        timeout: 5000,
      },
      (res) => {
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          try {
            const redirectUrl = new URL(res.headers.location, parsed.href).href;
            res.resume();
            return resolve(fetchLinkPreview(redirectUrl));
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
