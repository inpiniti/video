import { NextResponse } from "next/server";
import fs from "fs";
import fsPromises from "fs/promises";
import os from "os";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";

// Basic server-side thumbnail generator.
// - GET /api/thumbnail?url=<remoteVideoUrl>
// Response: { url: '/aom_yumi_thumbs/<hash>.jpg' }
// Notes:
// - Requires `ffmpeg` to be installed and on PATH.
// - Downloads the remote video to a temp file (with a size limit) and runs ffmpeg to extract a frame.
// - Caches results under `public/aom_yumi_thumbs/<sha256>.jpg`.

const OUT_DIR = path.join(process.cwd(), "public", "aom_yumi_thumbs");
const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024; // 50 MB
const DOWNLOAD_TIMEOUT_MS = 30_000; // 30s
const FFMPEG_TIMEOUT_MS = 30_000; // 30s

async function fileExists(p: string) {
  try {
    await fsPromises.access(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function downloadToTemp(url: string, dest: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  const res = await fetch(url, { signal: controller.signal });
  clearTimeout(timeout);
  if (!res.ok) throw new Error(`Download failed ${res.status}`);

  const contentLength = res.headers.get("content-length");
  if (contentLength) {
    const len = parseInt(contentLength, 10);
    if (!isNaN(len) && len > MAX_DOWNLOAD_BYTES) throw new Error("Content too large");
  }

  const ab = await res.arrayBuffer();
  if (ab.byteLength > MAX_DOWNLOAD_BYTES) throw new Error("Download exceeds max size");
  await fsPromises.writeFile(dest, Buffer.from(ab));
}

function runFfmpeg(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Extract a frame at 1s and write a single jpeg
    const args = ["-y", "-i", inputPath, "-ss", "00:00:01", "-vframes", "1", "-q:v", "2", outputPath];
    const proc = spawn("ffmpeg", args, { stdio: "ignore" });

    const timeout = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error("ffmpeg timeout"));
    }, FFMPEG_TIMEOUT_MS);

    proc.on("exit", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}`));
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

export async function GET(req: Request) {
  try {
    const urlObj = new URL(req.url);
    const target = urlObj.searchParams.get("url");
    if (!target) return NextResponse.json({ error: "missing url" }, { status: 400 });

    // Only allow http/https
    if (!/^https?:\/\//i.test(target)) return NextResponse.json({ error: "invalid url" }, { status: 400 });

    const hash = crypto.createHash("sha256").update(target).digest("hex");
    await fsPromises.mkdir(OUT_DIR, { recursive: true });
    const outPath = path.join(OUT_DIR, `${hash}.jpg`);

    if (await fileExists(outPath)) {
      return NextResponse.json({ url: `/aom_yumi_thumbs/${hash}.jpg` });
    }

    // Download remote video to temp
    const tmpFile = path.join(os.tmpdir(), `thumb-${hash}`);
    try {
      await downloadToTemp(target, tmpFile);
    } catch (err) {
      try {
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      } catch {}
      return NextResponse.json({ error: `download failed: ${String(err)}` }, { status: 502 });
    }

    try {
      await runFfmpeg(tmpFile, outPath);
    } catch (err) {
      try {
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      } catch {}
      return NextResponse.json({ error: `ffmpeg failed: ${String(err)}` }, { status: 500 });
    }

    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch {}

    return NextResponse.json({ url: `/aom_yumi_thumbs/${hash}.jpg` });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
