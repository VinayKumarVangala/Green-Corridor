import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { checkRateLimit } from "@/lib/rate-limit"

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co"
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key"
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(req: Request) {
    try {
        const ip = req.headers.get("x-forwarded-for") || "127.0.0.1"

        // 1. Check Rate Limit (Requirement 4)
        const { success, remaining } = await checkRateLimit(ip, "/api/emergency/request", 5)

        if (!success) {
            return NextResponse.json({
                error: "Too many requests. Please wait before requesting another emergency ambulance."
            }, {
                status: 429,
                headers: { "X-RateLimit-Remaining": remaining.toString() }
            })
        }

        const body = await req.json()
        const {
            requester_name,
            requester_phone,
            emergency_type,
            lat,
            lng,
            address
        } = body

        // 2. Create emergency request record
        const { data: request, error: requestError } = await supabase
            .from("emergency_requests")
            .insert({
                requester_name,
                requester_phone,
                emergency_type,
                address,
                lat,
                lng,
                status: "pending"
            })
            .select()
            .single()

        if (requestError) {
            console.error("DB Error:", requestError)
            return NextResponse.json({ error: "Failed to create request" }, { status: 500 })
        }

        // 3. Log to audit_logs (Requirement 5)
        await supabase.from("audit_logs").insert({
            action: "EMERGENCY_REQUEST_CREATED",
            entity_id: request.id,
            entity_type: "emergency_request",
            details: {
                ip,
                emergency_type,
                lat,
                lng
            }
        })

        // 4. MOCK: AI Ambulance Assignment Logic
        const { data: nearestAmbulance, error: rpcError } = await supabase.rpc('find_nearest_ambulance', {
            lat: lat,
            lng: lng
        })

        if (nearestAmbulance && nearestAmbulance.length > 0) {
            const ambulance = nearestAmbulance[0]

            await supabase.from("ambulance_assignments").insert({
                emergency_request_id: request.id,
                ambulance_driver_id: ambulance.driver_id,
                status: "assigned"
            })

            // Update request status and log assignment
            await supabase.from("emergency_requests").update({ status: "assigned" }).eq("id", request.id)

            await supabase.from("audit_logs").insert({
                action: "AMBULANCE_ASSIGNED",
                entity_id: request.id,
                entity_type: "emergency_request",
                details: { driver_id: ambulance.driver_id }
            })
        }

        return NextResponse.json({
            id: request.id,
            message: "Emergency request submitted successfully.",
            remaining
        })
    } catch (error) {
        console.error("API Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
