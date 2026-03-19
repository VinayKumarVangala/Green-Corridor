import { Card, CardContent } from "@/components/ui/card";
import { Activity, Clock, TrendingUp, Users } from "lucide-react";

export function HospitalStats() {
  const stats = [
    { label: "Today's Admissions", value: "24", icon: Users, color: "text-blue-600", trend: "+12%" },
    { label: "Avg Turnaround", value: "18m", icon: Clock, color: "text-emerald-600", trend: "-5%" },
    { label: "Critical Cases", value: "03", icon: Activity, color: "text-red-500", trend: "+2" },
    { label: "Bed Occupancy", value: "82%", icon: TrendingUp, color: "text-amber-500", trend: "High" },
  ];

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((s, i) => (
        <Card key={i} className="border-none shadow-sm rounded-3xl overflow-hidden bg-white hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest ${
                s.trend.startsWith('+') ? "text-red-500" : s.trend.startsWith('-') ? "text-emerald-500" : "text-amber-500"
              }`}>
                {s.trend}
              </span>
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
              <p className="text-3xl font-black text-slate-900 tracking-tight">{s.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
