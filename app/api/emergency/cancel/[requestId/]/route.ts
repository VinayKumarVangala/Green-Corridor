import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co"
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key"
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(
    req: Request,
    { params }: { params: { requestId: string } }
) {
    try {
        const { requestId } = params
        const { reason } = await req.json()

        // 1. Fetch request to check grace period (5 mins)
        const { data: request, error: fetchError } = await supabase
            .from("emergency_requests")
            .select("created_at, status")
            .eq("id", requestId)
            .single()

        if (fetchError || !request) {
            return NextResponse.json({ error: "Request not found" }, { status: 404 })
        }

        if (request.status === 'cancelled' || request.status === 'completed') {
            return NextResponse.json({ error: "Request already finalized" }, { status: 400 })
        }

        const createdAt = new Date(request.created_at)
        const now = new Date()
        const diffMins = (now.getTime() - createdAt.getTime()) / 60000

        if (diffMins > 5) {
            return NextResponse.json({
                error: "Cancellation period (5 mins) expired. Please contact dispatch via phone."
            }, { status: 403 })
        }

        // 2. Perform cancellation
        await Promise.all([
            // Update request status
            supabase.from("emergency_requests").update({
                status: "cancelled",
                metadata: { cancel_reason: reason, cancelled_at: now.toISOString() }
            }).eq("id", requestId),

            // Update assignment status if exists
            supabase.from("ambulance_assignments").update({
                status: "cancelled"
            }).eq("emergency_request_id", requestId),

            // Log to audit_logs
            supabase.from("audit_logs").insert({
                action: "EMERGENCY_REQUEST_CANCELLED",
                entity_id: requestId,
                entity_type: "emergency_request",
                details: { reason, diff_mins: diffMins }
            })
        ])

        return NextResponse.json({ message: "Emergency request successfully cancelled" })
    } catch (error) {
        console.error("API Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
