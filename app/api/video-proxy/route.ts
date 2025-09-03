import { NextRequest, NextResponse } from 'next/server';

// Simple server-side proxy to fetch remote video data so client-side FFmpeg can process
// cross-origin sources without CORS issues. NOTE: This downloads the full file into memory.
// For very large videos consider adding range support / size limits.
export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get('u');
  if (!u) return new NextResponse('Missing parameter u', { status: 400 });
  let target: URL;
  try {
    target = new URL(u);
  } catch {
    return new NextResponse('Invalid URL', { status: 400 });
  }
  if (!/^https?:$/.test(target.protocol)) {
    return new NextResponse('Unsupported protocol', { status: 400 });
  }
  // Optional host allow-list via env (comma separated)
  const allowList = process.env.ALLOWED_VIDEO_HOSTS?.split(',').map(h => h.trim()).filter(Boolean);
  if (allowList && allowList.length > 0 && !allowList.includes(target.hostname)) {
    return new NextResponse('Host not allowed', { status: 403 });
  }
  try {
    const upstream = await fetch(target.toString(), { cache: 'no-store' });
    if (!upstream.ok) {
      return new NextResponse(`Upstream error ${upstream.status}`, { status: 502 });
    }
    const buf = await upstream.arrayBuffer();
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return new NextResponse('Proxy fetch failed', { status: 500 });
  }
}
