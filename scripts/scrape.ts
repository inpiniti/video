import puppeteer from 'puppeteer';
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import pLimit from 'p-limit';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

// Set ffmpeg path
if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
}

// Configuration
const BASE_URL = 'https://coomer.st';
const USER_URL = 'https://coomer.st/onlyfans/user/aom_yumi';
const START_PAGE_OFFSET = 0;
const END_PAGE_OFFSET = 1850;
const STEP = 50;

const SAVE_DIR_IMAGES = 'C:\\Users\\youngkyun\\Pictures';
const SAVE_DIR_VIDEOS = 'C:\\Users\\youngkyun\\Videos';
const BOARD_LIST_FILE = 'boardList.json';

// Types
interface BoardItem {
    id: number;
    title: string;
    date: string;
    thumbnail: string;
    url: string;
    imgs?: string[];
    videos?: string[];
    localThumbnail?: string; // New field for local thumbnail path
}

interface DownloadTask {
    url: string;
    savePath: string;
    type: 'image' | 'video';
    itemId: number; // To link back for thumbnail extraction
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
    console.log('Starting scraper with Puppeteer...');

    // Ensure directories exist
    await fs.ensureDir(SAVE_DIR_IMAGES);
    await fs.ensureDir(SAVE_DIR_VIDEOS);

    let boardList: BoardItem[] = [];
    let currentId = 1;

    // Load existing boardList if available (Resume capability)
    if (await fs.pathExists(BOARD_LIST_FILE)) {
        try {
            boardList = await fs.readJson(BOARD_LIST_FILE);
            console.log(`Loaded ${boardList.length} existing posts.`);
            if (boardList.length > 0) {
                currentId = Math.max(...boardList.map(b => b.id)) + 1;
            }
        } catch (e) {
            console.warn('Failed to load existing boardList.json, starting fresh.');
        }
    }

    const browser = await puppeteer.launch({
        headless: true, // Set to false if you want to see the browser
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Set a reasonable viewport and user agent
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // --- Phase 1: Scrape Board List ---
    console.log('--- Phase 1: Scraping Board List ---');

    // Check which pages we might have missed or just scan all to be safe?
    // Since we want to ensure we have everything, scanning all pages is safer but slower.
    // Optimization: If we find a post that already exists, we might stop if we assume chronological order.
    // But these sites can be shuffled or have pinned posts. Let's scan all for now, but skip adding duplicates.

    for (let offset = START_PAGE_OFFSET; offset <= END_PAGE_OFFSET; offset += STEP) {
        const pageUrl = offset === 0 ? USER_URL : `${USER_URL}?o=${offset}`;
        console.log(`Fetching page: ${pageUrl}`);

        try {
            await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 60000 });

            // Wait for posts to load
            try {
                await page.waitForSelector('a.fancy-link', { timeout: 10000 });
            } catch (e) {
                console.warn(`Timeout waiting for selector on ${pageUrl}. Moving on...`);
            }

            // Extract data from the page context
            const posts = await page.evaluate((baseUrl) => {
                const items: any[] = [];
                const elements = document.querySelectorAll('a.fancy-link');

                elements.forEach((el) => {
                    const anchor = el as HTMLAnchorElement;
                    const href = anchor.getAttribute('href');
                    if (!href || !href.includes('/post/')) return;

                    const titleEl = anchor.querySelector('.post-card__header');
                    const timeEl = anchor.querySelector('time');
                    const imgEl = anchor.querySelector('img');
                    const videoEl = anchor.querySelector('video');

                    const title = titleEl ? titleEl.textContent?.trim() : 'No Title';
                    const date = timeEl ? (timeEl.getAttribute('datetime') || timeEl.textContent?.trim()) : 'Unknown Date';

                    let thumbnail = '';
                    if (imgEl) thumbnail = imgEl.getAttribute('src') || '';
                    else if (videoEl) thumbnail = videoEl.getAttribute('poster') || '';

                    // Fix thumbnail URL
                    if (thumbnail && !thumbnail.startsWith('http')) {
                        thumbnail = thumbnail.startsWith('//') ? `https:${thumbnail}` : `${baseUrl}${thumbnail}`;
                    }

                    const fullUrl = href.startsWith('http') ? href : `${baseUrl}${href}`;

                    items.push({
                        title,
                        date,
                        thumbnail,
                        url: fullUrl,
                    });
                });
                return items;
            }, BASE_URL);

            if (posts.length === 0) {
                console.warn(`No posts found on page ${offset}.`);
            } else {
                console.log(`Found ${posts.length} posts on page ${offset}.`);
            }

            let newPostsCount = 0;
            for (const post of posts) {
                // Avoid duplicates if any
                if (!boardList.find(b => b.url === post.url)) {
                    boardList.push({
                        id: currentId++,
                        ...post,
                        imgs: [],
                        videos: []
                    });
                    newPostsCount++;
                }
            }
            console.log(`Added ${newPostsCount} new posts.`);

        } catch (error) {
            console.error(`Error fetching page ${pageUrl}:`, error);
        }

        // Random delay to mimic human behavior
        await delay(1000 + Math.random() * 1000);
    }

