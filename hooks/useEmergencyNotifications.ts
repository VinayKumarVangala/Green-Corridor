"use client"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { useSession } from "next-auth/react"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co"
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy-key"
const supabase = createClient(supabaseUrl, supabaseKey)

export function useEmergencyNotifications() {
    const { data: session } = useSession()
    const [notifications, setNotifications] = useState<any[]>([])

    useEffect(() => {
        if (!session?.user?.id || session.user.role !== "ambulance_driver") return

        const driverId = session.user.id
        const employeeId = session.user.metadata?.employeeId

        // Subscribe to ambulance_assignments for this driver
        const channel = supabase
            .channel(`driver_notifications_${driverId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'ambulance_assignments',
                    filter: `status=eq.pending`,
                },
                async (payload) => {
                    // Check if this assignment belongs to this driver
                    // In a real DB, we'd filter at the table level, but Supabase Realtime 
                    // filter might need more setup for complex joins. 
                    // For now, we fetch details to confirm.

                    const { data: assignment, error } = await supabase
                        .from('ambulance_assignments')
                        .select(`
                            *,
                            emergency_requests (*)
                        `)
                        .eq('id', payload.new.id)
                        .single()

                    if (assignment && assignment.ambulance_id === driverId) {
                        setNotifications(prev => [...prev, assignment])
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [session])

    const removeNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id))
    }

    return { notifications, removeNotification }
}
