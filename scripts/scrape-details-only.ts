import puppeteer from 'puppeteer';
import fs from 'fs-extra';

// Configuration
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
    localThumbnail?: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
    console.log('Starting detail page scraper...');

    // Load existing boardList
    if (!await fs.pathExists(BOARD_LIST_FILE)) {
        console.error('boardList.json not found!');
        return;
    }

    let boardList: BoardItem[] = await fs.readJson(BOARD_LIST_FILE);
    console.log(`Loaded ${boardList.length} posts from boardList.json`);

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    console.log('--- Scraping Details (Images & Videos) ---');

    let scrapedCount = 0;
    for (let i = 0; i < boardList.length; i++) {
        const item = boardList[i];

        // Skip if already scraped details
        if ((item.imgs && item.imgs.length > 0) || (item.videos && item.videos.length > 0)) {
            continue;
        }

        console.log(`[${i + 1}/${boardList.length}] Scraping ID ${item.id}: ${item.title}`);

        try {
            await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await delay(1000);

            const media = await page.evaluate(() => {
                const images: string[] = [];
                const videos: string[] = [];

                function fixUrl(url: string | null): string | null {
                    if (!url) return null;
                    if (url.startsWith('http')) return url;
                    if (url.startsWith('//')) return 'https:' + url;
                    return 'https://coomer.st' + url;
                }

                // Method 1: Videos ONLY from a.post__attachment-link
                const videoLinks = document.querySelectorAll('a.post__attachment-link[href]');
                for (const el of videoLinks) {
                    const anchor = el as HTMLAnchorElement;
                    const href = fixUrl(anchor.getAttribute('href'));
                    if (href && href.match(/\.(mp4|m4v|mov|webm)$/i) && !videos.includes(href)) {
                        videos.push(href);
                    }
                }

                // Method 2: Images from a.post__attachment-link
                const imageLinks = document.querySelectorAll('a.post__attachment-link[href]');
                for (const el of imageLinks) {
                    const anchor = el as HTMLAnchorElement;
                    const href = fixUrl(anchor.getAttribute('href'));
                    if (href && href.match(/\.(jpg|jpeg|png|gif|webp)$/i) && !images.includes(href)) {
                        images.push(href);
                    }
                }

                // Method 3: Images from all <a> tags (for cases without post__attachment-link)
                const allLinks = document.querySelectorAll('a[href]');
                for (const el of allLinks) {
                    const anchor = el as HTMLAnchorElement;
                    const href = fixUrl(anchor.getAttribute('href'));
                    if (href && href.match(/\.(jpg|jpeg|png|gif|webp)$/i) && !images.includes(href)) {
                        images.push(href);
                    }
                }

                // Method 4: Images from all <img> tags
                const allImages = document.querySelectorAll('img');
                for (const el of allImages) {
                    const img = el as HTMLImageElement;
                    const src = fixUrl(img.getAttribute('src'));
                    if (src && src.match(/\.(jpg|jpeg|png|gif|webp)$/i) && !images.includes(src)) {
                        images.push(src);
                    }
                }

                return { images, videos };
            });

            item.imgs = media.images;
            item.videos = media.videos;
            scrapedCount++;

            console.log(`  Found ${media.images.length} images, ${media.videos.length} videos`);

            // Save periodically
            if (scrapedCount % 10 === 0) {
                await fs.writeJson(BOARD_LIST_FILE, boardList, { spaces: 2 });
                console.log(`  Saved progress (${scrapedCount} posts scraped)`);
            }

            // Delay between requests
            await delay(500 + Math.random() * 500);

        } catch (error) {
            console.error(`  Error scraping ID ${item.id}:`, error);
        }
    }

    await browser.close();
    await fs.writeJson(BOARD_LIST_FILE, boardList, { spaces: 2 });
    console.log(`\nCompleted! Scraped ${scrapedCount} posts.`);
    console.log(`Updated ${BOARD_LIST_FILE}`);
}

main().catch(console.error);
