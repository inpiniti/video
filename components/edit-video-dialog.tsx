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
}

export function EditVideoDialog({ video }: { video: EditVideoData }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(video.title ?? "");
  const [date, setDate] = useState(video.date ?? "");
  const [url, setUrl] = useState(video.url);
  const [actor, setActor] = useState(video.actor ?? "");
  const [loading, setLoading] = useState(false);

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
