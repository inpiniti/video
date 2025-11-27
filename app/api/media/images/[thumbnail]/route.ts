import { NextResponse } from "next/server";
import fs from "fs-extra";
import path from "path";
import mime from "mime";

const SAVE_DIR_IMAGES = "C:\\Users\\youngkyun\\Pictures";

// This route is mounted at: /api/media/images/[thumbnail]
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ thumbnail: string }> }
) {
  const resolvedParams = await params;
  const raw = resolvedParams?.thumbnail || "";
  const filename = decodeURIComponent(raw);

  if (!filename) {
    return new NextResponse("Missing file", { status: 400 });
  }

  // Security: prevent directory traversal
  const safeFilename = path.basename(filename);
  const filePath = path.join(SAVE_DIR_IMAGES, safeFilename);

  try {
    console.log(
      `[DEBUG] Looking for file. filePath: ${filePath}, filename: ${filename}, safeFilename: ${safeFilename}, SAVE_DIR_IMAGES: ${SAVE_DIR_IMAGES}`
    );
    if (!(await fs.pathExists(filePath))) {
      console.log(`[DEBUG] File not found at: ${filePath}`);
      return new NextResponse("File not found", { status: 404 });
    }

    const stat = await fs.stat(filePath);
    const fileStream = fs.createReadStream(filePath);
    const contentType = mime.getType(filePath) || "application/octet-stream";

    // @ts-expect-error - fs.ReadStream is allowed as NextResponse body
    return new NextResponse(fileStream, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": stat.size.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("Error serving thumbnail:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