    console.log(`Total posts collected: ${boardList.length}`);

    // --- Phase 2: Scrape Details ---
    console.log('--- Phase 2: Scraping Details (Images & Videos) ---');

    // For details, we can reuse the single page instance or open multiple tabs.
    // To be safe and resource-friendly, let's use the single page sequentially or with small concurrency.
    // Puppeteer concurrency is heavy. Let's do sequential for safety or use a small pool.
    // Given the number of posts (50 * 37 = 1850), sequential might take too long.
    // Let's try to use the same browser page but iterate.

    for (let i = 0; i < boardList.length; i++) {
        const item = boardList[i];

        // Skip if already scraped details
        if (item.imgs && item.imgs.length > 0 || item.videos && item.videos.length > 0) {
            continue;
        }

        console.log(`[${i + 1}/${boardList.length}] Scraping details for ID ${item.id}: ${item.title}`);

        try {
            await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

            // Wait a bit for dynamic content
            await delay(500);

            const media = await page.evaluate(() => {
                const images: string[] = [];
                const videos: string[] = [];

                // Helper to fix URLs
                function fixUrl(url: string | null): string | null {
                    if (!url) return null;
                    if (url.startsWith('http')) return url;
                    if (url.startsWith('//')) return 'https:' + url;
                    return 'https://coomer.st' + url;
                }

                // Method 1: .post__attachment
                const attachments = document.querySelectorAll('.post__attachment');
                for (const el of attachments) {
                    const anchor = el as HTMLAnchorElement;
                    const href = fixUrl(anchor.getAttribute('href'));
                    const imgEl = anchor.querySelector('img');
                    const src = fixUrl(imgEl ? imgEl.getAttribute('src') : null);

                    const link = href || src;
                    if (link) {
                        if (link.match(/\.(mp4|m4v|mov|webm)$/i)) {
                            videos.push(link);
                        } else if (link.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                            images.push(link);
                        }
                    }
                }

                // Method 2: All <a> tags with href containing file extensions
                const allLinks = document.querySelectorAll('a[href]');
                for (const el of allLinks) {
                    const anchor = el as HTMLAnchorElement;
                    const href = fixUrl(anchor.getAttribute('href'));
                    if (href) {
                        if (href.match(/\.(mp4|m4v|mov|webm)$/i) && !videos.includes(href)) {
                            videos.push(href);
                        } else if (href.match(/\.(jpg|jpeg|png|gif|webp)$/i) && !images.includes(href)) {
                            images.push(href);
                        }
                    }
                }

                // Method 3: All <img> tags
                const allImages = document.querySelectorAll('img');
                for (const el of allImages) {
                    const img = el as HTMLImageElement;
                    const src = fixUrl(img.getAttribute('src'));
                    if (src && src.match(/\.(jpg|jpeg|png|gif|webp)$/i) && !images.includes(src)) {
                        images.push(src);
                    }
                }

                // Method 4: <video> and <source> tags
                const videoElements = document.querySelectorAll('video, source');
                for (const el of videoElements) {
                    const src = fixUrl(el.getAttribute('src'));
                    if (src && !videos.includes(src)) {
                        videos.push(src);
                    }
                }

                return { images, videos };
            });

            item.imgs = media.images;
            item.videos = media.videos;

            // Save periodically
            if (i % 10 === 0) {
                await fs.writeJson(BOARD_LIST_FILE, boardList, { spaces: 2 });
            }

        } catch (error) {
            console.error(`Error scraping details for ${item.id}:`, error);
        }
    }

