"use client"

import { useState, useEffect, useCallback } from "react"
import {
    X,
    Bell,
    MapPin,
    Navigation,
    ChevronRight,
    AlertTriangle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface EmergencyNotificationProps {
    assignment: any
    onAccept: (id: string) => void
    onDecline: (id: string) => void
    onTimeout: (id: string) => void
}

export function EmergencyNotification({
    assignment,
    onAccept,
    onDecline,
    onTimeout
}: EmergencyNotificationProps) {
    const [timeLeft, setTimeLeft] = useState(10)
    const [isProcessing, setIsProcessing] = useState(false)

    const handleTimeout = useCallback(() => {
        onTimeout(assignment.id)
    }, [assignment.id, onTimeout])

    useEffect(() => {
        if (timeLeft <= 0) {
            handleTimeout()
            return
        }

        const timer = setInterval(() => {
            setTimeLeft(prev => prev - 1)
        }, 1000)

        return () => clearInterval(timer)
    }, [timeLeft, handleTimeout])

    useEffect(() => {
        // Play notification sound
        const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3")
        audio.play().catch(e => console.log("Audio play blocked"))

        // Browser push notification
        if (Notification.permission === "granted") {
            new Notification("EMERGENCY ASSIGNMENT", {
                body: `New ${assignment.emergency_requests.emergency_type} request. You have 10 seconds to respond.`,
                icon: "/favicon.ico"
            })
        }
    }, [assignment])

    const accept = async () => {
        setIsProcessing(true)
        try {
            const res = await fetch("/api/ambulance/assignment/respond", {
                method: "POST",
                body: JSON.stringify({ assignmentId: assignment.id, action: "accepted" })
            })
            if (!res.ok) throw new Error("Failed to accept")
            onAccept(assignment.id)
            toast.success("Assignment Accepted", {
                description: "Navigating to pickup location...",
            })
        } catch (e) {
            toast.error("Could not accept assignment")
        } finally {
            setIsProcessing(false)
        }
    }

    const decline = async () => {
        setIsProcessing(true)
        try {
            const res = await fetch("/api/ambulance/assignment/respond", {
                method: "POST",
                body: JSON.stringify({ assignmentId: assignment.id, action: "declined", reason: "Manual Decline" })
            })
            if (!res.ok) throw new Error("Failed to decline")
            onDecline(assignment.id)
        } catch (e) {
            onDecline(assignment.id) // Fallback
        } finally {
            setIsProcessing(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/95 backdrop-blur-xl transition-all animate-in fade-in zoom-in duration-300">
            <div className="relative max-w-2xl w-full bg-white rounded-[48px] overflow-hidden shadow-2xl shadow-red-600/20">

                {/* Progress bar for countdown */}
                <div className="absolute top-0 left-0 right-0 h-4 bg-slate-100">
                    <div
                        className="h-full bg-red-600 transition-all duration-1000 ease-linear"
                        style={{ width: `${(timeLeft / 10) * 100}%` }}
                    />
                </div>

                <div className="p-12">
                    <header className="flex items-center justify-between mb-12">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-red-600 rounded-3xl flex items-center justify-center animate-pulse shadow-xl shadow-red-600/30">
                                <AlertTriangle className="h-8 w-8 text-white" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Emergency Call</h2>
                                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">Immediate Response Required</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-5xl font-black text-red-600 tabular-nums">{timeLeft}s</span>
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Expires in</span>
                        </div>
                    </header>

                    <div className="space-y-10 mb-12">
                        <div className="p-8 rounded-[32px] bg-slate-50 border border-slate-100 ring-1 ring-slate-100">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                                        <span className="text-xs font-black text-red-600 uppercase tracking-widest">Critical Alert</span>
                                    </div>
                                    <h3 className="text-5xl font-black text-slate-900 leading-none">
                                        {assignment.emergency_requests.emergency_type}
                                    </h3>
                                    <div className="flex items-center gap-2 text-slate-400 font-bold">
                                        <MapPin className="h-4 w-4" />
                                        Distance: 1.2 KM (Est. 4 mins)
                                    </div>
                                </div>
                                <div className="text-center md:text-right">
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Patient Status</p>
                                    <span className="bg-red-100 text-red-700 px-4 py-2 rounded-full font-black text-sm uppercase tracking-tight">VITAL DANGER</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 justify-center py-6 border-y border-slate-50">
                            <Navigation className="h-5 w-5 text-slate-300" />
                            <p className="text-slate-400 font-medium italic">Pickup address hidden until acceptance</p>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <Button
                            onClick={decline}
                            disabled={isProcessing}
                            variant="outline"
                            className="h-20 rounded-[28px] text-xl font-bold border-2 border-slate-100 hover:bg-slate-50 text-slate-400 transition-all hover:text-slate-900"
                        >
                            DECLINE
                        </Button>
                        <Button
                            onClick={accept}
                            disabled={isProcessing}
                            className="h-20 rounded-[28px] text-xl font-black bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-600/20 text-white flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95"
                        >
                            ACCEPT ASSIGNMENT
                            <ChevronRight className="h-6 w-6" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
