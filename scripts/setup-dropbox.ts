import { DropboxAuth } from 'dropbox';
import fs from 'fs-extra';
import readline from 'readline';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'dropbox-config.json');

const APPS = [
    { key: 'jtesarmiet6bh4a', secret: 'sc8ftv3anutsnxz', name: 'drop1' },
    { key: 'w2nzwmy3m8jjyzr', secret: '12muh8k5x98izbb', name: 'drop2' }
];

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query: string): Promise<string> => {
    return new Promise((resolve) => {
        rl.question(query, resolve);
    });
};

async function setup() {
    let accounts: any[] = [];

    // Load existing config if available
    if (await fs.pathExists(CONFIG_FILE)) {
        const existing = await fs.readJson(CONFIG_FILE);
        if (existing.accounts) {
            accounts = existing.accounts;
        }
    }

    console.log('Starting Dropbox Setup...');
    console.log('Type "skip" to skip an account.');

    for (const app of APPS) {
        // Check if already configured
        if (accounts.find(a => a.name === app.name)) {
            console.log(`\n${app.name} is already configured. Skipping...`);
            continue;
        }

        console.log(`\n--- Setting up ${app.name} ---`);

        const dbxAuth = new DropboxAuth({
            clientId: app.key,
            clientSecret: app.secret,
        });

        const authUrl = await dbxAuth.getAuthenticationUrl(
            undefined as any, // Let Dropbox determine the redirect (or show code)
            undefined,
            'code',
            'offline',
            undefined,
            undefined,
            false
        );

        console.log(`1. Go to this URL: ${authUrl}`);
        console.log('2. Authorize the app.');
        console.log('3. Copy the "code" displayed on the screen.');

        const code = await question('Paste the access code here (or "skip"): ');

        if (code.trim().toLowerCase() === 'skip') {
            console.log(`Skipping ${app.name}...`);
            continue;
        }

        try {
            const response = await dbxAuth.getAccessTokenFromCode(undefined as any, code.trim());
            const refreshToken = response.result.refresh_token;

            if (!refreshToken) {
                console.error('Error: No refresh token received. Make sure you approved "offline" access.');
                continue;
            }

            console.log(`Success! Refresh Token acquired for ${app.name}.`);

            accounts.push({
                name: app.name,
                appKey: app.key,
                appSecret: app.secret,
                refreshToken: refreshToken
            });

            // Save immediately
            await fs.writeJson(CONFIG_FILE, { accounts }, { spaces: 2 });
            console.log(`Configuration saved.`);

        } catch (error) {
            console.error(`Failed to auth ${app.name}:`, error);
            console.log('Please check your App Key, Secret, and Redirect URI settings in Dropbox Console.');
        }
    }

    console.log('\nSetup finished.');
    rl.close();
}

setup();
