"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScenarioId = "normal" | "reroute" | "fallback" | "multi";
export type StepStatus = "pending" | "active" | "done" | "error";

export interface ScenarioStep {
  id: string;
  label: string;
  detail: string;
  stakeholder: "citizen" | "ambulance" | "hospital" | "traffic" | "ai";
  durationMs: number;
}

export interface ScenarioState {
  id: ScenarioId;
  status: "idle" | "running" | "done" | "reset";
  currentStepIndex: number;
  steps: ScenarioStep[];
  metrics: Record<string, string | number>;
  log: string[];
}

// ─── Scenario Definitions ─────────────────────────────────────────────────────

const SCENARIOS: Record<ScenarioId, Omit<ScenarioState, "status" | "currentStepIndex" | "log">> = {
  normal: {
    id: "normal",
    steps: [
      { id: "n1", label: "Emergency Triggered",  detail: "Citizen reports cardiac arrest at Sector 4, Block B",                  stakeholder: "citizen",   durationMs: 1800 },
      { id: "n2", label: "AI Dispatch",           detail: "AI scores 6 candidates — AMB-1234 selected (1.2 km, 94% acceptance)", stakeholder: "ai",        durationMs: 1400 },
      { id: "n3", label: "Driver Notified",       detail: "AMB-1234 receives push alert, accepts within 4s",                    stakeholder: "ambulance", durationMs: 1600 },
      { id: "n4", label: "Route Calculated",      detail: "Optimal path via Main Blvd → North Ave (8 min ETA)",                 stakeholder: "ai",        durationMs: 1200 },
      { id: "n5", label: "Hospital Alerted",      detail: "City General Hospital notified — trauma team on standby",            stakeholder: "hospital",  durationMs: 1000 },
      { id: "n6", label: "Junctions Cleared",     detail: "J001, J002 alerted — green corridor active",                        stakeholder: "traffic",   durationMs: 1000 },
      { id: "n7", label: "Patient Picked Up",     detail: "AMB-1234 confirms pickup — en route to hospital",                   stakeholder: "ambulance", durationMs: 1800 },
      { id: "n8", label: "Arrived at Hospital",   detail: "Total response time: 9m 42s ✓",                                     stakeholder: "hospital",  durationMs: 1200 },
    ],
    metrics: { responseTime: "9m 42s", distanceKm: "1.2", rerouteCount: 0, driversContacted: 1 },
  },
  reroute: {
    id: "reroute",
    steps: [
      { id: "r1", label: "Emergency Triggered",    detail: "Road accident reported — Sector 2, Market Street",                    stakeholder: "citizen",   durationMs: 1600 },
      { id: "r2", label: "Initial Route Set",      detail: "Route via South Street → Main Blvd (6 min ETA)",                     stakeholder: "ai",        durationMs: 1200 },
      { id: "r3", label: "Traffic Jam Detected",   detail: "Severe congestion on South Street (R003) — trafficFactor: 2.4×",     stakeholder: "ai",        durationMs: 1800 },
      { id: "r4", label: "AI Rerouting",           detail: "A* recalculates avoiding R003 — new path via Ring Road",             stakeholder: "ai",        durationMs: 2000 },
      { id: "r5", label: "Driver Updated",         detail: "Turn-by-turn navigation updated in real-time",                       stakeholder: "ambulance", durationMs: 1000 },
      { id: "r6", label: "Hospital ETA Updated",   detail: "Memorial Medical notified — ETA revised to 11 min (Δ+5m)",          stakeholder: "hospital",  durationMs: 1000 },
      { id: "r7", label: "Old Junctions Cancelled",detail: "J003 alert cancelled — J006 (Ring Road) newly alerted",             stakeholder: "traffic",   durationMs: 1200 },
      { id: "r8", label: "Arrived via Alt Route",  detail: "Total response time: 11m 18s — reroute saved ~4 min vs blocked path",stakeholder: "hospital",  durationMs: 1400 },
    ],
    metrics: { responseTime: "11m 18s", distanceKm: "3.1", rerouteCount: 1, driversContacted: 1 },
  },
  fallback: {
    id: "fallback",
    steps: [
      { id: "f1", label: "Emergency Triggered",  detail: "Stroke reported — Sector 1, Residential Zone",                    stakeholder: "citizen",   durationMs: 1600 },
      { id: "f2", label: "AMB-1237 Notified",    detail: "Nearest driver (0.8 km) receives dispatch alert",                 stakeholder: "ambulance", durationMs: 1400 },
      { id: "f3", label: "AMB-1237 Declines",    detail: "No response after 10s timeout — marked declined",                 stakeholder: "ambulance", durationMs: 2200 },
      { id: "f4", label: "Auto-Reassignment",    detail: "AI immediately tries AMB-1238 (1.4 km, 91% acceptance)",          stakeholder: "ai",        durationMs: 1200 },
      { id: "f5", label: "AMB-1238 Accepts",     detail: "Driver accepts in 3s — assignment confirmed",                     stakeholder: "ambulance", durationMs: 1400 },
      { id: "f6", label: "Route Calculated",     detail: "Optimal path computed — ETA 10 min",                              stakeholder: "ai",        durationMs: 1000 },
      { id: "f7", label: "Stakeholders Notified",detail: "Hospital + junctions alerted with new vehicle details",           stakeholder: "hospital",  durationMs: 1000 },
      { id: "f8", label: "Zero Delay Achieved",  detail: "Fallback added only 13s overhead — total: 10m 55s",               stakeholder: "ai",        durationMs: 1200 },
    ],
    metrics: { responseTime: "10m 55s", distanceKm: "1.4", rerouteCount: 0, driversContacted: 2 },
  },
  multi: {
    id: "multi",
    steps: [
      { id: "m1", label: "Emergency En Route",       detail: "AMB-1235 transporting patient — ETA 12 min",                          stakeholder: "ambulance", durationMs: 1400 },
      { id: "m2", label: "Route Change Detected",    detail: "New obstacle on North Ave — AI triggers reroute",                     stakeholder: "ai",        durationMs: 1800 },
      { id: "m3", label: "Hospital ETA Updated",     detail: "City General: ETA revised 12m → 15m (Δ+3m, threshold exceeded)",     stakeholder: "hospital",  durationMs: 1200 },
      { id: "m4", label: "New Junctions Alerted",    detail: "J004, J007 added to green corridor",                                  stakeholder: "traffic",   durationMs: 1000 },
      { id: "m5", label: "Old Junctions Cancelled",  detail: "J002 alert cancelled — officer released",                            stakeholder: "traffic",   durationMs: 1000 },
      { id: "m6", label: "Hospital Prep Updated",    detail: "Trauma team notified of 3-min delay — checklist adjusted",           stakeholder: "hospital",  durationMs: 1200 },
      { id: "m7", label: "Citizen Tracking Updated", detail: "Live ETA on citizen tracking page refreshed",                        stakeholder: "citizen",   durationMs:  800 },
      { id: "m8", label: "All Stakeholders Synced",  detail: "4 parties updated in 1.2s — zero manual coordination",               stakeholder: "ai",        durationMs: 1400 },
    ],
    metrics: { responseTime: "15m 02s", distanceKm: "2.8", rerouteCount: 1, driversContacted: 1 },
  },
};

