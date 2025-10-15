// Simplified job queue for video upload pipeline (no Supabase)
// Each job: download → compress → upload to TeraBox
// Only ONE job processes at a time (downloading, compressing, or uploading)

export type SimpleJobStatus =
  | "queued"
  | "downloading"
  | "compressing"
  | "uploading"
  | "done"
  | "error";

export interface SimpleJobProgress {
  percentage: number; // 0-100
  sizeMB?: number; // Current size
  totalMB?: number; // Total size (for downloads)
  message?: string; // Current activity message
}

export interface SimpleJob {
  id: string;
  sourceUrl: string;
  sourceFile?: string; // NEW: path to uploaded file (skips download)
  status: SimpleJobStatus;
  progress?: SimpleJobProgress;
  teraboxFileId?: string; // Result: terabox://[fileId]
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  // Internal: paths for pipeline stages
  downloadPath?: string;
  compressedPath?: string;
}

const jobs = new Map<string, SimpleJob>();
const queue: string[] = [];
let statusInterval: NodeJS.Timeout | null = null;

// Track what's currently processing in each stage
let currentlyDownloading: string | null = null;
let currentlyCompressing: string | null = null;
let currentlyUploading: string | null = null;

export function enqueueSimpleJob(
  sourceUrl: string,
  sourceFile?: string
): string {
  const id = `sjob_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const job: SimpleJob = {
    id,
    sourceUrl,
    sourceFile,
    status: sourceFile ? "compressing" : "queued", // Skip download if file provided
    createdAt: Date.now(),
  };

  // If file provided, set downloadPath to sourceFile so compress stage can use it
  if (sourceFile) {
    job.downloadPath = sourceFile;
  }

  jobs.set(id, job);
  queue.push(id);

  startStatusLogger();
  processJobs(); // Process all stages
  return id;
}

export function getAllSimpleJobs(): SimpleJob[] {
  return Array.from(jobs.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export function getQueueStatus() {
  const allJobs = getAllSimpleJobs();
  const queued = allJobs.filter((j) => j.status === "queued");
  const downloading = allJobs.filter((j) => j.status === "downloading");
  const compressing = allJobs.filter((j) => j.status === "compressing");
  const uploading = allJobs.filter((j) => j.status === "uploading");
  const done = allJobs.filter((j) => j.status === "done");
  const error = allJobs.filter((j) => j.status === "error");

  return {
    queued: queued.length,
    downloading: downloading[0] || null,
    compressing: compressing[0] || null,
    uploading: uploading[0] || null,
    done: done.length,
    error: error.length,
    total: allJobs.length,
  };
}

function startStatusLogger() {
  if (statusInterval) return;

  statusInterval = setInterval(() => {
    const status = getQueueStatus();

    // Clear console and print status
    process.stdout.write("\x1Bc"); // Clear console
    console.log("📊 작업 상태");
    console.log("─".repeat(40));
    console.log(`대기: ${status.queued}`);

    if (status.downloading) {
      const prog = status.downloading.progress;
      const percent = prog ? `${prog.percentage.toFixed(0)}%` : "0%";
      console.log(`다운로드: ${percent}`);
    } else {
      console.log(`다운로드: -`);
    }

    if (status.compressing) {
      const prog = status.compressing.progress;
      const percent = prog ? `${prog.percentage.toFixed(0)}%` : "0%";
      console.log(`압축: ${percent}`);
    } else {
      console.log(`압축: -`);
    }

    if (status.uploading) {
      const prog = status.uploading.progress;
      const percent = prog ? `${prog.percentage.toFixed(0)}%` : "0%";
      console.log(`업로드: ${percent}`);
    } else {
      console.log(`업로드: -`);
    }

    console.log("─".repeat(40));
    console.log(`✅ 완료: ${status.done}  ❌ 실패: ${status.error}`);

    // Stop if no active jobs
    if (
      !status.downloading &&
      !status.compressing &&
      !status.uploading &&
      status.queued === 0
    ) {
      stopStatusLogger();
    }
  }, 1000);
}

function stopStatusLogger() {
  if (statusInterval) {
    clearInterval(statusInterval);
    statusInterval = null;
  }
}

// Update job progress
export function updateSimpleJobProgress(
  jobId: string,
  progress: SimpleJobProgress
) {
  const job = jobs.get(jobId);
  if (job) {
    job.progress = progress;
  }
}

// Process all stages in pipeline
async function processJobs() {
  processDownload();
  processCompress();
  processUpload();
}

// Process download stage
async function processDownload() {
  if (currentlyDownloading) return; // Already downloading something

  // Find next job that needs downloading
  const nextJob = Array.from(jobs.values()).find((j) => j.status === "queued");
  if (!nextJob) return;

  currentlyDownloading = nextJob.id;
  nextJob.status = "downloading";
  nextJob.startedAt = Date.now();
  nextJob.progress = { percentage: 0 };

  try {
    const { downloadVideo } = await import("./videoDownloader");
    const downloadPath = await downloadVideo(
      nextJob.sourceUrl,
      nextJob.id,
      (percent, downloadedMB, totalMB) => {
        updateSimpleJobProgress(nextJob.id, {
          percentage: percent,
          sizeMB: downloadedMB,
          totalMB,
        });
      }
    );

    // Move to compress queue
    nextJob.status = "compressing";
    nextJob.progress = { percentage: 0 };
    nextJob.downloadPath = downloadPath; // Store path for next stage
  } catch (e) {
    nextJob.status = "error";
    nextJob.error = String(e);
    nextJob.completedAt = Date.now();
  } finally {
    currentlyDownloading = null;
    processJobs(); // Trigger next stages
  }
}

// Process compress stage
async function processCompress() {
  if (currentlyCompressing) return; // Already compressing something

  // Find next job that needs compressing (downloaded but not compressed)
  const nextJob = Array.from(jobs.values()).find(
    (j) => j.status === "compressing" && j.downloadPath
  );
  if (!nextJob || !nextJob.downloadPath) return;

  currentlyCompressing = nextJob.id;
  const downloadPath = nextJob.downloadPath;

  try {
    const { compressVideo } = await import("./videoCompressor");
    const compressedPath = await compressVideo(
      downloadPath,
      nextJob.id,
      async (percent) => {
        updateSimpleJobProgress(nextJob.id, {
          percentage: percent,
        });
      }
    );

    // null이면 파일이 너무 커서 스킵
    if (compressedPath === null) {
      console.log(
        `[JobQueue] ⚠️ Skipping upload - file too large even at lowest quality`
      );
      nextJob.status = "error";
      nextJob.error = "File too large (>50MB even at 320p). Skipped upload.";
      nextJob.completedAt = Date.now();

      // Cleanup download file
      const fs = await import("fs/promises");
      await fs.unlink(downloadPath).catch(() => {});
      delete nextJob.downloadPath;

      return; // 다음 작업으로 진행
    }

    // Move to upload queue
    nextJob.status = "uploading";
    nextJob.progress = { percentage: 0 };
    nextJob.compressedPath = compressedPath;

    // Cleanup download file
    const fs = await import("fs/promises");
    await fs.unlink(downloadPath).catch(() => {});
    delete nextJob.downloadPath;
  } catch (e) {
    nextJob.status = "error";
    nextJob.error = String(e);
    nextJob.completedAt = Date.now();
  } finally {
    currentlyCompressing = null;
    processJobs(); // Trigger next stages
  }
}

// Process upload stage
async function processUpload() {
  if (currentlyUploading) return; // Already uploading something

  // Find next job that needs uploading (compressed but not uploaded)
  const nextJob = Array.from(jobs.values()).find(
    (j) => j.status === "uploading" && j.compressedPath
  );
  if (!nextJob || !nextJob.compressedPath) return;

  currentlyUploading = nextJob.id;
  const compressedPath = nextJob.compressedPath;

  try {
    const { uploadToTeraBox } = await import("./teraboxUploader");
    const dummyId = Date.now();
    const teraboxFileId = await uploadToTeraBox(
      compressedPath,
      dummyId,
      (percent) => {
        updateSimpleJobProgress(nextJob.id, {
          percentage: percent,
        });
      }
    );

    // Done!
    nextJob.status = "done";
    nextJob.teraboxFileId = teraboxFileId;
    nextJob.progress = { percentage: 100 };
    nextJob.completedAt = Date.now();

    // Cleanup compressed file
    const fs = await import("fs/promises");
    await fs.unlink(compressedPath).catch(() => {});
    delete nextJob.compressedPath;
  } catch (e) {
    nextJob.status = "error";
    nextJob.error = String(e);
    nextJob.completedAt = Date.now();
  } finally {
    currentlyUploading = null;
    processJobs(); // Trigger next stages
  }
}
