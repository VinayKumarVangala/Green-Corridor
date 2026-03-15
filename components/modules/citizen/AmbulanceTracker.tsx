"use client"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import dynamic from "next/dynamic"
import { EstimatedTime } from "./EstimatedTime"
import { StatusTimeline } from "./StatusTimeline"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Phone, Share2, AlertCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"

const LiveMap = dynamic(() => import("./LiveMap"), {
    ssr: false,
    loading: () => <div className="h-[400px] w-full bg-slate-100 animate-pulse rounded-3xl flex items-center justify-center text-slate-400">Initializng Live Map...</div>
})

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface TrackingData {
    id: string
    status: string
    lat: number
    lng: number
    eta_minutes: number | null
    assignment: any
}

export function AmbulanceTracker({ requestId }: { requestId: string }) {
    const [data, setData] = useState<TrackingData | null>(null)
    const [loading, setLoading] = useState(true)

    const fetchStatus = async () => {
        try {
            const res = await fetch(`/api/emergency/status/${requestId}`)
            const json = await res.json()
            if (json.error) throw new Error(json.error)
            setData(json)
        } catch (e) {
            console.error(e)
            toast.error("Could not fetch tracking data")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchStatus()

        // Request notification permission
        if (typeof window !== 'undefined' && Notification.permission === "default") {
            Notification.requestPermission()
        }
        // Subscribe to Realtime Updates
        const requestChannel = supabase
            .channel(`emergency_request_${requestId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'emergency_requests',
                    filter: `id=eq.${requestId}`
                },
                (payload) => {
                    console.log("Status Change:", payload)
                    setData(prev => prev ? { ...prev, status: payload.new.status } : null)

                    if (payload.new.status !== payload.old.status) {
                        toast.success(`Update: Emergency status is now ${payload.new.status}`)
                        if (Notification.permission === "granted") {
                            new Notification("JEEVAN-SETU Update", { body: `Your emergency request is now ${payload.new.status}` })
                        }
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(requestChannel)
        }
    }, [requestId])

    // Split effect for ambulance location to keep logic clean
    useEffect(() => {
        if (!data?.assignment?.ambulance_driver_id) return

        const driverId = data.assignment.ambulance_driver_id
        const driverChannel = supabase
            .channel(`driver_location_${driverId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'ambulance_drivers',
                    filter: `id=eq.${driverId}`
                },
                (payload) => {
                    console.log("Movement:", payload)
                    setData(prev => {
                        if (!prev) return null
                        return {
                            ...prev,
                            assignment: {
                                ...prev.assignment,
                                ambulance_drivers: {
                                    ...prev.assignment.ambulance_drivers,
                                    current_lat: payload.new.current_lat,
                                    current_lng: payload.new.current_lng
                                }
                            }
                        }
                    })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(driverChannel)
        }
    }, [data?.assignment?.ambulance_driver_id])

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <p className="text-slate-500 font-medium tracking-tight">Syncing with Emergency Network...</p>
            </div>
        )
    }

    if (!data) return <div>Request not found</div>

    const ambulanceLoc = data.assignment?.ambulance_drivers
        ? { lat: data.assignment.ambulance_drivers.current_lat, lng: data.assignment.ambulance_drivers.current_lng }
        : null

    return (
        <div className="space-y-6">
            <EstimatedTime minutes={data.eta_minutes} />

            <LiveMap
                userLoc={{ lat: data.lat, lng: data.lng }}
                ambulanceLoc={ambulanceLoc}
                status={data.status}
            />

            <div className="grid md:grid-cols-3 gap-6">
                <Card className="md:col-span-2 border-none shadow-sm bg-white rounded-3xl">
                    <CardContent className="p-8">
                        <StatusTimeline currentStatus={data.status} />
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    <Button className="w-full h-14 rounded-2xl bg-slate-900 text-white font-bold gap-2">
                        <Share2 className="h-5 w-5" /> Share Access
                    </Button>
                    <Button variant="outline" className="w-full h-14 rounded-2xl font-bold gap-2">
                        <Phone className="h-5 w-5" /> Call Driver
                    </Button>
                    <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-bold text-red-600 uppercase">Emergency Protocol</p>
                            <p className="text-[10px] text-red-500 leading-tight">If the situation worsens, call 102 immediately while the ambulance is en route.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
