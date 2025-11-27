import fs from "fs-extra";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath as string);

const SAVE_DIR_IMAGES = "C:\\Users\\youngkyun\\Pictures";
const SAVE_DIR_VIDEOS = "C:\\Users\\youngkyun\\Videos";

async function extractThumbnail(videoPath: string, thumbPath: string) {
    console.log(`  ffmpeg input: ${videoPath}`);
    console.log(`  ffmpeg output folder: ${path.dirname(thumbPath)}`);
    console.log(`  ffmpeg output filename: ${path.basename(thumbPath)}`);

    await new Promise<void>((resolve, reject) => {
        ffmpeg(videoPath)
            .screenshots({
                count: 1,
                folder: path.dirname(thumbPath),
                filename: path.basename(thumbPath),
                size: "320x?",
            })
            .on("start", (cmd) => {
                console.log(`  ffmpeg command: ${cmd}`);
            })
            .on("end", () => {
                console.log("  ffmpeg finished");
                resolve();
            })
            .on("error", (err: Error) => {
                console.error("  ffmpeg error:", err);
                reject(err);
            });
    });
}

async function main() {
    const id = 53;
    const videoPath = path.join(SAVE_DIR_VIDEOS, `${id}_video_1.mp4`);
    const thumbPath = path.join(SAVE_DIR_IMAGES, `${id}_thumb.jpg`);

    console.log(`Video path: ${videoPath}`);
    console.log(`Thumb path: ${thumbPath}`);
    console.log(`Video exists: ${await fs.pathExists(videoPath)}`);
    console.log(`Thumb exists before: ${await fs.pathExists(thumbPath)}`);

    if (await fs.pathExists(videoPath)) {
        console.log("\nExtracting thumbnail...");
        try {
            await extractThumbnail(videoPath, thumbPath);
            console.log("✓ Success!");

            // Wait a bit for file system
            await new Promise(resolve => setTimeout(resolve, 500));

            console.log(`Thumb exists after: ${await fs.pathExists(thumbPath)}`);

            if (await fs.pathExists(thumbPath)) {
                const stats = await fs.stat(thumbPath);
                console.log(`Thumb file size: ${stats.size} bytes`);
            }
        } catch (err) {
            console.error("✗ Failed:", err);
        }
    }
}

main();
