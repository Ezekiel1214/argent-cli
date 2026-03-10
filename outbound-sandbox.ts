/**
 * Outbound Sandbox
 *
 * Single entry-point for all external HTTP requests made by the application.
 * Every request is validated against both the hard constraints defined in
 * outbound-sandbox-config.ts and the active SandboxPolicy before any
 * network I/O takes place. Redirects are re-validated on each hop.
 *
 * Usage:
 *   const result = await sandboxFetch(url, policy);
 *   if (!result.ok) { ... result.reason ... }
 */

import {
  ALLOWED_CONTENT_TYPE_PREFIXES,
  ALLOWED_METHOD,
  ALLOWED_PROTOCOL,
  BLOCKED_HOSTNAME_PATTERNS,
  BLOCKED_IP_PREFIXES,
  MAX_PATH_DEPTH,
  MAX_REDIRECTS,
  MAX_RESPONSE_BYTES,
  MAX_URL_LENGTH,
  REQUEST_TIMEOUT_MS,
  STRIPPED_QUERY_PARAM_PATTERNS,
  type SandboxPolicy,
} from "./outbound-sandbox-config";

// ─── Public types ─────────────────────────────────────────────────────────────

export type SandboxSuccess = {
  ok: true;
  status: number;
  contentType: string;
  body: string;
  /** Final URL after any permitted redirects. */
  resolvedUrl: string;
};

export type SandboxFailure = {
  ok: false;
  reason: string;
  /** The URL that triggered the rejection (may be a redirect target). */
  rejectedUrl: string;
};

export type SandboxResult = SandboxSuccess | SandboxFailure;

// ─── Validation helpers ───────────────────────────────────────────────────────

/**
 * Returns true when the string looks like a bare IPv4 address.
 * We deliberately do NOT attempt DNS resolution here; DNS-rebinding
 * protection must be handled at the network layer (e.g. a resolver
 * that refuses private-range answers).
 */
function looksLikeIpAddress(hostname: string): boolean {
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return true;
  // IPv6 — presence of colons is sufficient signal
  if (hostname.includes(":")) return true;
  // IPv6 in brackets (already stripped by URL parser, but be defensive)
  if (hostname.startsWith("[") && hostname.endsWith("]")) return true;
  return false;
}

function isBlockedByPrefix(hostname: string): boolean {
  return BLOCKED_IP_PREFIXES.some((prefix) => hostname.startsWith(prefix));
}

function isBlockedByPattern(hostname: string): boolean {
  return BLOCKED_HOSTNAME_PATTERNS.some((re) => re.test(hostname));
}

function hasCredentials(parsed: URL): boolean {
  return parsed.username !== "" || parsed.password !== "";
}

function pathDepth(pathname: string): number {
  return pathname.split("/").filter(Boolean).length;
}

function hasPathTraversal(pathname: string): boolean {
  // Catch both encoded and raw forms
  const decoded = decodeURIComponent(pathname);
  return decoded.includes("../") || decoded.includes("..\\") || decoded === "..";
}

/**
 * Strip dangerous query parameters (e.g. credentials or tokens) before
 * forwarding. Returns the sanitised URL string.
 */
function sanitiseQueryParams(parsed: URL): URL {
  const cleaned = new URL(parsed.toString());
  const toDelete: string[] = [];
  for (const key of cleaned.searchParams.keys()) {
    if (STRIPPED_QUERY_PARAM_PATTERNS.some((re) => re.test(key))) {
      toDelete.push(key);
    }
  }
  toDelete.forEach((k) => cleaned.searchParams.delete(k));
  return cleaned;
}

/**
 * Core per-URL validation. Returns a human-readable rejection reason, or
 * null if the URL passes all checks.
 */
