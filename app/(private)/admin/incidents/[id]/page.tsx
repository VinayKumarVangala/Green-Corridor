"use client"

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, CheckCircle, XCircle, Clock, MapPin, Truck, Building2, AlertTriangle, RefreshCw, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

interface TimelineEvent {
  label: string;
  time: string | null;
  icon: any;
  color: string;
  durationLabel?: string;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function IncidentDetailPage() {
  const params = useParams();
  const incidentId = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [feedbackOutcome, setFeedbackOutcome] = useState<"success" | "failure" | null>(null);
  const [feedbackType, setFeedbackType] = useState("dispatch");
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);

  useEffect(() => {
    fetch(`/api/analytics/export/${incidentId}?format=json`)
      .then((r) => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [incidentId]);

  async function submitFeedback() {
    if (!feedbackOutcome) return;
    setSubmitting(true);
    try {
      await fetch("/api/analytics/ai-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentId,
          decisionType: feedbackType,
          outcome: feedbackOutcome,
          notes: feedbackNotes || undefined,
        }),
      });
      setFeedbackDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-slate-400 font-bold animate-pulse">Loading incident…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-10">
        <Link href="/admin/incidents" className="flex items-center gap-2 text-slate-400 font-bold text-sm mb-6 hover:text-slate-600">
          <ArrowLeft className="h-4 w-4" /> Back to Incidents
        </Link>
        <p className="text-slate-500 font-bold">Incident not found or analytics not yet recorded.</p>
      </div>
    );
  }

  const tl = data.timeline;
  const dur = data.durations;

  const timelineEvents: TimelineEvent[] = [
    { label: "Emergency Requested", time: tl.request_created, icon: AlertTriangle, color: "text-red-500", durationLabel: undefined },
    { label: "Ambulance Dispatched", time: tl.first_assignment, icon: Truck, color: "text-blue-600", durationLabel: `Dispatch: ${formatDuration(dur.dispatch_seconds)}` },
    { label: "Driver Accepted", time: tl.driver_accepted, icon: CheckCircle, color: "text-violet-600", durationLabel: `Acceptance: ${formatDuration(dur.acceptance_seconds)}` },
    { label: "Patient Picked Up", time: tl.pickup_confirmed, icon: MapPin, color: "text-amber-500", durationLabel: `To pickup: ${formatDuration(dur.pickup_seconds)}` },
    { label: "Arrived at Hospital", time: tl.hospital_arrived, icon: Building2, color: "text-emerald-600", durationLabel: `Transport: ${formatDuration(dur.transport_seconds)}` },
  ];

  // Improvement suggestions based on data
  const suggestions: string[] = [];
  if (dur.dispatch_seconds > 60) suggestions.push("Dispatch took over 1 minute — consider expanding ambulance search radius.");
  if (data.assignment?.declined_count > 1) suggestions.push(`${data.assignment.declined_count} drivers declined — review driver availability thresholds.`);
  if (data.route?.changes_count > 2) suggestions.push("Multiple reroutes detected — traffic prediction model may need recalibration.");
  if (data.hospital?.capacity_at_arrival === "critical") suggestions.push("Hospital was at critical capacity on arrival — hospital selection algorithm should penalize critical hospitals more.");
  if (dur.total_minutes > 30) suggestions.push("Total response exceeded 30 minutes — review all phases for bottlenecks.");

  return (
    <div className="p-6 lg:p-10 space-y-8 min-h-screen">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link href="/admin/incidents" className="flex items-center gap-2 text-slate-400 font-bold text-sm mb-3 hover:text-slate-600">
            <ArrowLeft className="h-4 w-4" /> Back to Incidents
          </Link>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {data.incident?.emergency_type ?? "Incident"} Review
          </h1>
          <p className="text-slate-400 font-bold text-sm mt-1 font-mono">{incidentId}</p>
        </div>
        <div className="flex gap-3">
          <a
            href={`/api/analytics/export/${incidentId}?format=csv`}
            className="flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Download className="h-4 w-4" /> CSV
          </a>
          <a
            href={`/api/analytics/export/${incidentId}?format=json`}
            className="flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Download className="h-4 w-4" /> JSON
          </a>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Timeline + Decisions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Timeline */}
          <Card className="border-none shadow-sm rounded-3xl bg-white">
            <CardHeader className="p-6 pb-2">
              <CardTitle className="text-base font-black text-slate-900 uppercase tracking-widest">Incident Timeline</CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-2">
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-100" />
                <div className="space-y-6">
                  {timelineEvents.map((ev, i) => (
                    <div key={i} className="flex items-start gap-4 relative">
                      <div className={`w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 z-10 ${ev.time ? "" : "opacity-30"}`}>
                        <ev.icon className={`h-4 w-4 ${ev.color}`} />
                      </div>
                      <div className="flex-1 pt-1.5">
                        <p className={`text-sm font-black ${ev.time ? "text-slate-900" : "text-slate-300"}`}>{ev.label}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-slate-400 font-bold">{formatTime(ev.time)}</span>
                          {ev.durationLabel && (
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{ev.durationLabel}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Response Time</span>
                <span className="text-2xl font-black text-slate-900">{dur.total_minutes ?? "—"}m</span>
              </div>
            </CardContent>
          </Card>

          {/* Driver Decisions */}
          {data.driver_decisions?.length > 0 && (
            <Card className="border-none shadow-sm rounded-3xl bg-white">
              <CardHeader className="p-6 pb-2">
                <CardTitle className="text-base font-black text-slate-900 uppercase tracking-widest">Driver Decision Points</CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-2 space-y-3">
                {data.driver_decisions.map((d: any, i: number) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${d.decision === "accepted" ? "bg-emerald-50" : d.decision === "declined" ? "bg-red-50" : "bg-amber-50"}`}>
                      {d.decision === "accepted" ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : d.decision === "declined" ? <XCircle className="h-4 w-4 text-red-500" /> : <Clock className="h-4 w-4 text-amber-500" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-black text-slate-900">
                        Attempt #{d.attempt} — {d.driver_vehicle ?? "Unknown Vehicle"}
                      </p>
                      <p className="text-xs text-slate-400 font-bold">
                        {d.decision} in {d.decision_time_seconds}s
                        {d.decline_reason ? ` · "${d.decline_reason}"` : ""}
                        {d.distance_km ? ` · ${d.distance_km}km away` : ""}
                      </p>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase ${d.decision === "accepted" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : d.decision === "declined" ? "bg-red-50 text-red-500 border-red-100" : "bg-amber-50 text-amber-500 border-amber-100"}`}>
                      {d.decision}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Route Changes */}
          {data.route_changes?.length > 0 && (
            <Card className="border-none shadow-sm rounded-3xl bg-white">
              <CardHeader className="p-6 pb-2">
                <CardTitle className="text-base font-black text-slate-900 uppercase tracking-widest">Route Changes</CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-2 space-y-3">
                {data.route_changes.map((r: any, i: number) => (
                  <div key={i} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-sm font-black text-slate-900">Reroute #{r.change_number}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{r.reason}</span>
                      </div>
                      {r.improvement_percent != null && (
                        <span className={`text-xs font-black ${r.improvement_percent > 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {r.improvement_percent > 0 ? "+" : ""}{r.improvement_percent}% improvement
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 font-bold">
                      Triggered by: {r.triggered_by} · {r.junctions_cancelled} junctions cancelled, {r.junctions_added} added
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Improvement Suggestions */}
          {suggestions.length > 0 && (
            <Card className="border-none shadow-sm rounded-3xl bg-amber-50 border border-amber-100">
              <CardHeader className="p-6 pb-2">
                <CardTitle className="text-base font-black text-amber-700 uppercase tracking-widest flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Improvement Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-2 space-y-2">
                {suggestions.map((s, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 shrink-0" />
                    <p className="text-sm text-amber-800 font-medium">{s}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Summary + AI Feedback */}
        <div className="space-y-6">
          {/* Incident Summary */}
          <Card className="border-none shadow-sm rounded-3xl bg-white">
            <CardHeader className="p-6 pb-2">
              <CardTitle className="text-base font-black text-slate-900 uppercase tracking-widest">Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-2 space-y-3">
              {[
                { label: "Emergency Type", value: data.incident?.emergency_type },
                { label: "Location", value: data.incident?.location?.address },
                { label: "Hospital", value: data.hospital?.name },
                { label: "Hospital Status", value: data.hospital?.capacity_at_arrival },
                { label: "Driver", value: data.assignment?.final_driver?.vehicle_number },
                { label: "Dispatch Attempts", value: data.assignment?.total_attempts },
                { label: "Route Changes", value: data.route?.changes_count },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-start gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">{label}</span>
                  <span className="text-xs font-bold text-slate-700 text-right">{value ?? "—"}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Performance Scores */}
          {data.performance && (
            <Card className="border-none shadow-sm rounded-3xl bg-white">
              <CardHeader className="p-6 pb-2">
                <CardTitle className="text-base font-black text-slate-900 uppercase tracking-widest">Performance</CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-2 space-y-4">
                {[
                  { label: "Response Efficiency", value: data.performance.response_efficiency },
                  { label: "Route Efficiency", value: data.performance.route_efficiency },
                  { label: "Coordination Score", value: data.performance.coordination_score },
                ].map(({ label, value }) => {
                  const pct = value != null ? Math.round(value * 100) : null;
                  return (
                    <div key={label}>
                      <div className="flex justify-between mb-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                        <span className="text-xs font-black text-slate-700">{pct != null ? `${pct}%` : "—"}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pct != null && pct >= 70 ? "bg-emerald-500" : pct != null && pct >= 40 ? "bg-amber-400" : "bg-red-400"}`}
                          style={{ width: `${pct ?? 0}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* AI Feedback Form */}
          <Card className="border-none shadow-sm rounded-3xl bg-white">
            <CardHeader className="p-6 pb-2">
              <CardTitle className="text-base font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Brain className="h-4 w-4" /> AI Learning Feedback
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-2">
              {feedbackDone ? (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  <p className="text-sm font-black text-emerald-700">Feedback recorded. AI weights will adapt.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Decision Type</label>
                    <select
                      value={feedbackType}
                      onChange={(e) => setFeedbackType(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white focus:ring-2 focus:ring-slate-900 outline-none"
                    >
                      <option value="dispatch">Dispatch Decision</option>
                      <option value="route">Route Selection</option>
                      <option value="hospital">Hospital Selection</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Outcome</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setFeedbackOutcome("success")}
                        className={`flex-1 h-10 rounded-xl text-xs font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2 ${feedbackOutcome === "success" ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-200 text-slate-500 hover:border-emerald-300"}`}
                      >
                        <CheckCircle className="h-3.5 w-3.5" /> Success
                      </button>
                      <button
                        onClick={() => setFeedbackOutcome("failure")}
                        className={`flex-1 h-10 rounded-xl text-xs font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2 ${feedbackOutcome === "failure" ? "bg-red-500 text-white border-red-500" : "border-slate-200 text-slate-500 hover:border-red-300"}`}
                      >
                        <XCircle className="h-3.5 w-3.5" /> Failure
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Notes (optional)</label>
                    <textarea
                      value={feedbackNotes}
                      onChange={(e) => setFeedbackNotes(e.target.value)}
                      placeholder="What went wrong or right?"
                      rows={3}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 bg-white focus:ring-2 focus:ring-slate-900 outline-none resize-none"
                    />
                  </div>

                  <Button
                    onClick={submitFeedback}
                    disabled={!feedbackOutcome || submitting}
                    className="w-full h-11 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest"
                  >
                    {submitting ? "Submitting…" : "Submit Feedback"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
