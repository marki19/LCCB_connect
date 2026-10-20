// @ts-nocheck
// Supabase Edge Function (Deno): fetch Open Graph metadata for a URL.
//
// Hardened against SSRF (see Security_plan.md Phase 7):
//   * requires a signed-in caller (verifies the Supabase access token);
//   * allows http(s) only;
//   * blocks loopback / private / link-local / multicast / metadata addresses,
//     both as IP literals and as resolved DNS records;
//   * follows redirects manually, re-validating every hop;
//   * short timeout and a capped response size;
//   * CORS restricted to configured origins (ALLOWED_ORIGINS secret).
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? ""

const DEFAULT_ORIGINS = [
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:19000",
  "http://127.0.0.1:19000",
  "http://localhost:19006",
  "http://127.0.0.1:19006",
]
const configuredOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean)
const allowedOrigins = configuredOrigins.length ? configuredOrigins : DEFAULT_ORIGINS

const TIMEOUT_MS = 8000
const MAX_BYTES = 512 * 1024
const MAX_REDIRECTS = 4

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin")
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  }
  if (origin && allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin
  }
  return headers
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(req), "Content-Type": "application/json" },
  })
}

// --- SSRF guards ------------------------------------------------------------
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".")
  if (parts.length !== 4) return null
  let value = 0
  for (const part of parts) {
    const n = Number(part)
    if (!Number.isInteger(n) || n < 0 || n > 255) return null
    value = value * 256 + n
  }
  return value
}

function isBlockedIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip)
  if (n === null) return true // not a valid IPv4 literal -> treat as unsafe
  const inRange = (base: string, bits: number) => {
    const b = ipv4ToInt(base)!
    const mask = (0xffffffff << (32 - bits)) >>> 0
    return (n & mask) === (b & mask)
  }
  return (
    inRange("0.0.0.0", 8) || // "this network"
    inRange("10.0.0.0", 8) || // private
    inRange("100.64.0.0", 10) || // carrier-grade NAT
    inRange("127.0.0.0", 8) || // loopback
    inRange("169.254.0.0", 16) || // link-local incl. cloud metadata
    inRange("172.16.0.0", 12) || // private
    inRange("192.0.0.0", 24) || // IETF protocol assignments
    inRange("192.168.0.0", 16) || // private
    inRange("198.18.0.0", 15) || // benchmarking
    inRange("224.0.0.0", 4) || // multicast
    inRange("240.0.0.0", 4) // reserved
  )
}

// Parse an IPv6 literal (optionally with a zone id or an embedded dotted IPv4
// tail) into its eight 16-bit groups. Returns null when the literal is not a
// valid IPv6 address, so callers can fail closed.
function parseIpv6(input: string): number[] | null {
  let value = input.trim().toLowerCase()
  const zone = value.indexOf("%") // strip a zone id (e.g. "fe80::1%eth0")
  if (zone !== -1) value = value.slice(0, zone)

  // Fold an embedded dotted IPv4 tail into two hex groups.
  const v4 = value.match(/^(.*):(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (v4) {
    const octets = v4[2].split(".").map(Number)
    if (octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) return null
    const g1 = ((octets[0] << 8) | octets[1]).toString(16)
    const g2 = ((octets[2] << 8) | octets[3]).toString(16)
    value = `${v4[1]}:${g1}:${g2}`
  }

  if (!value.includes(":")) return null
  const halves = value.split("::")
  if (halves.length > 2) return null // more than one "::" is invalid

  const parseGroups = (s: string): number[] =>
    s === ""
      ? []
      : s.split(":").map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN))

  const head = parseGroups(halves[0])
  const tail = halves.length === 2 ? parseGroups(halves[1]) : []
  if ([...head, ...tail].some((n) => Number.isNaN(n))) return null

  if (halves.length === 2) {
    const fill = 8 - head.length - tail.length
    if (fill < 1) return null // "::" must stand for at least one group
    return [...head, ...Array(fill).fill(0), ...tail]
  }
  return head.length === 8 ? head : null
}