function validateUrl(
  rawUrl: string,
  policy: SandboxPolicy
): { parsed: URL; sanitised: URL } | { error: string } {
  // 1. Length guard (before parsing to avoid memory abuse)
  if (rawUrl.length > MAX_URL_LENGTH) {
    return { error: `URL exceeds maximum length of ${MAX_URL_LENGTH} characters` };
  }

  // 2. Parseable?
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { error: "URL is malformed and could not be parsed" };
  }

  // 3. Protocol / scheme
  if (parsed.protocol !== ALLOWED_PROTOCOL) {
    return { error: `Protocol "${parsed.protocol}" is not permitted; only https: is allowed` };
  }

  // 4. No credentials in URL
  if (hasCredentials(parsed)) {
    return { error: "URLs must not contain embedded credentials (user:password@host)" };
  }

  // 5. No explicit port (HTTPS enforces 443 implicitly; explicit ports open
  //    attack surface against non-standard services)
  if (parsed.port !== "") {
    return { error: `Explicit ports are not permitted; received port "${parsed.port}"` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 6. No raw IP addresses (SSRF / metadata endpoint protection)
  if (looksLikeIpAddress(hostname)) {
    return { error: `Direct IP addresses are not permitted; use a resolvable hostname` };
  }

  // 7. Blocked IP prefixes (belt-and-suspenders for numeric hostnames that
  //    slip past the regex above)
  if (isBlockedByPrefix(hostname)) {
    return { error: `Hostname "${hostname}" resolves to a reserved IP range` };
  }

  // 8. Blocked hostname patterns (localhost, *.local, metadata endpoints, etc.)
  if (isBlockedByPattern(hostname)) {
    return { error: `Hostname "${hostname}" matches a blocked pattern` };
  }

  // 9. Extra blocked hosts from policy
  if (policy.extraBlockedHosts.includes(hostname)) {
    return { error: `Hostname "${hostname}" is on the operator block list` };
  }

  // 10. Allowlist enforcement (when configured)
  if (
    policy.allowedHosts.length > 0 &&
    !policy.allowedHosts.includes(hostname)
  ) {
    return {
      error: `Hostname "${hostname}" is not on the permitted hosts list`,
    };
  }

  // 11. Bare hostname — must contain at least one dot (prevents single-label
  //     names like "internal" from slipping through if not caught above)
  if (!hostname.includes(".")) {
    return { error: `Single-label hostnames are not permitted (got "${hostname}")` };
  }

  // 12. Path traversal
  if (hasPathTraversal(parsed.pathname)) {
    return { error: "Path traversal sequences (../) are not permitted" };
  }

  // 13. Path depth
  if (pathDepth(parsed.pathname) > MAX_PATH_DEPTH) {
    return {
      error: `Path depth exceeds maximum of ${MAX_PATH_DEPTH} segments`,
    };
  }

  // 14. Strip sensitive query params
  const sanitised = sanitiseQueryParams(parsed);

  return { parsed, sanitised };
}

// ─── Core fetch ───────────────────────────────────────────────────────────────

/**
 * Perform a validated, sandboxed GET request to an external URL.
 *
 * @param rawUrl   The target URL (validated before any I/O).
 * @param policy   The active sandbox policy (env defaults + in-app overrides).
 */
export async function sandboxFetch(
  rawUrl: string,
  policy: SandboxPolicy
): Promise<SandboxResult> {
  let currentUrl = rawUrl;
  let redirectsFollowed = 0;

  while (true) {
    // Validate (and sanitise) the current URL
    const check = validateUrl(currentUrl, policy);
    if ("error" in check) {
      return { ok: false, reason: check.error, rejectedUrl: currentUrl };
    }

    const targetUrl = check.sanitised.toString();

    // Set up timeout via AbortController
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(targetUrl, {
        method: ALLOWED_METHOD,
        redirect: "manual", // We handle redirects manually so each hop is validated
        signal: controller.signal,
        headers: {
          // Neutral user-agent; avoids leaking application identity
          "User-Agent": "SandboxedFetcher/1.0",
          Accept: ALLOWED_CONTENT_TYPE_PREFIXES.map((ct) => ct).join(", "),
        },
      });
    } catch (err: unknown) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === "AbortError") {
        return {
          ok: false,
          reason: `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`,
          rejectedUrl: targetUrl,
        };
      }
      return {
        ok: false,
        reason: `Network error: ${err instanceof Error ? err.message : String(err)}`,
        rejectedUrl: targetUrl,
      };
    } finally {
      clearTimeout(timer);
    }

    // Handle redirects manually
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        return {
          ok: false,
          reason: "Redirect response missing Location header",
          rejectedUrl: targetUrl,
        };
      }

      redirectsFollowed += 1;
      if (redirectsFollowed > MAX_REDIRECTS) {
        return {
          ok: false,
          reason: `Exceeded maximum of ${MAX_REDIRECTS} redirects`,
          rejectedUrl: location,
        };
      }

      // Resolve relative redirect URLs against the current base
      try {
        currentUrl = new URL(location, targetUrl).toString();
      } catch {
        return {
          ok: false,
          reason: `Redirect target "${location}" is not a valid URL`,
          rejectedUrl: location,
        };
      }

      // Loop — the redirect target will be validated at the top of the next iteration
      continue;
    }

    // Validate Content-Type before reading body
    const rawContentType = response.headers.get("content-type") ?? "";
    const contentType = rawContentType.split(";")[0].trim().toLowerCase();
    const isAllowedContentType = ALLOWED_CONTENT_TYPE_PREFIXES.some((prefix) =>
      contentType.startsWith(prefix)
    );
    if (!isAllowedContentType) {
      return {
        ok: false,
        reason: `Response Content-Type "${contentType}" is not permitted`,
        rejectedUrl: targetUrl,
      };
    }

    // Enforce response size limit using a streaming read
    const reader = response.body?.getReader();
    if (!reader) {
      return {
        ok: false,
        reason: "Response body is not readable",
        rejectedUrl: targetUrl,
      };
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > MAX_RESPONSE_BYTES) {
          reader.cancel();
          return {
            ok: false,
            reason: `Response body exceeds maximum size of ${MAX_RESPONSE_BYTES / 1024}KB`,
            rejectedUrl: targetUrl,
          };
        }
        chunks.push(value);
      }
    } catch (err) {
      return {
        ok: false,
        reason: `Error reading response body: ${err instanceof Error ? err.message : String(err)}`,
        rejectedUrl: targetUrl,
      };
    }

    const body = new TextDecoder().decode(
      chunks.reduce((acc, chunk) => {
        const merged = new Uint8Array(acc.length + chunk.length);
        merged.set(acc);
        merged.set(chunk, acc.length);
        return merged;
      }, new Uint8Array(0))
    );

    return {
      ok: true,
      status: response.status,
      contentType: rawContentType,
      body,
      resolvedUrl: targetUrl,
    };
  }
}
