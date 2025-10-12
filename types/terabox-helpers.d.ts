// Type definitions for terabox-upload-tool internal helpers
declare module "terabox-upload-tool/lib/helpers/download/download" {
  function getDownloadLink(
    ndus: string,
    fid: string
  ): Promise<{
    success: boolean;
    message: string;
    downloadLink?: string;
  }>;
  export default getDownloadLink;
}
