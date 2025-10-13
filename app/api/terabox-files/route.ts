import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const folder = request.nextUrl.searchParams.get("folder") || "/videos";

    console.log(`[TeraBox Files] Fetching file list for folder: ${folder}`);

    // Get TeraBox credentials
    const ndus = process.env.TERABOX_NDUS;
    const appId = process.env.TERABOX_APP_ID;
    const uploadId = process.env.TERABOX_UPLOAD_ID;
    const jsToken = process.env.TERABOX_JS_TOKEN;
    const browserId = process.env.TERABOX_BROWSER_ID;

    if (!ndus || !appId || !uploadId || !jsToken || !browserId) {
      return NextResponse.json(
        { error: "TeraBox credentials not configured" },
        { status: 500 }
      );
    }

    // Import TeraBox uploader
    const TeraboxUploader = (await import("terabox-upload-tool")).default;
    const uploader = new TeraboxUploader({
      ndus,
      appId,
      uploadId,
      jsToken,
      browserId,
    });

    console.log("[TeraBox Files] Calling fetchFileList...");
    const result = await uploader.fetchFileList(folder);

    console.log("[TeraBox Files] Result:", JSON.stringify(result, null, 2));

    // fetchFileList returns FileInfo[] directly
    if (Array.isArray(result)) {
      return NextResponse.json({
        success: true,
        folder,
        files: result,
        count: result.length,
      });
    } else {
      return NextResponse.json(
        {
          error: "Failed to fetch file list",
          detail: result,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[TeraBox Files] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
