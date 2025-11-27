import fs from 'fs-extra';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from 'ffmpeg-static';
import { Dropbox, DropboxAuth } from 'dropbox';
import pLimit from 'p-limit';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller as string);

const BOARD_LIST_FILE = path.join(process.cwd(), 'boardList.json');
const DROPBOX_CONFIG_FILE = path.join(process.cwd(), 'dropbox-config.json');
const TEMP_DIR = path.join(process.cwd(), 'temp_upload');
const PICTURES_DIR = 'C:\\Users\\youngkyun\\Pictures';
const VIDEOS_DIR = 'C:\\Users\\youngkyun\\Videos';

// Concurrency limit
const CONCURRENCY = 5;
const limit = pLimit(CONCURRENCY);

interface Post {
    id: number;
    thumbnail: string;
    imgs?: string[];
    videos?: string[];
    dropboxImgs?: string[];
    dropboxVideos?: string[];
    dropboxAccount?: string;
    localThumbnail?: string;
}

interface DropboxAccount {
    name: string;
    client: Dropbox;
    freeSpace: number;
    existingFiles: Set<string>; // Set of filenames (e.g., "1_img_1.webp")
}

// Mutex for saving
let isSaving = false;
async function saveBoardList(posts: Post[]) {
    while (isSaving) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    isSaving = true;
    try {
        await fs.writeJson(BOARD_LIST_FILE, posts, { spaces: 2 });
    } finally {
        isSaving = false;
    }
}

async function getDropboxClients(): Promise<DropboxAccount[]> {
    if (!await fs.pathExists(DROPBOX_CONFIG_FILE)) {
        throw new Error('Dropbox config not found. Run setup-dropbox.ts first.');
    }
    const config = await fs.readJson(DROPBOX_CONFIG_FILE);
    const accounts: DropboxAccount[] = [];

    for (const acc of config.accounts) {
        const auth = new DropboxAuth({
            clientId: acc.appKey,
            clientSecret: acc.appSecret,
            refreshToken: acc.refreshToken,
        });

        const client = new Dropbox({ auth });

        // Check quota & List existing files
        try {
            const space = await client.usersGetSpaceUsage();
            let total = 0;
            if (space.result.allocation['.tag'] === 'individual') {
                total = space.result.allocation.allocated;
            } else if (space.result.allocation['.tag'] === 'team') {
                total = space.result.allocation.allocated;
            }
            const used = space.result.used || 0;
            const freeSpace = total - used;

            console.log(`[${acc.name}] Free space: ${(freeSpace / 1024 / 1024).toFixed(2)} MB`);

            // List existing files
            console.log(`[${acc.name}] Fetching file list...`);
            const existingFiles = new Set<string>();
            let hasMore = true;
            let cursor: string | undefined = undefined;

            while (hasMore) {
                const res: any = cursor
                    ? await client.filesListFolderContinue({ cursor })
                    : await client.filesListFolder({ path: '', recursive: true });

                for (const entry of res.result.entries) {
                    if (entry['.tag'] === 'file') {
                        existingFiles.add(entry.name);
                    }
                }

                hasMore = res.result.has_more;
                cursor = res.result.cursor;
            }
            console.log(`[${acc.name}] Found ${existingFiles.size} existing files.`);

            accounts.push({
                name: acc.name,
                client,
                freeSpace,
                existingFiles
            });
        } catch (err) {
            console.error(`Failed to init ${acc.name}:`, err);
        }
    }

    return accounts.sort((a, b) => b.freeSpace - a.freeSpace);
}

