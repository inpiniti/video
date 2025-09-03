"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { supabase, hasSupabase } from "@/lib/supabaseClient";
import { EditVideoDialog } from "./edit-video-dialog";
import { generateAndUploadThumbnail, saveThumbnailToSupabase } from "@/lib/thumbnailUploader";
import { Button } from "@/components/ui/button";
import { DropboxAuth } from "./dropbox-auth";

// Clean implementation: all thumbnail generation code removed.

type FileEntry =
  | string
  | { id?: number; title?: string; date?: string; url: string; actor?: string; thumbnail?: string | null };

export default function VideoGrid(): React.ReactElement {
  const [files, setFiles] = useState<FileEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usingSupabase, setUsingSupabase] = useState<boolean | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Close preview with ESC
  useEffect(() => {
    if (!previewImage) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewImage(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewImage]);

  const refreshFromSupabase = async () => {
    try {
      if (!hasSupabase() || !supabase) return;
      const { data, error } = await supabase
        .from("videos")
  .select("id,title,date,url,actor,thumbnail")
        .order("id", { ascending: true })
        .limit(1000);
      if (!error && Array.isArray(data)) {
        const mapped = (data as any[]) // eslint-disable-line @typescript-eslint/no-explicit-any
          .map((r) => {
            if (!r || typeof r !== "object") return null;
            const url = typeof r.url === "string" ? r.url : undefined;
            if (!url) return null;
            return {
              id:
                typeof r.id === "number"
                  ? r.id
                  : typeof r.id === "string"
                  ? parseInt(r.id, 10) || undefined
                  : undefined,
              title: typeof r.title === "string" ? r.title : undefined,
              date: typeof r.date === "string" ? r.date : undefined,
              url,
              actor: typeof r.actor === "string" ? r.actor : undefined,
              thumbnail: typeof (r as { thumbnail?: unknown }).thumbnail === "string" ? (r as { thumbnail?: string }).thumbnail : undefined,
            };
          })
          .filter(Boolean) as FileEntry[];
        setFiles(mapped);
        setUsingSupabase(true);
      }
    } catch {
      /* ignore */
    }
  };

  // Initial load (Supabase then fallback JSON)
  useEffect(() => {
    let mounted = true;
    (async () => {
      let triedSupabase = false;
      if (hasSupabase() && supabase) {
        triedSupabase = true;
        try {
          const { data, error } = await supabase
            .from("videos")
            .select("id,title,date,url,actor,thumbnail")
            .order("id", { ascending: true })
            .limit(1000);
          if (!mounted) return;
          if (!error && Array.isArray(data)) {
            setUsingSupabase(true);
            const mapped = (data as any[]) // eslint-disable-line @typescript-eslint/no-explicit-any
              .map((r) => {
                if (!r || typeof r !== "object") return null;
                const url = typeof r.url === "string" ? r.url : undefined;
                if (!url) return null;
                return {
                  id:
                    typeof r.id === "number"
                      ? r.id
                      : typeof r.id === "string"
                      ? parseInt(r.id, 10) || undefined
                      : undefined,
                  title: typeof r.title === "string" ? r.title : undefined,
                  date: typeof r.date === "string" ? r.date : undefined,
                  url,
                  actor: typeof r.actor === "string" ? r.actor : undefined,
                  thumbnail: typeof (r as { thumbnail?: unknown }).thumbnail === "string" ? (r as { thumbnail?: string }).thumbnail : undefined,
                };
              })
              .filter(Boolean) as FileEntry[];
            setFiles(mapped);
            return;
          }
          setUsingSupabase(false);
        } catch {
          setUsingSupabase(false);
        }
      }
      // Fallback to static JSON
      try {
        const res = await fetch("/aom_yumi.json");
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        if (!mounted) return;
        if (Array.isArray(data)) {
          if (triedSupabase) setUsingSupabase(false);
          setFiles(data as FileEntry[]);
        } else setError("Invalid JSON format");
      } catch (e: unknown) {
        if (!mounted) return;
        setError(String(e));
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Listen to add/update events
  useEffect(() => {
    const handler = () => {
      refreshFromSupabase();
    };
    window.addEventListener("video-added", handler as EventListener);
    window.addEventListener("video-updated", handler as EventListener);
    return () => {
      window.removeEventListener("video-added", handler as EventListener);
      window.removeEventListener("video-updated", handler as EventListener);
    };
  }, []);

  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;
  if (!files) return <div className="p-4">Loading media…</div>;

  const parseFile = (name: string) => {
    let base = name;
    try {
      if (/^https?:\/\//i.test(name)) {
        const u = new URL(name);
        base = u.pathname.split("/").filter(Boolean).pop() || name;
      }
    } catch {
      /* ignore */
    }
    base = base.replace(/\.[^.]+$/, "");
    const m = base.match(/^(\d{4})[_-]?(\d{2})[_-]?(\d{2})[_-_]?(.*)$/);
    if (m) {
      const [, year, month, day] = m;
      let title = m[4] || "";
      title = title
        .replace(/[_-]*source$/i, "")
        .replace(/[_-]+/g, " ")
        .trim();
      const d = new Date(`${year}-${month}-${day}`);
      const prettyDate = !isNaN(d.getTime())
        ? d.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : `${year}-${month}-${day}`;
      return { date: prettyDate, title: title || base };
    }
    return { date: "", title: base };
  };

  function Card({ file }: { file: FileEntry }) {
    const raw = typeof file === "string" ? file : file.url;
    const src = /^https?:\/\//i.test(raw)
      ? raw
      : `/aom_yumi/${encodeURIComponent(raw)}`;
    const isUrl = /^https?:\/\//i.test(raw);
    // Detect cross-origin (client side only)
    const isCrossOrigin = (() => {
      if (!isUrl) return false;
      try {
        return new URL(src).origin !== window.location.origin;
      } catch {
        return false;
      }
    })();
    let domain: string | null = null;
    if (isUrl) {
      try {
        const u = new URL(src);
        domain = u.hostname.replace(/^www\./, "");
      } catch {
        /* ignore */
      }
    }
    const lower = (() => {
      try {
        if (isUrl) {
          const u = new URL(raw);
          return u.pathname.toLowerCase();
        }
      } catch {
        /* ignore */
      }
      return raw.toLowerCase();
    })();
    const ext = (lower.match(/\.([a-z0-9]+)(?:$|[?#])/) || [, ""])[1];
    const IMAGE_EXTS = new Set([
      "jpg",
      "jpeg",
      "png",
      "webp",
      "gif",
      "avif",
      "bmp",
      "svg",
    ]);
    const isImage = IMAGE_EXTS.has(ext);
    const parsed = parseFile(raw);
    const title =
      typeof file === "string" ? parsed.title : file.title ?? parsed.title;
    const date =
      typeof file === "string" ? parsed.date : file.date ?? parsed.date;
    const actor = typeof file !== "string" ? file.actor : undefined;
    const id = typeof file !== "string" ? file.id : undefined;
    const thumbnail = typeof file !== "string" ? file.thumbnail : undefined;
    const [thumbLoading, setThumbLoading] = useState(false);

    const handleGenerate = async () => {
      if (!id) return;
      try {
        setThumbLoading(true);
        const processingSrc = isCrossOrigin ? `/api/video-proxy?u=${encodeURIComponent(raw)}` : src;
        const { publicUrl } = await generateAndUploadThumbnail(processingSrc);
        await saveThumbnailToSupabase(id, publicUrl);
        // optimistic update
        setFiles((prev) => prev?.map(f => (typeof f !== 'string' && f.id === id ? { ...f, thumbnail: publicUrl } : f)) || prev);
      } catch (e) {
        alert('Thumbnail failed: ' + e);
      } finally {
        setThumbLoading(false);
      }
    };
    return (
      <div className="flex flex-col">
        <div className="relative rounded-xl overflow-hidden w-full bg-black">
          {thumbnail ? (
            <Image
              src={thumbnail}
              alt={title || 'thumbnail'}
              width={360}
              height={640}
              className="w-full h-full object-cover aspect-[9/16]"
              unoptimized
              onClick={() => { try { window.open(src,'_blank','noopener,noreferrer'); } catch {/* ignore */} }}
            />
          ) : isImage ? (
            <Image
              src={src}
              alt={title || "image"}
              width={360}
              height={640}
              className="w-full h-full object-cover aspect-[9/16]"
              unoptimized
              onClick={() => { try { window.open(src, "_blank", "noopener,noreferrer"); } catch {/* ignore */} }}
            />
          ) : (
            <video
              className="w-full h-full object-cover aspect-[9/16]"
              style={{ maxHeight: "80vh" }}
              controls
              playsInline
              preload="none"
              src={src}
            />
          )}
        </div>
        <div className="p-3 space-y-1">
          <div className="flex flex-col gap-2 w-fit">
            {domain && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-800 mr-2">
                {domain}
              </span>
            )}
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
            <div className="flex items-center gap-1">
              {id && usingSupabase && (
                <>
                  <EditVideoDialog
                    video={{
                      id,
                      title: title || null,
                      date: typeof file !== "string" ? file.date ?? null : null,
                      url: src,
                      actor: actor || null,
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={thumbLoading}
                    onClick={handleGenerate}
                    title={isCrossOrigin ? 'Using proxy fetch for cross-origin video' : undefined}
                  >
                    {thumbLoading ? '...' : (thumbnail ? 'Regen' : 'Thumbnail')}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
  <DropboxAuth />
      {usingSupabase === false && (
        <div className="text-sm text-yellow-700">
          Supabase configured but unreachable — using local JSON fallback.
        </div>
      )}
      <div className="grid auto-rows-fr gap-4 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {files.map((f, i) => {
          const key =
            typeof f === "string"
              ? f
              : f.id
              ? `id:${f.id}`
              : f.url || f.title || String(i);
          return <Card key={key} file={f} />;
        })}
      </div>
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewImage(null)}
          role="dialog"
          aria-modal="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewImage}
            alt="preview"
            className="max-w-full max-h-[90vh] object-contain rounded shadow-lg"
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewImage(null);
            }}
            className="absolute top-4 right-4 text-white text-sm bg-black/50 rounded px-3 py-1 hover:bg-black/70"
          >
            닫기
          </button>
        </div>
      )}
    </div>
  );
}
