type Subscriber = (ids: Set<string>) => void;

const activeSet: Set<string> = new Set();
const loadedVideos: Map<string, number> = new Map(); // videoId -> timestamp
const MAX_LOADED_VIDEOS = 10; // 최대 10개의 비디오만 로드 상태 유지
const subscribers: Set<Subscriber> = new Set();

function notify() {
  const snapshot = new Set(activeSet);
  for (const s of subscribers) {
    try {
      s(snapshot);
    } catch {
      /* ignore subscriber errors */
    }
  }
}

function cleanupOldVideos() {
  if (loadedVideos.size <= MAX_LOADED_VIDEOS) return;

  // Sort by timestamp (oldest first)
  const sorted = Array.from(loadedVideos.entries()).sort((a, b) => a[1] - b[1]);

  // Remove oldest videos
  const toRemove = sorted.slice(0, sorted.length - MAX_LOADED_VIDEOS);
  const videosToUnload = new Set<string>();

  for (const [id] of toRemove) {
    loadedVideos.delete(id);
    videosToUnload.add(id);
  }

  return videosToUnload;
}

export const activeVideo = {
  getActive: () => new Set(activeSet),
  getLoaded: () => new Set(loadedVideos.keys()),
  markLoaded: (id: string) => {
    loadedVideos.set(id, Date.now());
    const toUnload = cleanupOldVideos();
    return toUnload;
  },
  isLoaded: (id: string) => loadedVideos.has(id),
  requestActive: (id: string) => {
    loadedVideos.set(id, Date.now()); // Update access time
    if (!activeSet.has(id)) {
      activeSet.add(id);
      notify();
    }
  },
  clearActive: (id?: string) => {
    if (typeof id === "string") {
      if (activeSet.has(id)) {
        activeSet.delete(id);
        notify();
      }
    } else {
      if (activeSet.size > 0) {
        activeSet.clear();
        notify();
      }
    }
  },
  subscribe: (fn: Subscriber) => {
    subscribers.add(fn);
    try {
      fn(new Set(activeSet));
    } catch {}
  },
  unsubscribe: (fn: Subscriber) => {
    subscribers.delete(fn);
  },
};

export default activeVideo;
