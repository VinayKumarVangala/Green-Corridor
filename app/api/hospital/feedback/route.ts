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
        const { assignmentId, feedback, rating, issues } = await req.json()
        
        if (!assignmentId) {
            return NextResponse.json({ error: "Missing assignmentId" }, { status: 400 })
        }

        // 1. Submit feedback to mission_feedback table
        // This helps the AI learn which hospitals/drivers are more efficient
        const { error } = await supabase
            .from('mission_feedback')
            .insert({ 
                assignment_id: assignmentId,
                staff_id: session.user.id,
                hospital_id: session.user.metadata?.hospitalId || session.user.id,
                feedback: feedback,
                rating: rating,
                issues: issues, // array of strings
                created_at: new Date().toISOString()
            })

        if (error) throw error

        // 2. Potentially update assignment with feedback received flag
        await supabase
            .from('ambulance_assignments')
            .update({ feedback_received: true })
            .eq('id', assignmentId)

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error("Post-Mission Feedback Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
