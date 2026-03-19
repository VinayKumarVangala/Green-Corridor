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
        const { level, direction, description, estimatedDelay } = await req.json()

        if (!level || !['light', 'moderate', 'heavy', 'gridlock'].includes(level)) {
            return NextResponse.json({ error: "Invalid congestion level" }, { status: 400 })
        }

        const junctionId = session.user.id

        // 1. Update junction congestion level
        const { error: updateErr } = await supabase
            .from('traffic_junctions')
            .update({
                current_congestion: level,
                last_updated: new Date().toISOString()
            })
            .eq('id', junctionId)

        if (updateErr) throw updateErr

        // 2. Insert congestion report for AI pattern learning
        const { error: insertErr } = await supabase
            .from('congestion_reports')
            .insert({
                junction_id: junctionId,
                officer_id: session.user.id,
                level: level,
                direction: direction || "all",
                description: description || "",
                estimated_delay_minutes: estimatedDelay || 0,
                reported_at: new Date().toISOString()
            })

        if (insertErr) throw insertErr

        // 3. Audit log
        await supabase.from('audit_logs').insert({
            action: 'CONGESTION_REPORT',
            user_id: session.user.id,
            details: { junctionId, level, direction, estimatedDelay }
        })

        return NextResponse.json({ success: true, level })

    } catch (error) {
        console.error("Congestion Report Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
