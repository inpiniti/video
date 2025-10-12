import { NextRequest, NextResponse } from "next/server";
import { enqueueJob, getJob } from "@/lib/jobQueue";

// POST /api/upload - Enqueue video upload job
// Body: { id: number, url: string }
// Returns: { jobId: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, url } = body;
    console.log("[Upload API] 📨 Received upload request:", { id, url });

    if (!id || !url) {
      console.error("[Upload API] ❌ Missing required fields:", { id, url });
      return NextResponse.json({ error: "Missing id or url" }, { status: 400 });
    }

    const jobId = enqueueJob(id, url);
    console.log("[Upload API] ✅ Job created:", jobId);

    return NextResponse.json({ jobId });
  } catch (e) {
    console.error("[Upload API] ❌ Error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// GET /api/upload?jobId=xxx - Check job status
// Returns: Job object
export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  console.log("[Upload API] 🔍 Status check for job:", jobId);

  if (!jobId) {
    console.error("[Upload API] ❌ Missing jobId parameter");
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const job = getJob(jobId);
  if (!job) {
    console.error("[Upload API] ❌ Job not found:", jobId);
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  console.log(
    `[Upload API] 📊 Job status: ${job.status}`,
    job.error ? `(error: ${job.error})` : ""
  );
  return NextResponse.json(job);
}
