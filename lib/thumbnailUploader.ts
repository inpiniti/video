"use client";

// Client-side thumbnail extraction via @ffmpeg/ffmpeg and upload to Dropbox.
// Assumptions:
// - DROPBOX_ACCESS_TOKEN is obtained previously and stored (localStorage) after OAuth.
// - Supabase table `videos` has a nullable `thumbnail` (text) column.
// - Only MP4 or general video URLs are processed; images skipped.

import { supabase, hasSupabase } from "@/lib/supabaseClient";
// Dynamic import of @ffmpeg/ffmpeg to avoid SSR build issues where a stub empty module is used.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ffmpegInstance: any = null; // lazy

export interface ThumbnailResult {
  publicUrl: string;
  width: number;
  height: number;
}

export async function ensureFfmpeg() {
  if (ffmpegInstance) return ffmpegInstance;
  if (typeof window === "undefined") {
    throw new Error("FFmpeg can only be loaded in the browser");
  }
  const specifiers = [
    "@ffmpeg/ffmpeg",
    "@ffmpeg/ffmpeg/dist/esm/index.js",
    "@ffmpeg/ffmpeg/dist/esm/ffmpeg.mjs",
    "@ffmpeg/ffmpeg/dist/ffmpeg.min.js",
  ];
  let createFFmpegFn: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
  let FFmpegClass: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
  let lastErr: unknown = null;
  for (const spec of specifiers) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod: any = await import(/* @vite-ignore */ spec);
      // v0.11 style factory OR v0.12+ class export
      createFFmpegFn = mod.createFFmpeg || mod.default?.createFFmpeg;
      FFmpegClass = mod.FFmpeg || mod.default?.FFmpeg;
      if (createFFmpegFn || FFmpegClass) break;
    } catch (e) {
      lastErr = e;
    }
  }
  if (!createFFmpegFn && !FFmpegClass) {
    throw new Error(
      "Neither createFFmpeg nor FFmpeg class export found. Last error: " +
        (lastErr ? String(lastErr) : "unknown")
    );
  }
  if (createFFmpegFn) {
    ffmpegInstance = createFFmpegFn({ log: false });
    if (!ffmpegInstance.isLoaded()) {
      await ffmpegInstance.load();
    }
    return ffmpegInstance;
  }
  // Fallback: construct class and adapt to legacy interface we use elsewhere.
  const inst = new FFmpegClass();
  if (!inst.loaded) {
    await inst.load();
  }
  // Adapter implementing subset: isLoaded(), load(), FS(), run()
  ffmpegInstance = {
    isLoaded: () => inst.loaded,
    load: async () => {
      if (!inst.loaded) await inst.load();
    },
    // Simplified FS adapter
    FS: (op: string, path: string, data?: Uint8Array) => {
      if (op === "writeFile") {
        return inst.writeFile(path, data);
      }
      if (op === "readFile") {
        return inst.readFile(path);
      }
      throw new Error("Unsupported FS op: " + op);
    },
    run: async (...args: string[]) => inst.exec(args),
  };
  return ffmpegInstance;
}

export async function extractThumbnail(url: string): Promise<Blob> {
  const ffmpeg = await ensureFfmpeg();
  const inputName = "input.mp4"; // generic
  const outputName = "thumb.jpg";
  const arrayBuffer = await (await fetch(url)).arrayBuffer();
  await ffmpeg.FS("writeFile", inputName, new Uint8Array(arrayBuffer));
  // Grab frame at 1 second (fallback to first frame if shorter)
  await ffmpeg.run(
    "-i",
    inputName,
    "-ss",
    "1",
    "-vframes",
    "1",
    "-vf",
    "scale=360:-1",
    outputName
  );
  const data = await ffmpeg.FS("readFile", outputName);
  return new Blob([data.buffer], { type: "image/jpeg" });
}

// Fallback: capture a frame using a <video> + <canvas> (works if CORS allows drawing)
async function captureViaVideoElement(url: string): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    // Attempt a small seek after metadata to ensure we have a non-black frame
    const cleanup = () => {
      video.src = "";
      video.remove();
    };
    let timeoutId: number | null = null;
    const fail = (err: unknown) => {
      if (timeoutId) window.clearTimeout(timeoutId);
      cleanup();
      reject(err);
    };
    video.addEventListener("error", () =>
      fail(new Error("video element error loading resource"))
    );
    video.addEventListener(
      "loadeddata",
      () => {
        try {
          // Try to seek to 1s
          const target = Math.min(
            1,
            video.duration && isFinite(video.duration)
              ? video.duration - 0.05
              : 1
          );
          const proceed = () => {
            try {
              const w = video.videoWidth || 360;
              const h = video.videoHeight || 640;
              const canvas = document.createElement("canvas");
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext("2d");
              if (!ctx) return fail(new Error("canvas 2d context unavailable"));
              ctx.drawImage(video, 0, 0, w, h);
              canvas.toBlob(
                (b) => {
                  if (!b) return fail(new Error("canvas toBlob returned null"));
                  cleanup();
                  resolve(b);
                },
                "image/jpeg",
                0.82
              );
            } catch (e) {
              fail(e);
            }
          };
          const onSeeked = () => {
            video.removeEventListener("seeked", onSeeked);
            proceed();
          };
          video.addEventListener("seeked", onSeeked);
          try {
            video.currentTime = target;
          } catch {
            // Some streams disallow seeking; just proceed
            video.removeEventListener("seeked", onSeeked);
            proceed();
          }
        } catch (e) {
          fail(e);
        }
      },
      { once: true }
    );
    timeoutId = window.setTimeout(
      () => fail(new Error("video load timeout")),
      10000
    );
    video.src = url;
    video.load();
  });
}

