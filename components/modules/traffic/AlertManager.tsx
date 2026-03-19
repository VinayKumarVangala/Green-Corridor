"use client"

import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { JunctionAlert } from "./JunctionAlert";
import { toast } from "sonner";
import { ShieldAlert, AlertTriangle } from "lucide-react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co"
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy-key"
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function AlertManager({ junctionId }: { junctionId: string }) {
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Hidden audio element for alerts
    audioRef.current = new Audio("/sounds/alert.mp3");
    
    const handleNewAlert = (payload: any) => {
      const newAlert = {
        id: payload.new.id,
        ambulanceId: payload.new.ambulance_id,
        vehicleNumber: payload.new.vehicle_number || "AMB-UNKNOWN",
        eta: payload.new.eta || 180,
        emergencyType: payload.new.emergency_type || "Critical",
        direction: payload.new.direction || "North",
        strategy: payload.new.strategy || "Clear all lanes for transit."
      };

      setActiveAlerts(prev => [...prev, newAlert]);
      
      // Play sound
      audioRef.current?.play().catch(() => {
        // Handle autoplay block
        console.warn("Audio play blocked by browser");
      });

      toast.custom((t) => (
        <div className="bg-red-600 text-white p-6 rounded-3xl shadow-2xl flex items-center gap-4 animate-bounce">
            <ShieldAlert className="h-8 w-8" />
            <div>
                <p className="font-black uppercase tracking-widest text-xs">Priority Override</p>
                <p className="font-bold">Ambulance Approaching Junction</p>
            </div>
        </div>
      ), { duration: 5000 });
    };

    const handleRouteUpdate = (payload: any) => {
        if (payload.new.route_changed) {
            setActiveAlerts(prev => prev.filter(a => a.ambulanceId !== payload.new.ambulance_id));
            toast.info("Route Changed", {
                description: "Ambulance diverted. Alert cancelled for this junction.",
                icon: <AlertTriangle className="h-5 w-5 text-amber-500" />
            });
        }
    };

    const channel = supabase
      .channel(`junction-alerts-${junctionId}`)
      .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'junction_alerts',
          filter: `junction_id=eq.${junctionId}`
      }, handleNewAlert)
      .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'ambulance_assignments'
      }, handleRouteUpdate)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [junctionId]);

  if (activeAlerts.length === 0) return null;

  return (
    <div className="fixed bottom-10 right-10 z-[5000] flex flex-col gap-6 items-end pointer-events-none">
      {activeAlerts.map((alert) => (
        <div key={alert.id} className="pointer-events-auto">
            <JunctionAlert 
                alert={alert} 
                onClose={() => setActiveAlerts(prev => prev.filter(a => a.id !== alert.id))}
                onAck={() => {
                    setActiveAlerts(prev => prev.filter(a => a.id !== alert.id));
                    toast.success("Tactical Acknowledgement Sent", {
                        description: "Dispatch and Driver have been notified."
                    });
                }}
            />
        </div>
      ))}
    </div>
  );
}
