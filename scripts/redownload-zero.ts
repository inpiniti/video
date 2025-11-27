import fs from "fs-extra";
import path from "path";
import axios from "axios";
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
const CONCURRENCY = 5;

type BoardItem = {
  id: number;
  title?: string;
  date?: string;
  thumbnail?: string;
  url?: string;
  imgs?: string[];
  videos?: string[];
  localThumbnail?: string;
};

type Task = {
  url: string;
  savePath: string;
  type: "image" | "video";
  itemId: number;
  index: number;
};

async function loadBoardList(): Promise<BoardItem[]> {
  if (!(await fs.pathExists(BOARD_LIST_FILE))) {
    throw new Error(`Missing board list: ${BOARD_LIST_FILE}`);
  }
  const data = await fs.readJson(BOARD_LIST_FILE);
  if (!Array.isArray(data)) throw new Error("boardList.json is not an array");
  return data as BoardItem[];
}

function buildLookup(boardList: BoardItem[]) {
  const imgs = new Map<string, string>();
  const vids = new Map<string, string>();
  for (const item of boardList) {
    const id = item.id;
    if (Array.isArray(item.imgs)) {
      item.imgs.forEach((u, i) => {
        if (!u) return;
        imgs.set(`${id}_img_${i + 1}`, u);
      });
    }
    if (Array.isArray(item.videos)) {
      item.videos.forEach((u, i) => {
        if (!u) return;
        vids.set(`${id}_video_${i + 1}`, u);
      });
    }
  }
  return { imgs, vids };
}

async function downloadFile(url: string, savePath: string) {
  await fs.ensureDir(path.dirname(savePath));
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

function scanZeroFiles(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const zeroFiles: string[] = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    const fp = path.join(dir, e.name);
    try {
      const st = fs.statSync(fp);
      if (st.size === 0) zeroFiles.push(e.name);
    } catch {
      // ignore
    }
  }
  return zeroFiles;
}

async function run() {
  console.log("Scanning for 0-byte files to re-download...");
  await fs.ensureDir(SAVE_DIR_IMAGES);
  await fs.ensureDir(SAVE_DIR_VIDEOS);

  const boardList = await loadBoardList();
  const boardIndex = new Map<number, BoardItem>();
  boardList.forEach((b) => boardIndex.set(b.id, b));

  const { imgs: imgsMap, vids: vidsMap } = buildLookup(boardList);

  const zeroImgs = scanZeroFiles(SAVE_DIR_IMAGES);
  const zeroVids = scanZeroFiles(SAVE_DIR_VIDEOS);

  const tasks: Task[] = [];

  const imgRegex = /^(\d+)_img_(\d+)(\..+)?$/;
  const vidRegex = /^(\d+)_video_(\d+)(\..+)?$/i;

  for (const fname of zeroImgs) {
    const m = fname.match(imgRegex);
    if (!m) continue;
    const key = `${m[1]}_img_${m[2]}`;
    const url = imgsMap.get(key);
    const filePath = path.join(SAVE_DIR_IMAGES, fname);
    if (!url) {
      console.warn(
        `No source URL found in boardList for image ${fname} (key ${key}), skipping`
      );
      continue;
    }
    try {
      await fs.remove(filePath);
      tasks.push({
        url,
        savePath: filePath,
        type: "image",
        itemId: Number(m[1]),
        index: Number(m[2]),
      });
    } catch (err) {
      console.warn(`Failed removing ${filePath}:`, err);
    }
  }

  for (const fname of zeroVids) {
    const m = fname.match(vidRegex);
    if (!m) continue;
    const key = `${m[1]}_video_${m[2]}`;
    const url = vidsMap.get(key);
    const filePath = path.join(SAVE_DIR_VIDEOS, fname);
    if (!url) {
      console.warn(
        `No source URL found in boardList for video ${fname} (key ${key}), skipping`
      );
      continue;
    }
    try {
      await fs.remove(filePath);
      tasks.push({
        url,
        savePath: filePath,
        type: "video",
        itemId: Number(m[1]),
        index: Number(m[2]),
      });
    } catch (err) {
      console.warn(`Failed removing ${filePath}:`, err);
    }
  }

  if (tasks.length === 0) {
    console.log("No 0-byte files found. Nothing to do.");
    return;
  }

  console.log(`Found ${tasks.length} files to re-download.`);

  let completed = 0;
  const total = tasks.length;

  // workers
  const workers: Promise<void>[] = [];
  for (let w = 0; w < CONCURRENCY; w++) {
    const worker = (async () => {
      while (true) {
        const task = tasks.shift();
        if (!task) break;
        try {
          console.log(
            `Downloading ${task.type} for item ${task.itemId}: ${task.url}`
          );
          await downloadFile(task.url, task.savePath);

          if (task.type === "video") {
            const item = boardIndex.get(task.itemId);
            if (item) {
              const thumbFilename = `${item.id}_thumb.jpg`;
              const thumbPath = path.join(SAVE_DIR_IMAGES, thumbFilename);
              try {
                console.log(
                  `Extracting thumbnail for ${item.id} from ${task.savePath}`
                );
                await extractThumbnailFromVideo(task.savePath, thumbPath);
                item.localThumbnail = thumbFilename;
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
          if (completed % 5 === 0 || completed === total) {
            console.log(`Progress: ${completed}/${total}`);
            await fs.writeJson(BOARD_LIST_FILE, boardList, { spaces: 2 });
          }
        } catch (err) {
          console.error(
            `Failed task ${task.url}:`,
            err instanceof Error ? err.message : err
          );
        }
      }
    })();
    workers.push(worker);
  }

  await Promise.all(workers);

  // final save
  await fs.writeJson(BOARD_LIST_FILE, boardList, { spaces: 2 });
  console.log("Re-download of 0-byte files complete.");
}

run().catch((err) => {
  console.error("Fatal error in redownload-zero script:", err);
  process.exit(1);
});
