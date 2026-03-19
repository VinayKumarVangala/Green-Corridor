"use client"

import { useSession } from "next-auth/react";
import { 
  History, 
  Map as MapIcon, 
  AlertTriangle, 
  ShieldCheck, 
  Clock,
  Navigation,
  Loader2,
  ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JunctionStatus } from "@/components/modules/traffic/JunctionStatus";
import { UpcomingAmbulancesTraffic } from "@/components/modules/traffic/UpcomingAmbulancesTraffic";
import { JunctionMap } from "@/components/modules/traffic/JunctionMap";
import { cn } from "@/lib/utils";

export default function TrafficDashboardPage() {
  const { data: session } = useSession();
  const junctionId = session?.user?.id || "JUNC-901";

  return (
    <div className="p-8 lg:p-12 space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Junction 901</h1>
            <Badge className="bg-emerald-50 text-emerald-600 border-none font-black text-[10px] tracking-widest uppercase px-3 py-1">
                Active Duty
            </Badge>
          </div>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Silk Board Intersection • Area H-4</p>
        </div>

        <div className="flex items-center gap-6 bg-white p-4 rounded-3xl shadow-sm border border-slate-50">
          <div className="text-right border-r border-slate-100 pr-6">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Sync</p>
            <p className="text-lg font-black text-slate-800 tabular-nums">1.4s Latency</p>
          </div>
          <div className="pr-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">System Health</p>
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-black text-emerald-600">ONLINE</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-10">
        {/* Left Column - Tactical Intel */}
        <div className="lg:col-span-8 space-y-10">
          
          <Card className="border-none shadow-2xl rounded-[40px] overflow-hidden h-[500px] relative mt-4">
            <JunctionMap />
          </Card>

          <div className="grid md:grid-cols-2 gap-10">
            <Card className="border-none shadow-sm rounded-[40px] bg-white">
                <CardHeader className="p-8 pb-4">
                    <CardTitle className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <History className="h-6 w-6 text-emerald-500" />
                        Today&apos;s Statistics
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-8 pt-0 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cleared</p>
                            <p className="text-2xl font-black text-slate-800">14</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Avg Time</p>
                            <p className="text-2xl font-black text-slate-800">22s</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Activity</p>
                        {[1, 2].map(i => (
                            <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <span className="text-xs font-bold text-slate-600">Ambulance KA-01-EF {i}234</span>
                                <Badge variant="outline" className="text-[8px] font-black bg-white border-emerald-100 text-emerald-600">CLEARED</Badge>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-sm rounded-[40px] bg-white">
                <CardHeader className="p-8 pb-4">
                    <CardTitle className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <AlertTriangle className="h-6 w-6 text-red-500" />
                        Clearance Orders
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-8 pt-0">
                    <div className="space-y-4 bg-red-50/50 p-6 rounded-3xl border border-red-50">
                        <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">Latest AI Instruction</p>
                        <p className="text-slate-800 font-black text-lg leading-tight uppercase tracking-tight">
                            &quot;HEAVY TRAFFIC DETECTED ON NORTH LANE. PRE-ACTIVATE CLEARANCE IN 45 SECONDS.&quot;
                        </p>
                        <Button className="w-full bg-red-600 hover:bg-red-700 text-white font-black rounded-xl">ACKNOWLEDGEMENT SENT</Button>
                    </div>
                </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Column - Status & Inbound */}
        <div className="lg:col-span-4 space-y-10">
          <JunctionStatus />
          <UpcomingAmbulancesTraffic junctionId={junctionId} />
        </div>
      </div>
    </div>
  );
}
