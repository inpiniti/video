import { NextResponse } from "next/server";

export async function GET() {
  try {
    const fileId = "95486587844405";
    console.log(`[Test] Testing TeraBox link for file ID: ${fileId}`);

    // Get credentials
    const ndus = process.env.TERABOX_NDUS;

    if (!ndus) {
      return NextResponse.json(
        { error: "TERABOX_NDUS not configured" },
        { status: 500 }
      );
    }

    console.log("[Test] NDUS found, calling getDownloadLink...");

    // Import and call the helper
    const { default: getDownloadLink } = await import(
      "terabox-upload-tool/lib/helpers/download/download"
    );

    const result = await getDownloadLink(ndus, fileId);

    console.log(
      "[Test] getDownloadLink result:",
      JSON.stringify(result, null, 2)
    );

    if (!result.success || !result.downloadLink) {
      return NextResponse.json(
        {
          error: "Failed to get download link",
          result,
        },
        { status: 500 }
      );
    }

    // Test fetching through proxy
    const downloadLink = result.downloadLink;
    console.log("[Test] Testing direct fetch with cookie...");

    const response = await fetch(downloadLink, {
      method: "HEAD", // Just check headers
      headers: {
        Cookie: `ndus=${ndus}`,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: "https://www.terabox.com/",
      },
    });

    console.log("[Test] Direct fetch status:", response.status);
    console.log("[Test] Content-Type:", response.headers.get("Content-Type"));
    console.log(
      "[Test] Content-Length:",
      response.headers.get("Content-Length")
    );

    return NextResponse.json({
      success: true,
      fileId,
      downloadLink,
      getDownloadLinkResult: result,
      directFetchTest: {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get("Content-Type"),
        contentLength: response.headers.get("Content-Length"),
        acceptRanges: response.headers.get("Accept-Ranges"),
      },
      proxyUrl: `/api/terabox-stream?fileId=${fileId}`,
    });
  } catch (error) {
    console.error("[Test] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
