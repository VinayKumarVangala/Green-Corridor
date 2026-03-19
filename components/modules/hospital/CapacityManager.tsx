"use client"

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, AlertTriangle, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function CapacityManager({ initialStatus = "available" }: { initialStatus?: string }) {
  const [status, setStatus] = useState(initialStatus);
  const [isUpdating, setIsUpdating] = useState(false);

  const updateStatus = async (newStatus: string) => {
    setIsUpdating(true);
    try {
      const res = await fetch("/api/hospital/status", {
        method: "POST",
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      setStatus(newStatus);
      toast.success(`Status updated to ${newStatus.toUpperCase()}`, {
        description: "AI routing will adjust incoming traffic accordingly."
      });
    } catch (e) {
      toast.error("Status update failed");
    } finally {
      setIsUpdating(false);
    }
  };

  const statuses = [
    { 
      id: "available", 
      label: "Available", 
      icon: Check, 
      color: "text-emerald-500", 
      bg: "bg-emerald-50", 
      border: "border-emerald-100",
      description: "Full capacity, accepting all emergencies."
    },
    { 
      id: "busy", 
      label: "Busy", 
      icon: AlertTriangle, 
      color: "text-amber-500", 
      bg: "bg-amber-50", 
      border: "border-amber-100",
      description: "Near capacity, redirect minor cases."
    },
    { 
      id: "critical", 
      label: "Critical", 
      icon: AlertCircle, 
      color: "text-red-500", 
      bg: "bg-red-50", 
      border: "border-red-100",
      description: "ER full, divert all new ambulances."
    },
  ];

  return (
    <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
      <CardHeader className="p-8 pb-4">
        <CardTitle className="text-xl font-black text-slate-900 tracking-tight">Facility Capacity</CardTitle>
      </CardHeader>
      <CardContent className="p-8 pt-0">
        <div className="grid gap-4">
          {statuses.map((s) => (
            <button
              key={s.id}
              onClick={() => updateStatus(s.id)}
              disabled={isUpdating}
              className={cn(
                "w-full p-4 rounded-2xl border-2 transition-all flex items-start gap-4 text-left group",
                status === s.id
                  ? cn(s.bg, s.border, "shadow-sm border-current")
                  : "border-slate-50 hover:bg-slate-50 hover:border-slate-100"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                status === s.id ? "bg-white shadow-sm" : "bg-white border border-slate-100"
              )}>
                <s.icon className={cn("h-5 w-5", s.color)} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                    <p className={cn("font-black uppercase tracking-widest text-[10px]", 
                        status === s.id ? s.color : "text-slate-400 group-hover:text-slate-600"
                    )}>{s.label}</p>
                    {status === s.id && <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />}
                </div>
                <p className="text-sm font-bold text-slate-800 line-clamp-1">{s.description}</p>
              </div>
            </button>
          ))}
        </div>
        
        {isUpdating && (
          <div className="mt-6 flex items-center justify-center gap-3 text-slate-400 font-bold uppercase tracking-widest text-[10px] animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin" />
            Syncing Status...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
