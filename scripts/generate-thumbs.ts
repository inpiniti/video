import fs from "fs-extra";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import pLimit from "p-limit";

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath as string);

const BOARD_LIST_FILE = path.resolve(process.cwd(), "boardList.json");
const SAVE_DIR_VIDEOS = "C:\\Users\\youngkyun\\Videos";
const OUT_DIR = path.resolve(process.cwd(), "public", "thum");

type BoardItem = {
  id: number;
  thumbnail?: string;
  localThumbnail?: string;
  videos?: string[];
  [key: string]: unknown;
};

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function extractThumbnail(videoPath: string, outPath: string) {
  await new Promise<void>((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        count: 1,
        folder: path.dirname(outPath),
        filename: path.basename(outPath),
        size: "640x?",
      })
      .on("end", () => resolve())
      .on("error", (err: Error) => reject(err));
  });
}

async function main() {
  console.log("generate-thumbs: start");
  await fs.ensureDir(OUT_DIR);

  if (!(await fs.pathExists(BOARD_LIST_FILE))) {
    console.error("boardList.json not found at", BOARD_LIST_FILE);
    process.exit(1);
  }

  const board = (await fs.readJson(BOARD_LIST_FILE)) as BoardItem[];

  // Filter items whose thumbnail points to /api/media/images/
  const targets = board.filter(
    (item) =>
      typeof item.thumbnail === "string" &&
      item.thumbnail.startsWith("/api/media/images/")
  );
  console.log(`Found ${targets.length} items with api/media thumbnails`);

  const videosDirExists = await fs.pathExists(SAVE_DIR_VIDEOS);
  if (!videosDirExists) {
    console.error("Videos dir not found:", SAVE_DIR_VIDEOS);
    process.exit(1);
  }

  const videoFiles = await fs.readdir(SAVE_DIR_VIDEOS);

  const limit = pLimit(3);

  let processed = 0;

  await Promise.all(
    targets.map((item) =>
      limit(async () => {
        const id = item.id;
        try {
          const outFilename = `${id}_thumb.jpg`;
          const outPath = path.join(OUT_DIR, outFilename);

          // If already exists, just update fields
          if (await fs.pathExists(outPath)) {
            console.log(`[${id}] thumbnail already exists, updating boardList`);
            item.localThumbnail = outFilename;
            item.thumbnail = `/thum/${outFilename}`;
            processed++;
            return;
          }

          // find a video file for this id
          const vid = videoFiles.find((f) => f.startsWith(`${id}_video_`));
          if (!vid) {
            console.warn(`[${id}] no downloaded video found, skipping`);
            return;
          }

          const videoPath = path.join(SAVE_DIR_VIDEOS, vid);
          if (!(await fs.pathExists(videoPath))) {
            console.warn(`[${id}] video path missing: ${videoPath}`);
            return;
          }

          console.log(
            `[${id}] extracting thumbnail from ${vid} -> ${outFilename}`
          );
          try {
            await extractThumbnail(videoPath, outPath);
            // small delay to ensure FS stability
            await delay(200);
            item.localThumbnail = outFilename;
            item.thumbnail = `/thum/${outFilename}`;
            processed++;
            console.log(`[${id}] done`);
          } catch (err) {
            console.error(`[${id}] ffmpeg failed:`, err);
          }
        } catch (err) {
          console.error(`[${item.id}] unexpected error:`, err);
        }
      })
    )
  );

  // Save updated board
  await fs.writeJson(BOARD_LIST_FILE, board, { spaces: 2 });
  console.log(
    `generate-thumbs: completed. processed ${processed}/${targets.length}`
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
