import { NextRequest, NextResponse } from "next/server";
import { getTeraBoxStreamingLink } from "@/lib/teraboxUploader";

export async function GET(request: NextRequest) {
  try {
    const fileId = request.nextUrl.searchParams.get("fileId");

    if (!fileId) {
      return NextResponse.json(
        { error: "fileId parameter is required" },
        { status: 400 }
      );
    }

    console.log(`[TeraBox API] Getting streaming link for file ID: ${fileId}`);

    const streamingLink = await getTeraBoxStreamingLink(fileId);

    return NextResponse.json({
      success: true,
      streamingLink,
    });
  } catch (error) {
    console.error("[TeraBox API] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
