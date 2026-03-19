import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    // Inbound payload from a hospital ERP / bed management system
    const { hospitalId, status, availableBeds } = await request.json();

    if (!hospitalId || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const validStatuses = ["available", "busy", "critical"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Update the hospital record directly via Service Role
    const { error } = await supabase.from("hospitals").update({
      status,
      // We could store available beds if the schema supported it, we'll log it instead
    }).eq("id", hospitalId);

    if (error) throw error;

    // Log the automated capacity update for audit trails
    await supabase.from("audit_logs").insert({
      action: "EXTERNAL_CAPACITY_SYNC",
      details: {
        hospitalId,
        newStatus: status,
        availableBeds: availableBeds || "unknown",
        timestamp: new Date().toISOString()
      }
    });

    return NextResponse.json({ success: true, message: "Hospital capacity synced." });
  } catch (error: any) {
    console.error("[API:AI] Webhook Hospital error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
