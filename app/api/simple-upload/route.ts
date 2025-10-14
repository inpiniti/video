import { NextRequest, NextResponse } from "next/server";
import { enqueueSimpleJob, getQueueStatus } from "@/lib/simpleJobQueue";
import { writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

// POST /api/simple-upload - Enqueue video upload job (no Supabase)
// Body: { url: string } OR FormData with video file
// Returns: { success: true, message: "업로드 중입니다..." } immediately
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // Handle file upload
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File;

      if (!file) {
        return NextResponse.json(
          { error: "파일이 필요합니다." },
          { status: 400 }
        );
      }

      // Save file to temp directory
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const tempFilePath = join(tmpdir(), `upload_${Date.now()}_${file.name}`);
      await writeFile(tempFilePath, buffer);

      console.log("[Simple Upload API] 📁 File uploaded:", {
        name: file.name,
        size: file.size,
        path: tempFilePath,
      });

      // Enqueue job with file path (skips download stage)
      const jobId = enqueueSimpleJob(file.name, tempFilePath);
      console.log("[Simple Upload API] ✅ File job enqueued:", jobId);

      return NextResponse.json({
        success: true,
        message: "업로드 중입니다...",
        jobId,
      });
    }

    // Handle URL upload
    const body = await req.json();
    const { url } = body;
    console.log("[Simple Upload API] 📨 Received upload request:", { url });

    if (!url) {
      console.error("[Simple Upload API] ❌ Missing URL");
      return NextResponse.json({ error: "URL이 필요합니다." }, { status: 400 });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "올바른 URL 형식이 아닙니다." },
        { status: 400 }
      );
    }

    // Enqueue job - it will run in background
    const jobId = enqueueSimpleJob(url);
    console.log("[Simple Upload API] ✅ Job enqueued:", jobId);

    // Return immediately
    return NextResponse.json({
      success: true,
      message: "업로드 중입니다...",
      jobId,
    });
  } catch (e) {
    console.error("[Simple Upload API] ❌ Error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// GET /api/simple-upload - Get queue status
export async function GET() {
  try {
    const status = getQueueStatus();
    return NextResponse.json(status);
  } catch (e) {
    console.error("[Simple Upload API] ❌ Error getting status:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
