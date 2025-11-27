import { NextResponse } from "next/server";
import fs from "fs-extra";
import path from "path";
import mime from "mime";

const SAVE_DIR_IMAGES = "C:\\Users\\youngkyun\\Pictures";
const SAVE_DIR_VIDEOS = "C:\\Users\\youngkyun\\Videos";

export async function GET(request: Request) {
  const reqUrl = new URL(request.url);
  const { searchParams, pathname } = reqUrl;

  // Support both query form: /api/media?file=xxx&type=image
  // and path form: /api/media/images/{file} or /api/media/videos/{file}
  let filename = searchParams.get("file");
  let type = searchParams.get("type"); // 'image' or 'video'

  if (!filename || !type) {
    // try to parse from path segments
    // pathname might be like: /api/media/images/{file}
    const prefix = "/api/media/";
    if (pathname.startsWith(prefix)) {
      const rest = pathname.slice(prefix.length); // images/{file} or videos/{file}
      const parts = rest.split("/").filter(Boolean);
      if (parts.length >= 2) {
        const kind = parts[0];
        const restName = parts.slice(1).join("/");
        if (kind === "images" || kind === "image") type = "image";
        if (kind === "videos" || kind === "video") type = "video";
        filename = restName;
      }
    }
  }

  if (!filename || !type) {
    return new NextResponse("Missing file or type", { status: 400 });
  }

  // Security check: prevent directory traversal
  const safeFilename = path.basename(filename);
  const baseDir = type === "video" ? SAVE_DIR_VIDEOS : SAVE_DIR_IMAGES;
  const filePath = path.join(baseDir, safeFilename);

  try {
    if (!(await fs.pathExists(filePath))) {
      return new NextResponse("File not found", { status: 404 });
    }

    const stat = await fs.stat(filePath);
    const fileStream = fs.createReadStream(filePath);

    // Determine mime type
    const contentType = mime.getType(filePath) || "application/octet-stream";

    // @ts-expect-error - Readable stream / fs.ReadStream is compatible with NextResponse body
    return new NextResponse(fileStream, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": stat.size.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error serving file:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
