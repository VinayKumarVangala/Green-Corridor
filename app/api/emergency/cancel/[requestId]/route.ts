import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isDemoMode } from "@/lib/demo-mode"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co"
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key"
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(
    req: Request,
    { params }: { params: { requestId: string } }
) {
    const { requestId } = params

    if (requestId.startsWith("demo-") || isDemoMode()) {
        return NextResponse.json({
            message: "Emergency request cancelled successfully (Demo Mode)."
        })
    }

    try {
        const { error } = await supabase
            .from("emergency_requests")
            .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
            .eq("id", requestId)

        if (error) throw error

        return NextResponse.json({
            message: "Emergency request cancelled successfully."
        })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
