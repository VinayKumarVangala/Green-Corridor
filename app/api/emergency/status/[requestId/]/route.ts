import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co"
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key"
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(
    req: Request,
    { params }: { params: { requestId: string } }
) {
    try {
        const { requestId } = params

        // Fetch request status and joined ambulance details
        const { data: request, error } = await supabase
            .from("emergency_requests")
            .select(`
                *,
                ambulance_assignments (
                    status,
                    ambulance_drivers (
                        vehicle_number,
                        current_lat,
                        current_lng,
                        profiles (
                            full_name,
                            phone
                        )
                    )
                )
            `)
            .eq("id", requestId)
            .single()

        if (error || !request) {
            return NextResponse.json({ error: "Request not found" }, { status: 404 })
        }

        // Mock ETA calculation based on distance if assigned
        let eta = null
        if (request.status === 'assigned' && request.ambulance_assignments?.[0]) {
            const assignment = request.ambulance_assignments[0]
            if (assignment.ambulance_drivers) {
                // Mock calculation: 2 mins per deg distance
                const dist = Math.sqrt(
                    Math.pow(request.lat - assignment.ambulance_drivers.current_lat, 2) +
                    Math.pow(request.lng - assignment.ambulance_drivers.current_lng, 2)
                )
                eta = Math.max(2, Math.round(dist * 120)) // min 2 mins
            }
        }

        return NextResponse.json({
            ...request,
            eta_minutes: eta,
            assignment: request.ambulance_assignments?.[0] || null
        })
    } catch (error) {
        console.error("API Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