    await browser.close();
    await fs.writeJson(BOARD_LIST_FILE, boardList, { spaces: 2 });
    console.log(`Saved ${BOARD_LIST_FILE}`);

    // --- Phase 3: Downloading & Processing ---
    console.log('--- Phase 3: Downloading Files & Extracting Thumbnails ---');

    const downloadQueue: DownloadTask[] = [];

    boardList.forEach((item) => {
        // Images
        item.imgs?.forEach((url, index) => {
            // Clean query params for extension detection
            const cleanUrl = url.split('?')[0];
            const ext = path.extname(cleanUrl) || '.jpg';
            const filename = `${item.id}_img_${index + 1}${ext}`;
            downloadQueue.push({
                url,
                savePath: path.join(SAVE_DIR_IMAGES, filename),
                type: 'image',
                itemId: item.id
            });
        });

        // Videos
        item.videos?.forEach((url, index) => {
            const cleanUrl = url.split('?')[0];
            const ext = path.extname(cleanUrl) || '.mp4';
            const filename = `${item.id}_video_${index + 1}${ext}`;
            downloadQueue.push({
                url,
                savePath: path.join(SAVE_DIR_VIDEOS, filename),
                type: 'video',
                itemId: item.id
            });
        });
    });

    console.log(`Total files to download: ${downloadQueue.length}`);

    const downloadLimit = pLimit(5); // User requested 5 concurrent downloads

    let completed = 0;
    const total = downloadQueue.length;

    await Promise.all(downloadQueue.map((task) => downloadLimit(async () => {
        try {
            let downloaded = false;
            if (await fs.pathExists(task.savePath)) {
                // console.log(`Skipping existing file: ${task.savePath}`);
                downloaded = true;
            } else {
                const response = await axios({
                    url: task.url,
                    method: 'GET',
                    responseType: 'stream',
                    timeout: 60000,
                });

                const writer = fs.createWriteStream(task.savePath);
                response.data.pipe(writer);

                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });
                downloaded = true;
            }

            // Thumbnail Extraction Logic
            if (downloaded && task.type === 'video') {
                const item = boardList.find(b => b.id === task.itemId);
                if (item && !item.thumbnail && !item.localThumbnail) {
                    const thumbFilename = `${item.id}_thumb.jpg`;
                    const thumbPath = path.join(SAVE_DIR_IMAGES, thumbFilename);

                    if (!await fs.pathExists(thumbPath)) {
                        console.log(`Extracting thumbnail for ID ${item.id} from video...`);
                        try {
                            await new Promise((resolve, reject) => {
                                ffmpeg(task.savePath)
                                    .screenshots({
                                        count: 1,
                                        folder: SAVE_DIR_IMAGES,
                                        filename: thumbFilename,
                                        size: '320x?'
                                    })
                                    .on('end', resolve)
                                    .on('error', reject);
                            });
                            item.localThumbnail = thumbFilename; // Store filename only, relative to images dir
                        } catch (err) {
                            console.error(`Failed to extract thumbnail for ${item.id}:`, err);
                        }
                    } else {
                        item.localThumbnail = thumbFilename;
                    }
                }
            }

            completed++;
            if (completed % 10 === 0 || completed === total) {
                console.log(`Progress: ${completed}/${total}`);
                // Periodically save boardList to update localThumbnail
                await fs.writeJson(BOARD_LIST_FILE, boardList, { spaces: 2 });
            }
        } catch (error) {
            console.error(`Failed to download ${task.url}:`, error);
        }
    })));

    // Final save
    await fs.writeJson(BOARD_LIST_FILE, boardList, { spaces: 2 });
    console.log('All operations completed!');
}

main().catch(console.error);
