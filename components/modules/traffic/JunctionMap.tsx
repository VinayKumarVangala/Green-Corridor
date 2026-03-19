"use client"

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, TrafficCone } from "lucide-react";

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);

export function JunctionMap({ junctionLocation = [12.9128, 77.6388] }: { junctionLocation?: [number, number] }) {
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return <div className="h-full w-full bg-slate-50 flex items-center justify-center font-black animate-pulse text-slate-200">INITIALIZING TACTICAL OVERLAY...</div>;

  return (
    <div className="h-full w-full relative">
      <MapContainer 
        center={junctionLocation} 
        zoom={15} 
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <Marker position={junctionLocation}>
          <Popup>Junction 901 - Active Station</Popup>
        </Marker>
      </MapContainer>
      
      <div className="absolute top-6 left-6 z-[1000] flex flex-col gap-3">
        <Badge className="bg-slate-900/90 backdrop-blur-md text-white border-none font-black px-4 py-2 rounded-xl shadow-xl flex items-center gap-2">
            <TrafficCone className="h-4 w-4 text-emerald-500" />
            Control Point Beta
        </Badge>
        <Badge className="bg-white/90 backdrop-blur-md text-slate-900 border-none font-black px-4 py-2 rounded-xl shadow-xl flex items-center gap-2">
            <Navigation className="h-4 w-4 text-blue-600" />
            2 Transits Detected
        </Badge>
      </div>

      <div className="absolute bottom-6 right-6 z-[1000]">
        <div className="bg-white/90 backdrop-blur-md p-4 rounded-3xl shadow-2xl border border-white/20 flex items-center gap-6">
            <div className="text-right border-r border-slate-100 pr-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Current Lat/Lng</p>
                <p className="text-sm font-black text-slate-800 tabular-nums">{junctionLocation[0]}, {junctionLocation[1]}</p>
            </div>
            <div className="flex -space-x-3">
                {[1,2,3].map(i => (
                    <div key={i} className="w-10 h-10 rounded-full bg-emerald-500 border-4 border-white flex items-center justify-center text-[10px] font-black text-white">
                        AMB
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
}
