import { DropboxAuth } from 'dropbox';
import fs from 'fs-extra';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'dropbox-config.json');

async function updateToken() {
    // Drop2 Config
    const appKey = 'w2nzwmy3m8jjyzr';
    const appSecret = '12muh8k5x98izbb';
    const code = 'MQs8BMGsqrsAAAAAAAAAHWDhbV9MpsRE5omxMjl423Y'; // User provided code

    const dbxAuth = new DropboxAuth({
        clientId: appKey,
        clientSecret: appSecret,
    });

    try {
        console.log('Exchanging code for token...');
        const response = await dbxAuth.getAccessTokenFromCode(undefined as any, code);
        const refreshToken = (response.result as any).refresh_token;

        if (!refreshToken) {
            console.error('Failed to get refresh token. Did you allow offline access?');
            return;
        }

        console.log('Got refresh token:', refreshToken);

        // Update Config File
        const config = await fs.readJson(CONFIG_FILE);
        const accountIndex = config.accounts.findIndex((a: any) => a.name === 'drop2');

        if (accountIndex >= 0) {
            config.accounts[accountIndex].refreshToken = refreshToken;
            await fs.writeJson(CONFIG_FILE, config, { spaces: 2 });
            console.log('Updated dropbox-config.json successfully.');
        } else {
            console.error('drop2 account not found in config file.');
        }

    } catch (error) {
        console.error('Error exchanging token:', error);
    }
}

updateToken();
