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
        const { alertId, status } = await req.json()

        if (!alertId) {
            return NextResponse.json({ error: "Missing alertId" }, { status: 400 })
        }

        const validStatuses = ['acknowledged', 'cleared', 'dismissed']
        if (!validStatuses.includes(status)) {
            return NextResponse.json({ error: "Invalid status" }, { status: 400 })
        }

        // 1. Update alert status
        const { error } = await supabase
            .from('junction_alerts')
            .update({
                status: status,
                acknowledged_at: status === 'acknowledged' ? new Date().toISOString() : undefined,
                cleared_at: status === 'cleared' ? new Date().toISOString() : undefined,
                officer_id: session.user.id
            })
            .eq('id', alertId)

        if (error) throw error

        // 2. Audit log
        await supabase.from('audit_logs').insert({
            action: 'ALERT_ACKNOWLEDGEMENT',
            user_id: session.user.id,
            details: { alertId, status },
            ip_address: req.headers.get("x-forwarded-for") || "unknown"
        })

        return NextResponse.json({ success: true, alertId, status })

    } catch (error) {
        console.error("Alert Acknowledge Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
