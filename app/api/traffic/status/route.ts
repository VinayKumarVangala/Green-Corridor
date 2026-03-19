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
        const { trafficLevel } = await req.json()
        
        if (!['light', 'moderate', 'heavy'].includes(trafficLevel)) {
            return NextResponse.json({ error: "Invalid level" }, { status: 400 })
        }

        const junctionId = session.user.id

        // Update junction traffic level
        const { error } = await supabase
            .from('traffic_junctions')
            .update({ 
                current_congestion: trafficLevel,
                last_updated: new Date().toISOString()
            })
            .eq('id', junctionId)

        if (error) throw error

        // Log to audit
        await supabase.from('audit_logs').insert({
            action: 'TRAFFIC_LEVEL_UPDATE',
            user_id: session.user.id,
            details: { trafficLevel, junctionId }
        })

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error("Traffic Hub Update Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
