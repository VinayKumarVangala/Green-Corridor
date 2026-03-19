import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co"
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key"
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    const session = await auth()
    if (!session?.user || session.user.role !== "hospital_staff") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const { searchParams } = new URL(req.url)
        const status = searchParams.get("status")
        const limit = parseInt(searchParams.get("limit") || "20")

        const hospitalId = session.user.metadata?.hospitalId || session.user.id

        // Fetch ambulance assignments assigned to this hospital
        let query = supabase
            .from('ambulance_assignments')
            .select(`
                *,
                emergency_requests (*, 
                    citizen_profiles (*)
                ),
                ambulance_drivers (*)
            `)
            .eq('emergency_requests.hospital_id', hospitalId)
            // If we have a dedicated junction or field for target hospital
            // For now, we assume emergency_requests links to hospital
            
        if (status) {
            query = query.eq('status', status)
        } else {
            // Default to active cases
            query = query.in('status', ['accepted', 'picked_up'])
        }

        const { data, error } = await query
            .order('created_at', { ascending: false })
            .limit(limit)

        if (error) throw error

        return NextResponse.json(data)

    } catch (error) {
        console.error("Fetch Notifications Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
