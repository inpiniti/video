// Compress video to MP4 (H.264 video + AAC audio) via ffmpeg
// Universal browser compatibility (Chrome, Safari, Firefox, Edge)
// Optimized for high quality with good compression
import { spawn } from "child_process";
import { join } from "path";
import { tmpdir } from "os";
import { statSync, existsSync, unlinkSync, renameSync } from "fs";

const MAX_FILE_SIZE_MB = 50; // 50MB 제한
const RESOLUTIONS = [
  { height: 720, name: "720p" },
  { height: 640, name: "640p" },
  { height: 480, name: "480p" },
  { height: 320, name: "320p" },
];

async function compressWithResolution(
  inputPath: string,
  outputPath: string,
  height: number,
  onProgress?: (percent: number, message: string) => void
): Promise<void> {
  console.log(`[Compressor] 🎬 Attempting compression at ${height}p...`);
  console.log(`[Compressor] Input: ${inputPath}`);
  console.log(`[Compressor] Output: ${outputPath}`);

  const args = [
    "-i",
    inputPath,
    "-vf",
    `scale=-2:${height}`,
    "-c:v",
    "libx264",
    "-crf",
    "23",
    "-preset",
    "slow",
    "-profile:v",
    "high",
    "-level",
    "4.2",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    "-y",
    outputPath,
  ];

  return new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", args);
    let stderr = "";
    let lastProgress = "";
    let duration = 0;

    ffmpeg.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;

      if (!duration) {
        const durationMatch = text.match(
          /Duration: (\d{2}):(\d{2}):(\d{2})\.\d{2}/
        );
        if (durationMatch) {
          const hours = parseInt(durationMatch[1]);
          const minutes = parseInt(durationMatch[2]);
          const seconds = parseInt(durationMatch[3]);
          duration = hours * 3600 + minutes * 60 + seconds;
        }
      }

      const progressMatch = text.match(/time=(\d{2}):(\d{2}):(\d{2})\.\d{2}/);
      if (progressMatch) {
        const hours = parseInt(progressMatch[1]);
        const minutes = parseInt(progressMatch[2]);
        const seconds = parseInt(progressMatch[3]);
        const currentTime = hours * 3600 + minutes * 60 + seconds;

        let percent = 0;
        if (duration > 0) {
          percent = Math.min(100, (currentTime / duration) * 100);
        }

        const currentProgress = `[Compressor] ⏳ Progress: ${percent.toFixed(
          1
        )}%`;
        if (currentProgress !== lastProgress) {
          console.log(currentProgress);
          lastProgress = currentProgress;
          if (onProgress) {
            onProgress(percent, `Compressing at ${height}p`);
          }
        }
      }
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg failed (${code}): ${stderr}`));
      }
    });

    ffmpeg.on("error", reject);
  });
}

export async function compressVideo(
  inputPath: string,
  jobId: string,
  onProgress?: (percent: number, message: string) => void
): Promise<string | null> {
  console.log(`[Compressor] 🎬 Starting adaptive compression...`);
  console.log(`[Compressor] Input: ${inputPath}`);
  console.log(`[Compressor] Max file size: ${MAX_FILE_SIZE_MB}MB`);

  // 각 해상도별로 시도
  for (let i = 0; i < RESOLUTIONS.length; i++) {
    const resolution = RESOLUTIONS[i];
    const outputPath = join(
      tmpdir(),
      `${jobId}_compressed_${resolution.name}.mp4`
    );

    console.log(
      `\n[Compressor] 📐 Trying ${resolution.name} (${resolution.height}p)...`
    );

    try {
      // 압축 실행
      await compressWithResolution(
        inputPath,
        outputPath,
        resolution.height,
        onProgress
      );

      // 파일 크기 확인
      const fileSizeBytes = statSync(outputPath).size;
      const fileSizeMB = fileSizeBytes / (1024 * 1024);

      console.log(
        `[Compressor] � Compressed file size: ${fileSizeMB.toFixed(2)}MB`
      );

      if (fileSizeMB <= MAX_FILE_SIZE_MB) {
        console.log(`[Compressor] ✅ File size OK! Using ${resolution.name}`);

        // 최종 파일명으로 변경
        const finalPath = join(tmpdir(), `${jobId}_compressed.mp4`);
        if (finalPath !== outputPath) {
          // 기존 파일이 있으면 삭제
          if (existsSync(finalPath)) {
            unlinkSync(finalPath);
          }
          renameSync(outputPath, finalPath);
        }

        if (onProgress) {
          onProgress(100, `Complete at ${resolution.name}`);
        }

        return finalPath;
      } else {
        console.log(
          `[Compressor] ⚠️ File too large (${fileSizeMB.toFixed(
            2
          )}MB > ${MAX_FILE_SIZE_MB}MB)`
        );

        // 임시 파일 삭제
        if (existsSync(outputPath)) {
          unlinkSync(outputPath);
        }

        // 마지막 해상도까지 시도했으면 실패
        if (i === RESOLUTIONS.length - 1) {
          console.log(
            `[Compressor] ❌ All resolutions tried. File still too large. Skipping upload.`
          );
          return null;
        }

        console.log(`[Compressor] 🔄 Trying next resolution...`);
      }
    } catch (error) {
      console.error(
        `[Compressor] ❌ Error compressing at ${resolution.name}:`,
        error
      );

      // 임시 파일 정리
      if (existsSync(outputPath)) {
        unlinkSync(outputPath);
      }

      // 압축 자체가 실패하면 다음 해상도로 계속 시도
      if (i === RESOLUTIONS.length - 1) {
        throw error; // 마지막 해상도에서도 실패하면 에러 throw
      }
    }
  }

  // 여기까지 오면 모든 해상도 시도 실패
  console.log(`[Compressor] ❌ All compression attempts failed`);
  return null;
}
