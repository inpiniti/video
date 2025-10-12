// Type declarations for terabox-upload-tool
// This package doesn't have official TypeScript types

declare module "terabox-upload-tool" {
  interface TeraBoxCredentials {
    ndus: string;
    appId: string;
    uploadId: string;
    jsToken: string;
    browserId: string;
  }

  interface UploadResult {
    success: boolean;
    message?: string;
    fileDetails?: {
      fs_id?: string | number;
      path?: string;
      server_filename?: string;
      size?: number;
      [key: string]: unknown;
    };
  }

  interface DownloadResult {
    dlink?: string;
    [key: string]: unknown;
  }

  interface FileInfo {
    fs_id: string | number;
    path: string;
    server_filename: string;
    size: number;
    [key: string]: unknown;
  }

  class TeraboxUploader {
    constructor(credentials: TeraBoxCredentials);

    uploadFile(
      filePath: string,
      showProgress?: boolean,
      directory?: string
    ): Promise<UploadResult>;

    downloadFile(fileId: string | number): Promise<DownloadResult>;

    fetchFileList(directory?: string): Promise<FileInfo[]>;

    deleteFiles(paths: string[]): Promise<unknown>;

    moveFiles(
      oldPath: string,
      newPath: string,
      newName: string
    ): Promise<unknown>;
  }

  export default TeraboxUploader;
}
