import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Uses service role to bypass RLS for webhooks
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    // Expected format from external traffic APIs like Google/here maps (mocked)
    const { junctionId, congestionLevel } = await request.json();

    if (!junctionId || !congestionLevel) {
      return NextResponse.json({ error: "Missing junctionId or congestionLevel" }, { status: 400 });
    }

    // Insert as an automated report
    const { error } = await supabase.from("congestion_reports").insert({
      junction_id: junctionId,
      level: congestionLevel,
      reporter_id: "00000000-0000-0000-0000-000000000000", // System UUID
      reported_at: new Date().toISOString()
    });

    if (error) throw error;

    // Update junction status implicitly
    await supabase.from("traffic_junctions").update({
      current_congestion: congestionLevel
    }).eq("id", junctionId);

    return NextResponse.json({ success: true, message: "Traffic data ingested." });
  } catch (error: any) {
    console.error("[API:AI] Webhook Traffic error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
