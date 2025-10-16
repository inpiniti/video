type StreamCallback = (start: boolean) => void;

const queue: string[] = [];
const callbacks: Map<string, StreamCallback> = new Map();
const streamingSet: Set<string> = new Set();
const MAX_CONCURRENT = 10;

function tryStartNext() {
  while (streamingSet.size < MAX_CONCURRENT && queue.length > 0) {
    const next = queue.shift()!;
    // if already streaming skip
    if (streamingSet.has(next)) continue;
    streamingSet.add(next);
    const cb = callbacks.get(next);
    try {
      if (cb) cb(true);
    } catch (e) {
      // ignore subscriber errors
      console.error(`[streamManager] callback error for ${next}:`, e);
    }
  }
}

const streamManager = {
  // subscribe a callback for a specific video id
  subscribe(id: string, cb: StreamCallback) {
    callbacks.set(id, cb);
  },
  unsubscribe(id: string) {
    callbacks.delete(id);
  },
  // request streaming for id: enqueue or start immediately
  requestStream(id: string) {
    if (streamingSet.has(id)) return;
    if (queue.includes(id)) return;
    // if slot available start immediately
    if (streamingSet.size < MAX_CONCURRENT) {
      streamingSet.add(id);
      const cb = callbacks.get(id);
      if (cb) {
        try {
          cb(true);
        } catch (e) {
          console.error(`[streamManager] callback error for ${id}:`, e);
        }
      }
    } else {
      queue.push(id);
    }
  },
  // mark streaming finished for id and start next queued
  finish(id: string) {
    if (streamingSet.has(id)) {
      streamingSet.delete(id);
    }
    // ensure it's not in queue
    const idx = queue.indexOf(id);
    if (idx > -1) queue.splice(idx, 1);
    tryStartNext();
  },
  isStreaming(id: string) {
    return streamingSet.has(id);
  },
  getQueue() {
    return [...queue];
  },
};

export default streamManager;
