"use client"

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Ambulance, 
  Clock, 
  User, 
  MapPin, 
  AlertCircle,
  Phone,
  MessageSquare,
  Activity,
  Stethoscope,
  Heart,
  ChevronRight,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PreparationChecklist } from "@/components/modules/hospital/PreparationChecklist";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import dynamic from "next/dynamic";

const AmbulanceMap = dynamic(() => import("@/components/modules/ambulance/navigation/AmbulanceMap"), { ssr: false });

export default function IncomingPatientDetailPage() {
  const { assignmentId } = useParams();
  const router = useRouter();
  const [prepStatus, setPrepStatus] = useState("preparing");
  const [countdown, setCountdown] = useState(480);
  
  // Mock data for the specific assignment
  const assignment = {
    id: assignmentId,
    emergencyType: "Cardiac Arrest",
    patient: {
        name: "Vijay Kumar",
        age: 52,
        gender: "Male",
        vitals: { bp: "150/95", hr: 112, spo2: "92%" }
    },
    ambulance: {
        id: "AMB-702",
        driver: "Rajesh Shinde",
        location: { lat: 12.9716, lng: 77.5946 }
    },
    hospitalLocation: { lat: 12.9279, lng: 77.6271 }
  };

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

  const updatePrepStatus = async (status: string) => {
    try {
        const res = await fetch("/api/hospital/patient-ready", {
            method: "POST",
            body: JSON.stringify({ assignmentId, status }),
        });
        if (!res.ok) throw new Error("Failed to sync readiness");
        
        setPrepStatus(status);
        toast.success(`Facility Status: ${status.toUpperCase()}`, {
            description: "Ambulance driver has been notified."
        });
    } catch (e) {
        toast.error("Failed to sync readiness");
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Dynamic Header */}
      <div className={cn(
        "h-48 flex items-end p-8 lg:p-12 transition-colors duration-1000",
        countdown < 120 ? "bg-red-600" : countdown < 300 ? "bg-amber-600" : "bg-slate-900"
      )}>
        <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-6">
          <div className="flex items-center gap-6">
            <Button 
                variant="ghost" 
                onClick={() => router.back()}
                className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 text-white border-none"
            >
                <ArrowLeft className="h-6 w-6" />
            </Button>
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <Badge className="bg-white/10 text-white border-none font-black text-[10px] tracking-widest uppercase px-3 py-1">
                        Priority 1 - {assignment.emergencyType}
                    </Badge>
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                </div>
                <h1 className="text-4xl font-black text-white tracking-tight">Preparing for {assignment.patient.name}</h1>
            </div>
          </div>

          <div className="flex items-center gap-6 bg-white/10 backdrop-blur-xl p-4 rounded-3xl border border-white/10">
            <div className="text-right border-r border-white/20 pr-6">
                <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1">Incoming ETA</p>
                <p className="text-4xl font-black text-white tabular-nums">{formatTime(countdown)}</p>
            </div>
            <div className="flex flex-col gap-1 pr-2">
                <Badge variant={prepStatus === 'ready' ? "default" : "outline"} className={cn(
                    "font-black uppercase text-[10px] tracking-widest",
                    prepStatus === 'ready' ? "bg-emerald-500 text-white" : "text-white/60 border-white/20"
                )}>
                    {prepStatus.toUpperCase()}
                </Badge>
                <p className="text-[10px] font-bold text-white/40 uppercase">Facility Sync</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-8 lg:p-12 -mt-10">
        <div className="grid lg:grid-cols-3 gap-10">
          
          <div className="lg:col-span-2 space-y-10">
            {/* Real-time Map Preview */}
            <Card className="border-none shadow-2xl rounded-[40px] overflow-hidden h-[400px] relative">
              <AmbulanceMap 
                start={assignment.ambulance.location}
                end={assignment.hospitalLocation}
              />
              <div className="absolute top-6 left-6 z-[1000]">
                <Badge className="bg-white/90 backdrop-blur-md text-slate-900 border-none font-black px-4 py-2 rounded-xl shadow-xl flex items-center gap-2">
                  <Ambulance className="h-4 w-4 text-blue-600" />
                  Live Position: {assignment.ambulance.id}
                </Badge>
              </div>
            </Card>

            {/* Patient File & Vitals */}
            <div className="grid md:grid-cols-2 gap-10">
                <Card className="border-none shadow-sm rounded-[40px] bg-white">
                    <CardHeader className="p-8 pb-4">
                        <CardTitle className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            <ShieldCheck className="h-6 w-6 text-emerald-500" />
                            Clinical Profile
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 pt-0 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Age / Gender</p>
                                <p className="text-lg font-black text-slate-800">{assignment.patient.age} / {assignment.patient.gender}</p>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Blood Group</p>
                                <p className="text-lg font-black text-slate-800">O Positive</p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pre-Intake Note</p>
                            <p className="text-slate-600 font-bold text-sm leading-relaxed italic border-l-4 border-slate-200 pl-4 bg-slate-50/50 py-3 rounded-r-xl">
                                &quot;Patient unconscious. Family reports history of hypertension. Immediate ECG required on arrival.&quot;
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm rounded-[40px] bg-white">
                    <CardHeader className="p-8 pb-4">
                        <CardTitle className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            <Activity className="h-6 w-6 text-red-500" />
                            Live Telemetry
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 pt-0">
                        <div className="space-y-4">
                            {Object.entries(assignment.patient.vitals).map(([key, value]) => (
                                <div key={key} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group transition-all hover:bg-slate-100">
                                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{key}</span>
                                    <span className="text-xl font-black text-slate-900 group-hover:scale-110 transition-transform">{value}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
          </div>

          <div className="space-y-10">
            {/* Status Sync Control */}
            <Card className="border-none shadow-sm rounded-[40px] overflow-hidden bg-white">
                <CardHeader className="p-8 pb-4 border-b border-slate-50 bg-slate-50/50">
                    <CardTitle className="text-xl font-black text-slate-900 tracking-tight">Facility Readiness</CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-4">
                    <Button 
                        onClick={() => updatePrepStatus('preparing')}
                        className={cn(
                            "w-full h-16 rounded-2xl font-black text-sm uppercase tracking-widest transition-all",
                            prepStatus === 'preparing' ? "bg-amber-600 text-white shadow-xl shadow-amber-600/20" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                        )}
                    >
                        <Loader2 className={cn("mr-2 h-5 w-5", prepStatus === 'preparing' && "animate-spin")} />
                        PREPARING
                    </Button>
                    <Button 
                        onClick={() => updatePrepStatus('ready')}
                        className={cn(
                            "w-full h-16 rounded-2xl font-black text-sm uppercase tracking-widest transition-all",
                            prepStatus === 'ready' ? "bg-emerald-600 text-white shadow-xl shadow-emerald-600/20" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                        )}
                    >
                        <CheckCircle2 className="mr-2 h-5 w-5" />
                        READY
                    </Button>
                    <Button 
                        onClick={() => router.push('/hospital/dashboard')}
                        className="w-full h-16 rounded-2xl bg-slate-900 hover:bg-black text-white font-black text-sm uppercase tracking-widest mt-4"
                    >
                        MARK ARRIVED
                    </Button>
                </CardContent>
            </Card>

            {/* Dynamic Checklist */}
            <PreparationChecklist emergencyType={assignment.emergencyType.split(' ')[0]} />

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" className="h-16 rounded-2xl border-slate-200 font-bold hover:bg-blue-50 hover:text-blue-600 gap-2">
                    <Phone className="h-5 w-5" />
                    Ambulance
                </Button>
                <Button variant="outline" className="h-16 rounded-2xl border-slate-200 font-bold hover:bg-blue-50 hover:text-blue-600 gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Staff Group
                </Button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function Loader2({ className }: { className?: string }) {
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
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
    );
}
