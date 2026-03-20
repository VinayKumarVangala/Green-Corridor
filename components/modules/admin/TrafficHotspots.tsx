"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin } from "lucide-react";

interface HotspotStat {
  id: string;
  name: string;
  lat: number;
  lng: number;
  totalAlerts: number;
  clearanceRate: number;
  avgClearanceSeconds: number;
}

export function TrafficHotspots({ data }: { data: HotspotStat[] }) {
  const maxAlerts = Math.max(...data.map((d) => d.totalAlerts), 1);

  return (
    <Card className="border-none shadow-sm rounded-3xl bg-white">
      <CardHeader className="p-6 pb-2">
        <CardTitle className="text-base font-black text-slate-900 uppercase tracking-widest">Traffic Hotspots</CardTitle>
      </CardHeader>
      <CardContent className="p-6 pt-2">
        {!data.length ? (
          <p className="text-slate-400 text-sm">No junction data for this period.</p>
        ) : (
          <div className="space-y-3">
            {data.map((j, i) => {
              const intensity = j.totalAlerts / maxAlerts;
              const barColor =
                intensity > 0.7 ? "bg-red-500" : intensity > 0.4 ? "bg-amber-400" : "bg-emerald-400";
              return (
                <div key={j.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <p className="text-sm font-black text-slate-900">{j.name}</p>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {j.totalAlerts} alerts
                    </span>
                  </div>
                  {/* Heat bar */}
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${Math.round(intensity * 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-bold">
                      {j.clearanceRate}% cleared · {Math.round(j.avgClearanceSeconds / 60)}m avg
                    </span>
                    <span className="text-[10px] text-slate-300 font-bold">
                      {j.lat.toFixed(4)}, {j.lng.toFixed(4)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
