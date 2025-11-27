import puppeteer from 'puppeteer';

const BASE_URL = 'https://coomer.st';
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function testPostDetail(postUrl: string, postId: number) {
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

            const fixUrl = (url) => {
                if (!url) return null;
                if (url.startsWith('http')) return url;
                if (url.startsWith('//')) return `https:${url}`;
                return `https://coomer.st${url}`;
            };

            // Method 1: .post__attachment
            const attachments = document.querySelectorAll('.post__attachment');
            for (const el of attachments) {
                const href = el.getAttribute('href');
                const imgEl = el.querySelector('img');
                const src = imgEl ? imgEl.getAttribute('src') : null;

                const link = href || src;
                if (link) {
                    const fullLink = fixUrl(link);
                    if (fullLink && fullLink.match(/\.(mp4|m4v|mov|webm)$/i)) {
                        videos.push(fullLink);
                    } else if (fullLink && fullLink.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                        images.push(fullLink);
                    }
                }
            }

            // Method 2: All <a> tags with href containing file extensions
            const allLinks = document.querySelectorAll('a[href]');
            for (const el of allLinks) {
                const href = el.getAttribute('href');
                if (href) {
                    const fullLink = fixUrl(href);
                    if (fullLink && fullLink.match(/\.(mp4|m4v|mov|webm)$/i) && !videos.includes(fullLink)) {
                        videos.push(fullLink);
                    } else if (fullLink && fullLink.match(/\.(jpg|jpeg|png|gif|webp)$/i) && !images.includes(fullLink)) {
                        images.push(fullLink);
                    }
                }
            }

            // Method 3: All <img> tags
            const allImages = document.querySelectorAll('img');
            for (const el of allImages) {
                const src = el.getAttribute('src');
                if (src) {
                    const fullLink = fixUrl(src);
                    if (fullLink && fullLink.match(/\.(jpg|jpeg|png|gif|webp)$/i) && !images.includes(fullLink)) {
                        images.push(fullLink);
                    }
                }
            }

            // Method 4: <video> and <source> tags
            const videoElements = document.querySelectorAll('video, source');
            for (const el of videoElements) {
                const src = el.getAttribute('src');
                if (src) {
                    const fullLink = fixUrl(src);
                    if (fullLink && !videos.includes(fullLink)) {
                        videos.push(fullLink);
                    }
                }
            }

            return {
                images,
                videos,
                counts: {
                    attachments: attachments.length,
                    links: allLinks.length,
                    imgs: allImages.length,
                    videoElements: videoElements.length
                }
            };
        });

        console.log(`Element counts: attachments=${media.counts.attachments}, links=${media.counts.links}, imgs=${media.counts.imgs}, videos=${media.counts.videoElements}`);
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
    // Test post ID 1 (should have images)
    await testPostDetail('https://coomer.st/onlyfans/user/aom_yumi/post/1046662243', 1);

    // Test post ID 3 (should have video)
    await testPostDetail('https://coomer.st/onlyfans/user/aom_yumi/post/1045045536', 3);
}

main().catch(console.error);
