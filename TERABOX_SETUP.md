# TeraBox 자격 증명 설정 가이드

이 가이드는 `terabox-upload-tool` 라이브러리를 사용하기 위해 필요한 자격 증명을 얻는 방법을 설명합니다.

## 필요한 자격 증명

다음 5가지 값이 필요합니다:

1. **ndus** - 쿠키 값
2. **appId** - 앱 ID
3. **uploadId** - 업로드 ID
4. **jsToken** - JS 토큰
5. **browserId** - 브라우저 ID

## 자격 증명 얻는 방법

### 1단계: TeraBox 로그인

1. https://www.terabox.com/ 접속
2. 이메일 또는 구글 계정으로 로그인

### 2단계: 개발자 도구 열기

1. `F12` 키를 눌러 개발자 도구 열기
2. **Network** 탭으로 이동
3. 필터를 `Fetch/XHR`로 설정

### 3단계: 테스트 파일 업로드

1. 좌측의 **Upload** 버튼 클릭
2. 작은 이미지나 텍스트 파일 선택하여 업로드
3. 업로드가 진행되는 동안 Network 탭 관찰

### 4단계: 업로드 요청 찾기

Network 탭에서 다음과 같은 요청을 찾으세요:

- `precreate` - 업로드 준비 요청
- `create` - 파일 생성 요청

이 요청들 중 하나를 클릭하세요.

### 5단계: Query Parameters에서 값 추출

**Headers** 탭에서 **Query String Parameters** 섹션을 찾으세요:

```
appId: 250528
uploadId: P1-MTAuMjI4Ljcy...
jsToken: B8C70D9679E...
bdstoken: e2b0d848...
```

이 값들을 복사하세요.

### 6단계: Cookie에서 ndus 값 추출

같은 요청의 **Headers** 탭에서:

1. **Request Headers** 섹션 찾기
2. **Cookie** 항목 찾기
3. 쿠키 문자열에서 `ndus=...;` 부분 찾기
4. `ndus=` 다음의 값만 복사

예시:

```
Cookie: ...ndus=7gWBT3NkUXVOdGx2TnpNNE16RTJOelF3TURBd...;...
```

여기서 `7gWBT3NkUXVOdGx2TnpNNE16RTJOelF3TURBd...` 부분만 복사

### 7단계: browserId 찾기

같은 요청 또는 다른 TeraBox API 요청에서:

1. **Query String Parameters**에서 `clienttype` 또는 `web` 파라미터 확인
2. 또는 **Request Headers**의 User-Agent나 다른 헤더에서 browser 관련 ID 찾기

만약 찾기 어렵다면, 임시로 다음 값을 사용해보세요:

```
browserId: web
```

## 환경 변수 설정

얻은 값들을 PowerShell에서 환경 변수로 설정:

```powershell
$env:TERABOX_NDUS="여기에_ndus_값"
$env:TERABOX_APP_ID="250528"
$env:TERABOX_UPLOAD_ID="여기에_uploadId_값"
$env:TERABOX_JS_TOKEN="여기에_jsToken_값"
$env:TERABOX_BROWSER_ID="web"
```

또는 `.env` 파일에 추가:

```env
TERABOX_NDUS=여기에_ndus_값
TERABOX_APP_ID=250528
TERABOX_UPLOAD_ID=여기에_uploadId_값
TERABOX_JS_TOKEN=여기에_jsToken_값
TERABOX_BROWSER_ID=web
```

## 주의사항

- **ndus** 쿠키는 세션 정보이므로 로그아웃하면 무효화됩니다
- **jsToken**은 주기적으로 변경될 수 있습니다
- 값들이 만료되면 다시 로그인하여 새로운 값을 얻어야 합니다
- 자격 증명은 보안에 민감하므로 절대 공개 저장소에 커밋하지 마세요

## 테스트

자격 증명 설정 후 테스트:

```powershell
# Upload 버튼 클릭하여 테스트
# 또는 직접 API 호출:
node -e "console.log(process.env.TERABOX_NDUS)"
```

## 문제 해결

### "Upload failed" 에러

- 자격 증명이 만료되었을 수 있습니다
- TeraBox에 다시 로그인하여 새로운 값을 얻으세요

### "Invalid token" 에러

- jsToken이나 ndus 값이 잘못되었습니다
- 복사할 때 앞뒤 공백이나 불필요한 문자가 포함되지 않았는지 확인하세요

### 자격 증명을 찾을 수 없음

- 더 큰 파일을 업로드해보세요 (더 많은 API 요청 발생)
- Network 탭의 필터를 제거하고 모든 요청을 확인하세요
- `terabox.com` 도메인의 요청만 필터링하세요

## 참고 자료

- [terabox-upload-tool GitHub](https://github.com/Pahadi10/terabox-upload-tool)
- [Chrome DevTools Network 문서](https://developer.chrome.com/docs/devtools/network)
