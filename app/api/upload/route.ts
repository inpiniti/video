import { NextRequest, NextResponse } from "next/server";
import { enqueueJob } from "@/lib/jobQueue";

// POST /api/upload - Enqueue video upload job
// Body: { id: number, url: string, supabaseUrl: string, supabaseKey: string }
// Returns: { success: true } immediately, job runs in background
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, url, supabaseUrl, supabaseKey } = body;
    console.log("[Upload API] 📨 Received upload request:", { id, url });

    if (!id || !url || !supabaseUrl || !supabaseKey) {
      console.error("[Upload API] ❌ Missing required fields:", {
        id,
        url,
        supabaseUrl: !!supabaseUrl,
        supabaseKey: !!supabaseKey,
      });
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Enqueue job - it will run in background
    enqueueJob(id, url, supabaseUrl, supabaseKey);
    console.log("[Upload API] ✅ Job enqueued, processing in background");

    // Return immediately - no polling needed
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[Upload API] ❌ Error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
