import { CheckCircle2, Circle, Clock, MapPin, Truck } from "lucide-react"
import { cn } from "@/lib/utils"

const STEPS = [
    { id: "pending", label: "Request Received", icon: Clock },
    { id: "assigned", label: "Ambulance Assigned", icon: Truck },
    { id: "en-route", label: "En Route to You", icon: MapPin },
    { id: "arrived", label: "Arrived", icon: CheckCircle2 },
]

interface StatusTimelineProps {
    currentStatus: string
}

export function StatusTimeline({ currentStatus }: StatusTimelineProps) {
    const currentIndex = STEPS.findIndex(s => s.id === currentStatus)

    return (
        <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest pl-1">Live Progress</h3>
            <div className="relative pl-8 space-y-8 before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                {STEPS.map((step, index) => {
                    const isActive = index <= currentIndex
                    const isCurrent = index === currentIndex
                    const Icon = step.icon

                    return (
                        <div key={step.id} className="relative flex items-center gap-4">
                            <div className={cn(
                                "absolute -left-8 h-8 w-8 rounded-full border-4 border-white flex items-center justify-center transition-all duration-500",
                                isActive ? "bg-primary text-white scale-110 shadow-md" : "bg-slate-200 text-slate-400"
                            )}>
                                {isActive ? <Icon className="h-4 w-4" /> : <div className="h-2 w-2 rounded-full bg-slate-400" />}
                            </div>
                            <div>
                                <div className={cn(
                                    "font-bold transition-colors",
                                    isActive ? "text-slate-900" : "text-slate-400"
                                )}>
                                    {step.label}
                                </div>
                                {isCurrent && (
                                    <div className="text-xs font-medium text-primary animate-pulse mt-0.5">
                                        Currently in progress...
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
