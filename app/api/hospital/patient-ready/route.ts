import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co"
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key"
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
    const session = await auth()
    if (!session?.user || session.user.role !== "hospital_staff") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const { assignmentId, status } = await req.json()
        
        if (!assignmentId || !status) {
            return NextResponse.json({ error: "Missing parameters" }, { status: 400 })
        }

        // 1. Update prep_status in ambulance_assignments
        // This notifies the ambulance driver via Realtime
        const { error } = await supabase
            .from('ambulance_assignments')
            .update({ 
                prep_status: status, // 'preparing', 'ready'
                prep_updated_at: new Date().toISOString()
            })
            .eq('id', assignmentId)

        if (error) throw error

        // 2. Log action
        await supabase.from('audit_logs').insert({
            action: 'HOSPITAL_PREP_UPDATE',
            user_id: session.user.id,
            details: { assignmentId, status }
        })

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error("Patient Ready Sync Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
