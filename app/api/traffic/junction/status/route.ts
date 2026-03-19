import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co"
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key"
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export const dynamic = 'force-dynamic'

export async function GET() {
    const session = await auth()
    if (!session?.user || session.user.role !== "traffic_police") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const junctionId = session.user.id

        // 1. Get junction details
        const { data: junction, error: junctionErr } = await supabase
            .from('traffic_junctions')
            .select('*')
            .eq('id', junctionId)
            .single()

        // 2. Get active alerts for this junction
        const { data: alerts, error: alertsErr } = await supabase
            .from('junction_alerts')
            .select('*')
            .eq('junction_id', junctionId)
            .in('status', ['active', 'acknowledged'])
            .order('created_at', { ascending: false })
            .limit(10)

        // 3. Get upcoming ambulances (active assignments that pass through this junction)
        const { data: ambulances, error: ambErr } = await supabase
            .from('ambulance_assignments')
            .select(`
                *,
                emergency_requests (*),
                ambulance_drivers (*)
            `)
            .in('status', ['accepted', 'picked_up'])
            .order('created_at', { ascending: false })
            .limit(5)

        return NextResponse.json({
            junction: junction || { id: junctionId, name: "Junction", current_congestion: "light" },
            alerts: alerts || [],
            ambulances: ambulances || []
        })

    } catch (error) {
        console.error("Junction Status Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
