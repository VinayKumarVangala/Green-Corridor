// /lib/errors/handleApiError.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AppError, toAppError, isAppError } from "./AppError";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "https://dummy.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dummy-key",
);

// ─── Structured log entry (Vercel Logs picks these up as JSON) ────────────────

interface LogEntry {
  level:     "info" | "warn" | "error";
  message:   string;
  code?:     string;
  endpoint?: string;
  userId?:   string;
  stack?:    string;
  context?:  Record<string, unknown>;
  ts:        string;
}

function structuredLog(entry: LogEntry) {
  const line = JSON.stringify(entry);
  if (entry.level === "error") console.error(line);
  else if (entry.level === "warn") console.warn(line);
  else console.log(line);
}

// ─── Persist non-operational errors to audit_logs for Supabase dashboard ─────

async function persistError(err: AppError, endpoint?: string) {
  if (err.isOperational) return; // operational errors are expected — don't pollute logs
  try {
    await supabase.from("audit_logs").insert({
      action: "SYSTEM_ERROR",
      details: {
        code:     err.code,
        message:  err.message,
        endpoint,
        context:  err.context,
        stack:    err.stack?.split("\n").slice(0, 5).join("\n"),
        ts:       new Date().toISOString(),
      },
    });
  } catch {
    // Never throw from error handler
  }
}

// ─── Main handler — use at the top of every API route catch block ─────────────

export function handleApiError(
  err: unknown,
  endpoint?: string,
): NextResponse {
  const appErr = toAppError(err);

  structuredLog({
    level:    appErr.statusCode >= 500 ? "error" : "warn",
    message:  appErr.message,
    code:     appErr.code,
    endpoint,
    context:  appErr.context,
    stack:    appErr.isOperational ? undefined : appErr.stack,
    ts:       new Date().toISOString(),
  });

  // Fire-and-forget persistence for programmer errors
  if (!appErr.isOperational) {
    persistError(appErr, endpoint).catch(() => {});
  }

  return NextResponse.json(appErr.toJSON(), { status: appErr.statusCode });
}

// ─── Retry with exponential backoff ──────────────────────────────────────────

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelayMs?: number;
    label?:       string;
    fallback?:    () => T | Promise<T>;
  } = {},
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 500, label = "operation", fallback } = options;

  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const delay = baseDelayMs * Math.pow(2, attempt - 1); // 500, 1000, 2000 ms

      structuredLog({
        level:   "warn",
        message: `${label} failed (attempt ${attempt}/${maxAttempts}) — retrying in ${delay}ms`,
        code:    isAppError(err) ? err.code : "UNKNOWN",
        ts:      new Date().toISOString(),
      });

      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  if (fallback) {
    structuredLog({ level: "warn", message: `${label} exhausted retries — using fallback`, ts: new Date().toISOString() });
    return fallback();
  }

  throw lastErr;
}

// ─── Supabase query wrapper with retry ───────────────────────────────────────

export async function safeQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  label = "db query",
): Promise<T> {
  return withRetry(
    async () => {
      const { data, error } = await queryFn();
      if (error) throw new Error(`[${label}] ${error.message}`);
      if (data === null) throw new Error(`[${label}] returned null`);
      return data;
    },
    { maxAttempts: 3, baseDelayMs: 300, label },
  );
}

// ─── OSRM / map API wrapper with text-direction fallback ─────────────────────

export interface TextDirections {
  fallback: true;
  message:  string;
  steps:    string[];
}

export async function safeRouteCalc<T>(
  routeFn: () => Promise<T | null>,
  startLabel: string,
  endLabel:   string,
): Promise<T | TextDirections> {
  try {
    const result = await withRetry(routeFn, { maxAttempts: 2, baseDelayMs: 1000, label: "OSRM route" });
    if (result) return result;
  } catch {
    // fall through to text directions
  }

  structuredLog({ level: "warn", message: "Map API unavailable — returning text directions", ts: new Date().toISOString() });

  return {
    fallback: true,
    message:  "Live map routing is temporarily unavailable. Follow these directions:",
    steps: [
      `Start at ${startLabel}`,
      "Head towards the nearest main road",
      "Follow emergency vehicle signage",
      `Destination: ${endLabel}`,
      "Contact dispatch for real-time guidance: 112",
    ],
  };
}
