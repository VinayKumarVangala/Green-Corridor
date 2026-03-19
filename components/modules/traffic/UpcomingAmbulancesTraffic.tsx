"use client"

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Ambulance, Clock, MapPin, ShieldCheck, AlertCircle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co"
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy-key"
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function UpcomingAmbulancesTraffic({ junctionId }: { junctionId: string }) {
  const [ambulances, setAmbulances] = useState<any[]>([]);

  useEffect(() => {
    const fetchUpcoming = async () => {
      // In a real app, we'd query for ambulances whose active route passes through this junction
      // For now, we'll fetch 'accepted' or 'picked_up' assignments
      const { data, error } = await supabase
        .from('ambulance_assignments')
        .select(`
          *,
          emergency_requests (*),
          ambulance_drivers (*)
        `)
        .in('status', ['accepted', 'picked_up'])
        .limit(5);

      if (!error && data) setAmbulances(data);
    };

    fetchUpcoming();
    
    const channel = supabase
      .channel('traffic-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ambulance_assignments' }, fetchUpcoming)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [junctionId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-xl font-black text-slate-900 tracking-tight">Active Transits</h3>
        <Badge className="bg-emerald-50 text-emerald-600 border-none font-black px-3 py-1 rounded-full uppercase text-[10px] tracking-widest">
            {ambulances.length} INBOUND
        </Badge>
      </div>

      {ambulances.length === 0 ? (
        <Card className="border-none shadow-sm rounded-[32px] p-12 text-center bg-white">
            <ShieldCheck className="h-12 w-12 text-slate-100 mx-auto mb-4" />
            <p className="text-slate-400 font-bold text-sm">NO EMERGENCY TRANSITS DETECTED</p>
        </Card>
      ) : (
        ambulances.map((amb) => (
          <Card key={amb.id} className="border-none shadow-sm rounded-[32px] overflow-hidden bg-white hover:shadow-md transition-all group">
            <CardContent className="p-0">
                <div className="flex items-center p-6 gap-6">
                    <div className="relative">
                        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                            <Ambulance className="h-8 w-8 text-emerald-600" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full border-2 border-white flex items-center justify-center animate-bounce">
                            <AlertCircle className="h-3 w-3 text-white" />
                        </div>
                    </div>
                    
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                            <p className="text-lg font-black text-slate-900">{amb.ambulance_drivers?.vehicle_number}</p>
                            <Badge className="bg-slate-100 text-slate-600 border-none text-[10px] font-black uppercase tracking-widest">
                                {amb.emergency_requests?.emergency_type || "Critical"}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
                            <span className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                1.2km away
                            </span>
                            <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                3m 40s
                            </span>
                        </div>
                    </div>

                    <div className="text-right">
                        <div className="bg-emerald-600 p-2 rounded-xl group-hover:scale-110 transition-transform cursor-pointer">
                            <ChevronRight className="h-5 w-5 text-white" />
                        </div>
                    </div>
                </div>
                
                <div className="h-1 bg-slate-50 w-full overflow-hidden">
                    <div className="h-full bg-emerald-500 w-[65%] animate-pulse" />
                </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