async function processAndUpload() {
    console.log('Initializing Dropbox clients...');
    const dbxAccounts = await getDropboxClients();
    if (dbxAccounts.length === 0) {
        console.error('No valid Dropbox accounts available.');
        return;
    }

    if (!await fs.pathExists(BOARD_LIST_FILE)) {
        console.error('boardList.json not found');
        return;
    }
    const posts: Post[] = await fs.readJson(BOARD_LIST_FILE);
    await fs.ensureDir(TEMP_DIR);

    let processedCount = 0;
    const tasks: Promise<void>[] = [];

    for (const post of posts) {
        tasks.push(limit(async () => {
            let changed = false;

            // Initialize arrays if missing
            if (!post.dropboxImgs) post.dropboxImgs = [];
            if (!post.dropboxVideos) post.dropboxVideos = [];

            // Process Thumbnail (for video posts with local thumbnail)
            if (post.thumbnail && post.thumbnail.startsWith('/api/media/images')) {
                const thumbnailFilename = path.basename(post.thumbnail);
                const localThumbPath = path.join(PICTURES_DIR, thumbnailFilename);

                // Check if thumbnail exists in any Dropbox account
                let foundAccount = dbxAccounts.find(acc => acc.existingFiles.has(thumbnailFilename));

                if (foundAccount) {
                    console.log(`[Skip Upload] ${thumbnailFilename} found in ${foundAccount.name}`);
                    const link = await getSharedLink(foundAccount, `/${thumbnailFilename}`);
                    post.thumbnail = link;
                    changed = true;
                } else if (await fs.pathExists(localThumbPath)) {
                    // Need to upload thumbnail
                    dbxAccounts.sort((a, b) => b.freeSpace - a.freeSpace);
                    const targetAccount = dbxAccounts[0];

                    if (targetAccount.freeSpace < 10 * 1024 * 1024) {
                        console.error(`[Full] Cannot upload ${thumbnailFilename}`);
                    } else {
                        const tempPath = path.join(TEMP_DIR, thumbnailFilename);
                        try {
                            console.log(`[Compress Thumbnail] ${thumbnailFilename}`);
                            // Compress thumbnail to WebP
                            const webpFilename = thumbnailFilename.replace(/\.(jpg|jpeg|png)$/i, '.webp');
                            const tempWebpPath = path.join(TEMP_DIR, webpFilename);
                            await convertToWebP(localThumbPath, tempWebpPath);

                            console.log(`[Upload Thumbnail] ${webpFilename} to ${targetAccount.name}`);
                            const link = await uploadToDropbox(targetAccount, tempWebpPath, `/${webpFilename}`);

                            post.thumbnail = link;
                            targetAccount.existingFiles.add(webpFilename);
                            targetAccount.freeSpace -= (await fs.stat(tempWebpPath)).size;
                            await fs.remove(tempWebpPath);
                            changed = true;
                        } catch (err) {
                            console.error(`Error processing thumbnail ${thumbnailFilename}:`, err);
                        }
                    }
                }
            }

            // Process Images
            if (post.imgs && post.imgs.length > 0) {
                for (let i = 0; i < post.imgs.length; i++) {
                    if (post.dropboxImgs[i]) continue; // Already has link

                    const targetFilename = `${post.id}_img_${i + 1}.webp`;
                    const localSrc = path.join(PICTURES_DIR, `${post.id}_img_${i + 1}.jpg`);

                    // Check if exists in any Dropbox account
                    let foundAccount = dbxAccounts.find(acc => acc.existingFiles.has(targetFilename));

                    if (foundAccount) {
                        console.log(`[Skip Upload] ${targetFilename} found in ${foundAccount.name}`);
                        const link = await getSharedLink(foundAccount, `/${targetFilename}`);
                        post.dropboxImgs[i] = link;
                        changed = true;
                    } else if (await fs.pathExists(localSrc)) {
                        // Need to upload
                        // Pick account with most space
                        dbxAccounts.sort((a, b) => b.freeSpace - a.freeSpace);
                        const targetAccount = dbxAccounts[0];

                        if (targetAccount.freeSpace < 10 * 1024 * 1024) {
                            console.error(`[Full] Cannot upload ${targetFilename}`);
                            continue;
                        }

                        const tempPath = path.join(TEMP_DIR, targetFilename);
                        try {
                            console.log(`[Compress] ${targetFilename}`);
                            await convertToWebP(localSrc, tempPath);

                            console.log(`[Upload] ${targetFilename} to ${targetAccount.name}`);
                            const link = await uploadToDropbox(targetAccount, tempPath, `/${targetFilename}`);

                            post.dropboxImgs[i] = link;
                            targetAccount.existingFiles.add(targetFilename);
                            targetAccount.freeSpace -= (await fs.stat(tempPath)).size;
                            await fs.remove(tempPath);
                            changed = true;
                        } catch (err) {
                            console.error(`Error processing ${targetFilename}:`, err);
                        }
                    }
                }
            }

            // Process Videos
            if (post.videos && post.videos.length > 0) {
                for (let i = 0; i < post.videos.length; i++) {
                    if (post.dropboxVideos[i]) continue;

                    const targetFilename = `${post.id}_video_${i + 1}_opt.mp4`;
                    const localSrc = path.join(VIDEOS_DIR, `${post.id}_video_${i + 1}.mp4`);

                    let foundAccount = dbxAccounts.find(acc => acc.existingFiles.has(targetFilename));

                    if (foundAccount) {
                        console.log(`[Skip Upload] ${targetFilename} found in ${foundAccount.name}`);
                        const link = await getSharedLink(foundAccount, `/${targetFilename}`);
                        post.dropboxVideos[i] = link;
                        changed = true;
                    } else if (await fs.pathExists(localSrc)) {
                        dbxAccounts.sort((a, b) => b.freeSpace - a.freeSpace);
                        const targetAccount = dbxAccounts[0];

                        if (targetAccount.freeSpace < 10 * 1024 * 1024) {
                            console.error(`[Full] Cannot upload ${targetFilename}`);
                            continue;
                        }

                        const tempPath = path.join(TEMP_DIR, targetFilename);
                        try {
                            console.log(`[Optimize] ${targetFilename}`);
                            await optimizeVideo(localSrc, tempPath);

                            console.log(`[Upload] ${targetFilename} to ${targetAccount.name}`);
                            const link = await uploadToDropbox(targetAccount, tempPath, `/${targetFilename}`);

                            post.dropboxVideos[i] = link;
                            targetAccount.existingFiles.add(targetFilename);
                            targetAccount.freeSpace -= (await fs.stat(tempPath)).size;
                            await fs.remove(tempPath);
                            changed = true;
                        } catch (err) {
                            console.error(`Error processing ${targetFilename}:`, err);
                        }
                    }
                }
            }

            if (changed) {
                await saveBoardList(posts);
                processedCount++;
                if (processedCount % 10 === 0) {
                    console.log(`Progress: ${processedCount} posts updated.`);
                }
            }
        }));
    }

    await Promise.all(tasks);
    console.log(`\nDone. Total updated: ${processedCount}`);
    await fs.remove(TEMP_DIR);
}

