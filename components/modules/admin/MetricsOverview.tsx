"use client"

import { Card, CardContent } from "@/components/ui/card";
import { Activity, Clock, Ambulance, Building2, TrendingUp, AlertCircle, Users, RefreshCw } from "lucide-react";

interface KPIs {
  totalRequests: number;
  completedRequests: number;
  pendingRequests: number;
  avgResponseMinutes: number;
  avgDispatchSeconds: number;
  avgDispatchAttempts: string;
  rerouteRate: number;
  activeDrivers: number;
  availableHospitals: number;
}

export function MetricsOverview({ kpis }: { kpis: KPIs }) {
  const metrics = [
    {
      label: "Total Requests",
      value: kpis.totalRequests,
      sub: `${kpis.completedRequests} completed`,
      icon: Activity,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Avg Response Time",
      value: `${kpis.avgResponseMinutes}m`,
      sub: `${kpis.avgDispatchSeconds}s dispatch`,
      icon: Clock,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Active Drivers",
      value: kpis.activeDrivers,
      sub: `${kpis.pendingRequests} pending calls`,
      icon: Users,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      label: "Available Hospitals",
      value: kpis.availableHospitals,
      sub: "accepting patients",
      icon: Building2,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Avg Dispatch Attempts",
      value: kpis.avgDispatchAttempts,
      sub: "per emergency",
      icon: AlertCircle,
      color: "text-red-500",
      bg: "bg-red-50",
    },
    {
      label: "Reroute Rate",
      value: `${kpis.rerouteRate}%`,
      sub: "of active missions",
      icon: RefreshCw,
      color: "text-slate-600",
      bg: "bg-slate-100",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {metrics.map((m, i) => (
        <Card key={i} className="border-none shadow-sm rounded-3xl bg-white hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className={`w-10 h-10 ${m.bg} rounded-2xl flex items-center justify-center mb-3`}>
              <m.icon className={`h-5 w-5 ${m.color}`} />
            </div>
            <p className="text-2xl font-black text-slate-900 tracking-tight">{m.value}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{m.label}</p>
            <p className="text-xs text-slate-400 mt-1">{m.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
