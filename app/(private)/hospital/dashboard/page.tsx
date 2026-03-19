"use client"

import { useSession } from "next-auth/react";
import { HospitalStats } from "@/components/modules/hospital/HospitalStats";
import { CapacityManager } from "@/components/modules/hospital/CapacityManager";
import { IncomingAmbulances } from "@/components/modules/hospital/IncomingAmbulances";
import { Bell, Search, Settings, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = 'force-dynamic';

export default function HospitalDashboard() {
  const { data: session } = useSession();
  const hospitalName = session?.user?.metadata?.hospitalName || "Apex Hospital";
  const hospitalId = session?.user?.id || "H-DUMMY";

  return (
    <div className="p-4 lg:p-12 space-y-10 min-h-screen">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">{hospitalName}</h1>
            <div className="bg-emerald-50 text-emerald-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-emerald-100">
                Live Console
            </div>
          </div>
          <p className="text-slate-500 font-bold">Welcome back, {session?.user?.name || "Staff"}</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group hidden md:block">
            <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
            <input 
              type="text" 
              placeholder="Search patients..." 
              className="pl-12 pr-6 h-12 w-64 rounded-2xl bg-white border border-slate-100 shadow-sm focus:ring-2 focus:ring-blue-600 outline-none font-medium transition-all"
            />
          </div>
          <Button variant="outline" size="icon" className="w-12 h-12 rounded-2xl border-slate-100 text-slate-400 hover:text-blue-600 transition-all relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
          </Button>
        </div>
      </header>

      {/* Stats Overview */}
      <HospitalStats />

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          {/* Live Intake List */}
          <IncomingAmbulances hospitalId={hospitalId} />
          
          {/* Quick Alert Bar */}
          <div className="bg-slate-900 p-8 rounded-[40px] shadow-2xl shadow-blue-900/10 flex items-center justify-between gap-6 overflow-hidden relative group transition-all hover:scale-[1.01]">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 -mr-32 -mt-32 rounded-full opacity-10 group-hover:scale-110 transition-transform duration-700" />
            <div className="flex items-center gap-6 relative z-10">
                <div className="w-16 h-16 bg-white/10 rounded-[28px] flex items-center justify-center border border-white/10 backdrop-blur-md">
                    <AlertCircle className="h-8 w-8 text-blue-400" />
                </div>
                <div>
                    <h3 className="text-xl font-black text-white">Mass Casualty Protocol</h3>
                    <p className="text-blue-200/60 font-medium">Activate city-wide emergency intake divert logic.</p>
                </div>
            </div>
            <Button className="h-14 px-8 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-600/30 relative z-10">
                ACTIVATE NOW
            </Button>
          </div>
        </div>

        <div className="space-y-10">
          {/* Capacity Manager */}
          <CapacityManager />

          {/* Emergency Contacts Card */}
          <Card className="border-none shadow-sm rounded-[40px] overflow-hidden bg-white">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-xl font-black text-slate-900 tracking-tight">Rapid Response</CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-0 space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 flex items-center justify-between border border-slate-100">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Trauma Team A</span>
                <span className="bg-emerald-50 text-emerald-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">On Standby</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 flex items-center justify-between border border-slate-100">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">OT-1 Readiness</span>
                <span className="bg-emerald-50 text-emerald-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">Prepared</span>
              </div>
              <Button variant="outline" className="w-full h-12 rounded-xl text-xs font-black uppercase tracking-widest border-slate-100 text-slate-600 hover:bg-slate-50 mt-4">
                View Staff Directory
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