// ─── Config ───────────────────────────────────────────────────────────────────

export const STAKEHOLDER_CONFIG = {
  citizen:   { label: "Citizen",   color: "bg-blue-500",    light: "bg-blue-50 text-blue-700 border-blue-200",         dot: "bg-blue-500"   },
  ambulance: { label: "Ambulance", color: "bg-red-500",     light: "bg-red-50 text-red-700 border-red-200",            dot: "bg-red-500"    },
  hospital:  { label: "Hospital",  color: "bg-emerald-500", light: "bg-emerald-50 text-emerald-700 border-emerald-200",dot: "bg-emerald-500"},
  traffic:   { label: "Traffic",   color: "bg-amber-500",   light: "bg-amber-50 text-amber-700 border-amber-200",      dot: "bg-amber-500"  },
  ai:        { label: "AI Brain",  color: "bg-violet-500",  light: "bg-violet-50 text-violet-700 border-violet-200",   dot: "bg-violet-500" },
};

export const SCENARIO_META: Record<ScenarioId, { title: string; subtitle: string; icon: string; color: string }> = {
  normal:  { title: "Normal Route",            subtitle: "Baseline dispatch flow",          icon: "🟢", color: "border-emerald-400 bg-emerald-50" },
  reroute: { title: "Dynamic Rerouting",        subtitle: "AI detects & avoids traffic jam", icon: "🔄", color: "border-blue-400 bg-blue-50"       },
  fallback:{ title: "Fallback Mechanism",       subtitle: "Auto-reassignment on decline",    icon: "🔁", color: "border-amber-400 bg-amber-50"     },
  multi:   { title: "Multi-stakeholder Update", subtitle: "Synchronized route change",       icon: "📡", color: "border-violet-400 bg-violet-50"   },
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useScenario() {
  const [state, setState] = useState<ScenarioState>({
    id: "normal", status: "idle", currentStepIndex: -1,
    steps: SCENARIOS.normal.steps, metrics: SCENARIOS.normal.metrics, log: [],
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = () => { if (timerRef.current) clearTimeout(timerRef.current); };

  const runStep = useCallback((scenarioId: ScenarioId, steps: ScenarioStep[], index: number) => {
    if (index >= steps.length) {
      setState(s => ({ ...s, status: "done", currentStepIndex: steps.length }));
      return;
    }
    const step = steps[index];
    setState(s => ({
      ...s,
      currentStepIndex: index,
      log: [`[${new Date().toLocaleTimeString()}] ${step.label}: ${step.detail}`, ...s.log].slice(0, 20),
    }));
    timerRef.current = setTimeout(() => runStep(scenarioId, steps, index + 1), step.durationMs);
  }, []);

  const start = useCallback((id: ScenarioId) => {
    clearTimer();
    const def = SCENARIOS[id];
    setState({ id, status: "running", currentStepIndex: -1, steps: def.steps, metrics: def.metrics, log: [] });
    timerRef.current = setTimeout(() => runStep(id, def.steps, 0), 400);
  }, [runStep]);

  const reset = useCallback(() => {
    clearTimer();
    setState(s => ({ ...s, status: "reset", currentStepIndex: -1, log: [] }));
  }, []);

  useEffect(() => () => clearTimer(), []);
  return { state, start, reset };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepRow({ step, index, currentIndex, totalSteps }: {
  step: ScenarioStep; index: number; currentIndex: number; totalSteps: number;
}) {
  const cfg     = STAKEHOLDER_CONFIG[step.stakeholder];
  const isDone  = index < currentIndex || currentIndex >= totalSteps;
  const isActive = index === currentIndex;

  return (
    <div className={cn(
      "flex items-start gap-3 p-3 rounded-xl border transition-all duration-500",
      isActive  && "border-slate-300 bg-white shadow-md scale-[1.01]",
      isDone    && "border-transparent bg-slate-50 opacity-60",
      !isActive && !isDone && "border-transparent bg-transparent opacity-30",
    )}>
      <div className={cn(
        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5 transition-all",
        isActive ? `${cfg.color} text-white shadow-sm` : isDone ? "bg-slate-200 text-slate-500" : "bg-slate-100 text-slate-300",
      )}>
        {isDone ? "✓" : index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-xs font-black", isActive ? "text-slate-900" : "text-slate-500")}>{step.label}</span>
          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full border", cfg.light)}>{cfg.label}</span>
          {isActive && <span className="text-[10px] text-slate-400 animate-pulse">● processing</span>}
        </div>
        {isActive && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{step.detail}</p>}
      </div>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center bg-white border border-slate-100 rounded-2xl px-4 py-3 shadow-sm min-w-[80px]">
      <span className="text-lg font-black text-slate-900 tabular-nums">{value}</span>
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 text-center">{label}</span>
    </div>
  );
}

function LogFeed({ entries }: { entries: string[] }) {
  return (
    <div className="bg-slate-950 rounded-2xl p-4 h-32 overflow-y-auto font-mono text-[11px] space-y-1">
      {entries.length === 0
        ? <span className="text-slate-600">Waiting for scenario to start...</span>
        : entries.map((e, i) => (
          <div key={i} className={cn("text-slate-400", i === 0 && "text-emerald-400 font-bold")}>{e}</div>
        ))
      }
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ScenarioController() {
  const { state, start, reset } = useScenario();
  const [selected, setSelected] = useState<ScenarioId>("normal");

  const isRunning = state.status === "running";
  const isDone    = state.status === "done";
  const progress  = state.steps.length > 0
    ? Math.round((Math.max(0, state.currentStepIndex) / state.steps.length) * 100)
    : 0;

  return (
    <div className="space-y-5">
      {/* Scenario Selector */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(Object.keys(SCENARIO_META) as ScenarioId[]).map(id => {
          const meta = SCENARIO_META[id];
          const isActive = selected === id;
          return (
            <button
              key={id}
              onClick={() => { setSelected(id); if (!isRunning) reset(); }}
              disabled={isRunning}
              className={cn(
                "text-left p-3 rounded-2xl border-2 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed",
                isActive ? `${meta.color} border-opacity-100` : "border-slate-200 bg-white hover:border-slate-300",
              )}
            >
              <div className="text-lg mb-1">{meta.icon}</div>
              <div className="text-xs font-black text-slate-900 leading-tight">{meta.title}</div>
              <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{meta.subtitle}</div>
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <Button
          onClick={() => start(selected)}
          disabled={isRunning}
          className="rounded-xl font-black text-xs uppercase tracking-widest h-10 px-6 bg-slate-900 hover:bg-black text-white"
        >
          {isDone ? "▶ Replay" : "▶ Run Scenario"}
        </Button>
        <Button
          variant="outline"
          onClick={reset}
          disabled={isRunning}
          className="rounded-xl font-black text-xs uppercase tracking-widest h-10 px-4"
        >
          ↺ Reset
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {isRunning && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
              LIVE
            </span>
          )}
          {isDone && <Badge className="bg-emerald-100 text-emerald-700 border-none font-black text-[10px]">COMPLETE</Badge>}
          {(isRunning || isDone) && <span className="text-xs font-bold text-slate-400">{progress}%</span>}
        </div>
      </div>

      {/* Progress bar */}
      {(isRunning || isDone) && (
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-slate-900 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${isDone ? 100 : progress}%` }}
          />
        </div>
      )}

      {/* Steps */}
      <div className="space-y-1">
        {state.steps.map((step, i) => (
          <StepRow key={step.id} step={step} index={i} currentIndex={state.currentStepIndex} totalSteps={state.steps.length} />
        ))}
      </div>

      {/* Metrics */}
      {(isRunning || isDone) && (
        <div className="flex flex-wrap gap-2 pt-1">
          <MetricPill label="Response Time"  value={state.metrics.responseTime} />
          <MetricPill label="Distance (km)"  value={state.metrics.distanceKm} />
          <MetricPill label="Reroutes"       value={state.metrics.rerouteCount} />
          <MetricPill label="Drivers Tried"  value={state.metrics.driversContacted} />
        </div>
      )}

      {/* Log feed */}
      <LogFeed entries={state.log} />
    </div>
  );
}

export { SCENARIOS };
