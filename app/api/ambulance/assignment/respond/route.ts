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
        const { assignmentId, action, reason } = await req.json()

        if (!['accepted', 'declined', 'timeout'].includes(action)) {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 })
        }

        // 1. Update assignment status
        const { data: assignment, error: updateError } = await supabase
            .from('ambulance_assignments')
            .update({
                status: action,
                responded_at: new Date().toISOString(),
                decline_reason: reason
            })
            .eq('id', assignmentId)
            .eq('ambulance_id', session.user.id)
            .select()
            .single()

        if (updateError) throw updateError

        // 2. If accepted, set driver to busy. If declined, stay available? 
        // Actually, if they decline, they are still available for other calls.
        if (action === 'accepted') {
            await supabase
                .from('ambulance_drivers')
                .update({ status: 'busy' })
                .eq('id', session.user.id)
        }

        // 3. Log to audit_logs
        await supabase.from('audit_logs').insert({
            action: `ASSIGNMENT_${action.toUpperCase()}`,
            user_id: session.user.id,
            details: { assignmentId, reason, action },
            ip_address: req.headers.get("x-forwarded-for") || "unknown"
        })

        // 4. Trigger AI Reassignment if declined/timeout (Placeholder for Job Queue)
        if (action === 'declined' || action === 'timeout') {
            console.log(`Triggering reassignment for request: ${assignment.request_id}`)
            // In a real system, we'd call the AI Dispatch service here
        }

        return NextResponse.json({ success: true, status: action })

    } catch (error) {
        console.error("Assignment Response Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
