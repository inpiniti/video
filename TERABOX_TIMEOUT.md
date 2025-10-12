# TeraBox 업로드 타임아웃 문제 해결

## 🔴 현재 에러

```
TimeoutError: page.goto: Timeout 30000ms exceeded
navigating to "https://www.terabox.com/", waiting until "networkidle"
```

## ✅ 적용한 수정사항

### 1. 타임아웃 증가

- 30초 → **60초**

### 2. 대기 조건 완화

- `networkidle` (모든 네트워크 요청 완료) → **`domcontentloaded`** (HTML만 로드되면 OK)
- 더 빠르게 진행 가능

### 3. 에러 복구력 향상

- TeraBox 로드가 느려도 계속 시도
- 부분 실패 시 Mock 업로드로 폴백

## 🚀 테스트 방법

### 1. 서버 재시작

```powershell
# Ctrl+C로 종료 후
npm run dev
```

### 2. Upload 버튼 클릭

### 3. 로그 확인

```
[TeraBox] Navigating to TeraBox...
[TeraBox] ✅ Page loaded                    ← 이제 더 빨리 나올 것
[TeraBox] Not logged in, starting login...
...
```

## 🎯 예상 결과

### 시나리오 A: 성공 (로그인 팝업 뜸)

```
[TeraBox] ✅ Page loaded
[TeraBox] Not logged in, starting login process...
[TeraBox] Selecting Google login...
[TeraBox] ⚠️  MANUAL LOGIN REQUIRED ⚠️
[TeraBox] Please complete Google login in the browser window...
```

→ **브라우저 창에서 구글 로그인 완료**하면 됩니다!

### 시나리오 B: 여전히 타임아웃

```
[TeraBox] ⚠️  Initial load slow, trying to continue...
[TeraBox] Falling back to mock upload
```

→ **네트워크 문제**일 가능성 (아래 해결책 참고)

### 시나리오 C: 자동 로그인 성공 (비밀번호 설정했다면)

```
[TeraBox] Already logged in!
[TeraBox] Starting file upload...
[TeraBox] Waiting for upload to complete...
[TeraBox] ✅ Upload complete! URL: https://terabox.com/...
```

## 🔧 여전히 실패한다면

### 방법 1: 수동으로 TeraBox 접속 테스트

브라우저에서 직접 열어보기:

```
https://www.terabox.com/
```

- 열리나요? → 느리지만 가능하면 OK
- 안 열리나요? → VPN이나 네트워크 문제

### 방법 2: 헤드리스 모드로 변경 (더 빠름)

`.env` 파일에 추가:

```env
TERABOX_HEADLESS=true
```

그리고 코드 수정:

```typescript
headless: process.env.TERABOX_HEADLESS === "true";
```

### 방법 3: 대체 클라우드 사용

TeraBox가 계속 안 되면 다른 서비스 사용:

#### Google Drive (공식 API)

```bash
npm install googleapis
```

- 무료 15GB
- 안정적
- 공식 API

#### Cloudflare R2 (S3 호환)

```bash
npm install @aws-sdk/client-s3
```

- 저렴
- 빠름
- 다운로드 무료

### 방법 4: 로컬 스토리지 사용 (임시)

개발/테스트용으로 로컬에 저장:

```typescript
// teraboxUploader.ts 수정
export async function uploadToTeraBox(
  filePath: string,
  videoId: number
): Promise<string> {
  // 파일을 public 폴더로 복사
  const publicPath = join(
    process.cwd(),
    "public",
    "uploads",
    `video_${videoId}.webm`
  );
  await fs.copyFile(filePath, publicPath);
  return `/uploads/video_${videoId}.webm`;
}
```

## 📊 Mock Upload가 나쁜가요?

### 개발 단계에서는 OK

- 전체 파이프라인 테스트 가능
- 다운로드 + 압축은 정상 작동
- URL만 가짜

### 프로덕션에서는 NG

- 실제 업로드 필요
- TeraBox 또는 대체 서비스 필수

## 🎯 다음 테스트

1. **서버 재시작** (`npm run dev`)
2. **Upload 버튼 클릭**
3. **브라우저 창 주시** (TeraBox 로그인 팝업이 뜰 수 있음)
4. **서버 로그 확인**

### 성공 시 보일 로그:

```
[TeraBox] ✅ Page loaded
[TeraBox] Not logged in, starting login process...
[TeraBox] ⚠️  MANUAL LOGIN REQUIRED ⚠️
```

→ 브라우저 창에서 구글 계정으로 로그인하면 됩니다!

### 로그인 완료 후:

```
[TeraBox] ✅ Session saved! Future uploads will be faster.
[TeraBox] Starting file upload...
[TeraBox] ✅ Upload complete!
```

---

## 💡 참고: 환경 변수

현재 `.env` 설정:

```env
TERABOX_EMAIL=younginpiniti@gmail.com
TERABOX_PROVIDER=google
TERABOX_PASSWORD=당신의_비밀번호  # 선택사항
```

- `TERABOX_PASSWORD`가 없으면 → 수동 로그인 필요 (한 번만)
- `TERABOX_PASSWORD`가 있으면 → 자동 로그인 시도

## 🚀 최종 확인

변경사항 적용 후:

1. 서버 재시작
2. Upload 버튼 클릭
3. 30초 → 60초로 늘어나서 더 여유 있게 로드됨
4. `domcontentloaded`로 더 빠르게 진행

이제 테스트해보세요! 🎉