function isBlockedIp(ip: string): boolean {
  const value = ip.trim().toLowerCase()
  if (value.includes(":")) {
    const groups = parseIpv6(value)
    if (!groups) return true // unparseable IPv6 -> fail closed
    const g = (i: number) => groups[i]
    const embeddedV4 = () => [g(6) >> 8, g(6) & 0xff, g(7) >> 8, g(7) & 0xff].join(".")

    if (groups.every((x) => x === 0)) return true // :: (unspecified)
    if (g(0) === 0 && g(1) === 0 && g(2) === 0 && g(3) === 0 && g(4) === 0 && g(5) === 0 && g(6) === 0 && g(7) === 1) {
      return true // ::1 loopback
    }
    // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d): classify the
    // embedded address as IPv4. WHATWG URL normalises the mapped form to hex
    // ("::ffff:7f00:1"), which the previous dotted-only regex missed.
    if (g(0) === 0 && g(1) === 0 && g(2) === 0 && g(3) === 0 && g(4) === 0 && (g(5) === 0xffff || g(5) === 0)) {
      return isBlockedIpv4(embeddedV4())
    }
    // NAT64 well-known prefix 64:ff9b::/96 (embeds an IPv4 address).
    if (g(0) === 0x64 && g(1) === 0xff9b && g(2) === 0 && g(3) === 0 && g(4) === 0 && g(5) === 0) {
      return isBlockedIpv4(embeddedV4())
    }
    if ((g(0) & 0xfe00) === 0xfc00) return true // fc00::/7 unique-local
    if ((g(0) & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
    if ((g(0) & 0xffc0) === 0xfec0) return true // fec0::/10 site-local (deprecated)
    if ((g(0) & 0xff00) === 0xff00) return true // ff00::/8 multicast
    return false
  }
  return isBlockedIpv4(value)
}

const BLOCKED_HOST_SUFFIXES = [".local", ".internal", ".localhost"]
function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase()
  return (
    h === "localhost" ||
    h === "metadata.google.internal" ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => h.endsWith(suffix))
  )
}

async function resolveHostIps(host: string): Promise<string[]> {
  const results: string[] = []
  for (const type of ["A", "AAAA"] as const) {
    try {
      results.push(...(await Deno.resolveDns(host, type)))
    } catch (err) {
      // A permission error means we cannot verify the address -> fail closed.
      if (err instanceof Deno.errors.PermissionDenied) throw err
      // Otherwise: NXDOMAIN / no records of this type.
    }
  }
  return results
}

async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error("Invalid URL")
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http(s) URLs are allowed")
  }

  const host = url.hostname.replace(/^\[|\]$/g, "")
  if (!host) throw new Error("Invalid URL host")
  if (isBlockedHostname(host)) throw new Error("Blocked host")

  const isIpLiteral = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")
  if (isIpLiteral) {
    if (isBlockedIp(host)) throw new Error("Blocked address")
    return url
  }

  const ips = await resolveHostIps(host)
  if (ips.length === 0) throw new Error("Host did not resolve")
  if (ips.some(isBlockedIp)) throw new Error("Host resolves to a blocked address")
  return url
}

// --- capped fetch with manual redirect handling -----------------------------
async function safeFetch(rawUrl: string): Promise<string> {
  let current = new URL(rawUrl)

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertSafeUrl(current.toString())

    const res = await fetch(current, {
      redirect: "manual",
      headers: {
        "User-Agent": "LCCBConnectBot/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get("location")
      if (!location) throw new Error("Redirect without a Location header")
      current = new URL(location, current) // re-validated on the next iteration
      continue
    }

    if (!res.ok) throw new Error(`Upstream responded with ${res.status}`)

    const reader = res.body?.getReader()
    if (!reader) return ""

    const chunks: Uint8Array[] = []
    let total = 0
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      total += value.length
    }
    await reader.cancel().catch(() => {})

    const merged = new Uint8Array(Math.min(total, MAX_BYTES))
    let offset = 0
    for (const chunk of chunks) {
      if (offset >= merged.length) break
      const slice = chunk.subarray(0, merged.length - offset)
      merged.set(slice, offset)
      offset += slice.length
    }
    return new TextDecoder("utf-8").decode(merged)
  }

  throw new Error("Too many redirects")
}

// --- Open Graph extraction --------------------------------------------------
function extractMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
  ]
  for (const re of patterns) {
    const match = html.match(re)
    if (match) return match[1]
  }
  return null
}

function clamp(value: string | null, max: number): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeadersFor(req) })
  }
  if (req.method !== "POST") {
    return json(req, { error: "Method not allowed" }, 405)
  }

  // 1. Require an authenticated caller.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim()
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return json(req, { error: "Authentication required" }, 401)
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !userData?.user) {
    return json(req, { error: "Invalid or expired token" }, 401)
  }

  try {
    const { url } = await req.json()
    if (!url || typeof url !== "string") {
      return json(req, { error: "URL is required" }, 400)
    }

    const html = await safeFetch(url)
    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? null

    // Only ever return extracted metadata — never echo arbitrary HTML.
    const preview = {
      title: clamp(extractMeta(html, "og:title") ?? titleTag, 300),
      description: clamp(extractMeta(html, "og:description"), 600),
      image: clamp(extractMeta(html, "og:image"), 2048),
      url: clamp(extractMeta(html, "og:url") ?? url, 2048),
    }

    return json(req, preview, 200)
  } catch (error) {
    // Log server-side; never leak internal error details to the caller.
    console.error("[link-preview]", error?.message ?? error)
    return json(req, { error: "Unable to generate a preview for that URL" }, 400)
  }
})
