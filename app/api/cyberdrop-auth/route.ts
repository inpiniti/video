import { NextRequest, NextResponse } from "next/server";

// Preflight auth against Cyberdrop API to refresh file access before playback
// GET /api/cyberdrop-auth?key={id}
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key) return new NextResponse("Missing key", { status: 400 });
  const url = `https://api.cyberdrop.me/api/file/auth/${encodeURIComponent(
    key
  )}`;
  console.log(`Preflight auth request to: ${url}`);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json, text/plain, */*",
        Referer: "https://cyberdrop.me/",
      },
      cache: "no-store",
    });
    console.log(`Cyberdrop auth response: `, res);
    const text = await res.text();
    console.log(`Cyberdrop auth response text: `, text);
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") || "application/json",
      },
    });
  } catch {
    return new NextResponse("auth request failed", { status: 502 });
  }
}
