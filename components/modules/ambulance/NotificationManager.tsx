"use client"

import { useEmergencyNotifications } from "@/hooks/useEmergencyNotifications"
import { EmergencyNotification } from "@/components/modules/ambulance/EmergencyNotification"
import { useState, useEffect } from "react"

export function NotificationManager() {
    const { notifications, removeNotification } = useEmergencyNotifications()
    const [currentNotification, setCurrentNotification] = useState<any>(null)

    useEffect(() => {
        // If we have notifications and aren't showing one, show the first in queue
        if (notifications.length > 0 && !currentNotification) {
            setCurrentNotification(notifications[0])
        }
    }, [notifications, currentNotification])

    const handleAction = (id: string) => {
        removeNotification(id)
        setCurrentNotification(null)
    }

    const handleTimeout = async (id: string) => {
        // API call to auto-decline
        try {
            await fetch("/api/ambulance/assignment/decline", {
                method: "POST",
                body: JSON.stringify({ assignmentId: id, reason: "Timeout" })
            })
        } catch (e) {
            console.error("Timeout decline failed")
        }
        handleAction(id)
    }

    if (!currentNotification) return null

    return (
        <EmergencyNotification
            assignment={currentNotification}
            onAccept={handleAction}
            onDecline={handleAction}
            onTimeout={handleTimeout}
        />
    )
}
