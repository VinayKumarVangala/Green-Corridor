"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface HospitalStat {
  id: string;
  name: string;
  totalIncidents: number;
  avgResponseMinutes: number;
  capacityIssueRate: number;
  currentStatus: string;
}

const statusColor: Record<string, string> = {
  available: "bg-emerald-50 text-emerald-600 border-emerald-100",
  busy: "bg-amber-50 text-amber-600 border-amber-100",
  critical: "bg-red-50 text-red-600 border-red-100",
};

export function HospitalPerformance({ data }: { data: HospitalStat[] }) {
  return (
    <Card className="border-none shadow-sm rounded-3xl bg-white">
      <CardHeader className="p-6 pb-2">
        <CardTitle className="text-base font-black text-slate-900 uppercase tracking-widest">Hospital Performance</CardTitle>
      </CardHeader>
      <CardContent className="p-6 pt-2">
        {!data.length ? (
          <p className="text-slate-400 text-sm">No hospital data for this period.</p>
        ) : (
          <div className="space-y-3">
            {data.map((h) => (
              <div key={h.id} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-900 truncate">{h.name}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                    {h.totalIncidents} incidents · {h.avgResponseMinutes}m avg
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase ${statusColor[h.currentStatus] ?? "bg-slate-100 text-slate-500 border-slate-200"}`}>
                    {h.currentStatus}
                  </span>
                  {h.capacityIssueRate > 0 && (
                    <p className="text-[10px] text-red-400 font-bold mt-1">{h.capacityIssueRate}% capacity issues</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
