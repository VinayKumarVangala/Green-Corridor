"use client"

import { useEffect, useState } from "react"
import { MapContainer, TileLayer, Marker, useMap, Popup } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { Navigation } from "lucide-react"

// Custom Icons
const ambulanceIcon = L.icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/3448/3448553.png", // Alternative ambulance icon
    iconSize: [40, 40],
    iconAnchor: [20, 20],
})

const userIcon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
})

interface LiveMapProps {
    userLoc: { lat: number, lng: number }
    ambulanceLoc: { lat: number, lng: number } | null
    status: string
}

function MapUpdater({ userLoc, ambulanceLoc }: { userLoc: any, ambulanceLoc: any }) {
    const map = useMap()

    useEffect(() => {
        if (userLoc && ambulanceLoc) {
            const bounds = L.latLngBounds([userLoc.lat, userLoc.lng], [ambulanceLoc.lat, ambulanceLoc.lng])
            map.fitBounds(bounds, { padding: [50, 50] })
        } else if (userLoc) {
            map.setView([userLoc.lat, userLoc.lng], 15)
        }
    }, [userLoc, ambulanceLoc, map])

    return null
}

export default function LiveMap({ userLoc, ambulanceLoc, status }: LiveMapProps) {
    return (
        <div className="rounded-3xl overflow-hidden border border-slate-200 h-[400px] shadow-inner relative z-0">
            <MapContainer
                center={[userLoc.lat, userLoc.lng]}
                zoom={15}
                style={{ height: "100%", width: "100%" }}
                zoomControl={false}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.osm.org/{z}/{x}/{y}.png"
                />

                <Marker position={[userLoc.lat, userLoc.lng]} icon={userIcon}>
                    <Popup>Your Location</Popup>
                </Marker>

                {ambulanceLoc && (
                    <Marker position={[ambulanceLoc.lat, ambulanceLoc.lng]} icon={ambulanceIcon}>
                        <Popup>
                            <div className="font-bold">Ambulance</div>
                            <div className="text-xs text-slate-500">Status: {status}</div>
                        </Popup>
                    </Marker>
                )}

                <MapUpdater userLoc={userLoc} ambulanceLoc={ambulanceLoc} />
            </MapContainer>

            <div className="absolute top-4 right-4 z-[1000] bg-white px-3 py-1.5 rounded-full shadow-md border border-slate-100 flex items-center gap-2 text-xs font-bold text-slate-600">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-ping" />
                LIVE TRACKING
            </div>
        </div>
    )
}
