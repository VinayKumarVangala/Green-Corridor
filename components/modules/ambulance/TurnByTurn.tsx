"use client"

import {
    Navigation,
    ArrowUp,
    ArrowUpLeft,
    ArrowUpRight,
    ArrowLeft,
    ArrowRight,
    CircleDot
} from "lucide-react"
import { cn } from "@/lib/utils"

interface TurnByTurnProps {
    instructions: any[]
}

export function TurnByTurn({ instructions }: TurnByTurnProps) {
    const getIcon = (type: string, modifier?: string) => {
        if (type === "depart") return <Navigation className="h-5 w-5 rotate-45" />
        if (type === "arrive") return <CircleDot className="h-5 w-5" />

        switch (modifier) {
            case "left":
            case "slight left":
            case "sharp left":
                return <ArrowUpLeft className="h-5 w-5" />
            case "right":
            case "slight right":
            case "sharp right":
                return <ArrowUpRight className="h-5 w-5" />
            case "straight":
                return <ArrowUp className="h-5 w-5" />
            default:
                return <ArrowUp className="h-5 w-5" />
        }
    }

    return (
        <div className="flex flex-col h-full bg-white border-l border-slate-100">
            <div className="p-6 border-b border-slate-50 bg-slate-50/50">
                <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <Navigation className="h-5 w-5 text-red-600" />
                    Instructions
                </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {instructions.map((step, i) => (
                    <div
                        key={i}
                        className={cn(
                            "flex items-start gap-4 p-4 rounded-2xl transition-all",
                            i === 0 ? "bg-red-50 ring-1 ring-red-100" : "bg-slate-50 hover:bg-slate-100"
                        )}
                    >
                        <div className={cn(
                            "p-3 rounded-xl flex items-center justify-center",
                            i === 0 ? "bg-red-600 text-white" : "bg-white text-slate-400"
                        )}>
                            {getIcon(step.type, step.modifier)}
                        </div>
                        <div className="flex-1">
                            <p className={cn(
                                "font-bold leading-tight",
                                i === 0 ? "text-slate-900 text-lg" : "text-slate-600"
                            )}>
                                {step.instruction}
                            </p>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">
                                {Math.round(step.distance)} meters • {Math.round(step.duration)}s
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
