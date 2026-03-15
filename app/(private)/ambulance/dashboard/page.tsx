"use client"

import { useState } from "react";
import { useSession } from "next-auth/react";

export const dynamic = 'force-dynamic';
import { NavigationView } from "@/components/modules/ambulance/NavigationView";
import { StatusToggle } from "@/components/modules/ambulance/StatusToggle";
import { CurrentJob } from "@/components/modules/ambulance/CurrentJob";
import { DriverProfile } from "@/components/modules/ambulance/DriverProfile";
import { LocationSync } from "@/components/modules/ambulance/LocationSync";
import { NotificationManager } from "@/components/modules/ambulance/NotificationManager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, MapPin, Clock, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AmbulanceDashboard() {
    const { data: session } = useSession();
    const [navJob, setNavJob] = useState<any>(null);

    return (
        <div className="p-4 lg:p-8 space-y-8 min-h-screen relative">
            {/* Full-screen Navigation Overlay */}
            {navJob && (
                <div className="fixed inset-0 z-[2000] p-4 lg:p-8 bg-slate-950/80 backdrop-blur-xl flex flex-col animate-in fade-in duration-500">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center">
                                <Navigation className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-white uppercase tracking-tight">Active Emergency Navigation</h2>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{navJob.emergencyType} • Priority 1</p>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => setNavJob(null)}
                            className="bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-xl font-bold"
                        >
                            CLOSE NAV
                        </Button>
                    </div>

                    <div className="flex-1">
                        <NavigationView
                            start={{ lat: 12.9716, lng: 77.5946 }} // Mock start (Bangalore)
                            end={{ lat: 12.9279, lng: 77.6271 }} // Mock end (Koramangala)
                            onArrive={() => setNavJob(null)}
                        />
                    </div>
                </div>
            )}

            {/* Background Geolocation Sync */}
            <LocationSync />

            {/* Real-time Notification Management */}
            <NotificationManager />

            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Driver Dashboard</h1>
                    <p className="text-slate-500 font-medium">Welcome back, {session?.user?.name || "Driver"}</p>
                </div>
                <StatusToggle />
            </header>

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Active Emergency Request */}
                    <CurrentJob onStartNav={(job) => setNavJob(job)} />

                    {/* Quick Stats */}
                    <div className="grid md:grid-cols-3 gap-4">
                        <Card className="border-none shadow-sm rounded-2xl">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                    <Activity className="h-3 w-3" />
                                    Total Calls Today
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black text-slate-900">12</div>
                            </CardContent>
                        </Card>
                        <Card className="border-none shadow-sm rounded-2xl">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                    <MapPin className="h-3 w-3" />
                                    Kms Covered
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black text-slate-900">142.5</div>
                            </CardContent>
                        </Card>
                        <Card className="border-none shadow-sm rounded-2xl">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                    <Clock className="h-3 w-3" />
                                    Avg Service Time
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black text-slate-900">22m</div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Driver Information */}
                    <DriverProfile user={session?.user} />
                </div>
            </div>
        </div>
    );
}
