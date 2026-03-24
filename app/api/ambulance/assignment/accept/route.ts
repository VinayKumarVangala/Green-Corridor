import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isDemoMode } from "@/lib/demo-mode"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co"
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key"
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(req: Request) {
    try {
        const { assignmentId } = await req.json()

        if (!assignmentId) {
            return NextResponse.json({ error: "Assignment ID is required" }, { status: 400 })
        }

        // In Demo Mode, we just return success
        if (isDemoMode()) {
            console.log(`[Demo] Assignment ${assignmentId} ACCEPTED. In a real environment, this would now:`);
            console.log(`  1. Notify the nearest appropriate Hospital.`);
            console.log(`  2. Alert all Traffic Junctions on the calculated route.`);
            console.log(`  3. Start live location tracking for the Citizen.`);
            return NextResponse.json({ 
                message: "Assignment accepted (Demo Mode)",
                integration: "Stakeholder coordination would trigger now."
            })
        }

        const { error } = await supabase
            .from("ambulance_assignments")
            .update({ 
                status: "accepted", 
                accepted_at: new Date().toISOString() 
            })
            .eq("id", assignmentId)

        if (error) throw error

        return NextResponse.json({ message: "Assignment accepted successfully" })
    } catch (error: any) {
        console.error("Accept assignment error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
