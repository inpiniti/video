# Upload Pipeline Documentation

## Overview

This project includes a video upload pipeline that downloads, compresses, and uploads videos to TeraBox (or alternative cloud storage).

## Architecture

### Client Flow (components/video-grid.tsx)

1. User clicks "Upload" button on a video card
2. Frontend POST to `/api/upload` with `{ id, url }`
3. Receives `jobId` and polls `/api/upload?jobId=...` every 3s
4. When job status is `done`, updates Supabase `videos.url` with TeraBox URL
5. Button shows "Uploading..." during processing

### Server Flow

1. **Queue** (`lib/jobQueue.ts`): In-memory job queue with 10 concurrent workers

   - Tracks job status: queued → downloading → compressing → uploading → done/error
   - Auto-processes queued jobs when workers become available

2. **Download** (`lib/videoDownloader.ts`): Fetch video from URL to temp file

3. **Compress** (`lib/videoCompressor.ts`): Convert to WebM (AV1 video + Opus audio)

   - Uses ffmpeg with libaom-av1 codec
   - CRF 30 for quality/size balance
   - cpu-used 4 for reasonable encoding speed
   - Opus audio at 128k bitrate

4. **Upload** (`lib/teraboxUploader.ts`): Upload to TeraBox and get public URL

   - **⚠️ PLACEHOLDER IMPLEMENTATION** - see below

5. **API Route** (`app/api/upload/route.ts`):
   - POST: Enqueue job, return jobId
   - GET: Check job status by jobId

## TeraBox Integration ⚠️

**IMPORTANT**: TeraBox does not have an official public API. The current implementation in `lib/teraboxUploader.ts` is a **mock placeholder** that returns a fake URL.

### Options to implement real upload:

#### Option 1: Browser Automation (Recommended for TeraBox)

Use Playwright or Puppeteer to automate the web upload:

```typescript
import { chromium } from "playwright";

export async function uploadToTeraBox(
  filePath: string,
  videoId: number
): Promise<string> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 1. Login to TeraBox
  await page.goto("https://www.terabox.com/");
  await page.fill('input[name="username"]', process.env.TERABOX_USERNAME!);
  await page.fill('input[name="password"]', process.env.TERABOX_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForNavigation();

  // 2. Navigate to upload
  await page.goto("https://www.terabox.com/main?category=all#/upload");

  // 3. Upload file
  const fileInput = await page.locator('input[type="file"]');
  await fileInput.setInputFiles(filePath);

  // 4. Wait for upload complete
  await page.waitForSelector(".upload-success", { timeout: 300000 }); // 5min

  // 5. Get share link
  await page.click(".share-button");
  const shareUrl = await page.locator(".share-link").textContent();

  await browser.close();
  return shareUrl || "";
}
```

#### Option 2: Use Alternative Cloud Storage

Switch to services with official APIs:

**Google Drive** (with @googleapis/drive):

```typescript
import { google } from "googleapis";
import { createReadStream } from "fs";

const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
  scopes: ["https://www.googleapis.com/auth/drive.file"],
});

const drive = google.drive({ version: "v3", auth });

export async function uploadToGoogleDrive(
  filePath: string,
  videoId: number
): Promise<string> {
  const fileMetadata = { name: `video_${videoId}.webm` };
  const media = { mimeType: "video/webm", body: createReadStream(filePath) };

  const file = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: "id",
  });

  // Make public
  await drive.permissions.create({
    fileId: file.data.id!,
    requestBody: { type: "anyone", role: "reader" },
  });

  return `https://drive.google.com/uc?id=${file.data.id}`;
}
```

**Cloudflare R2** (S3-compatible):

```typescript
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFile } from "fs/promises";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function uploadToR2(
  filePath: string,
  videoId: number
): Promise<string> {
  const fileBuffer = await readFile(filePath);
  const key = `videos/video_${videoId}_${Date.now()}.webm`;

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: key,
      Body: fileBuffer,
      ContentType: "video/webm",
    })
  );

  return `${process.env.R2_PUBLIC_URL}/${key}`;
}
```

#### Option 3: Unofficial TeraBox API/SDK

Search npm for community packages (use at your own risk):

```bash
npm search terabox
```

## Environment Variables

Add to `.env.local`:

```env
# For TeraBox (if using browser automation)
TERABOX_USERNAME=your_username
TERABOX_PASSWORD=your_password

# OR for Google Drive
GOOGLE_SERVICE_ACCOUNT_KEY=/path/to/key.json

# OR for Cloudflare R2
R2_ENDPOINT=https://xxxxx.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_key
R2_SECRET_ACCESS_KEY=your_secret
R2_BUCKET=your-bucket
R2_PUBLIC_URL=https://your-public-domain.com
```

## Dependencies

Install required packages:

```bash
# For browser automation (Option 1)
npm install playwright
npx playwright install chromium

# For Google Drive (Option 2)
npm install googleapis

# For Cloudflare R2 (Option 2)
npm install @aws-sdk/client-s3
```

## Testing

To test the pipeline without real upload:

1. The mock implementation will work for development
2. Check server logs for job progress
3. Monitor temp files in OS temp directory during processing

## Performance Notes

- **Concurrent jobs**: 10 workers process jobs in parallel
- **Compression speed**: AV1 encoding is CPU-intensive (~1-2min per minute of video on modern CPU)
- **Disk space**: Ensure temp directory has enough space (2x video size during processing)
- **Memory**: Each worker may use 500MB-2GB depending on video size

## Production Recommendations

1. **Use proper cloud storage**: Don't rely on mock TeraBox upload
2. **Add progress tracking**: Enhance job status to include % progress
3. **Implement cleanup**: Delete old completed jobs from memory after 24h
4. **Add retry logic**: Retry failed jobs with exponential backoff
5. **Monitor disk space**: Alert when temp directory fills up
6. **Rate limiting**: Add per-user upload limits
7. **Persistent queue**: Use Redis or database for queue to survive server restarts
8. **Webhook notifications**: Push job completion to client instead of polling

## Troubleshooting

**Job stuck in queue?**

- Check server logs for errors
- Verify ffmpeg is installed: `ffmpeg -version`
- Check temp directory permissions

**Compression fails?**

- Ensure ffmpeg has libaom-av1 codec: `ffmpeg -codecs | grep av1`
- Try fallback to VP9: Replace `libaom-av1` with `libvpx-vp9`

**Upload fails?**

- Implement real TeraBox upload (see options above)
- Check network connectivity
- Verify credentials in env vars

**Memory issues?**

- Reduce MAX_CONCURRENT in jobQueue.ts
- Use streaming instead of loading full file in memory
