"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DriverStat {
  id: string;
  vehicleNumber: string;
  employeeId: string;
  acceptanceRate: number;
  avgDecisionSeconds: number;
  completedMissions: number;
  totalAssignments: number;
  currentStatus: string;
}

const statusDot: Record<string, string> = {
  available: "bg-emerald-500",
  busy: "bg-amber-500",
  offline: "bg-slate-300",
};

export function DriverPerformance({ data }: { data: DriverStat[] }) {
  return (
    <Card className="border-none shadow-sm rounded-3xl bg-white">
      <CardHeader className="p-6 pb-2">
        <CardTitle className="text-base font-black text-slate-900 uppercase tracking-widest">Driver Rankings</CardTitle>
      </CardHeader>
      <CardContent className="p-6 pt-2">
        {!data.length ? (
          <p className="text-slate-400 text-sm">No driver data for this period.</p>
        ) : (
          <div className="space-y-3">
            {data.map((d, i) => (
              <div key={d.id} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-lg font-black text-slate-300 w-6 shrink-0">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${statusDot[d.currentStatus] ?? "bg-slate-300"}`} />
                    <p className="text-sm font-black text-slate-900">{d.vehicleNumber}</p>
                    <span className="text-[10px] text-slate-400 font-bold">{d.employeeId}</span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                    {d.completedMissions} missions · {d.avgDecisionSeconds}s avg response
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-black ${d.acceptanceRate >= 80 ? "text-emerald-600" : d.acceptanceRate >= 50 ? "text-amber-500" : "text-red-500"}`}>
                    {d.acceptanceRate}%
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">accept rate</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
