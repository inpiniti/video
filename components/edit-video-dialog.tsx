"use client";

import React, { useState } from "react";
import { supabase, hasSupabase } from "@/lib/supabaseClient";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export interface EditVideoData {
  id: number;
  title?: string | null;
  date?: string | null;
  url: string;
  actor?: string | null;
  thumbnail?: string | null;
}

export function EditVideoDialog({ video }: { video: EditVideoData }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(video.title ?? "");
  const [date, setDate] = useState(video.date ?? "");
  const [url, setUrl] = useState(video.url);
  const [actor, setActor] = useState(video.actor ?? "");
  const [thumbnail, setThumbnail] = useState(video.thumbnail ?? "");
  const [loading, setLoading] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      if (!hasSupabase() || !supabase) throw new Error("Supabase not configured");
      const { error } = await supabase
        .from("videos")
        .update({
          title: title || null,
          date: date || null,
          url,
          actor: actor || null,
          thumbnail: thumbnail ? thumbnail : null,
        })
        .eq("id", video.id);
      if (error) throw error;
      setOpen(false);
      window.dispatchEvent(new CustomEvent("video-updated"));
    } catch (e) {
      alert(String(e));
    } finally {
      setLoading(false);
    }
  };

  const regenerateThumbnail = async () => {
    try {
      setRegenLoading(true);
      if (!hasSupabase() || !supabase) throw new Error('Supabase not configured');
      // dynamic import to avoid circular
      const { generateAndUploadThumbnail, saveThumbnailToSupabase } = await import('@/lib/thumbnailUploader');
      const processingSrc = url.startsWith('http') ? `/api/video-proxy?u=${encodeURIComponent(url)}` : url;
      const { publicUrl } = await generateAndUploadThumbnail(processingSrc);
      await saveThumbnailToSupabase(video.id, publicUrl);
      setThumbnail(publicUrl);
    } catch (e) {
      alert('Regen failed: ' + e);
    } finally {
      setRegenLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full max-w-md p-4 rounded-lg bg-white">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Edit Video</h3>
        </div>
        <div className="flex flex-col gap-2 mt-2">
          <label className="text-sm">Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          <label className="text-sm">Date (YYYY-MM-DD)</label>
          <Input value={date} onChange={(e) => setDate(e.target.value)} />
          <label className="text-sm">URL</label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} />
          <label className="text-sm">Actor</label>
          <Input value={actor} onChange={(e) => setActor(e.target.value)} />
          <div className="mt-2 flex flex-col gap-1">
            <label className="text-sm flex items-center gap-2">Thumbnail URL
              {regenLoading && <span className="text-[10px] text-gray-400">(generating...)</span>}
            </label>
            <Input value={thumbnail} onChange={(e) => setThumbnail(e.target.value)} placeholder="https://...jpg" />
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={regenerateThumbnail} disabled={regenLoading}>
                {regenLoading ? 'Regen...' : 'Generate from video'}
              </Button>
              {thumbnail && (
                <a href={thumbnail} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline">open</a>
              )}
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button size="sm" onClick={submit} disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
