// Download video from URL to temp file
import { join } from "path";
import { tmpdir } from "os";
import { createWriteStream } from "fs";

export async function downloadVideo(
  url: string,
  jobId: string,
  onProgress?: (percent: number, downloadedMB: number, totalMB: number) => void
): Promise<string> {
  console.log(`[Downloader] 🌐 Starting download from: ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    console.error(
      `[Downloader] ❌ Download failed with status: ${response.status}`
    );
    throw new Error(`Download failed: ${response.status}`);
  }

  const contentLength = response.headers.get("content-length");
  const totalSize = contentLength ? parseInt(contentLength) : 0;
  console.log(
    `[Downloader] 📦 File size: ${
      totalSize ? (totalSize / 1024 / 1024).toFixed(2) + " MB" : "unknown"
    }`
  );

  const tempPath = join(tmpdir(), `${jobId}_source.mp4`);

  if (!response.body) {
    throw new Error("Response body is null");
  }

  // Stream download with progress
  const fileStream = createWriteStream(tempPath);
  let downloaded = 0;
  let lastLogTime = Date.now();

  const reader = response.body.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      fileStream.write(value);
      downloaded += value.length;

      // Report progress every 2 seconds
      const now = Date.now();
      if (totalSize && now - lastLogTime > 2000) {
        const percent = (downloaded / totalSize) * 100;
        const downloadedMB = downloaded / 1024 / 1024;
        const totalMB = totalSize / 1024 / 1024;

        console.log(
          `[Downloader] ⏳ Progress: ${percent.toFixed(
            1
          )}% (${downloadedMB.toFixed(2)}/${totalMB.toFixed(2)} MB)`
        );

        if (onProgress) {
          onProgress(percent, downloadedMB, totalMB);
        }

        lastLogTime = now;
      }
    }

    fileStream.end();

    // Wait for stream to finish
    await new Promise<void>((resolve, reject) => {
      fileStream.on("finish", () => resolve());
      fileStream.on("error", reject);
    });

    // Final progress update
    if (totalSize && onProgress) {
      const downloadedMB = downloaded / 1024 / 1024;
      const totalMB = totalSize / 1024 / 1024;
      onProgress(100, downloadedMB, totalMB);
    }

    console.log(
      `[Downloader] ✅ Downloaded ${(downloaded / 1024 / 1024).toFixed(2)} MB`
    );
    console.log(`[Downloader] 💾 Saved to: ${tempPath}`);

    return tempPath;
  } catch (error) {
    fileStream.close();
    throw error;
  }
}
