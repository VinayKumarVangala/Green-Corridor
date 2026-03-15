"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Truck, Phone, Mail, Award, History } from "lucide-react";

export function DriverProfile({ user }: { user: any }) {
    const metadata = user?.metadata || { employeeId: "EMP001", vehicleNumber: "VEH001" };

    return (
        <div className="space-y-6">
            <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                <CardHeader className="bg-slate-900 text-white p-8">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20">
                            <User className="h-10 w-10 text-white/80" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black tracking-tight">{user?.name || "Driver Name"}</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="bg-emerald-500/20 border-emerald-500/30 text-emerald-400 font-bold uppercase tracking-widest text-[10px]">
                                    Active
                                </Badge>
                                <div className="text-slate-400 text-xs font-bold uppercase tracking-widest flex items-center gap-1">
                                    <Award className="h-3 w-3" />
                                    Senior Driver
                                </div>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8">
                    <div className="space-y-6">
                        <div className="flex items-center justify-between pb-6 border-b border-slate-50">
                            <div className="flex items-center gap-3">
                                <Truck className="h-5 w-5 text-slate-400" />
                                <span className="text-sm font-bold text-slate-500">Vehicle Number</span>
                            </div>
                            <span className="font-black text-slate-900 uppercase tracking-tight">{metadata.vehicleNumber}</span>
                        </div>

                        <div className="flex items-center justify-between pb-6 border-b border-slate-50">
                            <div className="flex items-center gap-3">
                                <User className="h-5 w-5 text-slate-400" />
                                <span className="text-sm font-bold text-slate-500">Employee ID</span>
                            </div>
                            <span className="font-black text-slate-900 uppercase tracking-tight">{metadata.employeeId}</span>
                        </div>

                        <div className="flex items-center gap-3 py-2">
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Shift Completion</span>
                                    <span className="text-xs font-black text-slate-900">75%</span>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-red-500 w-[75%]" />
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                <CardHeader className="p-6">
                    <CardTitle className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <History className="h-4 w-4 text-red-600" />
                        Latest Alerts
                    </CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                    <div className="space-y-4">
                        {[
                            "Route cleared: Junction A to B",
                            "New emergency protocol updated",
                            "Flash rain warning: North Sector"
                        ].map((alert, i) => (
                            <div key={i} className="flex gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100/50">
                                <div className="w-1 h-1 rounded-full bg-red-400 mt-2" />
                                <p className="text-sm font-medium text-slate-600 leading-tight">{alert}</p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
