// Upload compressed video to TeraBox and return public URL
// Uses terabox-upload-tool library for direct API access

import { basename } from "path";

// TeraBox credentials interface
interface TeraBoxCredentials {
  ndus: string; // Required: Cookie from TeraBox session
  appId: string; // Required: App ID from upload request
  uploadId: string; // Required: Upload ID from upload request
  jsToken: string; // Required: JS Token from session
  browserId: string; // Required: Browser ID from session
}

export async function uploadToTeraBox(
  filePath: string,
  videoId: number
): Promise<string> {
  // Check for TeraBox credentials
  const credentials: TeraBoxCredentials | null = getCredentials();

  if (!credentials) {
    console.warn("[TeraBox] No credentials found, using mock upload");
    console.warn(
      "[TeraBox] To enable real uploads, set these environment variables:"
    );
    console.warn(
      "[TeraBox]   TERABOX_NDUS, TERABOX_APP_ID, TERABOX_UPLOAD_ID,"
    );
    console.warn("[TeraBox]   TERABOX_JS_TOKEN, TERABOX_BROWSER_ID");
    console.warn(
      "[TeraBox] See setup guide: https://github.com/Pahadi10/terabox-upload-tool#guide"
    );
    return mockUpload(videoId);
  }

  console.log(`[TeraBox] Starting upload for video ${videoId}`);
  console.log(`[TeraBox] File: ${basename(filePath)}`);

  try {
    // Dynamic import to avoid loading heavy dependency upfront
    const TeraboxUploader = (await import("terabox-upload-tool")).default;

    // Initialize uploader with credentials
    const uploader = new TeraboxUploader(credentials);

    // Upload file with progress tracking to /videos directory
    console.log("[TeraBox] Uploading to /videos directory...");

    const result = await uploader.uploadFile(
      filePath,
      true, // showProgress
      "/videos" // directory
    );

    if (result.success) {
      console.log("[TeraBox] ✅ Upload successful!");
      console.log("[TeraBox] File details:", result.fileDetails);

      // Get file ID to create download link
      const fileId = result.fileDetails?.fs_id;

      if (fileId) {
        console.log("[TeraBox] Getting download link for fileId:", fileId);
        const downloadInfo = await uploader.downloadFile(fileId);

        console.log(
          "[TeraBox] downloadFile response:",
          JSON.stringify(downloadInfo, null, 2)
        );

        if (downloadInfo && downloadInfo.dlink) {
          console.log(
            "[TeraBox] ✅ Direct streaming link obtained:",
            downloadInfo.dlink
          );
          return downloadInfo.dlink;
        } else {
          console.error(
            "[TeraBox] ⚠️ No dlink in response. Full response:",
            downloadInfo
          );
        }
      } else {
        console.error("[TeraBox] ⚠️ No fileId in upload result");
      }

      // Fallback: return a share link format (may need adjustment)
      const fileName = basename(filePath);
      return `https://www.terabox.com/sharing/link?surl=${fileName}`;
    } else {
      console.error("[TeraBox] Upload failed:", result.message);
      throw new Error(result.message || "Upload failed");
    }
  } catch (error) {
    console.error("[TeraBox] Upload error:", error);
    console.error("[TeraBox] Error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
    });

    // Fallback to mock for development
    console.warn("[TeraBox] Falling back to mock upload");
    return mockUpload(videoId);
  }
}

function getCredentials(): TeraBoxCredentials | null {
  const ndus = process.env.TERABOX_NDUS;
  const appId = process.env.TERABOX_APP_ID;
  const uploadId = process.env.TERABOX_UPLOAD_ID;
  const jsToken = process.env.TERABOX_JS_TOKEN;
  const browserId = process.env.TERABOX_BROWSER_ID;

  // All credentials are required
  if (!ndus || !appId || !uploadId || !jsToken || !browserId) {
    return null;
  }

  return { ndus, appId, uploadId, jsToken, browserId };
}

async function mockUpload(videoId: number): Promise<string> {
  console.log(`[TeraBox] Using mock upload for video ${videoId}`);
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return `https://terabox.mock/video_${videoId}_${Date.now()}.webm`;
}

// Alternative: Use official cloud storage APIs
// Google Drive example (requires @googleapis/drive):
// import { google } from 'googleapis';
// const drive = google.drive({ version: 'v3', auth: oauth2Client });
// const media = { mimeType: 'video/webm', body: fs.createReadStream(filePath) };
// const file = await drive.files.create({ requestBody: { name: `video_${videoId}.webm` }, media });
// await drive.permissions.create({ fileId: file.data.id, requestBody: { type: 'anyone', role: 'reader' } });
// return `https://drive.google.com/uc?id=${file.data.id}`;
