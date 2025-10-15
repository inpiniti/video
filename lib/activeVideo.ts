type Subscriber = (ids: Set<string>) => void;

const activeSet: Set<string> = new Set();
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

export const activeVideo = {
  getActive: () => new Set(activeSet),
  requestActive: (id: string) => {
    if (!activeSet.has(id)) {
      activeSet.add(id);
      notify();
    }
  },
  clearActive: (id?: string) => {
    if (typeof id === 'string') {
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
