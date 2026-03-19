"use client"

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Ambulance, 
  Clock, 
  MapPin, 
  User, 
  AlertCircle, 
  ChevronRight,
  Stethoscope,
  Activity
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface IncomingPatientCardProps {
  assignment: any;
}

export function IncomingPatientCard({ assignment }: IncomingPatientCardProps) {
  const [countdown, setCountdown] = useState(480); // 8 mins in seconds
  
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

  const isUrgent = countdown < 300; // Less than 5 mins
  const isCritical = countdown < 120; // Less than 2 mins

  return (
    <Card className={cn(
      "border-none shadow-xl rounded-[40px] overflow-hidden bg-white transition-all hover:scale-[1.01]",
      isCritical ? "ring-2 ring-red-500 shadow-red-500/10" : isUrgent ? "ring-2 ring-amber-500 shadow-amber-500/10" : ""
    )}>
      <CardContent className="p-0">
        <div className={cn(
          "p-6 flex items-center justify-between gap-4 transition-colors",
          isCritical ? "bg-red-50" : isUrgent ? "bg-amber-50" : "bg-slate-50/50"
        )}>
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg",
              isCritical ? "bg-red-600 shadow-red-600/20" : isUrgent ? "bg-amber-600 shadow-amber-600/20" : "bg-blue-600 shadow-blue-600/20"
            )}>
              <Ambulance className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Incoming Ambulance</p>
              <p className="text-xl font-black text-slate-900">{assignment.ambulance_drivers?.vehicle_number || "AMB-102"}</p>
            </div>
          </div>
          
          <div className="text-right">
            <p className={cn(
              "text-3xl font-black tabular-nums",
              isCritical ? "text-red-600 animate-pulse" : isUrgent ? "text-amber-600" : "text-blue-600"
            )}>
              {formatTime(countdown)}
            </p>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Time to Arrival</p>
          </div>
        </div>

        <div className="p-8">
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge className="bg-red-100 text-red-600 border-none font-black text-[10px] tracking-widest uppercase px-3 py-1">
                  {assignment.emergency_requests?.emergency_type || "Critical"}
                </Badge>
                {isCritical && (
                  <Badge className="bg-red-600 text-white border-none font-black text-[10px] tracking-widest uppercase px-3 py-1 animate-bounce">
                    IMMEDIATE STANDBY
                  </Badge>
                )}
              </div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">Patient: {assignment.emergency_requests?.citizen_profiles?.full_name || "John Doe"}</h3>
              <div className="flex flex-wrap gap-4 text-slate-500 font-bold text-sm">
                <span className="flex items-center gap-2">
                  <User className="h-4 w-4" /> Male, 45y
                </span>
                <span className="flex items-center gap-2">
                    <Activity className="h-4 w-4" /> BP: 140/90 • HR: 110
                </span>
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> 2.4 km away
                </span>
              </div>
            </div>

            <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Preparation Checklist</p>
                <div className="space-y-3 font-bold text-sm text-slate-600">
                    <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Trauma Team Notified</span>
                        <CheckCircle />
                    </div>
                    <div className="flex items-center justify-between opacity-50">
                        <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-slate-300 rounded-full" /> OT-2 Readiness</span>
                        <div className="w-4 h-4 rounded-full border-2 border-slate-200" />
                    </div>
                </div>
            </div>
          </div>

          <Link href={`/hospital/incoming/${assignment.id}`}>
            <Button className="w-full h-16 rounded-2xl bg-slate-900 hover:bg-black font-black text-sm uppercase tracking-widest shadow-xl group transition-all">
                OPEN PREPARATION CONSOLE
                <ChevronRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function CheckCircle() {
    return (
        <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                <polyline points="20 6 9 17 4 12" />
            </svg>
        </div>
    );
}