async function getSharedLink(account: DropboxAccount, dbxPath: string): Promise<string> {
    try {
        // Try to create (returns existing if present)
        const linkRes = await account.client.sharingCreateSharedLinkWithSettings({
            path: dbxPath
        });
        return linkRes.result.url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
    } catch (err: any) {
        if (err.error && err.error.error && err.error.error['.tag'] === 'shared_link_already_exists') {
            const listRes = await account.client.sharingListSharedLinks({
                path: dbxPath,
                direct_only: true
            });
            if (listRes.result.links.length > 0) {
                return listRes.result.links[0].url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
            }
        }
        console.error(`Failed to get link for ${dbxPath}:`, err);
        return '';
    }
}

async function uploadToDropbox(account: DropboxAccount, filePath: string, dbxPath: string): Promise<string> {
    const fileContent = await fs.readFile(filePath);

    await account.client.filesUpload({
        path: dbxPath,
        contents: fileContent,
        mode: { '.tag': 'overwrite' }
    });

    return getSharedLink(account, dbxPath);
}

function convertToWebP(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .outputOptions('-c:v libwebp')
            .outputOptions('-lossless 0')
            .outputOptions('-q:v 80')
            .save(outputPath)
            .on('end', () => resolve())
            .on('error', (err) => reject(err));
    });
}

function optimizeVideo(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .outputOptions('-c:v libx264')
            .outputOptions('-crf 23')
            .outputOptions('-preset medium')
            .outputOptions('-c:a aac')
            .outputOptions('-b:a 128k')
            .outputOptions('-movflags +faststart')
            .save(outputPath)
            .on('end', () => resolve())
            .on('error', (err) => reject(err));
    });
}

processAndUpload();
