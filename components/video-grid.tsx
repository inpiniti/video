"use client";

import React, { useEffect, useRef, useState } from "react";

type FileEntry = string;

export default function VideoGrid(): React.ReactElement {
  const [files, setFiles] = useState<FileEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/aom_yumi.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!mounted) return;
        if (Array.isArray(data)) setFiles(data as FileEntry[]);
        else setError("Invalid JSON format");
      })
      .catch((err) => {
        if (!mounted) return;
        setError(String(err));
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;
  if (!files) return <div className="p-4">Loading videos…</div>;

  const parseFile = (name: string) => {
    const base = name.replace(/\.[^.]+$/, "");
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
    const { title, date } = parseFile(file);
    const [poster, setPoster] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const generatedRef = useRef(false);

    useEffect(() => {
      let obs: IntersectionObserver | null = null;
      const el = containerRef.current;

      const tryServerThumb = async (): Promise<boolean> => {
        const thumbPath = `/aom_yumi_thumbs/${encodeURIComponent(file)}.jpg`;
        try {
          const res = await fetch(thumbPath, { method: "HEAD" });
          if (res.ok) {
            setPoster(thumbPath);
            return true;
          }
        } catch (e) {
          // ignore
        }
        return false;
      };

      const generateThumb = async (): Promise<void> => {
        if (generatedRef.current) return;
        generatedRef.current = true;
        try {
          const vid = document.createElement("video");
          vid.crossOrigin = "anonymous";
          vid.preload = "metadata";
          vid.src = `/aom_yumi/${encodeURIComponent(file)}`;

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
        } catch (e) {
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
    }, [file]);

    return (
      <div ref={containerRef} className="flex flex-col">
        <div className="rounded-xl overflow-hidden w-full bg-black">
          <video
            className="w-full h-full object-cover aspect-[9/16]"
            controls
            playsInline
            preload="metadata"
            poster={poster ?? "/file.svg"}
            src={`/aom_yumi/${encodeURIComponent(file)}`}
          />
        </div>
        <div className="p-3">
          <div className="font-semibold text-sm text-black">{title}</div>
          <div className="text-xs text-gray-400">{date}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 md:grid-cols-3">
      {files!.map((f) => (
        <VideoCard key={f} file={f} />
      ))}
    </div>
  );
}
