"use client"

import { Ambulance, Hospital, TrafficCone } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const roles = [
    {
        id: "ambulance",
        title: "Ambulance Driver",
        description: "Emergency vehicle operators",
        icon: Ambulance,
        href: "/login/ambulance",
        color: "text-red-600",
        bg: "bg-red-50",
    },
    {
        id: "hospital",
        title: "Hospital Staff",
        description: "Emergency room coordinators",
        icon: Hospital,
        href: "/login/hospital",
        color: "text-blue-600",
        bg: "bg-blue-50",
    },
    {
        id: "traffic",
        title: "Traffic Police",
        description: "Junction management teams",
        icon: TrafficCone,
        href: "/login/traffic",
        color: "text-green-600",
        bg: "bg-green-50",
    },
]

export function RoleSelector() {
    return (
        <div className="grid gap-6 sm:grid-cols-3">
            {roles.map((role) => (
                <Link key={role.id} href={role.href} className="group transition-transform hover:scale-105">
                    <Card className="h-full border-2 hover:border-primary/50">
                        <CardHeader className="text-center">
                            <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${role.bg}`}>
                                <role.icon className={`h-8 w-8 ${role.color}`} />
                            </div>
                            <CardTitle>{role.title}</CardTitle>
                            <CardDescription>{role.description}</CardDescription>
                        </CardHeader>
                    </Card>
                </Link>
            ))}
        </div>
    )
}
