// In-memory job queue with concurrency control for video upload pipeline
// Each job: download → compress (WebM AV1+Opus) → upload to TeraBox → return URL

export type JobStatus =
  | "queued"
  | "downloading"
  | "compressing"
  | "uploading"
  | "done"
  | "error";

export interface JobProgress {
  percentage: number; // 0-100
  downloadedMB?: number; // For download stage
  totalMB?: number; // For download stage
  message?: string; // Current activity message
}

export interface Job {
  id: string;
  videoId: number;
  sourceUrl: string;
  supabaseUrl: string;
  supabaseKey: string;
  status: JobStatus;
  progress?: JobProgress; // Real-time progress info
  teraboxUrl?: string;
  error?: string;
  createdAt: number;
}

const jobs = new Map<string, Job>();
const queue: string[] = [];
let activeWorkers = 0;
const MAX_CONCURRENT = 10;

export function enqueueJob(
  videoId: number,
  sourceUrl: string,
  supabaseUrl: string,
  supabaseKey: string
): string {
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const job: Job = {
    id,
    videoId,
    sourceUrl,
    supabaseUrl,
    supabaseKey,
    status: "queued",
    createdAt: Date.now(),
  };
  jobs.set(id, job);
  queue.push(id);

  console.log(`[Queue] ✅ Job enqueued: ${id}`);
  console.log(`[Queue] Video ID: ${videoId}, URL: ${sourceUrl}`);
  console.log(
    `[Queue] Current queue length: ${queue.length}, Active workers: ${activeWorkers}/${MAX_CONCURRENT}`
  );

  processQueue();
  return id;
}

export function getAllJobs(): Job[] {
  return Array.from(jobs.values());
}

// Update job progress
export function updateJobProgress(jobId: string, progress: JobProgress) {
  const job = jobs.get(jobId);
  if (job) {
    job.progress = progress;
  }
}

async function processQueue() {
  console.log(
    `[Queue] 🔍 processQueue called - Workers: ${activeWorkers}/${MAX_CONCURRENT}, Queue: ${queue.length}`
  );

  if (activeWorkers >= MAX_CONCURRENT || queue.length === 0) {
    if (queue.length === 0 && activeWorkers === 0) {
      console.log("[Queue] 💤 Queue is empty, waiting for jobs...");
    } else if (activeWorkers >= MAX_CONCURRENT) {
      console.log(
        `[Queue] ⏸️  Max workers reached (${activeWorkers}/${MAX_CONCURRENT})`
      );
    }
    return;
  }
  const jobId = queue.shift();
  if (!jobId) return;
  const job = jobs.get(jobId);
  if (!job) {
    console.error(`[Queue] ❌ Job ${jobId} not found in jobs map`);
    return;
  }

  console.log(`[Queue] 🚀 Starting job: ${jobId}`);
  console.log(`[Queue] 📋 Job details:`, {
    videoId: job.videoId,
    sourceUrl: job.sourceUrl,
  });
  console.log(
    `[Queue] Active workers will be: ${activeWorkers + 1}/${MAX_CONCURRENT}`
  );

  activeWorkers++;
  try {
    await processJob(job);
    console.log(`[Queue] ✅ Job ${jobId} completed successfully`);
  } catch (e) {
    console.error(`[Queue] ❌ Job ${jobId} failed with error:`, e);
    job.status = "error";
    job.error = String(e);
  } finally {
    activeWorkers--;
    console.log(
      `[Queue] 🏁 Job ${jobId} finished. Active workers now: ${activeWorkers}/${MAX_CONCURRENT}`
    );

    if (queue.length > 0) {
      console.log(
        `[Queue] ⏭️  ${queue.length} jobs remaining, processing next...`
      );
    }
    processQueue(); // kick next
  }
}

