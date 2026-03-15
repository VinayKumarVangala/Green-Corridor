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

        // 1. Update assignment status to arrived
        const { error: updateError } = await supabase
            .from('ambulance_assignments')
            .update({
                status: 'arrived',
                arrived_at: new Date().toISOString()
            })
            .eq('id', assignmentId)
            .eq('ambulance_id', session.user.id)

        if (updateError) throw updateError

        // 2. Set driver status back to available
        await supabase
            .from('ambulance_drivers')
            .update({ status: 'available' })
            .eq('id', session.user.id)

        // 3. Log to audit_logs
        await supabase.from('audit_logs').insert({
            action: 'HOSPITAL_ARRIVAL_CONFIRMED',
            user_id: session.user.id,
            details: { assignmentId },
            ip_address: req.headers.get("x-forwarded-for") || "unknown"
        })

        // 4. Placeholder for Post-Incident Analysis trigger
        console.log(`Finalizing assignment ${assignmentId} for request. Triggering AI analysis...`)

        return NextResponse.json({ success: true, status: 'arrived' })

    } catch (error) {
        console.error("Arrival Confirmation Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
