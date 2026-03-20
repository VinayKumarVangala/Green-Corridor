"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TrendPoint {
  date: string;
  avgMinutes: number;
  count: number;
}

export function ResponseTimeChart({ data }: { data: TrendPoint[] }) {
  if (!data.length) {
    return (
      <Card className="border-none shadow-sm rounded-3xl bg-white">
        <CardHeader className="p-6 pb-2">
          <CardTitle className="text-base font-black text-slate-900 uppercase tracking-widest">Response Time Trend</CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-2">
          <p className="text-slate-400 text-sm">No data for this period.</p>
        </CardContent>
      </Card>
    );
  }

  const maxMin = Math.max(...data.map((d) => d.avgMinutes), 1);
  const chartH = 120;

  return (
    <Card className="border-none shadow-sm rounded-3xl bg-white">
      <CardHeader className="p-6 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-black text-slate-900 uppercase tracking-widest">Response Time Trend</CardTitle>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg minutes per day</span>
        </div>
      </CardHeader>
      <CardContent className="p-6 pt-2">
        <div className="flex items-end gap-2 h-32 w-full">
          {data.map((d, i) => {
            const barH = Math.max(4, Math.round((d.avgMinutes / maxMin) * chartH));
            const isHigh = d.avgMinutes > 20;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-10">
                  <div className="bg-slate-900 text-white text-[10px] font-black px-2 py-1 rounded-lg whitespace-nowrap">
                    {d.avgMinutes}m avg · {d.count} calls
                  </div>
                  <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1" />
                </div>
                <div
                  className={`w-full rounded-t-lg transition-all ${isHigh ? "bg-red-400" : "bg-blue-500"}`}
                  style={{ height: barH }}
                />
                <span className="text-[9px] text-slate-400 font-bold">
                  {d.date.slice(5)} {/* MM-DD */}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Normal (&lt;20m)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-400" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Slow (&gt;20m)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
