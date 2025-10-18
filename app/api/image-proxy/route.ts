import { NextRequest, NextResponse } from "next/server";

// Simple image proxy to avoid CORS issues for thumbnails
// Usage: /api/image-proxy?url={remote_image_url}

const ALLOWED_HOSTS = ["data.terabox.com", "aom.example.com"]; // 필요한 호스트를 여기에 추가하세요

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json(
      { error: "Missing url parameter" },
      { status: 400 }
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (e) {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  // 간단한 호스트 화이트리스트 검사
  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
  }

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        // 기본 User-Agent 제공 (필요시 조정)
        "User-Agent": "Mozilla/5.0 (compatible; ImageProxy/1.0)",
        Accept: "image/*,*/*;q=0.8",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream responded ${res.status}` },
        { status: 502 }
      );
    }

    const contentType =
      res.headers.get("content-type") || "application/octet-stream";
    const buffer = await res.arrayBuffer();
    const headers = new Headers();
    headers.set("Content-Type", contentType);
    // 엣지/브라우저 캐시: 1시간
    headers.set("Cache-Control", "public, s-maxage=3600, max-age=3600");
    // CORS 허용
    headers.set("Access-Control-Allow-Origin", "*");

    return new NextResponse(Buffer.from(buffer), { status: 200, headers });
  } catch (err) {
    console.error("[image-proxy] fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch image" },
      { status: 500 }
    );
  }
}
