import fs from "fs-extra";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";

// Configure ffmpeg path
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath as string);
}

// Config
const BOARD_LIST_FILE = path.resolve(__dirname, "..", "boardList.json");
const SAVE_DIR_IMAGES = path.resolve("C:\\Users\\youngkyun\\Pictures");
const SAVE_DIR_VIDEOS = path.resolve("C:\\Users\\youngkyun\\Videos");

type BoardItem = {
  id: number;
  title?: string;
  date?: string;
  thumbnail?: string;
  url?: string;
  imgs?: string[];
  videos?: string[];
  localThumbnail?: string;
  [key: string]: unknown;
};

/**
 * Extract thumbnail from video file
 */
async function extractThumbnailFromVideo(
  videoPath: string,
  thumbPath: string
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        timestamps: ["00:00:01.000"], // Capture at 1 second mark
        folder: path.dirname(thumbPath),
        filename: path.basename(thumbPath),
        size: "320x?",
      })
      .on("end", () => resolve())
      .on("error", (err: Error) => reject(err));
  });

  // Verify file was actually created
  if (!(await fs.pathExists(thumbPath))) {
    throw new Error("Thumbnail file was not created by ffmpeg");
  }
}

/**
 * Load boardList.json
 */
async function loadBoardList(): Promise<BoardItem[]> {
  if (!(await fs.pathExists(BOARD_LIST_FILE))) {
    throw new Error(`Missing board list: ${BOARD_LIST_FILE}`);
  }
  const data = await fs.readJson(BOARD_LIST_FILE);
  if (!Array.isArray(data)) throw new Error("boardList.json is not an array");
  return data as BoardItem[];
}

/**
 * Save boardList.json
 */
async function saveBoardList(boardList: BoardItem[]): Promise<void> {
  await fs.writeJson(BOARD_LIST_FILE, boardList, { spaces: 2 });
}

/**
 * Check if item has videos
 */
function hasVideos(item: BoardItem): boolean {
  return Array.isArray(item.videos) && item.videos.length > 0;
}

/**
 * Get expected thumbnail filename for an item
 */
function getExpectedThumbnailFilename(item: BoardItem): string | null {
  if (item.localThumbnail) {
    return item.localThumbnail;
  }
  if (item.thumbnail && item.thumbnail.includes("/")) {
    const parts = item.thumbnail.split("/");
    return parts[parts.length - 1];
  }
  return `${item.id}_thumb.jpg`;
}

/**
 * Check if thumbnail file actually exists on disk
 */
async function thumbnailFileExists(item: BoardItem): Promise<boolean> {
  const filename = getExpectedThumbnailFilename(item);
  if (!filename) return false;

  const thumbPath = path.join(SAVE_DIR_IMAGES, filename);
  try {
    const exists = await fs.pathExists(thumbPath);
    if (!exists) return false;

    // Also check if file is not empty
    const stats = await fs.stat(thumbPath);
    return stats.size > 0;
  } catch {
    return false;
  }
}

/**
 * Main function
 */
async function run() {
  console.log("=== Fix Missing Thumbnails for Video Posts ===\n");

  // Ensure directories exist
  await fs.ensureDir(SAVE_DIR_IMAGES);
  await fs.ensureDir(SAVE_DIR_VIDEOS);

  // Load board list
  const boardList = await loadBoardList();
  console.log(`Total items in boardList: ${boardList.length}`);

  // Step 1: Filter video posts only
  const videoItems = boardList.filter(hasVideos);
  console.log(`\nStep 1: Found ${videoItems.length} video posts`);

  if (videoItems.length === 0) {
    console.log("No video posts found. Exiting.");
    return;
  }

  // Step 2: Filter video posts where thumbnail file is missing
  console.log(
    `\nStep 2: Checking which video posts are missing thumbnail files...`
  );
  const missingThumbnailItems: BoardItem[] = [];

  for (const item of videoItems) {
    const exists = await thumbnailFileExists(item);
    if (!exists) {
      missingThumbnailItems.push(item);
    }
  }

  console.log(
    `  → Found ${missingThumbnailItems.length} video posts without thumbnail files`
  );

  if (missingThumbnailItems.length === 0) {
    console.log("All video posts have thumbnail files. Exiting.");
    return;
  }

  // Step 3: Extract thumbnails from videos
  console.log(`\nStep 3: Extracting thumbnails from videos...`);
  const videoFiles = await fs.readdir(SAVE_DIR_VIDEOS);
  let extractedFromVideos = 0;
  let skippedNoVideo = 0;
  let failed = 0;

  for (const item of missingThumbnailItems) {
    const id = item.id;

    // Find video file for this item
    const videoFile = videoFiles.find((f) => f.startsWith(`${id}_video_`));

    if (!videoFile) {
      console.log(`  [${id}] No video file found in Videos folder, skipping`);
      skippedNoVideo++;
      continue;
    }

    const videoPath = path.join(SAVE_DIR_VIDEOS, videoFile);

    // Verify video file exists
    if (!(await fs.pathExists(videoPath))) {
      console.log(`  [${id}] Video path missing: ${videoPath}`);
      skippedNoVideo++;
      continue;
    }

    // Define thumbnail output path
    const thumbFilename = `${id}_thumb.jpg`;
    const thumbPath = path.join(SAVE_DIR_IMAGES, thumbFilename);

    // Extract thumbnail
    try {
      console.log(
        `  [${id}] Extracting thumbnail from ${videoFile} → ${thumbFilename}`
      );
      await extractThumbnailFromVideo(videoPath, thumbPath);

      // Update boardList item
      item.thumbnail = `/api/media/images/${thumbFilename}`;
      item.localThumbnail = thumbFilename;
      extractedFromVideos++;

      console.log(`  [${id}] ✓ Thumbnail extracted successfully`);
    } catch (err) {
      console.error(
        `  [${id}] ✗ Failed to extract thumbnail:`,
        err instanceof Error ? err.message : err
      );
      failed++;
    }
  }

  console.log(`  → Extracted ${extractedFromVideos} thumbnails from videos`);

  // Final save
  await saveBoardList(boardList);

  // Final report
  console.log(`\n=== Summary ===`);
  console.log(`Total video posts: ${videoItems.length}`);
  console.log(`Video posts missing thumbnail files: ${missingThumbnailItems.length}`);
  console.log(`Thumbnails successfully extracted: ${extractedFromVideos}`);
  console.log(`Skipped (no video file): ${skippedNoVideo}`);
  console.log(`Failed to extract: ${failed}`);

  console.log("\n✓ Script completed successfully!");
}

// Run the script
run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
