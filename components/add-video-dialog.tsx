"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogClose,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { SidebarMenuButton } from "./ui/sidebar";

export default function AddVideoDialog({
  onAdded,
  useMenuTrigger = false,
}: {
  onAdded?: () => void;
  useMenuTrigger?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [url, setUrl] = useState("");
  const [actor, setActor] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      type Payload = {
        title?: string;
        url: string;
        actor?: string;
        date?: string;
      };
      const payload: Payload = { title, url, actor, date };
      const { error } = await supabase.from("videos").insert(payload);
      if (error) throw error;
      setOpen(false);
      setTitle("");
      setDate("");
      setUrl("");
      setActor("");
      // Fire callback & global event so other components (e.g., grid) can refresh.
      onAdded?.();
      try {
        window.dispatchEvent(new CustomEvent("video-added"));
      } catch {}
    } catch (err) {
      console.error(err);
      alert(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {useMenuTrigger ? (
          <SidebarMenuButton className="justify-start">
            + Add Video
          </SidebarMenuButton>
        ) : (
          <Button>+ Add video</Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-full max-w-md p-4 rounded-lg bg-white">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Add video</h3>
        </div>

        <div className="flex flex-col gap-2 mt-2">
          <label className="text-sm">Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />

          <label className="text-sm">Date</label>
          <Input
            value={date}
            onChange={(e) => setDate(e.target.value)}
            placeholder="2023-01-01"
          />

          <label className="text-sm">URL</label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} />

          <label className="text-sm">Actor</label>
          <Input value={actor} onChange={(e) => setActor(e.target.value)} />
        </div>

        <div className="mt-4 flex justify-end">
          <button
            className="px-3 py-1 mr-2"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </button>
          <Button onClick={submit} disabled={loading}>
            Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
