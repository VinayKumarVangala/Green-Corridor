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
        const { action } = await req.json()
        
        const junctionId = session.user.id

        // Log manual signal preemption event
        const { error } = await supabase.from('audit_logs').insert({
            action: 'MANUAL_SIGNAL_OVERRIDE',
            user_id: session.user.id,
            details: { action, junctionId, timestamp: new Date().toISOString() },
            ip_address: req.headers.get("x-forwarded-for") || "unknown"
        })

        if (error) throw error

        // Potentially notify nearby ambulances via a custom notification
        // For now, we assume the audit log triggers a Realtime update or it's for compliance
        
        return NextResponse.json({ success: true, timestamp: new Date().toISOString() })

    } catch (error) {
        console.error("Signal Preemption Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
