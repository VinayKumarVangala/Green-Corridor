"use client"

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Phone,
    MapPin,
    Navigation,
    CheckCircle,
    AlertCircle,
    Loader2,
    Check
} from "lucide-react";
import { toast } from "sonner";

export function CurrentJob({ onStartNav }: { onStartNav?: (job: any) => void }) {
    // In a real app, this would be fetched from the DB or received via Supabase Realtime
    const [job, setJob] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);

    const fetchActiveJob = async () => {
        try {
            const res = await fetch("/api/ambulance/assignment/status");
            const data = await res.json();
            if (data.assignment) {
                const a = data.assignment;
                setJob({
                    id: a.id,
                    emergencyType: a.emergency_requests.emergency_type,
                    address: a.emergency_requests.address,
                    requester: a.emergency_requests.citizen_profiles?.full_name || "Anonymous",
                    phone: a.emergency_requests.citizen_profiles?.phone || "Not available",
                    status: a.status,
                    distance: "Calculating...", // This would come from navigation hook
                    eta: "8 mins"
                });
            } else {
                setJob(null);
            }
        } catch (e) {
            console.error("Failed to fetch job", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchActiveJob();
        // Periodic refresh
        const interval = setInterval(fetchActiveJob, 30000);
        return () => clearInterval(interval);
    }, []);

    const confirmPickup = async () => {
        setIsUpdating(true);
        try {
            const res = await fetch("/api/ambulance/pickup-confirm", {
                method: "POST",
                body: JSON.stringify({ assignmentId: job.id })
            });
            if (!res.ok) throw new Error("Failed to confirm pickup");
            toast.success("Patient Picked Up", { description: "Navigating to hospital..." });
            fetchActiveJob();
        } catch (e) {
            toast.error("Error confirming pickup");
        } finally {
            setIsUpdating(false);
        }
    };

    const confirmArrival = async () => {
        setIsUpdating(true);
        try {
            const res = await fetch("/api/ambulance/arrival-confirm", {
                method: "POST",
                body: JSON.stringify({ assignmentId: job.id })
            });
            if (!res.ok) throw new Error("Failed to confirm arrival");
            toast.success("Arrived at Hospital", { description: "You are now available for new calls." });
            fetchActiveJob();
        } catch (e) {
            toast.error("Error confirming arrival");
        } finally {
            setIsUpdating(false);
        }
    };

    if (loading) {
        return (
            <Card className="border-none shadow-sm rounded-3xl h-[300px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-slate-200 animate-spin" />
            </Card>
        );
    }

    if (!job) {
        return (
            <Card className="border-dashed border-2 border-slate-200 shadow-none rounded-3xl bg-slate-50/50 h-[300px] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100 shadow-sm">
                        <CheckCircle className="h-8 w-8 text-slate-300" />
                    </div>
                    <p className="text-slate-500 font-bold">No active jobs</p>
                    <p className="text-slate-400 text-sm mt-1">Updates will appear here automatically.</p>
                </div>
            </Card>
        );
    }

    return (
        <Card className="border-none shadow-xl shadow-red-600/5 rounded-[40px] overflow-hidden bg-white ring-1 ring-slate-100">
            <CardContent className="p-0">
                <div className="bg-red-600 p-8 text-white flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <Badge variant="outline" className="bg-white/10 border-white/20 text-white font-bold uppercase tracking-widest text-[10px]">
                                Priority 1 - High
                            </Badge>
                            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        </div>
                        <h2 className="text-4xl font-black tracking-tight">{job.emergencyType}</h2>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right hidden md:block border-r border-white/20 pr-6 mr-2">
                            <p className="text-xs font-bold text-white/60 uppercase tracking-widest mb-1">Time to Arrival</p>
                            <p className="text-3xl font-black">{job.eta}</p>
                        </div>
                        <Button
                            size="lg"
                            onClick={() => onStartNav?.(job)}
                            className="bg-white text-red-600 hover:bg-slate-100 rounded-2xl h-16 px-8 text-lg font-black shadow-xl shadow-black/10 group transition-all"
                        >
                            <Navigation className="mr-2 h-6 w-6 group-hover:rotate-12 transition-transform" />
                            GO
                        </Button>
                    </div>
                </div>

                <div className="p-8">
                    <div className="grid md:grid-cols-2 gap-10">
                        <div className="space-y-8">
                            <div className="flex items-start gap-4">
                                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                    <MapPin className="h-6 w-6 text-slate-400" />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Pickup Location</p>
                                    <p className="text-xl font-bold text-slate-800 leading-tight">{job.address}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                    <User className="h-6 w-6 text-slate-400" />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Requester</p>
                                    <div className="flex items-center gap-3">
                                        <p className="text-xl font-bold text-slate-800">{job.requester}</p>
                                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 font-bold border-none">Verified</Badge>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <Button variant="outline" className="w-full h-16 rounded-2xl text-lg font-black border-slate-200 hover:bg-slate-50 gap-3">
                                <Phone className="h-6 w-6 text-emerald-500 fill-emerald-500/20" />
                                {job.phone}
                            </Button>
                            <div className="grid grid-cols-2 gap-4">
                                <Button
                                    variant="outline"
                                    disabled={isUpdating || job.status === 'picked_up'}
                                    onClick={confirmPickup}
                                    className="h-16 rounded-2xl font-bold text-slate-900 border-slate-200 hover:bg-slate-50 gap-2"
                                >
                                    {job.status === 'picked_up' && <Check className="h-4 w-4 text-emerald-500" />}
                                    Patient Ready?
                                </Button>
                                <Button
                                    disabled={isUpdating || job.status !== 'picked_up'}
                                    onClick={confirmArrival}
                                    className="h-16 rounded-2xl font-black bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-600/10 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
                                >
                                    {isUpdating ? <Loader2 className="h-5 w-5 animate-spin" /> : "MARK ARRIVED"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// Sub-component for better organization
function User({ className }: { className?: string }) {
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
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    );
}
