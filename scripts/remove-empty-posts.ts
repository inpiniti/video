import fs from "fs-extra";
import path from "path";

const BOARD_LIST_FILE = path.resolve(__dirname, "..", "boardList.json");

type BoardItem = {
    id: number;
    title?: string;
    imgs?: string[];
    videos?: string[];
    [key: string]: unknown;
};

async function run() {
    console.log("=== Remove Empty Posts Script ===\n");

    if (!(await fs.pathExists(BOARD_LIST_FILE))) {
        console.error("boardList.json not found");
        process.exit(1);
    }

    const boardList = (await fs.readJson(BOARD_LIST_FILE)) as BoardItem[];
    console.log(`Total items before: ${boardList.length}`);

    // Filter items that have either images or videos
    const nonEmptyPosts = boardList.filter((item) => {
        const hasImages = Array.isArray(item.imgs) && item.imgs.length > 0;
        const hasVideos = Array.isArray(item.videos) && item.videos.length > 0;
        return hasImages || hasVideos;
    });

    const removedCount = boardList.length - nonEmptyPosts.length;

    if (removedCount > 0) {
        // Identify removed items for logging
        const removedItems = boardList.filter((item) => {
            const hasImages = Array.isArray(item.imgs) && item.imgs.length > 0;
            const hasVideos = Array.isArray(item.videos) && item.videos.length > 0;
            return !(hasImages || hasVideos);
        });

        console.log(
            `\nRemoving ${removedCount} items that have no images and no videos:`
        );
        removedItems.forEach((item) => {
            console.log(`- ID ${item.id}: ${item.title || "(no title)"}`);
        });

        // Save the filtered list
        // We are NOT re-indexing IDs, just saving the subset of items.
        await fs.writeJson(BOARD_LIST_FILE, nonEmptyPosts, { spaces: 2 });
        console.log(
            `\n✓ Saved boardList.json. Total items now: ${nonEmptyPosts.length}`
        );
    } else {
        console.log("\nNo empty posts found. Nothing to remove.");
    }
}

run().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
