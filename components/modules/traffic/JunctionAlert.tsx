"use client"

import { useState, useEffect } from "react";
import { 
  Ambulance, 
  Clock, 
  MapPin, 
  AlertTriangle, 
  X, 
  Zap, 
  ChevronRight,
  ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface JunctionAlertProps {
  alert: {
    id: string;
    ambulanceId: string;
    vehicleNumber: string;
    eta: number; // in seconds
    emergencyType: string;
    direction: string;
    strategy: string;
  };
  onClose: () => void;
  onAck: () => void;
}

export function JunctionAlert({ alert, onClose, onAck }: JunctionAlertProps) {
  const [countdown, setCountdown] = useState(alert.eta);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isUrgent = countdown < 60;

  return (
    <div className={cn(
      "w-full max-w-lg bg-white border-2 rounded-[40px] shadow-2xl overflow-hidden transition-all duration-500 animate-in slide-in-from-right-10",
      isUrgent ? "border-red-500 ring-4 ring-red-500/10" : "border-emerald-500 ring-4 ring-emerald-500/10"
    )}>
      <div className={cn(
        "p-6 flex items-center justify-between text-white uppercase font-black tracking-widest text-xs",
        isUrgent ? "bg-red-600" : "bg-emerald-600"
      )}>
        <div className="flex items-center gap-3">
            <ShieldAlert className="h-4 w-4" />
            Tactical Inbound Alert
        </div>
        <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-lg transition-colors">
            <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-8 space-y-8">
        <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-6">
                <div className={cn(
                    "w-20 h-20 rounded-3xl flex items-center justify-center transition-transform hover:scale-110 duration-300 shadow-xl",
                    isUrgent ? "bg-red-50 text-red-600 shadow-red-500/10" : "bg-emerald-50 text-emerald-600 shadow-emerald-500/10"
                )}>
                    <Ambulance className="h-10 w-10" />
                </div>
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-3xl font-black text-slate-900 tracking-tight">{alert.vehicleNumber}</h3>
                        <Badge variant="outline" className={cn(
                            "font-black text-[10px] tracking-widest px-2 py-0.5 uppercase",
                            isUrgent ? "border-red-200 text-red-600" : "border-emerald-200 text-emerald-600"
                        )}>
                            {alert.emergencyType}
                        </Badge>
                    </div>
                    <p className="text-slate-400 font-bold text-sm flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Approaching from {alert.direction}
                    </p>
                </div>
            </div>

            <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Estimated Arrival</p>
                <p className={cn(
                    "text-4xl font-black tabular-nums transition-colors duration-500",
                    isUrgent ? "text-red-600 animate-pulse" : "text-emerald-600"
                )}>
                    {formatTime(countdown)}
                </p>
            </div>
        </div>

        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-start gap-4 ring-1 ring-slate-100">
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 shrink-0">
                <Zap className="h-6 w-6 text-amber-500" />
            </div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">AI Clearance Strategy</p>
                <p className="text-slate-800 font-black text-lg leading-tight uppercase tracking-tight">
                    {countdown < 120 ? alert.strategy : "Standby for tactical instructions..."}
                </p>
            </div>
        </div>

        <div className="flex gap-4">
            <Button 
                onClick={onAck}
                className={cn(
                    "flex-1 h-16 rounded-[24px] font-black text-sm uppercase tracking-widest transition-all",
                    isUrgent ? "bg-red-600 hover:bg-red-700 shadow-xl shadow-red-500/20 text-white" : "bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-500/20 text-white"
                )}
            >
                Confirm Readiness
                <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
                variant="outline" 
                onClick={onClose}
                className="h-16 w-16 rounded-[24px] border-slate-200 text-slate-400 hover:bg-slate-50"
            >
                <History className="h-6 w-6" />
            </Button>
        </div>
      </div>

      <div className="h-1 bg-slate-100 w-full overflow-hidden">
        <div 
            className={cn(
                "h-full transition-all duration-1000 ease-linear",
                isUrgent ? "bg-red-600" : "bg-emerald-600"
            )}
            style={{ width: `${(countdown / alert.eta) * 100}%` }}
        />
      </div>
    </div>
  );
}

function History({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M12 7v5l4 2" />
        </svg>
    );
}
