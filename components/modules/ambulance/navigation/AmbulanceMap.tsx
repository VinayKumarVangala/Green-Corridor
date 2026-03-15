"use client"

import { useEffect } from "react"
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"

// Fix Leaflet marker icon issue
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

interface AmbulanceMapProps {
    start: { lat: number, lng: number }
    end: { lat: number, lng: number }
    polyline?: [number, number][]
}

function MapRecorder({ center }: { center: [number, number] }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.setView(center, map.getZoom());
        }
    }, [center, map]);
    return null;
}

export default function AmbulanceMap({ start, end, polyline }: AmbulanceMapProps) {
    return (
        <MapContainer
            center={[start.lat, start.lng]}
            zoom={15}
            className="h-full w-full"
            zoomControl={false}
        >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

            {polyline && (
                <Polyline
                    positions={polyline}
                    color="#dc2626"
                    weight={8}
                    opacity={0.6}
                />
            )}

            <Marker position={[start.lat, start.lng]}>
                <Popup>Start Location</Popup>
            </Marker>

            <Marker position={[end.lat, end.lng]}>
                <Popup>Destination</Popup>
            </Marker>

            <MapRecorder center={[start.lat, start.lng]} />
        </MapContainer>
    )
}
