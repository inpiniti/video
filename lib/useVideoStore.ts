import create, { StateCreator } from 'zustand'

type Video = Record<string, any>

type VideoState = {
  videos: Video[]
  setVideos: (v: Video[]) => void
  clearVideos: () => void
}

// Simple sessionStorage persistence
const STORAGE_KEY = 'video_store_v1'

function loadFromSession(): Video[] {
  try {
    if (typeof window === 'undefined') return []
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed.videos) ? parsed.videos : []
  } catch {
    return []
  }
}

function saveToSession(videos: Video[]) {
  try {
    if (typeof window === 'undefined') return
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ videos }))
  } catch {
    // ignore
  }
}

const creator: StateCreator<VideoState> = (set) => ({
  videos: typeof window !== 'undefined' ? loadFromSession() : [],
  setVideos: (v: Video[]) => {
    set({ videos: v })
    saveToSession(v)
  },
  clearVideos: () => {
    set({ videos: [] })
    try {
      if (typeof window !== 'undefined') sessionStorage.removeItem(STORAGE_KEY)
    } catch {}
  }
})

export const useVideoStore = create<VideoState>(creator)
