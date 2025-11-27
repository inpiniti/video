import { Dropbox } from 'dropbox';
import fs from 'fs-extra';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'dropbox-config.json');
const BOARD_LIST_FILE = path.join(process.cwd(), 'boardList.json');

interface BoardItem {
    id: number;
    title: string;
    date: string;
    thumbnail: string;
    url: string;
    imgs?: string[];
    videos?: string[];
    dropboxImgs?: string[];
    dropboxVideos?: string[];
    dropboxAccount?: string;
    localThumbnail?: string;
}

interface DropboxAccount {
    name: string;
    appKey: string;
    appSecret: string;
    refreshToken: string;
}

interface DropboxConfig {
    accounts: DropboxAccount[];
}

async function getDropboxClient(account: DropboxAccount): Promise<Dropbox> {
    const dbx = new Dropbox({
        clientId: account.appKey,
        clientSecret: account.appSecret,
        refreshToken: account.refreshToken,
    });
    return dbx;
}

async function searchFileInDropbox(dbx: Dropbox, filename: string): Promise<string | null> {
    try {
        // Search for the file
        const response = await dbx.filesSearchV2({
            query: filename,
            options: {
                filename_only: true,
            }
        });

        if (response.result.matches && response.result.matches.length > 0) {
            const match = response.result.matches[0];
            if (match.metadata['.tag'] === 'metadata') {
                const metadata = match.metadata.metadata;
                if (metadata['.tag'] === 'file') {
                    // Get shared link
                    try {
                        const linkResponse = await dbx.sharingCreateSharedLinkWithSettings({
                            path: metadata.path_display || metadata.path_lower || '',
                            settings: {
                                requested_visibility: { '.tag': 'public' }
                            }
                        });

                        // Convert to direct download link
                        let url = linkResponse.result.url;
                        url = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
                        url = url.replace('?dl=0', '?dl=0');

                        return url;
                    } catch (linkError: any) {
                        // Link might already exist
                        if (linkError.error?.error?.['.tag'] === 'shared_link_already_exists') {
                            try {
                                const existingLinks = await dbx.sharingListSharedLinks({
                                    path: metadata.path_display || metadata.path_lower || ''
                                });

                                if (existingLinks.result.links && existingLinks.result.links.length > 0) {
                                    let url = existingLinks.result.links[0].url;
                                    url = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
                                    url = url.replace('?dl=0', '?dl=0');
                                    return url;
                                }
                            } catch (e) {
                                console.error(`Error getting existing link for ${filename}:`, e);
                            }
                        }
                    }
                }
            }
        }
        return null;
    } catch (error) {
        console.error(`Error searching for ${filename}:`, error);
        return null;
    }
}

async function main() {
    console.log('Starting thumbnail update process...\n');

    // Load config
    if (!await fs.pathExists(CONFIG_FILE)) {
        console.error('dropbox-config.json not found. Please run setup-dropbox first.');
        return;
    }

    const config: DropboxConfig = await fs.readJson(CONFIG_FILE);

    if (!config.accounts || config.accounts.length === 0) {
        console.error('No Dropbox accounts configured.');
        return;
    }

    // Load boardList
    if (!await fs.pathExists(BOARD_LIST_FILE)) {
        console.error('boardList.json not found.');
        return;
    }

    const boardList: BoardItem[] = await fs.readJson(BOARD_LIST_FILE);
    console.log(`Loaded ${boardList.length} posts from boardList.json\n`);

    // Filter posts with local API thumbnail paths
    const postsToUpdate = boardList.filter(post =>
        post.thumbnail && post.thumbnail.startsWith('/api/media/images')
    );

    console.log(`Found ${postsToUpdate.length} posts with local thumbnail paths\n`);

    if (postsToUpdate.length === 0) {
        console.log('No posts to update. Exiting.');
        return;
    }

    // Create Dropbox clients
    const dropboxClients = new Map<string, Dropbox>();
    for (const account of config.accounts) {
        const client = await getDropboxClient(account);
        dropboxClients.set(account.name, client);
        console.log(`✓ Connected to ${account.name}`);
    }
    console.log('');

    let updatedCount = 0;
    let notFoundCount = 0;

    // Process each post
    for (let i = 0; i < postsToUpdate.length; i++) {
        const post = postsToUpdate[i];

        // Extract filename from thumbnail path
        // e.g., "/api/media/images/3_thumb.jpg" -> "3_thumb.jpg"
        const filename = path.basename(post.thumbnail);

        console.log(`[${i + 1}/${postsToUpdate.length}] Processing ID ${post.id}: ${filename}`);

        let foundUrl: string | null = null;
        let foundAccount: string | null = null;

        // Try to find in each Dropbox account
        for (const [accountName, dbx] of dropboxClients.entries()) {
            console.log(`  Searching in ${accountName}...`);
            const url = await searchFileInDropbox(dbx, filename);

            if (url) {
                foundUrl = url;
                foundAccount = accountName;
                console.log(`  ✓ Found in ${accountName}`);
                break;
            }
        }

        if (foundUrl && foundAccount) {
            // Update the post
            post.thumbnail = foundUrl;
            if (!post.dropboxAccount) {
                post.dropboxAccount = foundAccount;
            }
            updatedCount++;
            console.log(`  ✓ Updated thumbnail to Dropbox URL`);
        } else {
            notFoundCount++;
            console.log(`  ✗ Not found in any Dropbox account`);
        }

        console.log('');

        // Save periodically (every 10 posts)
        if ((i + 1) % 10 === 0) {
            await fs.writeJson(BOARD_LIST_FILE, boardList, { spaces: 2 });
            console.log(`💾 Progress saved (${i + 1}/${postsToUpdate.length})\n`);
        }
    }

    // Final save
    await fs.writeJson(BOARD_LIST_FILE, boardList, { spaces: 2 });

    console.log('='.repeat(50));
    console.log('Update complete!');
    console.log(`✓ Updated: ${updatedCount}`);
    console.log(`✗ Not found: ${notFoundCount}`);
    console.log(`Total processed: ${postsToUpdate.length}`);
    console.log('='.repeat(50));
}

main().catch(console.error);
