import { NextRequest, NextResponse } from 'next/server';
import { enqueueSimpleJob, getQueueStatus } from '@/lib/simpleJobQueue';

// POST /api/simple-upload - Enqueue video upload job (no Supabase)
// Body: { url: string }
// Returns: { success: true, message: "업로드 중입니다..." } immediately
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body;
    console.log('[Simple Upload API] 📨 Received upload request:', { url });

    if (!url) {
      console.error('[Simple Upload API] ❌ Missing URL');
      return NextResponse.json({ error: 'URL이 필요합니다.' }, { status: 400 });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: '올바른 URL 형식이 아닙니다.' },
        { status: 400 }
      );
    }

    // Enqueue job - it will run in background
    const jobId = enqueueSimpleJob(url);
    console.log('[Simple Upload API] ✅ Job enqueued:', jobId);

    // Return immediately
    return NextResponse.json({
      success: true,
      message: '업로드 중입니다...',
      jobId,
    });
  } catch (e) {
    console.error('[Simple Upload API] ❌ Error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// GET /api/simple-upload - Get queue status
export async function GET() {
  try {
    const status = getQueueStatus();
    return NextResponse.json(status);
  } catch (e) {
    console.error('[Simple Upload API] ❌ Error getting status:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
