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

async function searchAndCreateLink(dbx: Dropbox, accountName: string, searchPattern: string): Promise<string | null> {
    try {
        console.log(`  Searching for pattern: ${searchPattern} in ${accountName}...`);

        // Search for the file
        const response = await dbx.filesSearchV2({
            query: searchPattern,
            options: {
                filename_only: true,
            }
        });

        console.log(`  Found ${response.result.matches.length} matches`);

        if (response.result.matches && response.result.matches.length > 0) {
            // Show all matches
            for (let i = 0; i < response.result.matches.length; i++) {
                const match = response.result.matches[i];
                if (match.metadata['.tag'] === 'metadata') {
                    const metadata = match.metadata.metadata;
                    if (metadata['.tag'] === 'file') {
                        console.log(`  Match ${i + 1}: ${metadata.path_display}`);
                    }
                }
            }

            // Use the first match
            const match = response.result.matches[0];
            if (match.metadata['.tag'] === 'metadata') {
                const metadata = match.metadata.metadata;
                if (metadata['.tag'] === 'file') {
                    const filePath = metadata.path_display || metadata.path_lower || '';
                    console.log(`  Using file: ${filePath}`);

                    // Try to create or get shared link
                    try {
                        const linkResponse = await dbx.sharingCreateSharedLinkWithSettings({
                            path: filePath,
                            settings: {
                                requested_visibility: { '.tag': 'public' }
                            }
                        });

                        let url = linkResponse.result.url;
                        url = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
                        console.log(`  ✓ Created new link: ${url}`);
                        return url;
                    } catch (linkError: any) {
                        // Link might already exist
                        if (linkError.error?.error?.['.tag'] === 'shared_link_already_exists') {
                            try {
                                const existingLinks = await dbx.sharingListSharedLinks({
                                    path: filePath
                                });

                                if (existingLinks.result.links && existingLinks.result.links.length > 0) {
                                    let url = existingLinks.result.links[0].url;
                                    url = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
                                    console.log(`  ✓ Found existing link: ${url}`);
                                    return url;
                                }
                            } catch (e) {
                                console.error(`  Error getting existing link:`, e);
                            }
                        } else {
                            console.error(`  Error creating link:`, linkError);
                        }
                    }
                }
            }
        }
        return null;
    } catch (error) {
        console.error(`  Error searching:`, error);
        return null;
    }
}

async function main() {
    console.log('Fixing thumbnail for ID 1622...\n');

    // Load config
    if (!await fs.pathExists(CONFIG_FILE)) {
        console.error('dropbox-config.json not found.');
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
    const post = boardList.find(p => p.id === 1622);

    if (!post) {
        console.error('Post 1622 not found in boardList.json');
        return;
    }

    console.log(`Current thumbnail: ${post.thumbnail}\n`);

    // Try different search patterns
    const searchPatterns = [
        '1622_thumb',
        '1622_thumb.jpg',
        '1622_thumb.webp',
        '1622'
    ];

    let foundUrl: string | null = null;
    let foundAccount: string | null = null;

    // Try each account
    for (const account of config.accounts) {
        console.log(`\nSearching in ${account.name}...`);
        const dbx = await getDropboxClient(account);

        // Try each search pattern
        for (const pattern of searchPatterns) {
            const url = await searchAndCreateLink(dbx, account.name, pattern);
            if (url) {
                foundUrl = url;
                foundAccount = account.name;
                break;
            }
        }

        if (foundUrl) break;
    }

    if (foundUrl && foundAccount) {
        console.log(`\n✓ Found thumbnail in ${foundAccount}`);
        console.log(`  URL: ${foundUrl}`);

        // Update the post
        post.thumbnail = foundUrl;
        if (!post.dropboxAccount) {
            post.dropboxAccount = foundAccount;
        }

        // Save
        await fs.writeJson(BOARD_LIST_FILE, boardList, { spaces: 2 });
        console.log(`\n✓ Updated boardList.json`);
    } else {
        console.log(`\n✗ Thumbnail not found in any Dropbox account`);
    }
}

main().catch(console.error);
