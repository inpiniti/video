This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Local video catalog

This project includes a JSON catalog generated from files in `public/aom_yumi` and exposed at `/aom_yumi.json`.

- Place video files into `public/aom_yumi` and re-generate the catalog (or run the script used by the maintainer) to update the list.
- The homepage (`app/page.tsx`) loads `/aom_yumi.json` and renders the videos in a responsive grid via `components/video-grid.tsx`.

## Session changelog (actions performed in this workspace)

Summary: I wired up a simple video catalog flow and a client-side video grid that displays vertical "shorts" style videos, parses filenames for title/date, and uses thumbnails when available (or generates them on the client when a card scrolls into view).

Files added/modified
- `public/aom_yumi.json` — JSON array of video filenames (created from the files in `public/aom_yumi`).
- `components/video-grid.tsx` — client component that:
	- fetches `/aom_yumi.json` on the client,
	- parses each filename of the form `{YYYY}_{MM}_{DD}_{title}.mp4` to extract a readable date and a cleaned title,
	- renders each video in a vertical (9:16) aspect ratio with controls,
	- uses a server-side thumbnail at `/public/aom_yumi_thumbs/{filename}.jpg` when present (HEAD request), otherwise generates a data-URL thumbnail client-side when the card becomes visible (IntersectionObserver + hidden video + canvas).
- `app/page.tsx` — replaced placeholder boxes with `<VideoGrid />` and adjusted the import to the component location.
- `README.md` — this section and a short previous note about the catalog were added.

Other changes
- Ran `npx shadcn@latest init` after removing an existing `components.json` (the init created `components.json` and `lib/utils.ts` and updated CSS variables). This was part of setting up UI components in the project.

Notes and behavior
- File name parsing: filenames like `2023_02_22_some-title_source.mp4` are parsed into `Feb 22, 2023` and `some title` (the parser strips common suffix `_source` and replaces underscores/hyphens with spaces).
- Poster/thumbnail behavior:
	- First a HEAD request is attempted for `/aom_yumi_thumbs/{filename}.jpg` (server-generated thumbnail).
	- If missing, the browser will load the video (only when the card is visible) and capture a frame into a canvas to use as a data-URL poster.
	- Client-side thumbnail generation is intentionally deferred (IntersectionObserver) to avoid loading all videos at once.

Lint note
- There are minor lint warnings left intentionally (unused `catch` error variable in some catch blocks). They don't affect runtime; I can remove or log those errors if you prefer.

How to regenerate `public/aom_yumi.json` from the `public/aom_yumi` folder (PowerShell)
Place this in the repo root (PowerShell):

```powershell
# create/update JSON array of filenames
Get-ChildItem -Path .\public\aom_yumi -File | Select-Object -ExpandProperty Name | ConvertTo-Json -Compress | Out-File -Encoding utf8 .\public\aom_yumi.json
```

Optional: generate server thumbnails (requires ffmpeg installed)
- Create a thumbnails folder first: `mkdir public\aom_yumi_thumbs`
- Example PowerShell batch (will extract a frame at 1s for each mp4):

```powershell
Get-ChildItem .\public\aom_yumi -Filter *.mp4 | ForEach-Object {
	$in = $_.FullName
	$out = Join-Path .\public\aom_yumi_thumbs ($_.BaseName + '.jpg')
	ffmpeg -y -i $in -ss 00:00:01 -vframes 1 -q:v 2 $out
}
```

What I tested
- Verified `public/aom_yumi.json` exists and `components/video-grid.tsx` reads it.
- Implemented client-side thumbnail generation and server-thumb fallback. I validated the code compiles in the editor; please run the dev server and open `http://localhost:3000` to visually confirm thumbnails and vertical video layout.

Next steps (optional)
- Add a server API route to generate the JSON catalog on demand.
- Add a build-step script that runs ffmpeg to create `public/aom_yumi_thumbs` for all videos.
- Add a lightbox/fullscreen player for better viewing on click.

## Supabase integration (optional)

This project can read/write the video catalog from a Supabase table instead of the local JSON file. To enable:

1. Create a Supabase project and get the Project URL and Anon Key. Set these env vars in your development environment or `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

2. Create a `videos` table in Supabase. Example SQL:

```sql
create table public.videos (
	id bigserial primary key,
	title text,
	date date,
	url text not null,
	actor text,
	created_at timestamptz default now()
);

-- optional index for ordering
create index on public.videos (id);
```

3. UI: a small dialog was added at `components/add-video-dialog.tsx` which uses the Supabase client to insert records into `videos`.

4. Behavior: when Supabase env vars are set, `components/video-grid.tsx` will try to fetch from the `videos` table. If Supabase is not configured or the fetch fails, it falls back to `public/aom_yumi.json`.

5. Notes:
- The Supabase client is in `lib/supabaseClient.ts` and reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Make sure to `npm install` after the added dependency `@supabase/supabase-js`.


If you want, I can implement any of the next steps now (pick one) and also remove the leftover lint warnings.

## Mobile thumbnail notes

On some mobile browsers (notably iOS Safari/Chrome) initial client-side thumbnail generation can fail because:

- Autoplay policies block loading enough data to seek when the video isn't muted / playsInline.
- `loadeddata` may never fire quickly for large remote files; relying only on that event stalls the canvas capture.
- Seeking to 1s on very short clips rejects silently.

Mitigations implemented in `components/video-grid.tsx`:

1. Offscreen probe video is created with `muted` and `playsInline` flags to allow metadata to load without user gesture.
2. We wait for either `loadedmetadata` or `canplay` (whichever comes first) with a 5s timeout fallback.
3. Seek target adapts to duration (uses `min(1, duration - 0.05)` and falls back to ~0.1s if duration is not yet known).
4. A secondary timeout after a seek attempt prevents hanging if `seeked` never fires.
5. If width/height are zero we abort quietly instead of throwing.

If thumbnails still fail on specific devices you can further improve by:

- Lowering the timeout or trying multiple frame positions.
- Adding a server-side background job to pre-generate all missing thumbnails.
- Persisting generated data URLs in localStorage to avoid re-capturing.

Server pre-generation remains the most reliable for cross-browser consistency.
