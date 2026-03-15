"use client"

import { useEffect, useState, useMemo } from "react"
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { Button } from "@/components/ui/button"
import { MapPin, Navigation } from "lucide-react"

// Fix for default marker icons in Leaflet with Next.js
const DefaultIcon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
})
L.Marker.prototype.options.icon = DefaultIcon

interface LocationPickerProps {
    onLocationSelect: (lat: number, lng: number, address: string) => void
    initialLat?: number
    initialLng?: number
}

function LocationMarker({ position, setPosition }: { position: L.LatLng, setPosition: (pos: L.LatLng) => void }) {
    const map = useMapEvents({
        click(e) {
            setPosition(e.latlng)
            map.flyTo(e.latlng, map.getZoom())
        },
    })

    return position === null ? null : (
        <Marker
            position={position}
            draggable={true}
            eventHandlers={{
                dragend: (e) => {
                    const marker = e.target
                    setPosition(marker.getLatLng())
                }
            }}
        />
    )
}

function ChangeView({ center }: { center: L.LatLngExpression }) {
    const map = useMap()
    useEffect(() => {
        map.setView(center)
    }, [center, map])
    return null
}

export default function LocationPicker({ onLocationSelect, initialLat, initialLng }: LocationPickerProps) {
    const [position, setPosition] = useState<L.LatLng>(
        new L.LatLng(initialLat || 19.0760, initialLng || 72.8777) // Mumbai default
    )
    const [address, setAddress] = useState("Locating...")
    const [isLocating, setIsLocating] = useState(false)

    // Reverse geocoding (OpenStreetMap Nominatim)
    const reverseGeocode = async (lat: number, lng: number) => {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
            )
            const data = await response.json()
            const addr = data.display_name || `Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
            setAddress(addr)
            onLocationSelect(lat, lng, addr)
        } catch (e) {
            const fallback = `Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
            setAddress(fallback)
            onLocationSelect(lat, lng, fallback)
        }
    }

    useEffect(() => {
        reverseGeocode(position.lat, position.lng)
    }, [position])

    const handleGetCurrentLocation = () => {
        setIsLocating(true)
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const newPos = new L.LatLng(pos.coords.latitude, pos.coords.longitude)
                    setPosition(newPos)
                    setIsLocating(false)
                },
                () => {
                    setIsLocating(false)
                    alert("Could not get your location. Please select manually on the map.")
                }
            )
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="rounded-lg overflow-hidden border border-slate-200 h-[300px] relative z-0">
                <MapContainer
                    center={position}
                    zoom={13}
                    style={{ height: "100%", width: "100%" }}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <ChangeView center={position} />
                    <LocationMarker position={position} setPosition={setPosition} />
                </MapContainer>

                <Button
                    variant="outline"
                    size="sm"
                    className="absolute bottom-4 right-4 z-[1000] bg-white shadow-md"
                    onClick={handleGetCurrentLocation}
                    disabled={isLocating}
                    type="button"
                >
                    <Navigation className={`mr-2 h-4 w-4 ${isLocating ? 'animate-spin' : ''}`} />
                    My Location
                </Button>
            </div>

            <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-md border border-slate-100 italic text-sm">
                <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span className="text-slate-600 truncate">{address}</span>
            </div>
        </div>
    )
}
