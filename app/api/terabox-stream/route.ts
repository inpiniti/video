import { NextRequest, NextResponse } from "next/server";
import { getTeraBoxStreamingLink } from "@/lib/teraboxUploader";

export const config = {
  runtime: "edge", // Vercel Edge에서 실행
};

// Proxy TeraBox download link for video streaming with Range support
// Edge 캐시 전략:
// - s-maxage: 3300 (55분) => 1시간 미만으로 설정하여 TeraBox 링크 만료 위험을 줄임
// - stale-while-revalidate: 60 => 엣지에서 빠르게 응답하되 백그라운드 갱신 허용
// - Vary: Range => 범위별(부분 응답) 캐싱을 허용하도록 알려줌

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const fileId = req.nextUrl.searchParams.get("fileId");
  const quality =
    (req.nextUrl.searchParams.get("quality") as
      | "M3U8_AUTO_480"
      | "M3U8_AUTO_720"
      | "M3U8_AUTO_1080"
      | "ORIGIN") || "M3U8_AUTO_720"; // Default to 720p for better quality

  if (!url && !fileId) {
    return NextResponse.json(
      { error: "Missing url or fileId parameter" },
      { status: 400 }
    );
  }

  try {
    // If fileId provided, get fresh streaming link
    let streamingUrl = url;
    if (fileId) {
      console.log(
        "[TeraBox Stream] 🔑 Getting fresh link for fileId:",
        fileId,
        "quality:",
        quality
      );
      streamingUrl = await getTeraBoxStreamingLink(fileId, quality);
      console.log("[TeraBox Stream] ✅ Fresh link obtained");
    }

    if (!streamingUrl) {
      throw new Error("No streaming URL available");
    }

    console.log(
      "[TeraBox Stream] 📹 Streaming request for:",
      streamingUrl.substring(0, 100) + "..."
    );

    // Get Range header from client request
    const rangeHeader = req.headers.get("range");
    if (rangeHeader) {
      console.log("[TeraBox Stream] 📊 Range request:", rangeHeader);
    }

    // Prepare headers for TeraBox request
    const teraboxHeaders: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: "https://www.terabox.com/",
      Accept:
        "video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "identity",
      Connection: "keep-alive",
    };

    // Add NDUS cookie for authentication
    const ndus = process.env.TERABOX_NDUS;
    if (ndus) {
      teraboxHeaders["Cookie"] = `ndus=${ndus}`;
      console.log("[TeraBox Stream] 🔐 Added authentication cookie");
    }

    // Forward Range header if present (for video seeking)
    if (rangeHeader) {
      teraboxHeaders["Range"] = rangeHeader;
    }

    console.log("[TeraBox Stream] 🌐 Fetching from TeraBox...");

    // Fetch from TeraBox
    const response = await fetch(streamingUrl, {
      headers: teraboxHeaders,
      redirect: "follow",
    });

    console.log(
      "[TeraBox Stream] 📡 TeraBox response status:",
      response.status
    );

    if (!response.ok) {
      console.error(
        "[TeraBox Stream] ❌ TeraBox error:",
        response.status,
        response.statusText
      );
      throw new Error(
        `TeraBox responded with ${response.status}: ${response.statusText}`
      );
    }

    // Get content type and length
    const contentType = response.headers.get("Content-Type") || "video/mp4";
    const contentLength = response.headers.get("Content-Length");
    const acceptRanges = response.headers.get("Accept-Ranges") || "bytes";

    // Edge cache policy: 55분으로 설정 (TeraBox 링크 만료 고려)
    const sMaxAge = 3300; // seconds ~55min
    const staleWhileRevalidate = 60; // seconds

    // 기본 응답 헤더
    const responseHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Accept-Ranges": acceptRanges,
      // Vercel Edge 캐싱 제어: 엣지에서 55분간 캐시, 짧은 기간 stale 허용
      "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
      Vary: "Range",
    };

    // Handle range requests (for seeking)
    if (response.status === 206) {
      // Partial content
      const contentRange = response.headers.get("Content-Range");
      if (contentRange) {
        responseHeaders["Content-Range"] = contentRange;
      }
      if (contentLength) {
        responseHeaders["Content-Length"] = contentLength;
      }

      return new NextResponse(response.body, {
        status: 206,
        headers: responseHeaders,
      });
    }

    // Full content
    if (contentLength) {
      responseHeaders["Content-Length"] = contentLength;
    }

    return new NextResponse(response.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("[TeraBox Stream] Error:", error);
    return NextResponse.json(
      { error: `"Failed to stream video : ${error}"` },
      { status: 500 }
    );
  }
}
