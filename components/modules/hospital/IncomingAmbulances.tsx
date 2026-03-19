"use client"

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Ambulance, 
  MapPin, 
  Clock, 
  User, 
  AlertCircle,
  Phone,
  ChevronRight,
  Loader2
} from "lucide-react";
import { IncomingPatientCard } from "./IncomingPatientCard";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy-key";
const supabase = createClient(supabaseUrl, supabaseKey);

export function IncomingAmbulances({ hospitalId }: { hospitalId: string }) {
  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchIncoming = async () => {
    try {
      // In a real app, we'd query ambulance_assignments joined with emergency_requests
      // for this specific hospitalId where status is 'accepted' or 'picked_up'
      const { data, error } = await supabase
        .from('ambulance_assignments')
        .select(`
          *,
          emergency_requests (*),
          ambulance_drivers (*)
        `)
        .eq('status', 'picked_up') // Only show those on the way to hospital
        .order('created_at', { ascending: false });

      if (!error && data) {
        setAmbulances(data);
      }
    } catch (e) {
      console.error("Failed to fetch incoming ambulances", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIncoming();
    
    // Subscribe to real-time updates for ambulance_assignments
    const channel = supabase
      .channel('hospital-intake')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'ambulance_assignments' 
      }, () => {
        fetchIncoming();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hospitalId]);

  if (isLoading) {
    return (
      <Card className="border-none shadow-sm rounded-3xl h-[400px] flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
      </Card>
    );
  }

  return (
    <Card className="border-none shadow-sm rounded-[40px] overflow-hidden bg-white">
      <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between">
        <CardTitle className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Ambulance className="h-6 w-6 text-blue-600" />
            Live Intake
        </CardTitle>
        <Badge className="bg-blue-50 text-blue-600 border-none font-black px-4 py-1.5 rounded-full">
            {ambulances.length} INCOMING
        </Badge>
      </CardHeader>
      <CardContent className="p-8 pt-0">
        <div className="space-y-4">
          {ambulances.length === 0 ? (
            <div className="text-center py-20 bg-slate-50/50 rounded-[32px] border-2 border-dashed border-slate-100">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100 shadow-sm">
                    <Activity className="h-8 w-8 text-slate-200" />
                </div>
                <p className="text-slate-500 font-bold">Clear Coast</p>
                <p className="text-slate-400 text-xs mt-1 uppercase tracking-widest font-black">No incoming emergencies</p>
            </div>
          ) : (
            ambulances.map((amb) => (
              <IncomingPatientCard key={amb.id} assignment={amb} />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Activity({ className }: { className?: string }) {
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
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
    );
}
