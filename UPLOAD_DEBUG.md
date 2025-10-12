# 업로드 디버깅 가이드

## 🔍 문제 상황

- Upload 버튼 클릭 후 3초마다 `/api/upload?jobId=xxx` 계속 호출
- 서버 콘솔에 진행 상황이 안 보임
- 작업이 진행되는지 알 수 없음

## ✅ 해결 완료

상세한 로그를 모든 단계에 추가했습니다!

## 📝 이제 볼 수 있는 로그들

### 1. Upload 버튼 클릭 시:

```
[Upload API] 📨 Received upload request: { id: 123, url: 'https://...' }
[Upload API] ✅ Job created: job_xxxxx
[Queue] ✅ Job enqueued: job_xxxxx
[Queue] Video ID: 123, URL: https://...
[Queue] Current queue length: 1, Active workers: 0/10
[Queue] 🚀 Starting job: job_xxxxx
[Queue] Active workers: 1/10
```

### 2. 작업 진행 중:

```
[Job job_xxxxx] 📦 Processing started
[Job job_xxxxx] Video ID: 123, Source: https://...

[Job job_xxxxx] ⬇️  Step 1/3: Downloading video...
[Downloader] 🌐 Starting download from: https://...
[Downloader] 📦 File size: 45.32 MB
[Downloader] ✅ Downloaded 45.32 MB
[Downloader] 💾 Saved to: C:\Users\...\Temp\job_xxxxx_source.mp4
[Job job_xxxxx] ✅ Downloaded to: C:\Users\...\Temp\job_xxxxx_source.mp4

[Job job_xxxxx] 🔄 Step 2/3: Compressing video (this may take several minutes)...
[Compressor] 🎬 Starting compression...
[Compressor] Input: C:\Users\...\Temp\job_xxxxx_source.mp4
[Compressor] Output: C:\Users\...\Temp\job_xxxxx_compressed.webm
[Compressor] Codec: AV1 + Opus (WebM)
[Compressor] 🔧 FFmpeg command: ffmpeg -i ...
[Compressor] ⏳ This may take several minutes... (Progress will be shown below)
[Compressor] ⏳ Progress: 00:00:15.23 | 45 fps | 2048kB
[Compressor] ⏳ Progress: 00:00:30.45 | 42 fps | 4096kB
... (계속 업데이트)
[Compressor] ✅ Compression complete!
[Job job_xxxxx] ✅ Compressed to: C:\Users\...\Temp\job_xxxxx_compressed.webm

[Job job_xxxxx] ⬆️  Step 3/3: Uploading to TeraBox...
[TeraBox] Starting upload for video 123
[TeraBox] Navigating to TeraBox...
... (TeraBox 로그)
[Job job_xxxxx] ✅ Uploaded! URL: https://terabox.com/...

[Job job_xxxxx] 🎉 All steps completed successfully!
[Job job_xxxxx] 🧹 Cleaning up temp files...
[Job job_xxxxx] ✅ Cleanup done
[Queue] ✅ Job job_xxxxx finished. Active workers: 0/10
```

### 3. 클라이언트 폴링 시 (3초마다):

```
[Upload API] 🔍 Status check for job: job_xxxxx
[Upload API] 📊 Job status: downloading
[Upload API] 🔍 Status check for job: job_xxxxx
[Upload API] 📊 Job status: compressing
[Upload API] 🔍 Status check for job: job_xxxxx
[Upload API] 📊 Job status: uploading
[Upload API] 🔍 Status check for job: job_xxxxx
[Upload API] 📊 Job status: done
```

### 4. 에러 발생 시:

```
[Job job_xxxxx] ❌ Error during processing: Error: ffmpeg not found
[Queue] ❌ Job job_xxxxx failed: Error: ffmpeg not found
[Upload API] 📊 Job status: error (error: ffmpeg not found)
```

## 🚀 다음 단계

1. **개발 서버 재시작** (변경사항 적용):

   ```powershell
   # 터미널에서 Ctrl+C로 종료 후
   npm run dev
   ```

2. **Upload 버튼 다시 클릭**

3. **서버 콘솔 확인** - 이제 상세한 로그가 나옵니다!

## 🔧 예상 가능한 문제들

### 문제 1: ffmpeg not found

**증상:**

```
[Compressor] ❌ FFmpeg spawn error: Error: spawn ffmpeg ENOENT
```

**해결:**

```powershell
# Windows에서 ffmpeg 설치
winget install ffmpeg

# 설치 확인
ffmpeg -version
```

### 문제 2: 다운로드 실패

**증상:**

```
[Downloader] ❌ Download failed with status: 403
```

**원인:** CORS, 인증 필요, 잘못된 URL

**해결:** 서버 프록시를 통해 다운로드하도록 수정 필요

### 문제 3: TeraBox 로그인 실패

**증상:**

```
[TeraBox] ⚠️ MANUAL LOGIN REQUIRED ⚠️
```

**해결:**

- 브라우저 창이 뜨면 직접 구글 로그인 완료
- 또는 `.env`에 `TERABOX_PASSWORD` 추가

## 📊 현재 상태 확인

폴링 중인 job의 상태를 브라우저에서 직접 확인 가능:

```
http://localhost:3000/api/upload?jobId=job_1760292870161_z8optq3
```

반환 예시:

```json
{
  "id": "job_1760292870161_z8optq3",
  "videoId": 123,
  "sourceUrl": "https://...",
  "status": "compressing",
  "createdAt": 1760292870161
}
```

status 값:

- `queued` - 대기 중
- `downloading` - 다운로드 중
- `compressing` - 압축 중 (가장 오래 걸림)
- `uploading` - TeraBox 업로드 중
- `done` - 완료 (teraboxUrl 포함)
- `error` - 실패 (error 메시지 포함)
