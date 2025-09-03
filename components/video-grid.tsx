"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import { supabase, hasSupabase } from "@/lib/supabaseClient";
import { EditVideoDialog } from "./edit-video-dialog";

type FileEntry =
  | string
  | {
      id?: number;
      title?: string;
      date?: string;
      url: string;
      actor?: string;
    };

export default function VideoGrid(): React.ReactElement {
  // Debug flag to trace thumbnail lifecycle in the console.
  const THUMB_DEBUG = true;
  const [files, setFiles] = useState<FileEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usingSupabase, setUsingSupabase] = useState<boolean | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Close preview with ESC
  useEffect(() => {
    if (!previewImage) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewImage(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewImage]);

  // Helper: fetch current rows from Supabase and update state (no JSON fallback here).
  const refreshFromSupabase = async () => {
    try {
      if (hasSupabase() && supabase) {
        const { data, error } = await supabase
          .from("videos")
          .select("id,title,date,url,actor")
          .order("id", { ascending: true })
          .limit(1000);
        if (!error && Array.isArray(data)) {
          const arr = data as unknown[];
          const mapped = arr
            .map((x) => {
              if (x && typeof x === "object") {
                const y = x as Record<string, unknown>;
                const url = typeof y.url === "string" ? y.url : undefined;
                const title = typeof y.title === "string" ? y.title : undefined;
                const date = typeof y.date === "string" ? y.date : undefined;
                const actor = typeof y.actor === "string" ? y.actor : undefined;
                let id: number | undefined;
                if (typeof y.id === "number") id = y.id;
                else if (typeof y.id === "string") {
                  const parsed = parseInt(y.id, 10);
                  if (!isNaN(parsed)) id = parsed;
                }
                if (url) return { id, title, date, url, actor };
              }
              return null;
            })
            .filter(Boolean) as {
            id?: number;
            title?: string;
            date?: string;
            url: string;
            actor?: string;
          }[];
          setFiles(mapped);
          setUsingSupabase(true);
        }
      }
    } catch (e) {
      console.warn("refreshFromSupabase failed", e);
    }
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      let triedSupabase = false;

      // Only attempt Supabase if public env vars are present
      if (hasSupabase() && supabase) {
        triedSupabase = true;
        try {
          const { data, error } = await supabase
            .from("videos")
            .select("id,title,date,url,actor")
            .order("id", { ascending: true })
            .limit(1000);
          if (!mounted) return;
          if (!error && Array.isArray(data)) {
            setUsingSupabase(true);
            const arr = data as unknown[];
            const mapped = arr
              .map((x) => {
                if (x && typeof x === "object") {
                  const y = x as Record<string, unknown>;
                  const url = typeof y.url === "string" ? y.url : undefined;
                  const title =
                    typeof y.title === "string" ? y.title : undefined;
                  const date = typeof y.date === "string" ? y.date : undefined;
                  const actor =
                    typeof y.actor === "string" ? y.actor : undefined;
                  let id: number | undefined;
                  if (typeof y.id === "number") id = y.id;
                  else if (typeof y.id === "string") {
                    const parsed = parseInt(y.id, 10);
                    if (!isNaN(parsed)) id = parsed;
                  }
                  if (url) return { id, title, date, url, actor };
                }
                return null;
              })
              .filter(Boolean) as {
              id?: number;
              title?: string;
              date?: string;
              url: string;
              actor?: string;
            }[];
            setFiles(mapped);
            return;
          }
          // if response came back but no data, mark failure
          setUsingSupabase(false);
        } catch (err) {
          console.warn("supabase fetch failed", err);
          setUsingSupabase(false);
        }
      }

      // Fallback to local JSON if Supabase is not configured or failed
      try {
        const res = await fetch("/aom_yumi.json");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!mounted) return;
        if (Array.isArray(data)) {
          if (triedSupabase) setUsingSupabase(false);
          setFiles(data as FileEntry[]);
        } else setError("Invalid JSON format");
      } catch (err) {
        if (!mounted) return;
        setError(String(err));
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  // Listen for global events fired after insertion or update.
  useEffect(() => {
    const handler = () => {
      refreshFromSupabase();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("video-added", handler as EventListener);
      window.addEventListener("video-updated", handler as EventListener);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("video-added", handler as EventListener);
        window.removeEventListener("video-updated", handler as EventListener);
      }
    };
  }, []);

  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;
  if (!files) return <div className="p-4">Loading videos…</div>;

  const parseFile = (name: string) => {
    // If name is a URL, extract the final path segment first
    let base = name;
    try {
      if (/^https?:\/\//i.test(name)) {
        const u = new URL(name);
        base = u.pathname.split("/").filter(Boolean).pop() || name;
      }
    } catch {
      base = name;
    }
    base = base.replace(/\.[^.]+$/, "");
    const m = base.match(/^(\d{4})[_-]?(\d{2})[_-]?(\d{2})[_-_]?(.*)$/);
    if (m) {
      const year = m[1];
      const month = m[2];
      const day = m[3];
      let title = m[4] || "";
      title = title.replace(/[_-]*source$/i, "");
      title = title.replace(/[_-]+/g, " ").trim();
      const dateObj = new Date(`${year}-${month}-${day}`);
      const validDate = !isNaN(dateObj.getTime());
      const prettyDate = validDate
        ? dateObj.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : `${year}-${month}-${day}`;
      return { date: prettyDate, title: title || base };
    }
    return { date: "", title: base };
  };

  function VideoCard({ file, index, onImageClick }: { file: FileEntry; index: number; onImageClick: (url: string) => void }): React.ReactElement {
    // Simple local Badge component (minimal shadcn-style substitute)
    function Badge({ children }: { children: React.ReactNode }) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-800 mr-2">
          {children}
        </span>
      );
    }
    // Normalize entry: accept string or object { title?, date?, url }
    const raw = typeof file === "string" ? file : file.url;
    const src = /^https?:\/\//i.test(raw)
      ? raw
      : `/aom_yumi/${encodeURIComponent(raw)}`;
    const isUrl = /^https?:\/\//i.test(raw);

    // --- media type detection (by extension first) ---
    const lowerPath = (() => {
      try {
        if (isUrl) {
          const u = new URL(raw);
          return u.pathname.toLowerCase();
        }
      } catch {}
      return raw.toLowerCase();
    })();
    const extMatch = lowerPath.match(/\.([a-z0-9]+)(?:$|[?#])/);
    const ext = extMatch ? extMatch[1] : "";
    const IMAGE_EXTS = new Set(["jpg","jpeg","png","webp","gif","avif","bmp","svg"]);
    const VIDEO_EXTS = new Set(["mp4","webm","mov","m4v","mkv","avi","ts","m3u8"]);
    const { initialIsImage, initialIsVideo } = (() => {
      const img = IMAGE_EXTS.has(ext);
      const inferredVid = VIDEO_EXTS.has(ext) || (!ext && !isUrl);
      const vid = img ? false : inferredVid; // if image, not video
      return { initialIsImage: img, initialIsVideo: vid };
    })();
    const [isImage, setIsImage] = useState<boolean>(initialIsImage);
    const [isVideo, setIsVideo] = useState<boolean>(initialIsVideo || !initialIsImage);

  const parsed = parseFile(raw);
    const title =
      typeof file === "string" ? parsed.title : file.title ?? parsed.title;
    const date =
      typeof file === "string" ? parsed.date : file.date ?? parsed.date;
    const actor = typeof file !== "string" ? file.actor : undefined;
    const id = typeof file !== "string" ? file.id : undefined;

    // If the entry is an object with a URL, extract the host to show as a badge
    let domain: string | null = null;
    if (typeof file !== "string") {
      try {
        const u = new URL(file.url);
        domain = u.hostname.replace(/^www\./, "");
      } catch {
        domain = null;
      }
    }
    const [poster, setPoster] = useState<string | null>();
    const [isPlaying, setIsPlaying] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const generatedRef = useRef(false);
  const [imgFailed, setImgFailed] = useState(false);

    // If unknown extension & remote, lazily HEAD check when visible to confirm content-type (done inside intersection logic)

    useEffect(() => {
      if (isImage) return; // no video thumb work needed
      let obs: IntersectionObserver | null = null;
      const el = containerRef.current;
      const debugId = `${index}-${raw}`;
      if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 1. effect mount (isUrl=${isUrl}, isImage=${isImage}, isVideo=${isVideo})`);

  const tryServerThumb = async (): Promise<boolean> => {
        if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 2. tryServerThumb start (isUrl=${isUrl})`);
        // For local files we probe the local thumbs folder.
        if (!isUrl) {
          if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 2.1 local HEAD probe start`);
          const thumbPath = `/aom_yumi_thumbs/${encodeURIComponent(raw)}.jpg`;
          try {
            const res = await fetch(thumbPath, { method: "HEAD" });
            if (res.ok) {
              setPoster(thumbPath);
              if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 2.1 local HEAD success => poster=${thumbPath}`);
              return true;
            }
          } catch {
            // ignore
          }
          if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 2.1 local HEAD miss`);
          return false;
        }

        // For remote URLs: do not call the server API (unreliable/blocked).
        // Instead, use heuristic jpg paths and let the browser attempt to load them.
        if (isUrl) {
          try {
            if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 2.2 remote heuristics start`);
            const u = new URL(raw);
            const pathPoster = `${u.origin}${u.pathname.replace(/\.[^.]+$/, ".jpg")}`;
            setPoster(pathPoster);
            if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 2.2 remote heuristic pathPoster=${pathPoster}`);
            return true;
          } catch {
            if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 2.2 remote heuristic failed`);
          }
        }

        // Heuristic fallbacks (best-effort): set probable jpg paths and let browser try
        try {
          if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 2.3 heuristic path attempt #1 (.jpg replace)`);
          const u = new URL(raw);
          const pathPoster = `${u.origin}${u.pathname.replace(
            /\.[^.]+$/,
            ".jpg"
          )}`;
          setPoster(pathPoster);
          if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 2.3 heuristic success pathPoster=${pathPoster}`);
          return true;
        } catch {
          try {
            if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 2.3 heuristic attempt #2 (regex replace)`);
            setPoster(raw.replace(/\.[^.]+(?=$|[?#])/, ".jpg"));
            if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 2.3 heuristic success #2`);
            return true;
          } catch {
            try {
              if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 2.3 heuristic attempt #3 (append .jpg)`);
              setPoster(raw + ".jpg");
              if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 2.3 heuristic success #3`);
              return true;
            } catch {
              // give up
              if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 2.3 heuristic failed all attempts`);
            }
          }
        }
        return false;
      };

  const generateThumb = async (): Promise<void> => {
        // Only generate thumbnails for local files (avoids CORS problems for remote URLs)
        if (isUrl) return;
        if (generatedRef.current) return;
        generatedRef.current = true;
        if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 3. generateThumb start (local capture)`);
        try {
          const vid = document.createElement("video");
          vid.crossOrigin = "anonymous";
          vid.preload = "metadata";
          vid.muted = true; // mobile Safari allows loading/seek when muted
          vid.playsInline = true;
          vid.src = src;
          if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 3.1 video element prepared src=${src}`);

          // Wait for metadata / canplay with timeout to avoid hanging on some mobile browsers
          await new Promise<void>((resolve, reject) => {
            let settled = false;
            const timer = setTimeout(() => {
              if (!settled) {
                settled = true;
                if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 3.2 metadata timeout fallback`);
                resolve(); // proceed with whatever we have
              }
            }, 5000);
            const done = () => {
              if (settled) return;
              settled = true;
              clearTimeout(timer);
              if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 3.2 metadata loaded`);
              resolve();
            };
            const fail = () => {
              if (settled) return;
              settled = true;
              clearTimeout(timer);
              if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 3.2 metadata error`);
              reject(new Error("video metadata load error"));
            };
            vid.addEventListener("loadedmetadata", done, { once: true });
            vid.addEventListener("canplay", done, { once: true });
            vid.addEventListener("error", fail, { once: true });
          });

          // Seek to 1s if possible; if duration shorter, use 0.1s
          const seekTarget = Math.min(
            1,
            vid.duration > 0 ? vid.duration - 0.05 : 0.1
          );
          if (seekTarget > 0) {
            try {
              if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 3.3 seeking to ${seekTarget.toFixed(2)}s (duration=${vid.duration})`);
              await new Promise<void>((resolve) => {
                const onSeek = () => resolve();
                vid.currentTime = seekTarget;
                vid.addEventListener("seeked", onSeek, { once: true });
                // Fallback in case seek never fires
                setTimeout(() => resolve(), 1200);
              });
              if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 3.3 seek complete`);
            } catch {
              // ignore seek failure
              if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 3.3 seek failed`);
            }
          }

          if (vid.videoWidth === 0 || vid.videoHeight === 0) return; // nothing to draw
          const canvas = document.createElement("canvas");
          canvas.width = vid.videoWidth;
          canvas.height = vid.videoHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          try {
            ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
            setPoster(dataUrl);
            if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 3.4 draw success -> poster(dataURL len=${dataUrl.length})`);
          } catch {
            // draw failed
            if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 3.4 draw failed`);
          }
        } catch {
          // ignore - poster remains null
          if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 3.x generateThumb exception`);
        }
      };

  const onIntersect: IntersectionObserverCallback = (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
    if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 4. intersect visible -> start process (isImage=${isImage})`);
            // If we haven't determined type (unknown extension) and remote, attempt a HEAD to decide
            if (isUrl && !ext && !isImage && !generatedRef.current) {
              (async () => {
                try {
                if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 4.a HEAD probe for content-type start`);
                const headRes = await fetch(src, { method: 'HEAD' });
                const ct = headRes.headers.get('content-type') || '';
                if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 4.a HEAD content-type='${ct}'`);
                if (ct.startsWith('image/')) {
                  setIsImage(true); setIsVideo(false);
                  if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 4.a determined image; skipping video pipeline`);
                  // no further video thumb work; disconnect observer
                  if (obs && el) { obs.unobserve(el); obs.disconnect(); if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 6. observer disconnected (image)`); }
                  return;
                }
                } catch {}
              })();
            }
            tryServerThumb().then((has) => {
      if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 5. tryServerThumb result has=${has}`);
              if (!has) generateThumb();
            });
            if (obs && el) {
              obs.unobserve(el);
              obs.disconnect();
      if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 6. observer disconnected`);
            }
          }
        }
      };

      if (el && typeof IntersectionObserver !== "undefined") {
        // reduce eager prefetching on mobile by tightening the rootMargin
        obs = new IntersectionObserver(onIntersect, { rootMargin: "100px" });
        obs.observe(el);
        if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 0. observer registered`);
      } else {
        tryServerThumb().then((has) => {
          if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] 4'. no observer tryServerThumb has=${has}`);
          if (!has) generateThumb();
        });
      }

      return () => {
        if (obs) obs.disconnect();
        if (THUMB_DEBUG) console.log(`[THUMB ${debugId}] cleanup`);
      };
  }, [raw, src, isUrl, index, isImage, isVideo, ext]);

    return (
      <div ref={containerRef} className="flex flex-col">
        <div className={`relative rounded-xl overflow-hidden w-full ${isImage ? 'bg-transparent' : 'bg-black'}`}>
          {isImage ? (
            imgFailed ? (
              // fallback raw <img>
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={title || 'image'}
                className="w-full h-full object-cover aspect-[9/16]"
                style={{ maxHeight: '80vh' }}
                onClick={() => onImageClick(src)}
              />
            ) : (
              <Image
                src={src}
                alt={title || 'image'}
                width={360}
                height={640}
                className="w-full h-full object-cover aspect-[9/16]"
                style={{ maxHeight: "80vh" }}
                priority={false}
                unoptimized
                onClick={() => onImageClick(src)}
                role="button"
                aria-label="이미지 크게 보기"
                onError={() => { if (THUMB_DEBUG) console.log('[IMG]', 'error', src); setImgFailed(true); }}
                onLoadingComplete={() => { if (THUMB_DEBUG) console.log('[IMG]', 'loaded', src); }}
              />
            )
          ) : (
            <video
              ref={videoRef}
              className="w-full h-full object-cover aspect-[9/16]"
              style={{ maxHeight: "80vh" }}
              controls
              playsInline
              preload="none"
              poster={poster || ""}
              src={src}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          )}

          {/* Centered Play icon overlay shown when there is no poster and video not playing */}
          {!isImage && !poster && !isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Play className="w-12 h-12 text-white/90 drop-shadow" />
            </div>
          )}
        </div>
        <div className="p-3 space-y-1">
          <div className="flex flex-col gap-2 w-fit">
            {domain && <Badge>{domain}</Badge>}
            {actor && (
              <span className="text-[10px] w-fit px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                {actor}
              </span>
            )}
          </div>
          <div className="font-semibold text-sm text-black line-clamp-2">
            {title}
          </div>
          <div className="text-[11px] text-gray-400 flex items-center justify-between">
            <span>{date}</span>
            {id && usingSupabase && (
              <EditVideoDialog
                video={{
                  id,
                  title: title || null,
                  date:
                    file && typeof file !== "string" ? file.date ?? null : null,
                  url: src,
                  actor: actor || null,
                }}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col items-center justify-between mb-4">
        <div>
          {usingSupabase === false && (
            <div className="text-sm text-yellow-700">
              Supabase configured but unreachable — using local JSON fallback.
            </div>
          )}
        </div>
        <div className="flex items-center gap-2" />

  {/* Default to 2 columns on small/phone screens as requested */}
  <div className="grid auto-rows-fr gap-4 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {(() => {
            const used = new Set<string>();
            const prepared = files!.map((f, i) => {
              let base: string;
              if (typeof f !== 'string' && typeof f.id === 'number') {
                base = `id:${f.id}`;
              } else {
                base = typeof f === 'string' ? f : (f.url || f.title || String(i));
              }
              let finalKey = base;
              if (used.has(finalKey)) {
                let n = 1;
                while (used.has(`${base}::${n}`)) n++;
                finalKey = `${base}::${n}`;
                if (THUMB_DEBUG) console.log('[KEY] duplicate resolved', base, '=>', finalKey);
              }
              used.add(finalKey);
              return { f, i, key: finalKey };
            });
              return prepared.map(({ f, i, key }) => (
              <VideoCard
                key={key}
                file={f}
                index={i}
                onImageClick={(u) => {
                  try {
                    // open in new tab for faster full-size viewing on mobile
                    window.open(u, "_blank", "noopener,noreferrer");
                  } catch {
                    // fallback to in-app preview
                    setPreviewImage(u);
                  }
                }}
              />
            ));
          })()}
        </div>
      </div>
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewImage(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="max-w-[90vw] max-h-[90vh]">
            {/* Use native img for full-size to avoid layout constraints */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImage}
              alt="preview"
              className="max-w-full max-h-[90vh] object-contain rounded shadow-lg"
            />
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }}
            className="absolute top-4 right-4 text-white text-sm bg-black/50 rounded px-3 py-1 hover:bg-black/70"
          >닫기</button>
        </div>
      )}
    </div>
  );
}
