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

## Local video catalog

This project includes a JSON catalog generated from files in `public/aom_yumi` and exposed at `/aom_yumi.json`.

- Place video files into `public/aom_yumi` and re-generate the catalog (or run the script used by the maintainer) to update the list.
## Session changelog (actions performed in this workspace)

Summary: I wired up a simple video catalog flow and a client-side video grid that displays vertical "shorts" style videos, parses filenames for title/date, and uses thumbnails when available (or generates them on the client when a card scrolls into view).

- `components/video-grid.tsx` — client component that:
	- fetches `/aom_yumi.json` on the client,
	- renders each video in a vertical (9:16) aspect ratio with controls,
	- uses a server-side thumbnail at `/public/aom_yumi_thumbs/{filename}.jpg` when present (HEAD request), otherwise generates a data-URL thumbnail client-side when the card becomes visible (IntersectionObserver + hidden video + canvas).

Other changes
- Ran `npx shadcn@latest init` after removing an existing `components.json` (the init created `components.json` and `lib/utils.ts` and updated CSS variables). This was part of setting up UI components in the project.

Notes and behavior
- Poster/thumbnail behavior:
	- First a HEAD request is attempted for `/aom_yumi_thumbs/{filename}.jpg` (server-generated thumbnail).
	- If missing, the browser will load the video (only when the card is visible) and capture a frame into a canvas to use as a data-URL poster.
	- Client-side thumbnail generation is intentionally deferred (IntersectionObserver) to avoid loading all videos at once.

Lint note
- There are minor lint warnings left intentionally (unused `catch` error variable in some catch blocks). They don't affect runtime; I can remove or log those errors if you prefer.

How to regenerate `public/aom_yumi.json` from the `public/aom_yumi` folder (PowerShell)
Place this in the repo root (PowerShell):
# create/update JSON array of filenames
Get-ChildItem -Path .\public\aom_yumi -File | Select-Object -ExpandProperty Name | ConvertTo-Json -Compress | Out-File -Encoding utf8 .\public\aom_yumi.json
```

Optional: generate server thumbnails (requires ffmpeg installed)
- Create a thumbnails folder first: `mkdir public\aom_yumi_thumbs`
- Example PowerShell batch (will extract a frame at 1s for each mp4):

```powershell
Get-ChildItem .\public\aom_yumi -Filter *.mp4 | ForEach-Object {
	ffmpeg -y -i $in -ss 00:00:01 -vframes 1 -q:v 2 $out
}
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
	date date,
	url text not null,
	actor text,
	created_at timestamptz default now()
);

-- optional index for ordering
create index on public.videos (id);
3. UI: a small dialog was added at `components/add-video-dialog.tsx` which uses the Supabase client to insert records into `videos`.

4. Behavior: when Supabase env vars are set, `components/video-grid.tsx` will try to fetch from the `videos` table. If Supabase is not configured or the fetch fails, it falls back to `public/aom_yumi.json`.

5. Notes:
- The Supabase client is in `lib/supabaseClient.ts` and reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Make sure to `npm install` after the added dependency `@supabase/supabase-js`.

## Mobile thumbnail notes

On some mobile browsers (notably iOS Safari/Chrome) initial client-side thumbnail generation can fail because:

- Autoplay policies block loading enough data to seek when the video isn't muted / playsInline.
- `loadeddata` may never fire quickly for large remote files; relying only on that event stalls the canvas capture.
- Seeking to 1s on very short clips rejects silently.

Mitigations implemented in `components/video-grid.tsx`:

4. A secondary timeout after a seek attempt prevents hanging if `seeked` never fires.
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

Open http://localhost:3000 with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses `next/font` to optimize and load a bundled font.

## Local video catalog

This project includes a JSON catalog generated from files in `public/aom_yumi` and exposed at `/aom_yumi.json`.

- Place video files into `public/aom_yumi` and re-generate the catalog (or run the script used by the maintainer) to update the list.

## Session changelog (actions performed in this workspace)

Summary: implemented a client-side video catalog and grid that shows vertical videos, parses filenames for metadata, and displays thumbnails using local server thumbnails (if present) or client-side heuristics and on-demand capture.

- `components/video-grid.tsx` — client component that:
	- fetches `/aom_yumi.json` on the client (fallback from Supabase if configured),
	- renders each video in a vertical (9:16) aspect ratio with controls,
	- poster/thumbnail strategy: prefer a local thumbnail under `public/aom_yumi_thumbs/{filename}.jpg` (checked by HEAD), otherwise try heuristic jpg paths for remote URLs and finally generate a data-URL poster client-side when a card becomes visible (IntersectionObserver + hidden video + canvas).

Other changes
- Ran `npx shadcn@latest init` (created `components.json`, updated CSS variables and `lib/utils.ts`).

Notes and behavior
- Poster/thumbnail behavior (summary):
	1. Try local server thumbnail: `/aom_yumi_thumbs/{filename}.jpg` via HEAD.
	2. For remote URLs, try heuristic JPG paths (replace extension with `.jpg`, append `.jpg`), letting the browser attempt to load them.
	3. If no poster is found, and the file is local, generate a frame on-demand when the card becomes visible using an offscreen video + canvas and use the resulting data-URL as the poster.
	- Client-side generation is deferred via IntersectionObserver to avoid loading many videos at once.

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

- Verified `public/aom_yumi.json` exists and `components/video-grid.tsx` reads it. To visually confirm layout and posters run the dev server and open http://localhost:3000.

