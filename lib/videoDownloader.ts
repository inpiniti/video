// Download video from URL to temp file
import { join } from "path";
import { tmpdir } from "os";
import { createWriteStream, existsSync, statSync } from "fs";

export async function downloadVideo(
  url: string,
  jobId: string,
  onProgress?: (percent: number, downloadedMB: number, totalMB: number) => void
): Promise<string> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `[Downloader] 🌐 Starting download (attempt ${attempt}/${maxRetries}) from: ${url}`
      );
      return await downloadWithResume(url, jobId, onProgress);
    } catch (error) {
      lastError = error as Error;
      console.error(
        `[Downloader] ❌ Attempt ${attempt}/${maxRetries} failed:`,
        error
      );

      if (attempt < maxRetries) {
        const waitTime = attempt * 2000; // 2s, 4s, 6s
        console.log(`[Downloader] ⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  throw new Error(
    `Download failed after ${maxRetries} attempts: ${lastError?.message}`
  );
}

async function downloadWithResume(
  url: string,
  jobId: string,
  onProgress?: (percent: number, downloadedMB: number, totalMB: number) => void
): Promise<string> {
  const tempPath = join(tmpdir(), `${jobId}_source.mp4`);

  // Check if partial file exists
  let startByte = 0;
  if (existsSync(tempPath)) {
    const stats = statSync(tempPath);
    startByte = stats.size;
    console.log(
      `[Downloader] 📂 Resuming from ${(startByte / 1024 / 1024).toFixed(2)} MB`
    );
  }

  const headers: HeadersInit = {};
  if (startByte > 0) {
    headers["Range"] = `bytes=${startByte}-`;
  }

  const response = await fetch(url, { headers });

  // Accept both 200 (full) and 206 (partial) responses
  if (!response.ok && response.status !== 206) {
    let errorDetail = "";
    try {
      errorDetail = await response.text();
    } catch {
      // ignore
    }
    console.error(
      `[Downloader] ❌ Download failed with status: ${response.status}`
    );
    console.error(`[Downloader] 🔗 URL: ${url}`);
    console.error(
      `[Downloader] 📄 Error detail: ${errorDetail.substring(0, 500)}`
    );
    throw new Error(
      `Download failed: ${response.status} - ${errorDetail.substring(0, 100)}`
    );
  }

  const contentLength = response.headers.get("content-length");
  const contentRange = response.headers.get("content-range");

  let totalSize = 0;
  if (contentRange) {
    // Parse "bytes 1000-2000/3000" format
    const match = contentRange.match(/\/(\d+)$/);
    if (match) totalSize = parseInt(match[1]);
  } else if (contentLength) {
    totalSize = parseInt(contentLength);
  }

  console.log(
    `[Downloader] 📦 File size: ${
      totalSize ? (totalSize / 1024 / 1024).toFixed(2) + " MB" : "unknown"
    }`
  );

  if (!response.body) {
    throw new Error("Response body is null");
  }

  // Stream download with progress (append mode if resuming)
  const fileStream = createWriteStream(tempPath, {
    flags: startByte > 0 ? "a" : "w",
  });
  let downloaded = startByte;
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
