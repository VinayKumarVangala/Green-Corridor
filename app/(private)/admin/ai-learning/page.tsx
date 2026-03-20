"use client"

import { useState, useEffect } from "react";
import { Brain, RefreshCw, Save, AlertTriangle, CheckCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

interface Weights { traffic: number; distance: number; roadType: number; rushHour: number; }

const WEIGHT_LABELS: Record<keyof Weights, string> = {
  traffic: "Traffic Congestion",
  distance: "Route Distance",
  roadType: "Road Type Quality",
  rushHour: "Rush Hour Penalty",
};

export default function AILearningPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [weights, setWeights] = useState<Weights>({ traffic: 0.40, distance: 0.30, roadType: 0.20, rushHour: 0.10 });
  const [overrideNotes, setOverrideNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch("/api/analytics/ai-feedback");
      if (res.ok) {
        const d = await res.json();
        setData(d);
        setWeights(d.currentWeights);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  const weightSum = Math.round(Object.values(weights).reduce((a, b) => a + b, 0) * 100) / 100;
  const isValid = Math.abs(weightSum - 1) < 0.01;

  function handleWeightChange(key: keyof Weights, val: string) {
    const num = Math.round(parseFloat(val) * 100) / 100;
    if (!isNaN(num)) setWeights((w) => ({ ...w, [key]: num }));
  }

  async function saveWeights() {
    if (!isValid) return;
    setSaving(true);
    try {
      // Submit as a feedback with weight override on a synthetic "system" entry
      await fetch("/api/analytics/ai-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentId: "00000000-0000-0000-0000-000000000000", // system override
          decisionType: "route",
          outcome: "success",
          notes: overrideNotes || "Manual weight override by admin",
          weightOverride: weights,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      fetchData();
    } finally {
      setSaving(false);
    }
  }

  function resetToDefaults() {
    setWeights(data?.defaultWeights ?? { traffic: 0.40, distance: 0.30, roadType: 0.20, rushHour: 0.10 });
  }

  return (
    <div className="p-6 lg:p-10 space-y-8 min-h-screen">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Brain className="h-7 w-7 text-slate-700" /> AI Learning
          </h1>
          <p className="text-slate-400 font-bold text-sm mt-1">
            View adaptive signals, feedback history, and override route scoring weights.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={fetchData}
          disabled={loading}
          className="h-10 px-4 rounded-xl border-slate-200 text-xs font-black uppercase tracking-widest gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </header>

      {loading && !data ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-slate-400 font-bold animate-pulse">Loading AI state…</p>
        </div>
      ) : data && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Weight Editor */}
          <Card className="border-none shadow-sm rounded-3xl bg-white">
            <CardHeader className="p-6 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-black text-slate-900 uppercase tracking-widest">Route Scoring Weights</CardTitle>
                {data.hasOverride && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100 uppercase tracking-widest">
                    Override Active
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6 pt-2 space-y-5">
              {(Object.keys(weights) as (keyof Weights)[]).map((key) => (
                <div key={key}>
                  <div className="flex justify-between mb-1.5">
                    <label className="text-xs font-black text-slate-600">{WEIGHT_LABELS[key]}</label>
                    <span className="text-xs font-black text-slate-400">{Math.round(weights[key] * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.70"
                    step="0.05"
                    value={weights[key]}
                    onChange={(e) => handleWeightChange(key, e.target.value)}
                    className="w-full accent-slate-900"
                  />
                  <div className="flex justify-between text-[9px] text-slate-300 font-bold mt-0.5">
                    <span>5%</span><span>70%</span>
                  </div>
                </div>
              ))}

              {/* Sum indicator */}
              <div className={`flex items-center justify-between p-3 rounded-xl ${isValid ? "bg-emerald-50 border border-emerald-100" : "bg-red-50 border border-red-100"}`}>
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Total</span>
                <span className={`text-sm font-black ${isValid ? "text-emerald-600" : "text-red-500"}`}>
                  {Math.round(weightSum * 100)}% {isValid ? "✓" : "— must equal 100%"}
                </span>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Override Reason</label>
                <input
                  type="text"
                  value={overrideNotes}
                  onChange={(e) => setOverrideNotes(e.target.value)}
                  placeholder="e.g. Post-monsoon traffic adjustment"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 bg-white focus:ring-2 focus:ring-slate-900 outline-none"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={resetToDefaults}
                  className="flex-1 h-11 rounded-2xl border-slate-200 text-xs font-black uppercase tracking-widest"
                >
                  Reset Defaults
                </Button>
                <Button
                  onClick={saveWeights}
                  disabled={!isValid || saving}
                  className="flex-1 h-11 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest gap-2"
                >
                  {saved ? <><CheckCircle className="h-4 w-4" /> Saved!</> : saving ? "Saving…" : <><Save className="h-4 w-4" /> Apply Weights</>}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Adaptive Signal + Feedback Summary */}
          <div className="space-y-6">
            {/* Adaptive Signal */}
            <Card className="border-none shadow-sm rounded-3xl bg-white">
              <CardHeader className="p-6 pb-2">
                <CardTitle className="text-base font-black text-slate-900 uppercase tracking-widest">Adaptive Signal (30d)</CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-2">
                {!data.adaptiveSignal ? (
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <p className="text-sm text-slate-500 font-bold">Need at least 5 reroute events to compute adaptive signal.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-400 font-bold">Based on {data.adaptiveSignal.sampleSize} reroute events:</p>
                    {[
                      { label: "Traffic was the bottleneck", value: data.adaptiveSignal.trafficBottleneckRate, key: "traffic" },
                      { label: "Distance was the bottleneck", value: data.adaptiveSignal.distanceBottleneckRate, key: "distance" },
                    ].map(({ label, value, key }) => (
                      <div key={key}>
                        <div className="flex justify-between mb-1">
                          <span className="text-xs font-black text-slate-600">{label}</span>
                          <span className="text-xs font-black text-slate-400">{value}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${value > 60 ? "bg-red-400" : value > 40 ? "bg-amber-400" : "bg-emerald-400"}`}
                            style={{ width: `${value}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {data.adaptiveSignal.trafficBottleneckRate > 60 && (
                      <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 font-bold">Traffic is frequently the bottleneck. Consider increasing the traffic weight above {Math.round(weights.traffic * 100)}%.</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Feedback Summary */}
            <Card className="border-none shadow-sm rounded-3xl bg-white">
              <CardHeader className="p-6 pb-2">
                <CardTitle className="text-base font-black text-slate-900 uppercase tracking-widest">Feedback Summary (30d)</CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-2">
                <div className="flex items-center gap-6 mb-4">
                  <div className="text-center">
                    <p className="text-3xl font-black text-emerald-600">{data.feedbackSummary.success}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Success</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-black text-red-500">{data.feedbackSummary.failure}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Failure</p>
                  </div>
                  <div className="flex-1">
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      {(data.feedbackSummary.success + data.feedbackSummary.failure) > 0 && (
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${Math.round((data.feedbackSummary.success / (data.feedbackSummary.success + data.feedbackSummary.failure)) * 100)}%` }}
                        />
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold mt-1 text-right">
                      {(data.feedbackSummary.success + data.feedbackSummary.failure) > 0
                        ? `${Math.round((data.feedbackSummary.success / (data.feedbackSummary.success + data.feedbackSummary.failure)) * 100)}% success rate`
                        : "No feedback yet"}
                    </p>
                  </div>
                </div>

                {Object.keys(data.feedbackSummary.byType).length > 0 && (
                  <div className="space-y-2 pt-4 border-t border-slate-100">
                    {Object.entries(data.feedbackSummary.byType as Record<string, { success: number; failure: number }>).map(([type, counts]) => (
                      <div key={type} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-xs font-black text-slate-600 capitalize">{type}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-black text-emerald-600">{counts.success} ✓</span>
                          <span className="text-xs font-black text-red-500">{counts.failure} ✗</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Export for retraining */}
            <Card className="border-none shadow-sm rounded-3xl bg-slate-900">
              <CardContent className="p-6">
                <p className="text-white font-black text-sm mb-1">Export Training Data</p>
                <p className="text-slate-400 text-xs font-bold mb-4">Download all incident analytics for model retraining.</p>
                <a
                  href="/api/analytics/dashboard?range=90d"
                  target="_blank"
                  className="flex items-center justify-center gap-2 w-full h-11 rounded-2xl bg-white text-slate-900 font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-colors"
                >
                  <Download className="h-4 w-4" /> Download 90-Day Dataset
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
