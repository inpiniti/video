// Compress video to MP4 (H.265/HEVC video + AAC audio) via ffmpeg
// iPhone/Safari compatible format with excellent quality/size ratio
import { spawn } from "child_process";
import { join } from "path";
import { tmpdir } from "os";

export async function compressVideo(
  inputPath: string,
  jobId: string,
  onProgress?: (percent: number, message: string) => void
): Promise<string> {
  const outputPath = join(tmpdir(), `${jobId}_compressed.mp4`);

  console.log(`[Compressor] 🎬 Starting compression...`);
  console.log(`[Compressor] Input: ${inputPath}`);
  console.log(`[Compressor] Output: ${outputPath}`);
  console.log(`[Compressor] Codec: H.265 (HEVC) + AAC (MP4)`);

  // H.265/HEVC + AAC in MP4 container (iPhone/Safari compatible)
  // -c:v libx265: H.265/HEVC video codec (excellent compression, widely supported)
  // -crf 28: Constant quality (lower = higher quality; 28 is good balance for mobile)
  // -preset medium: Encoding speed/quality tradeoff
  // -tag:v hvc1: Use hvc1 tag for better iOS/Safari compatibility
  // -c:a aac: AAC audio codec (universal compatibility)
  // -b:a 128k: Audio bitrate
  // -movflags +faststart: Enable progressive streaming (fast start playback)
  const args = [
    "-i",
    inputPath,
    "-c:v",
    "libx265",
    "-crf",
    "28",
    "-preset",
    "medium",
    "-tag:v",
    "hvc1",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    "-y",
    outputPath,
  ];

  console.log(`[Compressor] 🔧 FFmpeg command: ffmpeg ${args.join(" ")}`);
  console.log(
    `[Compressor] ⏳ This may take several minutes... (Progress will be shown below)`
  );

  return new Promise<string>((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", args);
    let stderr = "";
    let lastProgress = "";
    let duration = 0;

    ffmpeg.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;

      // Extract total duration (appears at start)
      if (!duration) {
        const durationMatch = text.match(
          /Duration: (\d{2}):(\d{2}):(\d{2})\.\d{2}/
        );
        if (durationMatch) {
          const hours = parseInt(durationMatch[1]);
          const minutes = parseInt(durationMatch[2]);
          const seconds = parseInt(durationMatch[3]);
          duration = hours * 3600 + minutes * 60 + seconds;
          console.log(
            `[Compressor] 📹 Video duration: ${durationMatch[1]}:${durationMatch[2]}:${durationMatch[3]}`
          );
        }
      }

      // Extract progress information
      const progressMatch = text.match(/time=(\d{2}):(\d{2}):(\d{2})\.\d{2}/);
      const fpsMatch = text.match(/fps=\s*(\d+)/);
      const sizeMatch = text.match(/size=\s*(\d+kB)/);

      if (progressMatch) {
        const hours = parseInt(progressMatch[1]);
        const minutes = parseInt(progressMatch[2]);
        const seconds = parseInt(progressMatch[3]);
        const currentTime = hours * 3600 + minutes * 60 + seconds;

        let percent = 0;
        if (duration > 0) {
          percent = Math.min(100, (currentTime / duration) * 100);
        }

        const message = `${progressMatch[0]} ${
          fpsMatch ? `| ${fpsMatch[1]} fps` : ""
        } ${sizeMatch ? `| ${sizeMatch[1]}` : ""}`;
        const currentProgress = `[Compressor] ⏳ Progress: ${percent.toFixed(
          1
        )}% - ${message}`;

        if (currentProgress !== lastProgress) {
          console.log(currentProgress);
          lastProgress = currentProgress;

          if (onProgress) {
            onProgress(percent, message);
          }
        }
      }
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        console.log(`[Compressor] ✅ Compression complete!`);
        console.log(`[Compressor] Output file: ${outputPath}`);

        if (onProgress) {
          onProgress(100, "Complete");
        }

        resolve(outputPath);
      } else {
        console.error(`[Compressor] ❌ FFmpeg failed with code ${code}`);
        console.error(`[Compressor] Error output:`, stderr);
        reject(new Error(`ffmpeg failed (${code}): ${stderr}`));
      }
    });

    ffmpeg.on("error", (err) => {
      console.error(`[Compressor] ❌ FFmpeg spawn error:`, err);
      reject(err);
    });
  });
}
