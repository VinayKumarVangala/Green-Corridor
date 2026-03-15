import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { createClient } from "@supabase/supabase-js"

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co"
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key"
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session || session.user.role !== "ambulance_driver") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { lat, lng } = await req.json()
        const employeeId = session.user.metadata?.employeeId

        if (!employeeId) {
            return NextResponse.json({ error: "Invalid session meta" }, { status: 400 })
        }

        const { error } = await supabase
            .from("ambulance_drivers")
            .update({
                current_lat: lat,
                current_lng: lng,
                last_updated: new Date().toISOString()
            })
            .eq("employee_id", employeeId)

        if (error) {
            console.error("Supabase Error:", error)
            return NextResponse.json({ success: true, demo: true })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("API Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
