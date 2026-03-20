"use client";

// /lib/errors/ErrorBoundary.tsx

import React from "react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children:  React.ReactNode;
  fallback?: React.ReactNode;
  variant?:  "page" | "panel" | "map" | "inline";
  label?:    string; // context label for logging
  onError?:  (error: Error, info: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error:    Error | null;
}

// ─── Class component (required for componentDidCatch) ─────────────────────────

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const label = this.props.label ?? "unknown";

    // Structured log — Vercel picks this up in Function Logs
    console.error(JSON.stringify({
      level:     "error",
      message:   `[ErrorBoundary:${label}] ${error.message}`,
      component: info.componentStack?.split("\n")[1]?.trim(),
      stack:     error.stack?.split("\n").slice(0, 4).join(" | "),
      ts:        new Date().toISOString(),
    }));

    this.props.onError?.(error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback)  return this.props.fallback;

    const { variant = "panel", label } = this.props;
    const { error } = this.state;

    return <ErrorFallback variant={variant} error={error} label={label} onReset={this.reset} />;
  }
}

// ─── Fallback UI ──────────────────────────────────────────────────────────────

function ErrorFallback({
  variant,
  error,
  label,
  onReset,
}: {
  variant: "page" | "panel" | "map" | "inline";
  error:   Error | null;
  label?:  string;
  onReset: () => void;
}) {
  if (variant === "page") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-red-100 rounded-3xl flex items-center justify-center mx-auto">
            <span className="text-3xl">⚠️</span>
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Something went wrong</h1>
            <p className="text-slate-500 mt-2 text-sm">
              An unexpected error occurred{label ? ` in ${label}` : ""}. The team has been notified.
            </p>
          </div>
          {process.env.NODE_ENV === "development" && error && (
            <pre className="text-left text-xs bg-slate-900 text-red-400 p-4 rounded-2xl overflow-auto max-h-40">
              {error.message}
            </pre>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={onReset}
              className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-black transition-colors"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.href = "/"}
              className="px-6 py-3 border border-slate-200 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors"
            >
              Go home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "map") {
    return (
      <div className="w-full h-full min-h-[300px] bg-slate-100 rounded-3xl flex flex-col items-center justify-center gap-3 border border-slate-200">
        <span className="text-4xl">🗺️</span>
        <p className="font-bold text-slate-600 text-sm">Map unavailable</p>
        <p className="text-slate-400 text-xs text-center max-w-[200px]">
          Live map failed to load. Text directions are available below.
        </p>
        <button
          onClick={onReset}
          className="mt-1 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-red-500 font-bold">
        <span>⚠</span>
        <span>Failed to load{label ? ` ${label}` : ""}</span>
        <button onClick={onReset} className="underline hover:no-underline">retry</button>
      </span>
    );
  }

  // panel (default)
  return (
    <div className={cn(
      "rounded-3xl border border-red-100 bg-red-50 p-6 flex flex-col items-center gap-3 text-center",
    )}>
      <span className="text-2xl">⚠️</span>
      <div>
        <p className="font-black text-slate-800 text-sm">
          {label ? `${label} failed to load` : "Component error"}
        </p>
        <p className="text-slate-500 text-xs mt-1">
          {process.env.NODE_ENV === "development" ? error?.message : "Please try again."}
        </p>
      </div>
      <button
        onClick={onReset}
        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
      >
        Retry
      </button>
    </div>
  );
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

export function PageErrorBoundary({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary variant="page" label="page">{children}</ErrorBoundary>;
}

export function MapErrorBoundary({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary variant="map" label="map">{children}</ErrorBoundary>;
}

export function PanelErrorBoundary({ children, label }: { children: React.ReactNode; label?: string }) {
  return <ErrorBoundary variant="panel" label={label}>{children}</ErrorBoundary>;
}
