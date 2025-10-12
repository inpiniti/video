// Compress video to WebM (AV1 video + Opus audio) via ffmpeg
// Maintains high quality with efficient encoding
import { spawn } from "child_process";
import { join } from "path";
import { tmpdir } from "os";

export async function compressVideo(
  inputPath: string,
  jobId: string,
  onProgress?: (percent: number, message: string) => void
): Promise<string> {
  const outputPath = join(tmpdir(), `${jobId}_compressed.webm`);

  console.log(`[Compressor] 🎬 Starting compression...`);
  console.log(`[Compressor] Input: ${inputPath}`);
  console.log(`[Compressor] Output: ${outputPath}`);
  console.log(`[Compressor] Codec: AV1 + Opus (WebM)`);

  // AV1 + Opus in WebM container
  // -c:v libaom-av1: AV1 video codec (best compression efficiency)
  // -crf 30: Constant quality (lower = higher quality; 30 is good balance)
  // -b:v 0: Let CRF control bitrate
  // -cpu-used 4: Speed/quality tradeoff (0=slowest/best, 8=fastest/worst; 4 is balanced)
  // -c:a libopus: Opus audio codec
  // -b:a 128k: Audio bitrate
  const args = [
    "-i",
    inputPath,
    "-c:v",
    "libaom-av1",
    "-crf",
    "30",
    "-b:v",
    "0",
    "-cpu-used",
    "4",
    "-row-mt",
    "1",
    "-threads",
    "0",
    "-c:a",
    "libopus",
    "-b:a",
    "128k",
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
