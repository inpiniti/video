import { NextRequest, NextResponse } from "next/server";
import { fetchFileList } from "@/lib/teraboxUploader";

export async function GET(request: NextRequest) {
  try {
    const folderName = request.nextUrl.searchParams.get("folderName");

    if (!folderName) {
      return NextResponse.json(
        { error: "folderName parameter is required" },
        { status: 400 }
      );
    }

    console.log(`[TeraBox API] Fetching file list for folder: ${folderName}`);

    const fileList = (await fetchFileList(folderName)) as {
      data?: { list?: unknown[] };
    };

    return NextResponse.json(fileList?.data?.list || []);
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
