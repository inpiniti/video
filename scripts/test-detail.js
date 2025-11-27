const puppeteer = require('puppeteer');

const BASE_URL = 'https://coomer.st';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function testPostDetail(postUrl, postId) {
    console.log(`\n=== Testing Post ID ${postId} ===`);
    console.log(`URL: ${postUrl}`);

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    try {
        await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await delay(3000); // Wait for dynamic content

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

            return {
                images,
                videos,
                counts: {
                    imageLinks: imageLinks.length,
                    videoLinks: videoLinks.length
                }
            };
        });

        console.log(`Element counts: image-links=${media.counts.imageLinks}, video-links=${media.counts.videoLinks}`);
        console.log(`Found ${media.images.length} images:`);
        media.images.forEach((img, i) => console.log(`  ${i + 1}. ${img}`));

        console.log(`Found ${media.videos.length} videos:`);
        media.videos.forEach((vid, i) => console.log(`  ${i + 1}. ${vid}`));

    } catch (error) {
        console.error(`Error testing post ${postId}:`, error);
    } finally {
        await browser.close();
    }
}

async function main() {
    // Test post ID 1 (should have 1 image)
    await testPostDetail('https://coomer.st/onlyfans/user/aom_yumi/post/1046662243', 1);

    // Test post ID 3 (should have 1 video)
    await testPostDetail('https://coomer.st/onlyfans/user/aom_yumi/post/1045045536', 3);
}

main().catch(console.error);
