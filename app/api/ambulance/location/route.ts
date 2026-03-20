import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { createClient } from "@supabase/supabase-js"
import { handleApiError, withRetry } from "@/lib/errors/handleApiError"
import { AuthError, ValidationError } from "@/lib/errors/AppError"

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co"
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key"
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session || session.user.role !== "ambulance_driver") {
            throw new AuthError()
        }

        const { lat, lng } = await req.json()
        const employeeId = session.user.metadata?.employeeId

        if (!employeeId) throw new ValidationError("Invalid session metadata")
        if (typeof lat !== "number" || typeof lng !== "number") throw new ValidationError("lat and lng must be numbers")

        await withRetry(
            async () => {
                const { error } = await supabase
                    .from("ambulance_drivers")
                    .update({ current_lat: lat, current_lng: lng, last_updated: new Date().toISOString() })
                    .eq("employee_id", employeeId);
                if (error) throw new Error(error.message);
            },
            { maxAttempts: 3, baseDelayMs: 200, label: "location update" },
        );

        return NextResponse.json({ success: true })
    } catch (error) {
        return handleApiError(error, "/api/ambulance/location")
    }
}
