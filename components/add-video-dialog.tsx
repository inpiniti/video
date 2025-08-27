"use client";

import React, { useState } from "react";
import { Dialog, DialogTrigger, DialogContent, DialogClose } from "@radix-ui/react-dialog";
import { supabase } from "@/lib/supabaseClient";

export default function AddVideoDialog({ onAdded }: { onAdded?: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [url, setUrl] = useState("");
  const [actor, setActor] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.from("videos").insert({ title, date, url, actor });
      if (error) throw error;
      setOpen(false);
      setTitle("");
      setDate("");
      setUrl("");
      setActor("");
      onAdded?.();
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
        <button className="px-3 py-2 bg-blue-600 text-white rounded shadow">+ Add video</button>
      </DialogTrigger>
      <DialogContent className="w-full max-w-md p-4 rounded-lg bg-white">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Add video</h3>
          <DialogClose asChild>
            <button aria-label="Close" className="text-sm px-2">✕</button>
          </DialogClose>
        </div>

        <div className="flex flex-col gap-2 mt-2">
          <label className="text-sm">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="border p-2 rounded" />

          <label className="text-sm">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border p-2 rounded" />

          <label className="text-sm">URL</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} className="border p-2 rounded" />

          <label className="text-sm">Actor</label>
          <input value={actor} onChange={(e) => setActor(e.target.value)} className="border p-2 rounded" />
        </div>

        <div className="mt-4 flex justify-end">
          <button className="px-3 py-1 mr-2" onClick={() => setOpen(false)} disabled={loading}>Cancel</button>
          <button className="px-3 py-1 bg-primary text-primary-foreground rounded" onClick={submit} disabled={loading}>Add</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
