/**
 * /api/settings/outbound-sandbox
 *
 * GET  — Return the active merged policy (env defaults + stored overrides).
 * PUT  — Validate and persist admin-supplied policy overrides.
 *
 * Access is restricted to users whose IDs appear in APP_ADMIN_USER_IDS.
 * All mutations are written to the audit log.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  defaultSandboxPolicy,
  SANDBOX_SETTINGS_KEY,
  type SandboxPolicy,
} from "@/lib/outbound-sandbox-config";

// ─── Auth helper (replace with your actual session/auth utility) ──────────────

async function getAdminUserId(req: NextRequest): Promise<string | null> {
  // TODO: replace with your actual auth implementation
  const userId = req.headers.get("x-user-id");
  if (!userId) return null;
  const adminIds = (process.env.APP_ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim());
  return adminIds.includes(userId) ? userId : null;
}

// ─── Settings store (replace with your actual KV / DB implementation) ─────────

async function readStoredPolicy(): Promise<Partial<SandboxPolicy>> {
  // TODO: replace with your actual persistence layer
  const raw = process.env[`SETTINGS_${SANDBOX_SETTINGS_KEY}`];
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Partial<SandboxPolicy>;
  } catch {
    return {};
  }
}

async function writeStoredPolicy(policy: Partial<SandboxPolicy>): Promise<void> {
  // TODO: replace with your actual persistence layer
  // This stub intentionally left for implementors — write to DB / KV here.
  void policy;
}

async function appendAuditLog(entry: {
  actor: string;
  action: string;
  payload: unknown;
  timestamp: string;
}): Promise<void> {
  // TODO: replace with your actual audit log writer
  console.info("[AUDIT]", JSON.stringify(entry));
}

// ─── Validation ───────────────────────────────────────────────────────────────

const BARE_HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;

type ValidationError = { field: string; message: string };

function validatePolicy(body: unknown): { policy: Partial<SandboxPolicy> } | { errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { errors: [{ field: "body", message: "Request body must be a JSON object" }] };
  }

  const raw = body as Record<string, unknown>;
  const out: Partial<SandboxPolicy> = {};

  // allowedHosts
  if ("allowedHosts" in raw) {
    if (!Array.isArray(raw.allowedHosts)) {
      errors.push({ field: "allowedHosts", message: "Must be an array of strings" });
    } else {
      const invalid = (raw.allowedHosts as unknown[]).filter(
        (h) => typeof h !== "string" || !BARE_HOSTNAME_RE.test(h as string)
      );
      if (invalid.length > 0) {
        errors.push({
          field: "allowedHosts",
          message: `Contains invalid hostnames: ${invalid.join(", ")}. Only bare hostnames (e.g. "api.example.com") are accepted.`,
        });
      } else {
        // Reject IP addresses in the allowlist — they would bypass IP-blocking checks
        const ips = (raw.allowedHosts as string[]).filter((h) =>
          /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":")
        );
        if (ips.length > 0) {
          errors.push({
            field: "allowedHosts",
            message: `IP addresses are not permitted in allowedHosts: ${ips.join(", ")}`,
          });
        } else {
          out.allowedHosts = (raw.allowedHosts as string[]).map((h) =>
            h.trim().toLowerCase()
          );
        }
      }
    }
  }

  // extraBlockedHosts
  if ("extraBlockedHosts" in raw) {
    if (!Array.isArray(raw.extraBlockedHosts)) {
      errors.push({ field: "extraBlockedHosts", message: "Must be an array of strings" });
    } else {
      const invalid = (raw.extraBlockedHosts as unknown[]).filter(
        (h) => typeof h !== "string" || !BARE_HOSTNAME_RE.test(h as string)
      );
      if (invalid.length > 0) {
        errors.push({
          field: "extraBlockedHosts",
          message: `Contains invalid hostnames: ${invalid.join(", ")}`,
        });
      } else {
        out.extraBlockedHosts = (raw.extraBlockedHosts as string[]).map((h) =>
          h.trim().toLowerCase()
        );
      }
    }
  }

  // auditAllRequests
  if ("auditAllRequests" in raw) {
    if (typeof raw.auditAllRequests !== "boolean") {
      errors.push({ field: "auditAllRequests", message: "Must be a boolean" });
    } else {
      out.auditAllRequests = raw.auditAllRequests;
    }
  }

  // Reject unknown keys
  const knownKeys: (keyof SandboxPolicy)[] = ["allowedHosts", "extraBlockedHosts", "auditAllRequests"];
  const unknown = Object.keys(raw).filter((k) => !knownKeys.includes(k as keyof SandboxPolicy));
  if (unknown.length > 0) {
    errors.push({
      field: "body",
      message: `Unknown policy fields: ${unknown.join(", ")}`,
    });
  }

  if (errors.length > 0) return { errors };
  return { policy: out };
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const adminId = await getAdminUserId(req);
  if (!adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const stored = await readStoredPolicy();
  const active: SandboxPolicy = { ...defaultSandboxPolicy, ...stored };

  return NextResponse.json({
    active,
    defaults: defaultSandboxPolicy,
    overrides: stored,
    // Surface which constraints are hard-coded (non-overridable)
    hardConstraints: {
      protocol: "https: only",
      method: "GET only",
      noIpAddresses: true,
      noPrivateRanges: true,
      noCredentialsInUrl: true,
      noExplicitPort: true,
      noPathTraversal: true,
      maxUrlLength: 2048,
      maxRedirects: 2,
      requestTimeoutMs: 10000,
      maxResponseBytes: 1048576,
      maxPathDepth: 10,
      allowedContentTypes: [
        "application/json",
        "text/plain",
        "text/html",
        "text/xml",
        "application/xml",
        "application/rss+xml",
        "application/atom+xml",
      ],
      sensitiveQueryParamsStripped: true,
    },
  });
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const adminId = await getAdminUserId(req);
  if (!adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Request body is not valid JSON" },
      { status: 400 }
    );
  }

  const result = validatePolicy(body);
  if ("errors" in result) {
    return NextResponse.json({ errors: result.errors }, { status: 422 });
  }

  await writeStoredPolicy(result.policy);
  await appendAuditLog({
    actor: adminId,
    action: "outbound-sandbox.policy.update",
    payload: result.policy,
    timestamp: new Date().toISOString(),
  });

  const stored = await readStoredPolicy();
  const active: SandboxPolicy = { ...defaultSandboxPolicy, ...stored };

  return NextResponse.json({ active }, { status: 200 });
}
