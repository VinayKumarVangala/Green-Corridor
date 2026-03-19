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
        const { status } = await req.json()
        
        if (!['available', 'busy', 'critical'].includes(status)) {
            return NextResponse.json({ error: "Invalid status" }, { status: 400 })
        }

        // 1. Update hospital capacity in hospitals table
        // We assume the staff session has the hospital_id in metadata
        const hospitalId = session.user.id // Or from metadata

        const { error } = await supabase
            .from('hospitals')
            .update({ 
                status: status,
                last_updated: new Date().toISOString()
            })
            .eq('id', hospitalId)

        if (error) throw error

        // 2. Log to audit_logs
        await supabase.from('audit_logs').insert({
            action: 'HOSPITAL_STATUS_UPDATE',
            user_id: session.user.id,
            details: { status, hospitalId },
            ip_address: req.headers.get("x-forwarded-for") || "unknown"
        })

        return NextResponse.json({ success: true, status })

    } catch (error) {
        console.error("Hospital Status Update Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
