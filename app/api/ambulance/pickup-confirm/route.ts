import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co"
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key"
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(req: Request) {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== "ambulance_driver") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const { assignmentId } = await req.json()

        // 1. Update assignment status to picked_up
        const { error: updateError } = await supabase
            .from('ambulance_assignments')
            .update({
                status: 'picked_up',
                picked_up_at: new Date().toISOString()
            })
            .eq('id', assignmentId)
            .eq('ambulance_id', session.user.id)

        if (updateError) throw updateError

        // 2. Fetch assignment details to notify hospital
        const { data: assignment } = await supabase
            .from('ambulance_assignments')
            .select('*, emergency_requests(*)')
            .eq('id', assignmentId)
            .single()

        // 3. Log to audit_logs
        await supabase.from('audit_logs').insert({
            action: 'PATIENT_PICKED_UP',
            user_id: session.user.id,
            details: { assignmentId },
            ip_address: req.headers.get("x-forwarded-for") || "unknown"
        })

        // 4. Placeholder for Hospital Notification
        console.log(`Notifying hospital ${assignment.hospital_id} about incoming patient from request ${assignment.request_id}`)

        return NextResponse.json({ success: true, status: 'picked_up' })

    } catch (error) {
        console.error("Pickup Confirmation Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