// Dropbox upload. Minimal implementation using content-upload endpoint.
// Stores access token in localStorage key "DROPBOX_ACCESS_TOKEN".

async function getDropboxToken(): Promise<string | null> {
  return localStorage.getItem("DROPBOX_ACCESS_TOKEN");
}

export async function uploadToDropbox(
  blob: Blob,
  baseName: string
): Promise<string> {
  const token = await getDropboxToken();
  if (!token) throw new Error("Dropbox token missing. Perform OAuth first.");

  // Sanitize baseName: remove path separators and special characters
  const sanitized = baseName
    .replace(/[\/\\:*?"<>|]/g, "_") // Remove invalid filename characters
    .replace(/^\.+/, "") // Remove leading dots
    .substring(0, 100); // Limit length

  const path = `/thumbnails/${Date.now()}_${sanitized}.jpg`;
  const uploadRes = await fetch(
    "https://content.dropboxapi.com/2/files/upload",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Dropbox-API-Arg": JSON.stringify({
          path,
          mode: "add",
          autorename: true,
          mute: false,
        }),
        "Content-Type": "application/octet-stream",
      },
      body: blob,
    }
  );
  if (!uploadRes.ok) {
    let detail = "";
    try {
      detail = await uploadRes.text();
    } catch {
      /* ignore */
    }
    if (uploadRes.status === 401 && /expired_access_token/.test(detail)) {
      try {
        localStorage.removeItem("DROPBOX_ACCESS_TOKEN");
      } catch {
        /* ignore */
      }
      throw new Error(
        "Dropbox token expired. 다시 'Dropbox 연결' 버튼으로 재인증하세요. Raw: " +
          detail
      );
    }
    throw new Error(
      "Dropbox upload failed: " +
        uploadRes.status +
        (detail ? " " + detail : "")
    );
  }
  // Create shared link
  const linkRes = await fetch(
    "https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path,
        settings: { requested_visibility: "public" },
      }),
    }
  );
  if (!linkRes.ok) {
    let detail = "";
    try {
      detail = await linkRes.text();
    } catch {
      /* ignore */
    }
    throw new Error(
      "Dropbox link create failed: " +
        linkRes.status +
        (detail ? " " + detail : "")
    );
  }
  const linkJson = await linkRes.json();
  // Normalize Dropbox sharing link to a direct/raw URL suitable for <img src>
  let shareUrl = linkJson?.url as string;
  if (typeof shareUrl === "string") {
    // 1) Swap host to dl.dropboxusercontent.com for direct content (avoids HTML landing page)
    shareUrl = shareUrl.replace("www.dropbox.com", "dl.dropboxusercontent.com");
    // 2) Replace both forms of dl=0
    shareUrl = shareUrl.replace("?dl=0", "?raw=1").replace("&dl=0", "&raw=1");
    // 3) Ensure we have a raw=1 or dl=1 parameter; if missing append raw=1
    if (!/[?&](raw=1|dl=1)\b/.test(shareUrl)) {
      shareUrl += (shareUrl.includes("?") ? "&" : "?") + "raw=1";
    }
  }
  return shareUrl;
}

export async function generateAndUploadThumbnail(
  videoUrl: string
): Promise<ThumbnailResult> {
  let blob: Blob;
  let usedFallback = false;
  try {
    blob = await extractThumbnail(videoUrl);
  } catch (e) {
    // Likely fetch/CORS issue; try canvas fallback
    try {
      blob = await captureViaVideoElement(videoUrl);
      usedFallback = true;
    } catch (inner) {
      throw new Error(
        "FFmpeg & canvas fallback failed: " +
          (inner instanceof Error ? inner.message : String(inner)) +
          " (original: " +
          (e instanceof Error ? e.message : String(e)) +
          ")"
      );
    }
  }
  const urlParts = videoUrl.split("/");
  const base = (urlParts[urlParts.length - 1] || "video").replace(
    /\.[^.]+$/,
    ""
  );
  const publicUrl = await uploadToDropbox(blob, base);
  // Determine dimensions
  const dim = await new Promise<{ w: number; h: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.width, h: img.height });
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
  if (usedFallback) {
    console.info("[thumbnail] used canvas fallback for", videoUrl);
  }
  return { publicUrl, width: dim.w, height: dim.h };
}

export async function saveThumbnailToSupabase(
  id: number,
  thumbnailUrl: string
) {
  if (!hasSupabase() || !supabase) throw new Error("Supabase not configured");
  const { error } = await supabase
    .from("videos")
    .update({ thumbnail: thumbnailUrl })
    .eq("id", id);
  if (error) throw error;
  window.dispatchEvent(new CustomEvent("video-updated"));
}
