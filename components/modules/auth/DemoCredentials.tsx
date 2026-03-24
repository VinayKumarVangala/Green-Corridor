"use client"

import { Button } from "@/components/ui/button"
import { Copy } from "lucide-react"
import { toast } from "sonner"

interface DemoCredentialsProps {
    role: "ambulance_driver" | "hospital_staff" | "traffic_police"
}

const credentials = {
    ambulance_driver: {
        label: "Driver Credentials",
        fields: [
            { label: "Employee ID", value: "EMP001" },
            { label: "Vehicle ID", value: "VEH001" },
            { label: "Password", value: "password123" },
        ],
    },
    hospital_staff: {
        label: "Staff Credentials",
        fields: [
            { label: "Hospital ID", value: "HOSP001" },
            { label: "Password", value: "password123" },
        ],
    },
    traffic_police: {
        label: "Police Credentials",
        fields: [
            { label: "Junction ID", value: "JUNC001" },
            { label: "Password", value: "password123" },
        ],
    },
}

export function DemoCredentials({ role }: DemoCredentialsProps) {
    const data = credentials[role]

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text)
        toast.success(`${label} copied!`)
    }

    return (
        <div className="mt-8 p-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                Demo Verification Data
            </h4>
            <div className="space-y-2">
                {data.fields.map((field) => (
                    <div key={field.label} className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">{field.label}:</span>
                        <div className="flex items-center gap-2">
                            <code className="bg-white px-2 py-0.5 rounded border font-mono font-bold text-blue-600">
                                {field.value}
                            </code>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-slate-400 hover:text-blue-600"
                                onClick={() => copyToClipboard(field.value, field.label)}
                            >
                                <Copy className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
            <p className="mt-4 text-[11px] text-slate-400 leading-tight">
                Use these default credentials to bypass real database verification during this demo.
            </p>
        </div>
    )
}
