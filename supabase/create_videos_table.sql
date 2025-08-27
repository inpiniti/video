-- SQL: create a simple videos table for the app
-- Run this in Supabase SQL editor or psql connected to the DB

CREATE TABLE IF NOT EXISTS public.videos (
  id BIGSERIAL PRIMARY KEY,
  title TEXT,
  date DATE,
  url TEXT NOT NULL,
  actor TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Optional index for faster ordering by id
CREATE INDEX IF NOT EXISTS idx_videos_id ON public.videos (id);
