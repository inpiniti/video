"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

let internalClient: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    internalClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (e) {
    console.warn("Failed to init Supabase client:", e);
  }
} else {
  if (typeof window !== "undefined") {
    console.warn(
      "Supabase env vars NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not set — falling back to JSON catalog."
    );
  }
}

export const supabase = internalClient;
export function hasSupabase() {
  return !!internalClient;
}
