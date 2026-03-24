import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isDemoMode } from "@/lib/demo-mode"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co"
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key"
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(
    req: Request,
    { params }: { params: { requestId: string } }
) {
    const { requestId } = params

    if (requestId.startsWith("demo-") || isDemoMode()) {
        return NextResponse.json({
            id: requestId,
            status: "dispatched", // Mock status for demo
            lat: 19.0760,
            lng: 72.8777,
            eta_minutes: 8,
            assignment: {
                ambulance_driver_id: "demo-driver",
                ambulance_drivers: {
                    current_lat: 19.0860,
                    current_lng: 72.8877,
                    vehicle_number: "DEMO-001"
                }
            }
        })
    }

    try {
        const { data, error } = await supabase
            .from("emergency_requests")
            .select(`
                id,
                status,
                lat,
                lng,
                ambulance_assignments (
                    id,
                    ambulance_driver_id,
                    ambulance_drivers (
                        current_lat,
                        current_lng,
                        vehicle_number
                    )
                )
            `)
            .eq("id", requestId)
            .single()

        if (error) throw error

        const assignment = data.ambulance_assignments?.[0] || null

        return NextResponse.json({
            id: data.id,
            status: data.status,
            lat: data.lat,
            lng: data.lng,
            eta_minutes: 10,
            assignment
        })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
