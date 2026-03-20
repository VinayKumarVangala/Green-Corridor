import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { checkRateLimit } from "@/lib/rate-limit"
import { triggerEmergencyProcessing } from "@/lib/ai/engine"
import { initializeIncident } from "@/lib/analytics/incidentRecorder"
import { handleApiError, withRetry } from "@/lib/errors/handleApiError"
import { RateLimitError, ValidationError } from "@/lib/errors/AppError"

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co"
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key"
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(req: Request) {
    try {
        const ip = req.headers.get("x-forwarded-for") || "127.0.0.1"

        // 1. Check Rate Limit (Requirement 4)
        const { success, remaining } = await checkRateLimit(ip, "/api/emergency/request", 5)

        if (!success) throw new RateLimitError({ endpoint: "/api/emergency/request", ip });

        const body = await req.json()
        const {
            requester_name,
            requester_phone,
            emergency_type,
            lat,
            lng,
            address
        } = body

        if (!emergency_type || !lat || !lng || !address)
            throw new ValidationError("emergency_type, lat, lng, and address are required");

        // 2. Create emergency request record (with retry)
        const request = await withRetry(
            async () => {
                const { data, error } = await supabase
                    .from("emergency_requests")
                    .insert({ requester_name, requester_phone, emergency_type, address, lat, lng, status: "pending" })
                    .select().single();
                if (error) throw new Error(error.message);
                return data;
            },
            { maxAttempts: 3, baseDelayMs: 300, label: "emergency_requests insert" },
        );

        // 3. Log to audit_logs (Requirement 5)
        await supabase.from("audit_logs").insert({
            action: "EMERGENCY_REQUEST_CREATED",
            entity_id: request.id,
            entity_type: "emergency_request",
            details: {
                ip,
                emergency_type,
                lat,
                lng
            }
        })

        // 4. Initialize incident analytics record
        await initializeIncident(request.id)

        // 5. Trigger AI dispatch pipeline
        const jobId = triggerEmergencyProcessing(request.id)

        await supabase.from("audit_logs").insert({
            action: "AI_DISPATCH_TRIGGERED",
            entity_id: request.id,
            entity_type: "emergency_request",
            details: { jobId, ip, emergency_type }
        })

        return NextResponse.json({
            id: request.id,
            message: "Emergency request submitted successfully.",
            jobId,
            remaining
        })
    } catch (error) {
        return handleApiError(error, "/api/emergency/request")
    }
}