async function processJob(job: Job) {
  console.log(`[Job ${job.id}] 📦 Processing started`);
  console.log(
    `[Job ${job.id}] Video ID: ${job.videoId}, Source: ${job.sourceUrl}`
  );

  try {
    // 1. Download
    console.log(`[Job ${job.id}] ⬇️  Step 1/3: Downloading video...`);
    job.status = "downloading";
    job.progress = { percentage: 0, message: "Starting download..." };

    // Direct imports without .js extension for Next.js compatibility
    const { downloadVideo } = await import("./videoDownloader");
    console.log(`[Job ${job.id}] ✅ Loaded downloader module`);

    const downloadPath = await downloadVideo(
      job.sourceUrl,
      job.id,
      (percent, downloadedMB, totalMB) => {
        job.progress = {
          percentage: percent,
          downloadedMB,
          totalMB,
          message: `Downloading: ${percent.toFixed(1)}% (${downloadedMB.toFixed(
            1
          )}/${totalMB.toFixed(1)} MB)`,
        };
      }
    );
    console.log(`[Job ${job.id}] ✅ Downloaded to: ${downloadPath}`);

    // 2. Compress
    console.log(
      `[Job ${job.id}] 🔄 Step 2/3: Compressing video (this may take several minutes)...`
    );
    job.status = "compressing";
    job.progress = { percentage: 0, message: "Starting compression..." };

    const { compressVideo } = await import("./videoCompressor");
    console.log(`[Job ${job.id}] ✅ Loaded compressor module`);

    const compressedPath = await compressVideo(
      downloadPath,
      job.id,
      (percent, message) => {
        job.progress = {
          percentage: percent,
          message: `Compressing: ${percent.toFixed(1)}% - ${message}`,
        };
      }
    );
    console.log(`[Job ${job.id}] ✅ Compressed to: ${compressedPath}`);

    // If compression returned null, it means file was too large even at lowest quality.
    if (compressedPath === null) {
      console.log(
        `[Job ${job.id}] ⚠️ File too large (>50MB even at 320p). Skipping upload.`
      );
      job.status = "error";
      job.error = "File too large (>50MB even at 320p). Skipped upload.";
      job.progress = { percentage: 100, message: "Skipped (file too large)" };

      // Cleanup download file
      const fs = await import("fs/promises");
      await fs.unlink(downloadPath).catch(() => {});

      return;
    }

    // 3. Upload to TeraBox
    console.log(`[Job ${job.id}] ⬆️  Step 3/3: Uploading to TeraBox...`);
    job.status = "uploading";
    job.progress = { percentage: 0, message: "Starting upload..." };

    const { uploadToTeraBox } = await import("./teraboxUploader");
    console.log(`[Job ${job.id}] ✅ Loaded uploader module`);

    const teraboxUrl = await uploadToTeraBox(compressedPath, job.videoId);
    console.log(`[Job ${job.id}] ✅ Uploaded! TeraBox File ID: ${teraboxUrl}`);

    // 4. Update Supabase with new URL and remove [upload] tag
    console.log(`[Job ${job.id}] 💾 Step 4/4: Updating Supabase...`);
    job.status = "uploading"; // Keep as uploading for UI consistency
    job.progress = { percentage: 95, message: "Updating database..." };

    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(job.supabaseUrl, job.supabaseKey);

    // Get current title
    const { data: video } = await supabase
      .from("videos")
      .select("title")
      .eq("id", job.videoId)
      .single();

    let newTitle = video?.title || "";
    // Remove [upload] tag if present
    newTitle = newTitle.replace(/\[upload\]\s*/gi, "").trim();

    // Update URL and title
    const { error } = await supabase
      .from("videos")
      .update({
        url: teraboxUrl,
        title: newTitle,
      })
      .eq("id", job.videoId);

    if (error) {
      console.error(`[Job ${job.id}] ❌ Supabase update failed:`, error);
      throw new Error(`Supabase update failed: ${error.message}`);
    }
    console.log(`[Job ${job.id}] ✅ Supabase updated, [upload] tag removed`);

    // 5. Done
    job.status = "done";
    job.teraboxUrl = teraboxUrl;
    job.progress = { percentage: 100, message: "Complete!" };
    console.log(`[Job ${job.id}] 🎉 All steps completed successfully!`);

    // Cleanup temp files
    console.log(`[Job ${job.id}] 🧹 Cleaning up temp files...`);
    const fs = await import("fs/promises");
    await fs.unlink(downloadPath).catch(() => {
      /* ignore */
    });
    await fs.unlink(compressedPath).catch(() => {
      /* ignore */
    });
    console.log(`[Job ${job.id}] ✅ Cleanup done`);
  } catch (e) {
    console.error(`[Job ${job.id}] ❌ Error during processing:`, e);
    job.status = "error";
    job.error = String(e);
    throw e;
  }
}
