"use client"

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Zap, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2,
  TrafficCone,
  Car,
  CloudLightning
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function JunctionStatus({ initialStatus = "light" }: { initialStatus?: string }) {
  const [trafficLevel, setTrafficLevel] = useState(initialStatus);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const updateTraffic = async (level: string) => {
    setIsUpdating(true);
    try {
      const res = await fetch("/api/traffic/status", {
        method: "POST",
        body: JSON.stringify({ trafficLevel: level }),
      });
      if (!res.ok) throw new Error("Update failed");
      setTrafficLevel(level);
      toast.success(`Traffic set to ${level.toUpperCase()}`, {
          description: "AI routing engine has been updated."
      });
    } catch (e) {
      toast.error("Failed to update traffic level");
    } finally {
      setIsUpdating(false);
    }
  };

  const manualClearance = async () => {
    setIsClearing(true);
    try {
        const res = await fetch("/api/traffic/clearance", {
            method: "POST",
            body: JSON.stringify({ action: "MANUAL_OVERRIDE" }),
        });
        if (!res.ok) throw new Error("Clearance failed");
        toast.success("GREEN CORRIDOR ACTIVATED", {
            description: "All signals set to green. Audit log captured.",
            className: "bg-emerald-600 text-white"
        });
    } catch (e) {
        toast.error("Manual override failed");
    } finally {
        setTimeout(() => setIsClearing(false), 2000);
    }
  };

  const levels = [
    { id: "light", label: "Light", color: "text-emerald-500", bg: "bg-emerald-50", icon: CheckCircle2 },
    { id: "moderate", label: "Moderate", color: "text-amber-500", bg: "bg-amber-50", icon: AlertTriangle },
    { id: "heavy", label: "Heavy", color: "text-red-500", bg: "bg-red-50", icon: TrafficCone },
  ];

  return (
    <div className="space-y-6">
        <Card className="border-none shadow-2xl rounded-[40px] overflow-hidden bg-slate-900 text-white">
            <CardContent className="p-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h3 className="text-2xl font-black tracking-tight">Rapid Preemption</h3>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Manual Signal Control</p>
                    </div>
                    <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-all animate-pulse",
                        isClearing ? "bg-emerald-500 shadow-lg shadow-emerald-500/50" : "bg-white/10"
                    )}>
                        <Zap className="h-6 w-6 text-emerald-400" />
                    </div>
                </div>

                <Button 
                    onClick={manualClearance}
                    disabled={isClearing}
                    className={cn(
                        "w-full h-20 rounded-[28px] font-black text-lg uppercase tracking-[0.2em] transition-all active:scale-[0.98]",
                        isClearing 
                            ? "bg-emerald-600 text-white cursor-default" 
                            : "bg-white text-slate-900 hover:bg-emerald-50 hover:text-emerald-600 shadow-xl shadow-white/5"
                    )}
                >
                    {isClearing ? (
                        <span className="flex items-center gap-3">
                            <Loader2 className="h-6 w-6 animate-spin" />
                            CLEARING CORRIDOR...
                        </span>
                    ) : (
                        "ACTIVATE GREEN NOW"
                    )}
                </Button>
                
                <p className="text-center text-[10px] font-black text-slate-500 uppercase tracking-widest mt-4 flex items-center justify-center gap-2">
                    <CloudLightning className="h-3 w-3" />
                    Bypasses automated AI cycle for 60s
                </p>
            </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[40px] overflow-hidden bg-white">
            <CardHeader className="p-8 pb-4">
                <CardTitle className="text-xl font-black text-slate-900 tracking-tight">Congestion Level</CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-0">
                <div className="grid grid-cols-3 gap-4">
                    {levels.map((l) => (
                        <button
                            key={l.id}
                            onClick={() => updateTraffic(l.id)}
                            disabled={isUpdating}
                            className={cn(
                                "flex flex-col items-center gap-3 p-6 rounded-3xl border-2 transition-all group",
                                trafficLevel === l.id 
                                    ? cn(l.bg, "border-current", "ring-1 ring-current/20") 
                                    : "border-slate-50 hover:bg-slate-50 hover:border-slate-100"
                            )}
                        >
                            <l.icon className={cn(
                                "h-6 w-6 transition-transform group-hover:scale-110",
                                trafficLevel === l.id ? l.color : "text-slate-300"
                            )} />
                            <span className={cn(
                                "text-[10px] font-black uppercase tracking-widest",
                                trafficLevel === l.id ? l.color : "text-slate-400"
                            )}>
                                {l.label}
                            </span>
                        </button>
                    ))}
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
