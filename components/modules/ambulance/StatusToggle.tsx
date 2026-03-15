"use client"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, XCircle } from "lucide-react";

type Status = "available" | "busy" | "offline";

export function StatusToggle() {
    const [status, setStatus] = useState<Status>("available");

    const statuses: { id: Status; label: string; icon: any; color: string }[] = [
        { id: "available", label: "Available", icon: CheckCircle2, color: "text-emerald-500 bg-emerald-500/10" },
        { id: "busy", label: "Busy", icon: Circle, color: "text-amber-500 bg-amber-500/10" },
        { id: "offline", label: "Offline", icon: XCircle, color: "text-slate-400 bg-slate-400/10" },
    ];

    const updateStatus = async (newStatus: Status) => {
        setStatus(newStatus);
        // API call to update status would go here
        try {
            await fetch("/api/ambulance/status", {
                method: "POST",
                body: JSON.stringify({ status: newStatus }),
            });
        } catch (e) {
            console.error("Failed to update status");
        }
    };

    return (
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-slate-100">
            {statuses.map((s) => (
                <Button
                    key={s.id}
                    variant="ghost"
                    size="sm"
                    onClick={() => updateStatus(s.id)}
                    className={cn(
                        "h-10 px-4 rounded-xl transition-all font-bold gap-2",
                        status === s.id ? s.color : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                    )}
                >
                    <s.icon className="h-4 w-4" />
                    {s.label}
                </Button>
            ))}
        </div>
    );
}
