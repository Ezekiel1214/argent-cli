/**
 * Outbound Sandbox Configuration
 *
 * Defines the policy and hard constraints for all external HTTP requests
 * made by the sandbox. Defaults are loaded from environment variables;
 * app-admin overrides are persisted via the settings API and merged at
 * runtime.
 *
 * Hard constraints are NEVER overridable — they are enforced in
 * outbound-sandbox.ts regardless of what the settings store contains.
 */

// ─── Hard Constraint Constants ────────────────────────────────────────────────

/** Only HTTPS is permitted. HTTP and all other schemes are rejected. */
export const ALLOWED_PROTOCOL = "https:";

/** Only GET requests are permitted. */
export const ALLOWED_METHOD = "GET";

/** Maximum URL length (characters). Prevents oversized request abuse. */
export const MAX_URL_LENGTH = 2_048;

/** Maximum number of redirect hops to follow. Each hop is re-validated. */
export const MAX_REDIRECTS = 2;

/** Request timeout in milliseconds. */
export const REQUEST_TIMEOUT_MS = 10_000;

/** Maximum response body size in bytes (1 MB). */
export const MAX_RESPONSE_BYTES = 1_024 * 1_024;

/** Maximum path segment depth (number of "/" separators). */
export const MAX_PATH_DEPTH = 10;

/**
 * Blocked hostname patterns — matched against the final (post-redirect)
 * hostname in addition to the initial one.
 *
 * Covers: loopback, link-local, metadata endpoints, common internal
 * DNS suffixes, and cloud-provider instance-metadata addresses.
 */
export const BLOCKED_HOSTNAME_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^.*\.local$/i,
  /^.*\.internal$/i,
  /^.*\.corp$/i,
  /^.*\.lan$/i,
  /^.*\.intranet$/i,
  // AWS/GCP/Azure instance metadata
  /^169\.254\./,
  /^fd[0-9a-f]{2}:/i, // IPv6 link-local (fe80 covered below)
  /^fe80:/i,
];

/**
 * Blocked IPv4 CIDR ranges evaluated as string-prefix checks.
 * Direct IP addresses are always blocked; these cover the most
 * dangerous RFC-1918 / loopback / reserved ranges specifically.
 */
export const BLOCKED_IP_PREFIXES: string[] = [
  "10.",
  "172.16.",
  "172.17.",
  "172.18.",
  "172.19.",
  "172.20.",
  "172.21.",
  "172.22.",
  "172.23.",
  "172.24.",
  "172.25.",
  "172.26.",
  "172.27.",
  "172.28.",
  "172.29.",
  "172.30.",
  "172.31.",
  "192.168.",
  "127.",
  "0.",
  "169.254.",
  "100.64.", // Shared address space (RFC 6598)
  "198.18.", // Benchmarking (RFC 2544)
  "198.51.100.",
  "203.0.113.",
  "240.", // Reserved
  "255.",
];

/**
 * Response Content-Type values that are accepted. Requests whose responses
 * carry a different Content-Type are rejected after the headers arrive but
 * before the body is read.
 */
export const ALLOWED_CONTENT_TYPE_PREFIXES: string[] = [
  "application/json",
  "text/plain",
  "text/html",
  "text/xml",
  "application/xml",
  "application/rss+xml",
  "application/atom+xml",
];

/**
 * Query-parameter key patterns that are always stripped before the request
 * is forwarded. Prevents common injection / credential-leakage patterns.
 */
export const STRIPPED_QUERY_PARAM_PATTERNS: RegExp[] = [
  /^(access[_-]?token|api[_-]?key|apikey|secret|password|passwd|pwd|token|auth|bearer|x-api-key)$/i,
];

// ─── Configurable Policy (env defaults + in-app overrides) ───────────────────

export interface SandboxPolicy {
  /**
   * Explicit allowlist of bare hostnames. When non-empty, ONLY these hosts
   * are permitted; all others are rejected even if they pass all other checks.
   * When empty, all hosts that pass the block-list and constraint checks are
   * permitted.
   */
  allowedHosts: string[];

  /**
   * Additional hosts to block beyond the built-in patterns above.
   * Supports exact bare hostnames only (no wildcards, no globs).
   */
  extraBlockedHosts: string[];

  /**
   * When true, all outbound requests are logged to the audit trail even
   * on success. When false, only failures and rejections are logged.
   */
  auditAllRequests: boolean;
}

const DEFAULT_ALLOWED_HOSTS = (process.env.SANDBOX_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

const DEFAULT_BLOCKED_HOSTS = (process.env.SANDBOX_BLOCKED_HOSTS ?? "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

export const defaultSandboxPolicy: SandboxPolicy = {
  allowedHosts: DEFAULT_ALLOWED_HOSTS,
  extraBlockedHosts: DEFAULT_BLOCKED_HOSTS,
  auditAllRequests: process.env.SANDBOX_AUDIT_ALL === "true",
};

// ─── Settings-store key (used by the settings API route) ─────────────────────

export const SANDBOX_SETTINGS_KEY = "outbound-sandbox-policy";
