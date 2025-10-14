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

// fetchFileList
export async function fetchFileList(folderName: string): Promise<unknown> {
  const credentials = getCredentials();
  if (!credentials) {
    throw new Error("TeraBox credentials not configured");
  }
  try {
    // Dynamic import to avoid loading heavy dependency upfront
    const TeraboxUploader = (await import("terabox-upload-tool")).default;
    const uploader = new TeraboxUploader(credentials);
    const fileList = await uploader.fetchFileList(folderName);
    console.log("[TeraBox] Fetched file list:", fileList);
    return fileList;
  } catch (error) {
    console.error("[TeraBox] Failed to fetch file list:", error);
    throw error;
  }
}

// NEW APPROACH: Return TeraBox file ID instead of temporary download link
// The file ID is permanent and can be used to generate fresh streaming links on-demand
export async function uploadToTeraBox(
  filePath: string,
  videoId: number,
  progressCallback?: (percent: number) => void
): Promise<string> {
  // Check for TeraBox credentials
  const credentials: TeraBoxCredentials | null = getCredentials();

  if (!credentials) {
    return mockUpload(videoId, progressCallback);
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

      // Get file ID - this is the permanent identifier
      const fileId = result.fileDetails?.fs_id;

      if (fileId) {
        console.log("[TeraBox] ✅ File ID obtained:", fileId);

        // Test: Get streaming link immediately to verify it works
        try {
          const streamingLink = await getTeraBoxStreamingLink(
            fileId.toString()
          );
          console.log(
            "[TeraBox] ✅ Streaming link test successful:",
            streamingLink
          );
        } catch (linkError) {
          console.error(
            "[TeraBox] ⚠️ Failed to get streaming link:",
            linkError
          );
        }

        // Return just the file ID (no prefix)
        return fileId.toString();
      } else {
        console.error("[TeraBox] ⚠️ No fileId in upload result");
        throw new Error("Upload succeeded but no fileId returned");
      }
    } else {
      console.error("[TeraBox] Upload failed:", result.message);
      throw new Error(result.message || "Upload failed");
    }
  } catch (error) {
    // Fallback to mock for development
    return mockUpload(videoId, progressCallback);
  }
}

// Helper function to get streaming link from TeraBox file ID
// This should be called from a server API route, not directly from client
export async function getTeraBoxStreamingLink(fileId: string): Promise<string> {
  const credentials = getCredentials();

  if (!credentials) {
    throw new Error("TeraBox credentials not configured");
  }

  try {
    // Use internal helper to get fresh download/streaming link
    const { default: getDownloadLink } = await import(
      "terabox-upload-tool/lib/helpers/download/download"
    );

    const downloadResult = await getDownloadLink(
      credentials.ndus,
      fileId.toString()
    );

    console.log(
      "[TeraBox] getDownloadLink response:",
      JSON.stringify(downloadResult, null, 2)
    );

    if (downloadResult.success && downloadResult.downloadLink) {
      console.log(
        "[TeraBox] ✅ Fresh streaming link obtained:",
        downloadResult.downloadLink
      );
      return downloadResult.downloadLink;
    } else {
      throw new Error(`Failed to get download link: ${downloadResult.message}`);
    }
  } catch (error) {
    console.error("[TeraBox] Failed to get streaming link:", error);
    throw error;
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

async function mockUpload(
  videoId: number,
  progressCallback?: (percent: number) => void
): Promise<string> {
  // Simulate upload progress
  for (let i = 0; i <= 100; i += 10) {
    if (progressCallback) progressCallback(i);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  // Return mock file ID (just numbers, no prefix)
  return `mock_${videoId}_${Date.now()}`;
}

// Alternative: Use official cloud storage APIs
// Google Drive example (requires @googleapis/drive):
// import { google } from 'googleapis';
// const drive = google.drive({ version: 'v3', auth: oauth2Client });
// const media = { mimeType: 'video/webm', body: fs.createReadStream(filePath) };
// const file = await drive.files.create({ requestBody: { name: `video_${videoId}.webm` }, media });
// await drive.permissions.create({ fileId: file.data.id, requestBody: { type: 'anyone', role: 'reader' } });
// return `https://drive.google.com/uc?id=${file.data.id}`;
