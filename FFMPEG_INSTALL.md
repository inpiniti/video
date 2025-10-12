# FFmpeg 설치 가이드 (Windows)

## 🚨 현재 에러

```
❌ FFmpeg spawn error: ENOENT
```

**의미**: FFmpeg가 시스템에 설치되지 않았거나 PATH에 등록되지 않았습니다.

## ✅ 해결 방법 (3가지 중 선택)

### 방법 1: Chocolatey 사용 (가장 쉬움) ⭐

**1단계: PowerShell을 관리자 권한으로 실행**

**2단계: Chocolatey 설치 (없다면):**

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
```

**3단계: FFmpeg 설치:**

```powershell
choco install ffmpeg
```

**4단계: 확인:**

```powershell
ffmpeg -version
```

---

### 방법 2: Scoop 사용 (추천)

**1단계: PowerShell에서 Scoop 설치 (없다면):**

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex
```

**2단계: FFmpeg 설치:**

```powershell
scoop install ffmpeg
```

**3단계: 확인:**

```powershell
ffmpeg -version
```

---

### 방법 3: 수동 설치

**1단계: FFmpeg 다운로드**

- https://github.com/BtbN/FFmpeg-Builds/releases 방문
- `ffmpeg-master-latest-win64-gpl.zip` 다운로드

**2단계: 압축 해제**

```
C:\ffmpeg\  에 압축 해제
```

**3단계: PATH 환경 변수 추가**

1. 윈도우 검색에서 "환경 변수" 검색
2. "시스템 환경 변수 편집" 클릭
3. "환경 변수" 버튼 클릭
4. "시스템 변수"에서 "Path" 선택 후 "편집"
5. "새로 만들기" 클릭
6. 다음 경로 추가:
   ```
   C:\ffmpeg\bin
   ```
7. "확인" 클릭

**4단계: PowerShell 재시작 후 확인:**

```powershell
ffmpeg -version
```

---

## 🎯 설치 후 해야 할 일

### 1. FFmpeg 설치 확인

```powershell
ffmpeg -version
```

다음과 같은 출력이 나와야 합니다:

```
ffmpeg version N-xxx Copyright (c) 2000-2025 the FFmpeg developers
built with gcc ...
configuration: --enable-gpl --enable-version3 ...
```

### 2. AV1 코덱 지원 확인

```powershell
ffmpeg -codecs | Select-String av1
```

출력 예시:

```
DEV.L. av1                  Alliance for Open Media AV1 (decoders: libdav1d libaom-av1 av1 av1_cuvid av1_qsv ) (encoders: libaom-av1 av1_nvenc av1_qsv av1_amf )
```

`libaom-av1` 인코더가 있어야 합니다!

### 3. 개발 서버 재시작

```powershell
# 터미널에서 Ctrl+C로 서버 종료
npm run dev
```

### 4. Upload 버튼 다시 클릭

---

## 🔍 문제 해결

### Q: "ffmpeg is not recognized" 에러

**A**: PATH가 제대로 설정되지 않음

- PowerShell/CMD를 **재시작**
- PATH 확인: `$env:PATH`
- FFmpeg 경로가 포함되어 있는지 확인

### Q: AV1 코덱이 없다고 나옴

**A**: FFmpeg full build가 아닌 essentials build를 설치했을 수 있음

- Full/GPL 버전 재설치
- 또는 아래 대체 옵션 사용

### Q: 설치했는데도 안 됨

**A**:

1. PowerShell/CMD 재시작
2. VS Code 재시작
3. 컴퓨터 재시작

---

## 🚀 빠른 테스트

설치 후 바로 테스트:

```powershell
# 버전 확인
ffmpeg -version

# AV1 지원 확인
ffmpeg -codecs | Select-String av1

# 간단한 변환 테스트 (현재 디렉토리에 test.mp4가 있다면)
ffmpeg -i test.mp4 -t 5 -c:v libaom-av1 -crf 30 test_av1.webm
```

---

## 💡 대체 옵션 (AV1이 안 되면)

만약 AV1 코덱 설치가 어렵다면, VP9로 변경할 수 있습니다:

`lib/videoCompressor.ts` 파일 수정:

```typescript
// 기존:
'-c:v', 'libaom-av1',

// 변경:
'-c:v', 'libvpx-vp9',
```

VP9도 우수한 압축 효율을 제공합니다 (AV1보다 약간 낮지만 빠름).

---

## ✅ 설치 완료 체크리스트

- [ ] FFmpeg 설치됨
- [ ] `ffmpeg -version` 명령 작동
- [ ] AV1 코덱 지원 확인 (선택사항, VP9로 대체 가능)
- [ ] PowerShell/터미널 재시작
- [ ] 개발 서버 재시작
- [ ] Upload 버튼 테스트

---

## 🎉 설치 후

FFmpeg가 정상 설치되면 다음과 같은 로그를 볼 수 있습니다:

```
[Job job_xxxxx] 🔄 Step 2/3: Compressing video...
[Compressor] 🎬 Starting compression...
[Compressor] Input: C:\Users\...\Temp\job_xxxxx_source.mp4
[Compressor] Output: C:\Users\...\Temp\job_xxxxx_compressed.webm
[Compressor] Codec: AV1 + Opus (WebM)
[Compressor] 🔧 FFmpeg command: ffmpeg -i ...
[Compressor] ⏳ Progress: 00:00:15.23 | 45 fps | 2048kB
[Compressor] ⏳ Progress: 00:00:30.45 | 42 fps | 4096kB
...
[Compressor] ✅ Compression complete!
```

문제가 계속되면 알려주세요! 🚀
