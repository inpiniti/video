'use client';

import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { supabase, hasSupabase } from '@/lib/supabaseClient';
import { EditVideoDialog } from './edit-video-dialog';
import {
  generateAndUploadThumbnail,
  saveThumbnailToSupabase,
} from '@/lib/thumbnailUploader';
import { Button } from '@/components/ui/button';
import { DropboxAuth } from './dropbox-auth';
import { Play } from 'lucide-react';

// Clean implementation: all thumbnail generation code removed.

type FileEntry =
  | string
  | {
      id?: number;
      title?: string;
      date?: string;
      url: string;
      actor?: string;
      thumbnail?: string | null;
    };

export default function VideoGrid(): React.ReactElement {
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

  const refreshFromSupabase = async () => {
    try {
      if (!hasSupabase() || !supabase) return;
      const { data, error } = await supabase
        .from('videos')
        .select('id,title,date,url,actor,thumbnail')
        .order('id', { ascending: true })
        .limit(1000);
      if (!error && Array.isArray(data)) {
        const mapped = (data as any[]) // eslint-disable-line @typescript-eslint/no-explicit-any
          .map((r) => {
            if (!r || typeof r !== 'object') return null;
            const url = typeof r.url === 'string' ? r.url : undefined;
            if (!url) return null;
            return {
              id:
                typeof r.id === 'number'
                  ? r.id
                  : typeof r.id === 'string'
                  ? parseInt(r.id, 10) || undefined
                  : undefined,
              title: typeof r.title === 'string' ? r.title : undefined,
              date: typeof r.date === 'string' ? r.date : undefined,
              url,
              actor: typeof r.actor === 'string' ? r.actor : undefined,
              thumbnail:
                typeof (r as { thumbnail?: unknown }).thumbnail === 'string'
                  ? (r as { thumbnail?: string }).thumbnail
                  : undefined,
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
            .from('videos')
            .select('id,title,date,url,actor,thumbnail')
            .order('id', { ascending: true })
            .limit(1000);
          if (!mounted) return;
          if (!error && Array.isArray(data)) {
            setUsingSupabase(true);
            const mapped = (data as any[]) // eslint-disable-line @typescript-eslint/no-explicit-any
              .map((r) => {
                if (!r || typeof r !== 'object') return null;
                const url = typeof r.url === 'string' ? r.url : undefined;
                if (!url) return null;
                return {
                  id:
                    typeof r.id === 'number'
                      ? r.id
                      : typeof r.id === 'string'
                      ? parseInt(r.id, 10) || undefined
                      : undefined,
                  title: typeof r.title === 'string' ? r.title : undefined,
                  date: typeof r.date === 'string' ? r.date : undefined,
                  url,
                  actor: typeof r.actor === 'string' ? r.actor : undefined,
                  thumbnail:
                    typeof (r as { thumbnail?: unknown }).thumbnail === 'string'
                      ? (r as { thumbnail?: string }).thumbnail
                      : undefined,
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
        const res = await fetch('/aom_yumi.json');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (!mounted) return;
        if (Array.isArray(data)) {
          if (triedSupabase) setUsingSupabase(false);
          setFiles(data as FileEntry[]);
        } else setError('Invalid JSON format');
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
    window.addEventListener('video-added', handler as EventListener);
    window.addEventListener('video-updated', handler as EventListener);
    return () => {
      window.removeEventListener('video-added', handler as EventListener);
      window.removeEventListener('video-updated', handler as EventListener);
    };
  }, []);

  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;
  if (!files) return <div className="p-4">Loading media…</div>;

  const parseFile = (name: string) => {
    let base = name;
    try {
      if (/^https?:\/\//i.test(name)) {
        const u = new URL(name);
        base = u.pathname.split('/').filter(Boolean).pop() || name;
      }
    } catch {
      /* ignore */
    }
    base = base.replace(/\.[^.]+$/, '');
    const m = base.match(/^(\d{4})[_-]?(\d{2})[_-]?(\d{2})[_-_]?(.*)$/);
    if (m) {
      const [, year, month, day] = m;
      let title = m[4] || '';
      title = title
        .replace(/[_-]*source$/i, '')
        .replace(/[_-]+/g, ' ')
        .trim();
      const d = new Date(`${year}-${month}-${day}`);
      const prettyDate = !isNaN(d.getTime())
        ? d.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
        : `${year}-${month}-${day}`;
      return { date: prettyDate, title: title || base };
    }
    return { date: '', title: base };
  };

  function Card({ file }: { file: FileEntry }) {
    const raw = typeof file === 'string' ? file : file.url;

    // Detect TeraBox file ID format: terabox://[fileId]
    const isTeraBoxId = raw.startsWith('terabox://');
    const teraBoxFileId = isTeraBoxId ? raw.replace('terabox://', '') : null;

    const src = isTeraBoxId
      ? `/api/terabox-stream?fileId=${encodeURIComponent(teraBoxFileId!)}`
      : /^https?:\/\//i.test(raw)
      ? raw
      : `/aom_yumi/${encodeURIComponent(raw)}`;
    const isUrl = /^https?:\/\//i.test(raw);
    // Detect cross-origin (client side only)
    const isCrossOrigin = (() => {
      if (isTeraBoxId) return false; // TeraBox goes through our proxy
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
        domain = u.hostname.replace(/^www\./, '');
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
    const ext = (lower.match(/\.([a-z0-9]+)(?:$|[?#])/) || [, ''])[1];
    const IMAGE_EXTS = new Set([
      'jpg',
      'jpeg',
      'png',
      'webp',
      'gif',
      'avif',
      'bmp',
      'svg',
    ]);
    const isImage = IMAGE_EXTS.has(ext);
    const parsed = parseFile(raw);
    const title =
      typeof file === 'string' ? parsed.title : file.title ?? parsed.title;
    const date =
      typeof file === 'string' ? parsed.date : file.date ?? parsed.date;
    const actor = typeof file !== 'string' ? file.actor : undefined;
    const id = typeof file !== 'string' ? file.id : undefined;
    const thumbnail = typeof file !== 'string' ? file.thumbnail : undefined;
    const [thumbLoading, setThumbLoading] = useState(false);
    const [uploadLoading, setUploadLoading] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [authing, setAuthing] = useState(false);
    const [authTried, setAuthTried] = useState(false);
    const [overrideSrc, setOverrideSrc] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null); // Keep refs for values used inside effects to avoid re-running on each render
    const rawRef = useRef(raw);
    const authTriedRef = useRef(authTried);
    useEffect(() => {
      rawRef.current = raw;
    }, [raw]);
    useEffect(() => {
      authTriedRef.current = authTried;
    }, [authTried]);

    useEffect(() => {
      if (playing && videoRef.current) {
        // try autoplay; if it fails and source matches cyberdrop/gigachad, preflight and retry
        const v = videoRef.current;
        const tryPlay = async () => {
          try {
            await v.play();
          } catch {
            if (authTriedRef.current) return;
            // Attempt auth preflight and tokenized URL fetch
            try {
              setAuthTried(true);
              const u = new URL(rawRef.current, window.location.href);
              const host = u.hostname;
              const should =
                /gigachad-cdn\.ru$/i.test(host) || /cyberdrop\.me$/i.test(host);
              if (!should) return;
              // Extract key: prefer "/d/{key}" pattern
              let key: string | null = null;
              const parts = u.pathname.split('/').filter(Boolean);
              const idx = parts.findIndex((p) => p === 'd');
              if (idx >= 0 && parts[idx + 1]) key = parts[idx + 1];
              if (!key) key = parts.pop() || null;
              if (!key) return;
              setAuthing(true);
              const resp = await fetch(
                `/api/cyberdrop-auth?key=${encodeURIComponent(key)}`,
                { cache: 'no-store' }
              );
              if (resp.ok) {
                let tokenUrl: string | null = null;
                try {
                  const j = await resp.json();
                  if (j && typeof j.url === 'string') tokenUrl = j.url;
                } catch {
                  // fallback: read text and try naive url extraction
                  try {
                    const t = await resp.clone().text();
                    const m = t.match(/"url"\s*:\s*"([^"]+)"/);
                    if (m) tokenUrl = m[1];
                  } catch {
                    /* ignore */
                  }
                }
                if (tokenUrl) {
                  setOverrideSrc(tokenUrl);
                }
              }
            } finally {
              setAuthing(false);
            }
          }
        };
        void tryPlay();
      }
    }, [playing]);

    // When overrideSrc is set while already in playing mode, reload and try playback again
    useEffect(() => {
      if (!playing || !overrideSrc || !videoRef.current) return;
      const v = videoRef.current;
      // React will update src prop from state; give it a tick then play
      const id = setTimeout(() => {
        void v.play().catch(() => {
          /* ignore */
        });
      }, 50);
      return () => clearTimeout(id);
    }, [overrideSrc, playing]);

    const handleGenerate = async () => {
      if (!id) return;
      try {
        setThumbLoading(true);
        const processingSrc = isCrossOrigin
          ? `/api/video-proxy?u=${encodeURIComponent(raw)}`
          : src;
        const { publicUrl } = await generateAndUploadThumbnail(processingSrc);
        await saveThumbnailToSupabase(id, publicUrl);
        // optimistic update
        setFiles(
          (prev) =>
            prev?.map((f) =>
              typeof f !== 'string' && f.id === id
                ? { ...f, thumbnail: publicUrl }
                : f
            ) || prev
        );
      } catch (e) {
        alert('Thumbnail failed: ' + e);
      } finally {
        setThumbLoading(false);
      }
    };

    const [uploadProgress, setUploadProgress] = useState<string>('');

    const handleUpload = async () => {
      if (!id || !hasSupabase() || !supabase) return;

      try {
        setUploadLoading(true);
        setUploadProgress('Enqueueing...');

        // Get Supabase credentials from environment
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
          throw new Error('Supabase credentials not found');
        }

        // Add [upload] tag to title
        const currentTitle = title || '';
        const uploadingTitle = `[upload] ${currentTitle}`.trim();

        const { error: updateError } = await supabase
          .from('videos')
          .update({ title: uploadingTitle })
          .eq('id', id);

        if (updateError) {
          console.error('Failed to add [upload] tag:', updateError);
          throw new Error('Failed to prepare upload');
        }

        // Update local state
        setFiles(
          (prev) =>
            prev?.map((f) =>
              typeof f !== 'string' && f.id === id
                ? { ...f, title: uploadingTitle }
                : f
            ) || prev
        );

        setUploadProgress('Starting server job...');

        // Send to server with Supabase credentials
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            url: raw,
            supabaseUrl,
            supabaseKey,
          }),
        });

        if (!res.ok) throw new Error('Upload API failed');

        // Done! Server handles everything
        setUploadProgress('✅ Upload started! Processing in background...');

        // Show success for 3 seconds
        setTimeout(() => {
          setUploadProgress('');
          setUploadLoading(false);
        }, 3000);
      } catch (e) {
        alert(`Upload failed: ${e}`);
        setUploadLoading(false);
        setUploadProgress('');
      }
    };

    return (
      <div className="flex flex-col">
        <div className="relative rounded-xl overflow-hidden w-full bg-black">
          {thumbnail && !isImage && !playing ? (
            <div className="relative w-full h-full aspect-[9/16]">
              <Image
                src={thumbnail}
                alt={title || 'thumbnail'}
                width={360}
                height={640}
                className="w-full h-full object-cover"
                unoptimized
              />
              <button
                type="button"
                onClick={() => {
                  setAuthTried(false);
                  setOverrideSrc(null);
                  setPlaying(true);
                }}
                className="absolute inset-0 flex items-center justify-center group"
                aria-label="Play video"
              >
                <span className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white group-hover:bg-black/70 transition">
                  <Play className="w-8 h-8 ml-1" />
                </span>
              </button>
            </div>
          ) : thumbnail && !isImage && playing ? (
            <div className="relative">
              <video
                ref={videoRef}
                className="w-full h-full object-cover aspect-[9/16]"
                style={{ maxHeight: '80vh' }}
                controls
                playsInline
                preload="auto"
                src={overrideSrc || src}
                onError={() => {
                  if (authTried) return;
                  // Trigger auth flow via effect by toggling playing to re-run
                  setAuthTried(true);
                  // Kick the effect to run; it will detect failure and fetch token URL
                  // Do a no-op play attempt to route into catch path
                  if (videoRef.current) {
                    void videoRef.current.play().catch(() => {
                      /* handled in effect */
                    });
                  }
                }}
                autoPlay
              />
              {authing && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="px-2 py-1 text-xs rounded bg-black/60 text-white">
                    authenticating…
                  </span>
                </div>
              )}
            </div>
          ) : thumbnail && isImage ? (
            <Image
              src={thumbnail}
              alt={title || 'thumbnail'}
              width={360}
              height={640}
              className="w-full h-full object-cover aspect-[9/16]"
              unoptimized
              onClick={() => {
                try {
                  window.open(src, '_blank', 'noopener,noreferrer');
                } catch {
                  /* ignore */
                }
              }}
            />
          ) : isImage ? (
            <Image
              src={src}
              alt={title || 'image'}
              width={360}
              height={640}
              className="w-full h-full object-cover aspect-[9/16]"
              unoptimized
              onClick={() => {
                try {
                  window.open(src, '_blank', 'noopener,noreferrer');
                } catch {
                  /* ignore */
                }
              }}
            />
          ) : (
            <video
              className="w-full h-full object-cover aspect-[9/16]"
              style={{ maxHeight: '80vh' }}
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
                      date: typeof file !== 'string' ? file.date ?? null : null,
                      url: src,
                      actor: actor || null,
                      thumbnail:
                        typeof file !== 'string'
                          ? file.thumbnail ?? null
                          : null,
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={thumbLoading}
                    onClick={handleGenerate}
                    title={
                      isCrossOrigin
                        ? 'Using proxy fetch for cross-origin video'
                        : undefined
                    }
                  >
                    {thumbLoading ? '...' : thumbnail ? 'Regen' : 'Thumbnail'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploadLoading || !isUrl}
                    onClick={handleUpload}
                    title={
                      uploadProgress ||
                      'Download, compress (WebM AV1+Opus), upload to TeraBox'
                    }
                    className="min-w-[100px]"
                  >
                    {uploadLoading
                      ? uploadProgress || 'Uploading...'
                      : 'Upload'}
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
            typeof f === 'string'
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
