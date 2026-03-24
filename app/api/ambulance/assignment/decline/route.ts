import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isDemoMode } from "@/lib/demo-mode"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co"
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key"
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(req: Request) {
    try {
        const { assignmentId, reason } = await req.json()

        if (!assignmentId) {
            return NextResponse.json({ error: "Assignment ID is required" }, { status: 400 })
        }

        // In Demo Mode, we just return success
        if (isDemoMode()) {
            return NextResponse.json({ message: "Assignment declined (Demo Mode)" })
        }

        const { error } = await supabase
            .from("ambulance_assignments")
            .update({ 
                status: "declined", 
                declined_at: new Date().toISOString() 
            })
            .eq("id", assignmentId)

        if (error) throw error

        return NextResponse.json({ message: "Assignment declined" })
    } catch (error: any) {
        console.error("Decline assignment error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
