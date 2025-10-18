This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pn## Cyberdrop/Gigachad CDN 재생 전 인증

일부 Cyberdrop 기반 CDN(예: `k1-cd.cdn.gigachad-cdn.ru`) 동영상은 재생 전에 인증 요청을 받아야 재생됩니다. 이를 위해 다음이 추가되었습니다:

- 서버 라우트: `GET /api/cyberdrop-auth?key={id}` → `https://api.cyberdrop.me/api/file/auth/{id}` 로 프록시 호출하며, 응답은 JSON `{ url: "...tokenized_url..." }` 형태로 토큰이 포함된 임시 URL을 반환합니다.
- 클라이언트 동작 (지연 인증):
  1. "재생" 버튼 클릭 시 즉시 원본 URL로 재생을 시도합니다.
  2. 재생 실패(play() reject 또는 video.onError) 시에만 Gigachad/Cyberdrop 도메인을 확인하고 `/api/cyberdrop-auth?key=...` 를 호출합니다.
  3. API가 반환한 토큰 포함 URL로 `<video src>` 를 교체하고 재생을 재시도합니다.
  4. 인증 중엔 "authenticating…" 오버레이를 표시합니다.
- 장점: 정상 재생되는 동영상은 불필요한 API 호출을 하지 않아 빠르고 효율적입니다.

키 추출 규칙(간단): 경로가 `/api/file/d/{key}` 형태일 때 `d` 다음 세그먼트를 키로 사용합니다. 인증 실패 시에도 재생을 계속 시도합니다.

운영 팁:
- 토큰 URL은 일시적이며 만료될 수 있습니다. 반복 실패 시 사용자에게 토스트 알림을 추가할 수 있습니다.
- 다른 미러 도메인이 있으면 정규식 패턴(`/gigachad-cdn\.ru$/i`, `cyberdrop\.me` 등)을 보강하세요.
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

## Session changelog (recent focus)

The project originally experimented with multiple thumbnail strategies (server pre-generated frames, remote heuristic JPG probing, client-side canvas capture on visibility). All thumbnail generation and poster logic has now been fully removed per latest requirement. The grid simply renders:

- Images (jpg/png/webp/etc.) directly with `next/image` (unoptimized) and opens them in a new tab on click.
- Videos as plain `<video preload="none" controls>` elements (no poster attribute). The first frame only appears once playback begins (native browser behavior).

Removed items:

- `/api/thumbnail` usage (route may still exist but is unused).
- IntersectionObserver + canvas capture logic.
- Local / remote thumbnail probing and debug logging.
- HEAD checks for `/aom_yumi_thumbs`. The `public/aom_yumi_thumbs` folder is no longer referenced.

Current simplicity benefits:

- Far less client JS and no race conditions around seeking/decoding.
- No CORS issues from attempting to capture remote frames.
- Predictable rendering (only native video & image elements).

If you later want posters again, prefer one deterministic server-side generation approach (e.g. a build script using ffmpeg) instead of reintroducing layered fallbacks.

How to regenerate `public/aom_yumi.json` from the `public/aom_yumi` folder (PowerShell):

```powershell
Get-ChildItem -Path .\public\aom_yumi -File | Select-Object -ExpandProperty Name | ConvertTo-Json -Compress | Out-File -Encoding utf8 .\public\aom_yumi.json
```

Next optional enhancements:

- Add pagination or virtual scrolling if the list grows large.
- Add a lightweight lightbox for images (currently new-tab open is used for speed on mobile).
- Add server task or script to (optionally) pre-generate posters if reintroduced.

## Supabase integration (optional)

This project can read/write the video catalog from a Supabase table instead of the local JSON file. To enable:

1. Create a Supabase project and get the Project URL and Anon Key. Set these env vars in your development environment or `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

2. Create a `videos` table in Supabase. Example SQL:

````sql
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
````

Open http://localhost:3000 with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses `next/font` to optimize and load a bundled font.

## Local video catalog

This project includes a JSON catalog generated from files in `public/aom_yumi` and exposed at `/aom_yumi.json`.

- Place video files into `public/aom_yumi` and re-generate the catalog (or run the script used by the maintainer) to update the list.

## Legacy thumbnail system (removed)

The previous multi-stage thumbnail system (HEAD probe -> heuristic remote JPG -> client canvas capture) was removed for stability and simplicity. References in older commits or documentation sections can be ignored. Reintroduction should be done as a single server-side generation pass if needed.

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

## Mobile behavior

With thumbnails removed, mobile performance is simpler: videos are not preloaded (`preload="none"`), images open in a new tab (faster than an in-app lightbox for large files), and there is no background probing work.

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

## Mobile layout adjustments

## Dropbox 썸네일 업로드 OAuth 설정

수동 썸네일 생성 기능은 Dropbox에 JPG를 업로드하고 공유 링크를 받아 Supabase `videos.thumbnail` 컬럼에 저장합니다. 처음 사용 시 아래 과정을 따라 Dropbox OAuth 토큰을 발급하세요.

1. Dropbox App 생성: https://www.dropbox.com/developers/apps 에서 새 앱을 만들고 권한에 files.content.write, sharing.write 포함.
2. Redirect URI 추가: 앱 설정 화면에 현재 사이트 Origin (예: `http://localhost:3000`) 을 Redirect URI 로 등록.
3. 환경 변수 설정: `.env.local` 에 아래 추가
   ```env
   NEXT_PUBLIC_DROPBOX_APP_KEY=your_app_key_here
   ```
