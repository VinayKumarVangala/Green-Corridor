import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co"
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key"
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
    const session = await auth()
    if (!session?.user || session.user.role !== "traffic_police") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const { alertId, action, durationSeconds, issuesFaced, notes } = await req.json()

        if (!alertId || !action) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        // 1. Insert clearance report
        const { error } = await supabase
            .from('clearance_reports')
            .insert({
                alert_id: alertId,
                junction_id: session.user.id,
                officer_id: session.user.id,
                action_taken: action,
                duration_seconds: durationSeconds || 0,
                issues_faced: issuesFaced || [],
                notes: notes || "",
                created_at: new Date().toISOString()
            })

        if (error) throw error

        // 2. Update the junction_alert to 'cleared'
        await supabase
            .from('junction_alerts')
            .update({ status: 'cleared', cleared_at: new Date().toISOString() })
            .eq('id', alertId)

        // 3. Audit log for analytics
        await supabase.from('audit_logs').insert({
            action: 'CLEARANCE_REPORT_FILED',
            user_id: session.user.id,
            details: { alertId, action, durationSeconds, issuesFaced }
        })

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error("Clearance Report Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
