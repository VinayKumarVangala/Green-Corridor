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

    // Fetch initial pending notifications on mount
    const fetchInitialPending = async (driverId: string) => {
        console.log(`[Realtime] Syncing initial pending assignments for driver: ${driverId}`);
        const { data, error } = await supabase
            .from('ambulance_assignments')
            .select(`
                *,
                emergency_requests (*)
            `)
            .eq('ambulance_driver_id', driverId)
            .eq('status', 'pending');

        if (error) {
            console.error("[Realtime] Fetch initial error:", error.message);
            return;
        }

        if (data && data.length > 0) {
            console.log(`[Realtime] Found ${data.length} existing pending assignments.`);
            setNotifications(data);
        }
    }

    useEffect(() => {
        if (!session?.user?.id || session.user.role !== "ambulance_driver") return

        const driverId = session.user.id
        fetchInitialPending(driverId);

        console.log(`[Realtime] Subscribing to driver_notifications_${driverId}`);

        // Subscribe to ALL status changes for assignments belonging to this driver
        // Realtime doesn't support complex joins, so we listen to the table and filter locally
        const channel = supabase
            .channel(`driver_notifications_${driverId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'ambulance_assignments'
                },
                async (payload) => {
                    console.log(`[Realtime] New assignment detected! Processing payload:`, payload.new.id);

                    const { data: assignment, error } = await supabase
                        .from('ambulance_assignments')
                        .select(`
                            *,
                            emergency_requests (*)
                        `)
                        .eq('id', payload.new.id)
                        .single()

                    if (error) {
                        console.error("[Realtime] Payload detail fetch failed:", error.message);
                        return;
                    }

                    if (assignment && assignment.ambulance_driver_id === driverId && assignment.status === "pending") {
                        console.log(`[Realtime] Assignment confirmed for this driver: ${assignment.id}`);
                        setNotifications(prev => {
                            // Deduplicate
                            if (prev.find(n => n.id === assignment.id)) return prev;
                            return [...prev, assignment];
                        })
                    } else {
                        console.log(`[Realtime] Assignment ${assignment?.id} is for driver ${assignment?.ambulance_driver_id}, current user is ${driverId}. Ignoring.`);
                    }
                }
            )
            .subscribe((status) => {
                console.log(`[Realtime] Subscription Status for driver ${driverId}: ${status}`);
            })

        return () => {
            console.log(`[Realtime] Cleaning up subscription for ${driverId}`);
            supabase.removeChannel(channel)
        }
    }, [session])

    const removeNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id))
    }

    return { notifications, removeNotification }
}
