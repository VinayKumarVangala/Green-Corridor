"use client"

import { useState, useEffect } from "react";
import { MetricsOverview } from "@/components/modules/admin/MetricsOverview";
import { ResponseTimeChart } from "@/components/modules/admin/ResponseTimeChart";
import { HospitalPerformance } from "@/components/modules/admin/HospitalPerformance";
import { DriverPerformance } from "@/components/modules/admin/DriverPerformance";
import { TrafficHotspots } from "@/components/modules/admin/TrafficHotspots";
import { Button } from "@/components/ui/button";
import { RefreshCw, Download } from "lucide-react";

export const dynamic = "force-dynamic";

type Range = "7d" | "30d" | "90d";

export default function AdminDashboard() {
  const [range, setRange] = useState<Range>("7d");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function fetchData(r: Range) {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/dashboard?range=${r}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(range); }, [range]);

  const handleExportAll = () => {
    window.open(`/api/analytics/dashboard?range=${range}`, "_blank");
  };

  return (
    <div className="p-6 lg:p-10 space-y-8 min-h-screen">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Analytics Dashboard</h1>
          <p className="text-slate-400 font-bold text-sm mt-1">
            {data ? `Last updated ${new Date(data.generatedAt).toLocaleTimeString()}` : "Loading…"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Range selector */}
          <div className="flex bg-slate-100 rounded-2xl p-1 gap-1">
            {(["7d", "30d", "90d"] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  range === r ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => fetchData(range)}
            className="w-10 h-10 rounded-xl border-slate-200"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            variant="outline"
            onClick={handleExportAll}
            className="h-10 px-4 rounded-xl border-slate-200 text-xs font-black uppercase tracking-widest gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </header>

      {loading && !data ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400 font-bold animate-pulse">Loading analytics…</div>
        </div>
      ) : data ? (
        <>
          {/* KPIs */}
          <MetricsOverview kpis={data.kpis} />

          {/* Response Time Chart — full width */}
          <ResponseTimeChart data={data.responseTimeTrend} />

          {/* Hospital + Driver side by side */}
          <div className="grid lg:grid-cols-2 gap-6">
            <HospitalPerformance data={data.hospitalPerformance} />
            <DriverPerformance data={data.driverPerformance} />
          </div>

          {/* Traffic Hotspots + Reroute Reasons */}
          <div className="grid lg:grid-cols-2 gap-6">
            <TrafficHotspots data={data.trafficHotspots} />

            {/* Reroute Reasons breakdown */}
            <div className="bg-white rounded-3xl shadow-sm p-6 border-none">
              <p className="text-base font-black text-slate-900 uppercase tracking-widest mb-4">Reroute Causes</p>
              {Object.keys(data.rerouteReasons).length === 0 ? (
                <p className="text-slate-400 text-sm">No reroutes in this period.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(data.rerouteReasons as Record<string, number>)
                    .sort(([, a], [, b]) => b - a)
                    .map(([reason, count]) => {
                      const total = Object.values(data.rerouteReasons as Record<string, number>).reduce((a, b) => a + b, 0);
                      const pct = Math.round((count / total) * 100);
                      return (
                        <div key={reason}>
                          <div className="flex justify-between mb-1">
                            <span className="text-xs font-black text-slate-600 capitalize">{reason.replace(/_/g, " ")}</span>
                            <span className="text-xs font-black text-slate-400">{count} ({pct}%)</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-slate-700 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          {/* Quick link to incidents */}
          <div className="bg-slate-900 rounded-3xl p-6 flex items-center justify-between">
            <div>
              <p className="text-white font-black text-lg">Incident Review & AI Feedback</p>
              <p className="text-slate-400 text-sm mt-1">Review individual incidents, mark decisions, and tune AI weights.</p>
            </div>
            <a
              href="/admin/incidents"
              className="bg-white text-slate-900 font-black text-xs uppercase tracking-widest px-6 py-3 rounded-2xl hover:bg-slate-100 transition-colors"
            >
              Open Incidents →
            </a>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-400 font-bold">Failed to load analytics. Check your connection.</p>
        </div>
      )}
    </div>
  );
}