Next steps (optional)
- Add a build-step script that runs ffmpeg to create `public/aom_yumi_thumbs` for all videos.
- Add a lightbox/fullscreen player for better viewing on click.

## Supabase integration (optional)

This project can read/write the video catalog from a Supabase table instead of the local JSON file. To enable:

1. Create a Supabase project and get the Project URL and Anon Key. Set these env vars in your development environment or `.env.local`:

```env
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
- Make sure to `npm install` after the added dependency `@supabase/supabase-js` if you enable Supabase features.

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

## 코드 분석: `app/page.tsx` 및 `components/video-grid.tsx`

아래는 프로젝트의 핵심 UI 파일들에 대한 요약과 동작 방식입니다.

- `app/page.tsx`
	- 레이아웃: `SidebarProvider` 안에서 `AppSidebar`, 상단 헤더(브레드크럼, 사이드바 트리거 등)를 렌더링합니다.
	- 본문: `VideoGrid` 컴포넌트를 포함하여 비디오 그리드와 추가 콘텐츠 영역을 표시합니다.
	- 목적: 홈페이지를 구성하며 `components/video-grid.tsx`를 통해 비디오 카탈로그를 보여줍니다.

- `components/video-grid.tsx` (클라이언트 컴포넌트)
	- 데이터 소스
		- 우선 Supabase의 `videos` 테이블에서 데이터를 읽으려고 시도합니다(환경 변수 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 필요).
		- Supabase가 설정되어 있지 않거나 실패하면 `/aom_yumi.json`(프로젝트 루트 `public/aom_yumi.json`)을 페치하여 로컬 파일명 목록을 사용합니다.
	- 파일 파싱
		- 파일명 규칙 `YYYY_MM_DD_title.ext` 같은 형식을 파싱하여 사람이 읽기 좋은 날짜(`Feb 22, 2023` 등)와 정리된 제목을 추출합니다.
		- URL이 전달된 경우에도 경로의 마지막 세그먼트를 추출해 처리합니다.
	- 렌더링
		- 항목은 문자열(파일명) 혹은 객체({id,title,date,url,actor}) 형태를 지원합니다.
		- 확장자를 근거로 이미지/비디오를 추정하고, 세로형(9:16) 비디오 카드로 표시합니다.
	- 포스터(썸네일) 정책 (우선순위)
		1. 서버에서 생성된 로컬 썸네일을 우선 시도 (`/aom_yumi_thumbs/{filename}.jpg` via HEAD).
		2. 원격 URL에 대해서는 휴리스틱 JPG 경로(.jpg 치환 또는 append)를 시도합니다.
		3. 로컬 비디오의 경우 서버 썸네일이 없으면 IntersectionObserver로 뷰포트에 들어올 때만 비디오를 로드하여 캔버스에서 프레임을 추출해 data-URL 포스터를 생성합니다.
	- 성능/사용성
		- IntersectionObserver로 지연 생성하여 네트워크와 렌더 비용을 줄입니다.
		- 생성된 data-URL 포스터는 메모리상에 보관되며, 재생성 비용을 줄이려면 로컬 스토리지 캐싱을 권장합니다.
	- 이벤트
		- 전역 `video-added`, `video-updated` 이벤트를 수신하여 Supabase에서 재조회합니다.
	- 접근성/UX
		- 이미지 미리보기(클릭-모달)와 ESC로 닫기 등이 구현되어 있습니다.

주요 엣지 케이스와 한계
- 원격 비디오(다른 도메인)는 클라이언트 캔버스 생성 시 CORS 때문에 캡처가 불가능할 수 있습니다. 이 경우 원격 썸네일이 없다면 브라우저가 직접 로드 가능한 경로(.jpg)를 시도하거나 서버에서 미리 썸네일을 생성해 두어야 합니다.
- 매우 짧은 비디오나 일부 모바일 브라우저에서는 `seek`/`loadeddata` 이벤트가 불안정해 캡처가 실패할 수 있습니다(타임아웃과 폴백이 포함되어 있으나 완전한 보장은 아님).
- Supabase 접속 실패 시 자동으로 로컬 JSON로 폴백하지만, JSON 형식이 예상과 다르면 에러를 표시합니다.

간단한 권장 작업
- 서버에서 모든 비디오에 대해 빌드/백그라운드로 썸네일을 미리 생성해 두면 모바일 및 CORS 문제를 제거할 수 있습니다.
- 생성된 data-URL 썸네일을 로컬스토리지나 IndexedDB에 저장하면 재방문 시 재생성 비용을 줄일 수 있습니다.

If thumbnails still fail on specific devices you can further improve by:

- Lowering the timeout or trying multiple frame positions.
- Adding a server-side background job to pre-generate all missing thumbnails.
- Persisting generated data URLs in localStorage to avoid re-capturing.

Server pre-generation remains the most reliable for cross-browser consistency.

## Mobile fixes applied in this session

- Reduced eager thumbnail probing: IntersectionObserver rootMargin reduced to 100px to avoid starting work too early while scrolling on phones.
- Faster previews: image clicks now open the full-size image in a new browser tab where possible (falls back to the in-app modal). This is noticeably faster on mobile browsers.
- Mobile grid layout: default mobile column count changed so phones show 2 items per row for vertical videos.
- Video preload reduced: video elements now use `preload="none"` to avoid unnecessary data usage before user interaction.

After pulling these changes, please run the dev server and test on a phone to confirm the "refresh-like" scrolling behavior is gone and that image preview speed improved.
