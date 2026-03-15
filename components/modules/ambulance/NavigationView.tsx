"use client"

import { useState, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import { useRouting } from "@/hooks/useRouting"
import { TurnByTurn } from "@/components/modules/ambulance/TurnByTurn"
import { VoiceGuidance } from "@/components/modules/ambulance/VoiceGuidance"
import { Card } from "@/components/ui/card"
import {
    Navigation,
    Clock,
    Map as MapIcon,
    AlertCircle,
    Maximize2,
    Settings,
    ChevronRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Dynamic import for the Map component to prevent SSR errors
const AmbulanceMap = dynamic(() => import("./navigation/AmbulanceMap"), {
    ssr: false,
    loading: () => (
        <div className="h-full w-full bg-slate-100 flex items-center justify-center">
            <div className="animate-pulse flex flex-col items-center">
                <div className="h-12 w-12 rounded-full bg-slate-200 mb-4" />
                <div className="h-4 w-24 bg-slate-200 rounded" />
            </div>
        </div>
    )
})

interface NavigationViewProps {
    start: { lat: number, lng: number }
    end: { lat: number, lng: number }
    waypoints?: any[]
    onArrive?: () => void
}

export function NavigationView({ start, end, waypoints = [], onArrive }: NavigationViewProps) {
    const { routeData, calculateRoute, isLoading, error, alternatives } = useRouting()
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [currentStepIndex, setCurrentStepIndex] = useState(0)
    const [selectedRouteIndex, setSelectedRouteIndex] = useState(0)

    useEffect(() => {
        if (start && end) {
            calculateRoute(start, end, waypoints)
        }
    }, [start, end, waypoints, calculateRoute])

    // Traffic Polling every 30 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            if (start && end) {
                // Silently refresh route to check for traffic updates
                calculateRoute(start, end, waypoints, false).then(newData => {
                    // Simulation: If duration changed significantly, notify driver
                })
            }
        }, 30000)
        return () => clearInterval(interval)
    }, [start, end, waypoints, calculateRoute])

    if (isLoading && !routeData) {
        return (
            <div className="h-[600px] bg-slate-50 flex items-center justify-center rounded-[40px] border border-slate-100">
                <div className="text-center animate-pulse">
                    <Navigation className="h-12 w-12 text-red-600 mx-auto mb-4 animate-bounce" />
                    <p className="text-slate-500 font-bold">Calculating GPS Route...</p>
                </div>
            </div>
        )
    }

    const currentInstruction = routeData?.instructions[currentStepIndex]?.instruction || null

    return (
        <div className="relative h-[700px] w-full bg-slate-900 rounded-[40px] overflow-hidden shadow-2xl border border-slate-800 flex flex-col md:flex-row">

            {/* Map Area */}
            <div className="flex-1 relative order-2 md:order-1">
                <AmbulanceMap
                    start={start}
                    end={end}
                    polyline={routeData?.polyline}
                />

                {/* Overlays */}
                <div className="absolute top-6 left-6 z-[1000] flex flex-col gap-4">
                    <VoiceGuidance instruction={currentInstruction} />
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="rounded-full w-12 h-12 shadow-lg bg-white hidden md:flex"
                    >
                        <Maximize2 className="h-6 w-6 text-slate-400" />
                    </Button>
                </div>

                <div className="absolute bottom-6 left-6 right-6 z-[1000] md:max-w-md space-y-4">
                    {/* Alternatives Selector */}
                    {alternatives.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            {alternatives.map((alt, i) => (
                                <Button
                                    key={i}
                                    variant="ghost"
                                    onClick={() => setSelectedRouteIndex(i)}
                                    className={cn(
                                        "whitespace-nowrap rounded-2xl h-12 px-6 font-bold transition-all border shrink-0",
                                        selectedRouteIndex === i
                                            ? "bg-white text-red-600 border-white shadow-xl"
                                            : "bg-slate-900/40 backdrop-blur-md text-white border-white/10 hover:bg-slate-900/60"
                                    )}
                                >
                                    {alt.label}
                                    <span className="ml-2 opacity-60 font-medium">
                                        {Math.round(alt.duration / 60)}m
                                    </span>
                                </Button>
                            ))}
                        </div>
                    )}

                    <Card className="border-none shadow-2xl rounded-[32px] overflow-hidden bg-white/90 backdrop-blur-md">
                        <div className="p-6 flex items-center justify-between gap-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-600/20">
                                    <Navigation className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                    <p className="text-3xl font-black text-slate-900 tabular-nums">
                                        {routeData ? Math.round(routeData.duration / 60) : "--"} <span className="text-sm font-bold text-slate-400 uppercase">min</span>
                                    </p>
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                        {routeData ? (routeData.distance / 1000).toFixed(1) : "--"} km • Traffic Clear
                                    </p>
                                </div>
                            </div>
                            <Button className="h-14 px-8 rounded-2xl bg-slate-900 hover:bg-black font-black text-sm uppercase tracking-widest shadow-xl">
                                RE-ROUTE
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Instruction Sidebar */}
            <div className={cn(
                "w-full md:w-96 transition-all duration-500 ease-in-out order-1 md:order-2",
                isSidebarOpen ? "block" : "hidden"
            )}>
                {routeData && (
                    <TurnByTurn instructions={routeData.instructions} />
                )}
            </div>

            {/* Arrived Notification Overlay */}
            {/* Logic to show when near end.lat, end.lng */}
        </div>
    )
}

