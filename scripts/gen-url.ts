import { DropboxAuth } from 'dropbox';

const appKey = 'w2nzwmy3m8jjyzr';
const dbxAuth = new DropboxAuth({ clientId: appKey });

dbxAuth.getAuthenticationUrl(
    undefined as any,
    undefined,
    'code',
    'offline',
    undefined,
    undefined,
    false
).then(url => {
    console.log('Generated URL:', url);
});
