import fs from "fs-extra";
import path from "path";
import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";

// Configure ffmpeg path
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath as string);
}

// Config - adjust these if you want different locations
const BOARD_LIST_FILE = path.resolve(__dirname, "..", "boardList.json");
const SAVE_DIR_IMAGES = path.resolve("C:\\Users\\youngkyun\\Pictures");
const SAVE_DIR_VIDEOS = path.resolve("C:\\Users\\youngkyun\\Videos");
const CONCURRENCY = 5;

type BoardItem = {
  id: number;
  title?: string;
  date?: string;
  thumbnail?: string;
  url?: string;
  imgs?: string[];
  videos?: string[];
  localThumbnail?: string; // filename relative to images dir
};

type DownloadTask = {
  url: string;
  savePath: string;
  type: "image" | "video";
  itemId: number;
  index: number; // 1-based index for naming
};

async function ensureDirs() {
  await fs.ensureDir(SAVE_DIR_IMAGES);
  await fs.ensureDir(SAVE_DIR_VIDEOS);
}

async function loadBoardList(): Promise<BoardItem[]> {
  if (!(await fs.pathExists(BOARD_LIST_FILE))) {
    throw new Error(`Missing board list: ${BOARD_LIST_FILE}`);
  }
  const data = await fs.readJson(BOARD_LIST_FILE);
  if (!Array.isArray(data)) throw new Error("boardList.json is not an array");
  return data as BoardItem[];
}

function extensionFromUrl(url: string, fallback: string) {
  try {
    const clean = url.split("?")[0];
    const ext = path.extname(clean).split("#")[0];
    return ext || fallback;
  } catch {
    return fallback;
  }
}

async function downloadFile(url: string, savePath: string) {
  const writer = fs.createWriteStream(savePath);
  const response = await axios({
    url,
    method: "GET",
    responseType: "stream",
    timeout: 60000,
  });
  response.data.pipe(writer);
  await new Promise<void>((resolve, reject) => {
    writer.on("finish", () => resolve());
    writer.on("error", reject);
    response.data.on("error", reject);
  });
}

async function extractThumbnailFromVideo(videoPath: string, thumbPath: string) {
  await new Promise<void>((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        count: 1,
        folder: path.dirname(thumbPath),
        filename: path.basename(thumbPath),
        size: "320x?",
      })
      .on("end", () => resolve())
      .on("error", (err: Error) => reject(err));
  });
}

async function buildQueue(boardList: BoardItem[]): Promise<DownloadTask[]> {
  const queue: DownloadTask[] = [];
  for (const item of boardList) {
    const id = item.id;
    if (Array.isArray(item.imgs)) {
      item.imgs.forEach((url, i) => {
        if (!url) return;
        const ext = extensionFromUrl(url, ".jpg");
        const filename = `${id}_img_${i + 1}${ext}`;
        queue.push({
          url,
          savePath: path.join(SAVE_DIR_IMAGES, filename),
          type: "image",
          itemId: id,
          index: i + 1,
        });
      });
    }
    if (Array.isArray(item.videos)) {
      item.videos.forEach((url, i) => {
        if (!url) return;
        const ext = extensionFromUrl(url, ".mp4");
        const filename = `${id}_video_${i + 1}${ext}`;
        queue.push({
          url,
          savePath: path.join(SAVE_DIR_VIDEOS, filename),
          type: "video",
          itemId: id,
          index: i + 1,
        });
      });
    }
  }
  return queue;
}

async function saveBoardList(boardList: BoardItem[]) {
  await fs.writeJson(BOARD_LIST_FILE, boardList, { spaces: 2 });
}

async function run() {
  console.log("Starting download worker...");
  await ensureDirs();

  const boardList = await loadBoardList();
  const boardIndex = new Map<number, BoardItem>();
  boardList.forEach((b) => boardIndex.set(b.id, b));

  const queue = await buildQueue(boardList);
  console.log(`Total files to download: ${queue.length}`);

  let completed = 0;
  const total = queue.length;

  // Create worker functions
  const workers: Promise<void>[] = [];

  for (let w = 0; w < CONCURRENCY; w++) {
    const worker = (async () => {
      while (true) {
        const task = queue.shift();
        if (!task) break;
        try {
          if (await fs.pathExists(task.savePath)) {
            // file exists, skip
            completed++;
            if (completed % 10 === 0 || completed === total)
              console.log(`Progress: ${completed}/${total}`);
            continue;
          }
          // Ensure parent dir exists (should already)
          await fs.ensureDir(path.dirname(task.savePath));
          console.log(
            `Downloading ${task.type} for item ${task.itemId}: ${task.url}`
          );
          await downloadFile(task.url, task.savePath);

          // If video, possibly extract thumbnail
          if (task.type === "video") {
            const item = boardIndex.get(task.itemId);
            if (item && !item.thumbnail && !item.localThumbnail) {
              const thumbFilename = `${item.id}_thumb.jpg`;
              const thumbPath = path.join(SAVE_DIR_IMAGES, thumbFilename);
              try {
                console.log(
                  `Extracting thumbnail for ${item.id} from ${task.savePath}`
                );
                await extractThumbnailFromVideo(task.savePath, thumbPath);
                item.localThumbnail = thumbFilename; // filename only
                // Also update thumbnail field to local path so UI can reference
                item.thumbnail = `/api/media/images/${thumbFilename}`;
              } catch (err) {
                console.warn(
                  `Failed to extract thumbnail for ${item.id}:`,
                  err
                );
              }
            }
          }

          completed++;
          if (completed % 10 === 0 || completed === total) {
            console.log(`Progress: ${completed}/${total}`);
            // Persist boardList periodically
            await saveBoardList(boardList);
          }
        } catch (err) {
          console.error(
            `Failed downloading ${task.url}:`,
            err instanceof Error ? err.message : err
          );
        }
      }
    })();
    workers.push(worker);
  }

  await Promise.all(workers);

  // Final save
  await saveBoardList(boardList);
  console.log("Download complete.");
}

run().catch((err) => {
  console.error("Fatal error in download script:", err);
  process.exit(1);
});
