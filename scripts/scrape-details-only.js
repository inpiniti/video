const puppeteer = require('puppeteer');
const fs = require('fs-extra');

// Configuration
const BOARD_LIST_FILE = 'boardList.json';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
    console.log('Starting detail page scraper...');

    // Load existing boardList
    if (!await fs.pathExists(BOARD_LIST_FILE)) {
        console.error('boardList.json not found!');
        return;
    }

    let boardList = await fs.readJson(BOARD_LIST_FILE);
    console.log(`Loaded ${boardList.length} posts from boardList.json`);

    // Reset imgs and videos for all posts to start fresh
    console.log('Resetting all imgs and videos arrays...');
    boardList.forEach(item => {
        item.imgs = [];
        item.videos = [];
    });

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

        console.log(`[${i + 1}/${boardList.length}] Scraping ID ${item.id}: ${item.title}`);

        try {
            await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await delay(1000);

            const media = await page.evaluate(() => {
                const images = [];
                const videos = [];

                function fixUrl(url) {
                    if (!url) return null;
                    if (url.startsWith('http')) return url;
                    if (url.startsWith('//')) return 'https:' + url;
                    return 'https://coomer.st' + url;
                }

                // Images: ONLY from a.fileThumb.image-link
                const imageLinks = document.querySelectorAll('a.fileThumb.image-link[href]');
                for (const el of imageLinks) {
                    const href = fixUrl(el.getAttribute('href'));
                    if (href && !images.includes(href)) {
                        images.push(href);
                    }
                }

                // Videos: ONLY from a.post__attachment-link
                const videoLinks = document.querySelectorAll('a.post__attachment-link[href]');
                for (const el of videoLinks) {
                    const href = fixUrl(el.getAttribute('href'));
                    if (href && href.match(/\.(mp4|m4v|mov|webm)$/i) && !videos.includes(href)) {
                        videos.push(href);
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
            console.error(`  Error scraping ID ${item.id}:`, error.message);
        }
    }

    await browser.close();
    await fs.writeJson(BOARD_LIST_FILE, boardList, { spaces: 2 });
    console.log(`\nCompleted! Scraped ${scrapedCount} posts.`);
    console.log(`Updated ${BOARD_LIST_FILE}`);
}

main().catch(console.error);