4. 개발 서버 재시작 후 페이지 상단의 "Dropbox 연결" 버튼 클릭 → Dropbox 승인 → 리다이렉트 되면 주소창 해시(#...) 에서 토큰을 파싱하여 자동으로 localStorage `DROPBOX_ACCESS_TOKEN` 에 저장됩니다.
5. 이후 Thumbnail / Regen 버튼을 눌러 프레임을 추출하면 Dropbox 업로드 → Supabase 업데이트가 진행됩니다.

토큰 갱신/해제: 상단 컴포넌트에서 "해제" 클릭 시 localStorage 토큰이 제거됩니다. 만료나 권한 부족 에러가 나면 다시 연결을 시도하세요.

보안 주의: Implicit Flow(해시 토큰)는 순수 클라이언트 편의를 위한 것으로, 프로덕션/공개 서비스에서는 서버측 Code + PKCE 흐름을 권장합니다. 필요하면 `/api` 라우트로 교환 로직을 추가하세요.

허용 호스트 제한(프록시): 원격 교차 출처 영상을 프록시하는 `/api/video-proxy` 라우트는 기본 모든 호스트를 허용합니다. 운영 환경에서는 다음과 같이 제한 권장:

```env
ALLOWED_VIDEO_HOSTS=video.example.com,cdn.mysite.net
```

대용량 파일 주의: 현재 프록시는 Range 지원이 없어 큰 파일은 메모리를 많이 사용합니다. 개선하려면 스트리밍/Range 구현을 추가하십시오.

## Cyberdrop/Gigachad CDN 재생 전 프리플라이트

일부 Cyberdrop 기반 CDN(예: `k1-cd.cdn.gigachad-cdn.ru`) 동영상은 재생 전에 인증용 프리플라이트 요청을 먼저 보내야 원활히 재생됩니다. 이를 위해 다음이 추가되었습니다:

- 서버 라우트: `GET /api/cyberdrop-auth?key={id}` → `https://api.cyberdrop.me/api/file/auth/{id}` 로 프록시 호출합니다. 적절한 Referer 헤더를 포함합니다.
- 클라이언트 동작: 비디오 카드에서 썸네일 위 “재생” 버튼을 누르면, 원본 URL이 Gigachad/Cyberdrop 패턴과 매칭될 경우 프리플라이트를 먼저 호출하고 곧바로 재생을 시작합니다. 진행 중엔 작은 스피너가 표시됩니다.

키 추출 규칙(간단): 경로가 `/api/file/d/{key}` 형태일 때 `d` 다음 세그먼트를 키로 사용합니다. 실패하더라도 재생은 계속 시도합니다.

운영 팁:

- 프리플라이트는 실패해도 UX를 막지 않도록 무시됩니다. 필요 시 상태 코드를 검사해 재시도/토스트 알림을 추가하세요.
- 특정 도메인만 대상이 되도록 정규식 필터(`/gigachad-cdn\.ru$/i`, `cyberdrop.me` 등)를 사용합니다. 다른 미러 도메인이 있으면 패턴을 보강하세요.

- 2 columns on small screens for vertical media.
- `preload="none"` on videos to save bandwidth.
- Direct new-tab open for images for faster full-resolution viewing.

## Video Upload Pipeline (NEW)

Videos can be downloaded, compressed, and re-uploaded to cloud storage (TeraBox or alternatives) from the UI.

### Features

- **Upload button** next to Edit/Regen in each video card
- **Queue system** with 10 concurrent workers
- **Compression**: MP4 format with H.265 (HEVC) video codec + AAC audio (iPhone/Safari compatible, excellent quality/size ratio)
- **Smart URL storage**: Stores TeraBox file ID (permanent) instead of download links (temporary)
- **On-demand streaming**: Fresh streaming links generated at playback time for reliability
- **Progress UI**: Button shows real-time progress during processing
- **Background processing**: [upload] tag in title indicates processing in background

### Pipeline stages

1. **Queued**: Job added to processing queue (title shows [upload] tag)
2. **Downloading**: Fetch original video from source URL
3. **Compressing**: Convert to MP4 (H.265/HEVC + AAC) via ffmpeg
4. **Uploading**: Upload to TeraBox cloud storage and get file ID
5. **Done**: Update Supabase with TeraBox file ID (`terabox://[fileId]`) and remove [upload] tag
6. **Streaming**: On playback, `/api/terabox-stream?fileId=...` generates fresh streaming link with Range support for seeking

### Why TeraBox File IDs instead of URLs?

**Problem**: TeraBox download links are temporary and expire after some time, causing videos to break.

**Solution**: Store permanent file IDs and generate fresh streaming links on-demand:

- Upload returns file ID (e.g., `123456789`)
- Supabase stores `terabox://123456789` format
- On playback, client requests `/api/terabox-stream?fileId=123456789`
- Server calls `getDownloadLink()` to get fresh temporary link
- Video streams through our proxy with full Range/seek support

**Benefits**:

- ✅ Links never expire - file ID is permanent
- ✅ Always get fresh, valid streaming URL
- ✅ No need to update database when links expire
- ✅ Cleaner separation of storage (ID) vs access (temporary link)

### TeraBox Integration

**NEW**: Now using `terabox-upload-tool` npm package for direct API access!

#### Setup Required

TeraBox uploads require authentication credentials. See `TERABOX_SETUP.md` for detailed guide.

Quick setup:

1. Login to https://www.terabox.com/
2. Open DevTools (F12) → Network tab
3. Upload a test file
4. Extract these values from the upload request:

   - `ndus` (from Cookie header)
   - `appId` (from query params)
   - `uploadId` (from query params)
   - `jsToken` (from query params)
   - `browserId` (from headers or use "web")

5. Set environment variables:

```powershell
$env:TERABOX_NDUS="your_ndus_value"
$env:TERABOX_APP_ID="your_app_id"
$env:TERABOX_UPLOAD_ID="your_upload_id"
$env:TERABOX_JS_TOKEN="your_js_token"
$env:TERABOX_BROWSER_ID="web"
```

If credentials are not set, the uploader will fall back to mock mode.

### Requirements

- **ffmpeg** must be installed on server with H.265/HEVC support:
  ```bash
  # Check if H.265 codec is available
  ffmpeg -codecs | grep hevc
  ```
- **TeraBox credentials** (see `TERABOX_SETUP.md` for setup guide)

### Usage

1. Click "Upload" button on any video card
2. Title shows [upload] tag - processing in background
3. Server handles: download → compress → upload → update database
4. When complete: [upload] tag removed, video URL updated to compressed cloud version
5. Video plays on all devices including iPhone/Safari with much smaller file size

For detailed documentation, see `UPLOAD_PIPELINE.md`.

## 홈화면 가상화 (tanstack virtual) 적용

홈화면의 `Content` 컴포넌트가 `@tanstack/react-virtual`을 사용하도록 변경되었습니다. 주요 목적은 높이가 서로 다른(item별 variable height) 항목들을 효율적으로 렌더링하여 스크롤 성능을 개선하는 것입니다.

주요 변경사항

- 파일: `app/page.js`의 `Content` 컴포넌트를 가상화 기반으로 교체.
- 라이브러리: `@tanstack/react-virtual` 사용.
- 동작: 각 항목은 실제 DOM 측정(`measureElement`)으로 높이를 계산하며, `overscan: 5`로 현재 포커스(스크롤 위치 기준) 주변 약 ±5개의 항목만 미리 렌더링합니다. 따라서 중간쯤에서는 최대 11개(포커스 포함)가 렌더링될 수 있습니다.
- 스크롤 컨테이너 높이: 상단 헤더(고정 4rem)를 고려해 `height: calc(100vh - 4rem)`로 설정.

설치

프로젝트에 아직 패키지가 없다면 설치합니다:

- npm: `npm install @tanstack/react-virtual`
- pnpm: `pnpm add @tanstack/react-virtual`

주의사항

- estimateSize 값(예: 320px)은 초기 추정치입니다. 실제 평균 항목 높이에 맞춰 조정하면 초기 레이아웃 안정성이 좋아집니다.
- virtualizer는 렌더된 요소의 루트 DOM 노드를 측정하므로, 항목(wrapper)이 실제 크기를 가져야 정확히 측정됩니다. (`position: absolute`로 배치된 wrapper에 대해 `measureElement`를 호출하는 패턴을 사용합니다.)
- 매우 빠른 스크롤이나 레이아웃 변화가 많을 경우 측정 비용이 증가할 수 있으니 필요 시 overscan/estimateSize를 조정하세요.

향후 권장 작업

- estimateSize를 실제 데이터로 통계내어 동적으로 계산하거나, 초기 렌더 시 첫 N개의 항목을 측정하여 평균값을 사용하면 더 안정적입니다.
- 현재 포커스 아이템을 중앙에 고정하는 스크롤 보정 기능을 추가할 수 있습니다.
