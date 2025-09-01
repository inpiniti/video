"use client";

import React, { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
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
  const [files, setFiles] = useState<FileEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usingSupabase, setUsingSupabase] = useState<boolean | null>(null);

  // Helper: fetch current rows from Supabase and update state (no JSON fallback here).
  const refreshFromSupabase = async () => {
    try {
      if (
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ) {
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
            .filter(Boolean) as { id?: number; title?: string; date?: string; url: string; actor?: string }[];
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
      if (
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ) {
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

  function VideoCard({ file }: { file: FileEntry }): React.ReactElement {
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

    useEffect(() => {
      let obs: IntersectionObserver | null = null;
      const el = containerRef.current;

      const tryServerThumb = async (): Promise<boolean> => {
        // For local files we probe the local thumbs folder.
        if (!isUrl) {
          const thumbPath = `/aom_yumi_thumbs/${encodeURIComponent(raw)}.jpg`;
          try {
            const res = await fetch(thumbPath, { method: "HEAD" });
            if (res.ok) {
              setPoster(thumbPath);
              return true;
            }
          } catch {
            // ignore
          }
          return false;
        }

        // For remote URLs: ask the server to generate/cache a thumbnail.
        try {
          const api = `/api/thumbnail?url=${encodeURIComponent(raw)}`;
          const res = await fetch(api);
          if (!res.ok) return false;
          const data = await res.json();
          if (data && data.url) {
            setPoster(data.url);
            return true;
          }
        } catch {
          // ignore and fall through to heuristics below
        }

        // Heuristic fallbacks (best-effort): set probable jpg paths and let browser try
        try {
          const u = new URL(raw);
          const pathPoster = `${u.origin}${u.pathname.replace(
            /\.[^.]+$/,
            ".jpg"
          )}`;
          setPoster(pathPoster);
          return true;
        } catch {
          try {
            setPoster(raw.replace(/\.[^.]+(?=$|[?#])/, ".jpg"));
            return true;
          } catch {
            try {
              setPoster(raw + ".jpg");
              return true;
            } catch {
              // give up
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
        try {
          const vid = document.createElement("video");
          vid.crossOrigin = "anonymous";
          vid.preload = "metadata";
          vid.src = src;

          await new Promise<void>((resolve, reject) => {
            const onLoaded = () => resolve();
            const onError = () => reject(new Error("video load error"));
            vid.addEventListener("loadeddata", onLoaded, { once: true });
            vid.addEventListener("error", onError, { once: true });
          });

          const seekTo = Math.min(1, vid.duration || 0);
          await new Promise<void>((resolve, reject) => {
            const onSeek = () => resolve();
            const onError = () => reject(new Error("seek error"));
            vid.currentTime = seekTo;
            vid.addEventListener("seeked", onSeek, { once: true });
            vid.addEventListener("error", onError, { once: true });
          });

          const canvas = document.createElement("canvas");
          canvas.width = vid.videoWidth || 480;
          canvas.height = vid.videoHeight || 854;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
          setPoster(dataUrl);
        } catch {
          // ignore - poster remains null
        }
      };

      const onIntersect: IntersectionObserverCallback = (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            tryServerThumb().then((has) => {
              if (!has) generateThumb();
            });
            if (obs && el) {
              obs.unobserve(el);
              obs.disconnect();
            }
          }
        }
      };

      if (el && typeof IntersectionObserver !== "undefined") {
        obs = new IntersectionObserver(onIntersect, { rootMargin: "200px" });
        obs.observe(el);
      } else {
        tryServerThumb().then((has) => {
          if (!has) generateThumb();
        });
      }

      return () => {
        if (obs) obs.disconnect();
      };
    }, [raw, src, isUrl]);

    return (
      <div ref={containerRef} className="flex flex-col">
        <div className="relative rounded-xl overflow-hidden w-full bg-black">
          <video
            ref={videoRef}
            className="w-full h-full object-cover aspect-[9/16]"
            style={{ maxHeight: "80vh" }}
            controls
            playsInline
            preload="metadata"
            poster={poster || ""}
            src={src}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />

          {/* Centered Play icon overlay shown when there is no poster and video not playing */}
          {!poster && !isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Play className="w-12 h-12 text-white/90 drop-shadow" />
            </div>
          )}
        </div>
        <div className="p-3 space-y-1">
          <div className="flex items-center gap-2">
            {domain && <Badge>{domain}</Badge>}
            {actor && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                {actor}
              </span>
            )}
          </div>
          <div className="font-semibold text-sm text-black line-clamp-2">{title}</div>
          <div className="text-[11px] text-gray-400 flex items-center justify-between">
            <span>{date}</span>
            {id && usingSupabase && (
              <EditVideoDialog
                video={{ id, title: title || null, date: file && typeof file !== 'string' ? file.date ?? null : null, url: src, actor: actor || null }}
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

        <div className="grid auto-rows-fr gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {files!.map((f, i) => {
            const key =
              typeof f === "string" ? f : f.url ?? f.title ?? String(i);
            return <VideoCard key={key} file={f} />;
          })}
        </div>
      </div>
    </div>
  );
}
