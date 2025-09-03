declare module '@ffmpeg/ffmpeg' {
  // Partial type declarations for createFFmpeg used in this project
  interface FFmpeg {
    load: () => Promise<void>;
    isLoaded: () => boolean;
    FS: (method: string, ...args: any[]) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
    run: (...args: string[]) => Promise<void>;
  }
  interface CreateFFmpegOptions { log?: boolean }
  export function createFFmpeg(options?: CreateFFmpegOptions): FFmpeg;
}
