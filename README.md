# 보라매 추격 미션

청년부 레크레이션용 "추격 미션" 웹앱입니다. 임원단 4명이 보라매공원 안에 숨고, 9개 팀이 GPS로
실시간 위치를 추적해 먼저 모두 찾아내는 게임입니다.

- **프론트엔드**: Vite + Vanilla JS (빌드 결과물은 정적 파일이라 Vercel/Netlify에 바로 올릴 수 있습니다)
- **실시간 동기화 / DB**: Firebase Firestore
- **사진 업로드**: Firebase Storage
- **지도**: 네이버 지도 JS API v3

## 1. 로컬 실행 준비

```bash
npm install
cp .env.example .env.local   # 값 채우기 (아래 2, 3단계 참고)
npm run dev
```

## 2. 네이버 지도(NCP) API 키

네이버클라우드플랫폼(NCP) 콘솔 → **AI·Application Service > Maps > Application 등록** 에서
Client ID(`ncpKeyId`)를 발급받아 `.env.local`의 `VITE_NAVER_CLIENT_ID`에 넣습니다.

- **Web 서비스 URL** 등록이 필수입니다. 로컬 개발용 `http://localhost:5173`과, 실제 배포 후
  Vercel/Netlify에서 받은 도메인(예: `https://boramae-chase.vercel.app`)을 모두 등록해야
  해당 도메인에서 지도가 정상적으로 뜹니다. 도메인을 등록하지 않으면 지도 스크립트 로딩이
  실패합니다.

## 3. Firebase 프로젝트 생성 (단계별)

1. [Firebase 콘솔](https://console.firebase.google.com/)에서 **프로젝트 추가**를 눌러 새
   프로젝트를 만듭니다. (Google Analytics는 꺼도 무방합니다)
2. 왼쪽 메뉴에서 **Firestore Database** → **데이터베이스 만들기** → 위치는 `asia-northeast3
   (서울)` 선택 → 처음에는 "테스트 모드"로 시작해도 되지만, 이 저장소에 포함된
   `firestore.rules`를 곧바로 적용하는 걸 권장합니다 (5단계 참고).
3. 왼쪽 메뉴에서 **Storage** → **시작하기** 로 기본 버킷을 만듭니다. (위치는 Firestore와 동일
   리전 권장)
4. 프로젝트 설정(톱니바퀴 아이콘) → **일반** 탭 → 하단 "내 앱"에서 **</> (웹)** 아이콘을 눌러
   웹 앱을 등록합니다. 앱 등록 후 나오는 `firebaseConfig` 값을 `.env.local`에 옮겨 적습니다.

   ```js
   const firebaseConfig = {
     apiKey: "...",            // → VITE_FIREBASE_API_KEY
     authDomain: "...",        // → VITE_FIREBASE_AUTH_DOMAIN
     projectId: "...",         // → VITE_FIREBASE_PROJECT_ID
     storageBucket: "...",     // → VITE_FIREBASE_STORAGE_BUCKET
     messagingSenderId: "...", // → VITE_FIREBASE_MESSAGING_SENDER_ID
     appId: "...",             // → VITE_FIREBASE_APP_ID
   };
   ```

5. **보안 규칙 적용**: Firebase 콘솔의 Firestore/Storage "규칙" 탭에 이 저장소의
   `firestore.rules`, `storage.rules` 내용을 각각 붙여넣고 "게시"를 누릅니다. (또는
   `firebase-tools` CLI로 `firebase deploy --only firestore:rules,storage:rules`)

   > ⚠️ 이 앱은 하루짜리 행사용으로 만들어져 있어 로그인(Firebase Auth) 없이 누구나 같은
   > 클라이언트로 접속합니다. 임원단/진행자 비밀번호는 앱 화면에서만 확인하며, DB 규칙은
   > 문서 구조만 최소한으로 검증합니다. 즉 이론적으로 규칙 코드나 개발자 도구를 아는 사람이
   > 임의로 데이터를 쓸 수 있습니다 — 사내/실제 서비스 수준의 보안이 필요하다면 Firebase Auth
   > + Custom Claims 도입을 권장하지만, 이번 행사 목적에는 이 정도 방어로 충분하다고
   > 판단했습니다.

6. `.env.local`에 임원단 기본 비밀번호(`VITE_DEFAULT_OFFICER_PASSWORD`, 선택), 진행자 접속
   비밀번호(`VITE_HOST_PASSWORD`)도 설정합니다. 임원단 비밀번호는 앱을 실행한 뒤 **진행자
   콘솔 화면에서 언제든 변경**할 수 있습니다.

## 4. 배포 (Vercel 예시)

```bash
npm i -g vercel
vercel
```

- 처음 배포 시 프로젝트를 생성하고, Vercel 대시보드 → Settings → Environment Variables에
  `.env.local`의 모든 값을 동일하게 등록합니다.
- 배포 후 나온 도메인을 네이버클라우드플랫폼 Maps 애플리케이션의 **Web 서비스 URL**에
  추가로 등록해야 지도가 뜹니다 (2단계 참고).
- 빌드 명령은 `npm run build`, 출력 디렉터리는 `dist` 입니다 (Vercel이 Vite 프로젝트를
  자동으로 인식합니다).

### Netlify로 배포하려면

- New site from Git → 이 저장소 선택
- Build command: `npm run build`, Publish directory: `dist`
- Site settings → Environment variables에 동일하게 값 등록

## 5. 게임 진행 방법

1. **진행자**가 먼저 접속해 진행자 비밀번호로 입장 → 임원단 비밀번호를 원하는 값으로
   변경합니다 (선택).
2. 임원단 4명이 각자 스마트폰에서 **임원단** 선택 → 본인 번호(1~4) → 비밀번호 입력 후 입장.
   입장 직후부터 GPS 위치 추적이 시작되고, 5분마다 자동으로 위치가 서버에 올라갑니다.
   (수동으로 "지금 위치 전송" 버튼도 사용 가능)
3. 9개 팀은 각자 **팀** 선택 → 본인 팀 번호(1~9) 선택만으로 바로 입장합니다 (비밀번호 없음).
4. 진행자가 **"새 게임 시작 (전체 초기화)"** 버튼을 누르면 모든 위치/사진/발견 기록이
   초기화되고 게임이 "진행중" 상태로 바뀝니다. 이 타이밍부터 리더보드의 "걸린 시간"이
   계산됩니다.
5. 팀 화면 지도에는 임원 4명이 "대상 1~4"로 익명 처리되어 동일한 마커로 표시되고, 본인 팀의
   GPS 위치도 함께 표시되어 거리/방향을 확인할 수 있습니다.
6. 어떤 팀이 임원을 실제로 찾아내면, **발견당한 임원 본인**이 자기 화면에서 "나를 발견한 팀
   번호"를 선택해 체크합니다. 잘못 눌렀다면 같은 화면에서 다시 다른 팀 번호를 선택해
   정정하거나, 진행자 콘솔에서 "취소" 버튼으로 되돌릴 수 있습니다.
7. 리더보드는 **찾은 임원 수 → 걸린 시간(짧은 순)** 기준으로 모든 팀 화면에서 실시간
   갱신됩니다.

## 6. 데이터 구조 (Firestore)

- `game/status`: `{ started, startTime, officerPassword, resetCount }`
- `officers/{1..4}`: `{ location, updatedAt, photoUrl, photoUpdatedAt, found, foundByTeam, foundAt }`
- `teams/{1..9}`: `{ location, updatedAt }`
- `catches/{autoId}`: `{ officerId, teamId, foundAt }` — 발견 기록 로그 (리더보드 계산, 진행자
  취소 기능에 사용)

## 7. 알아두면 좋은 점

- 모바일 브라우저는 위치 권한을 거부하거나(설정에서 재허용 필요), HTTPS가 아닌 페이지에서
  GPS를 막을 수 있습니다. Vercel/Netlify 배포본은 기본적으로 HTTPS라 문제없습니다.
- 사진은 임원단 화면에서 촬영/첨부 시 Firebase Storage에 업로드되고, 팀 화면의 "대상"
  카드에 힌트 썸네일로 표시됩니다.
- 진행자 비밀번호(`VITE_HOST_PASSWORD`)는 배포 환경변수로 관리하며 앱 재배포 전까지는
  런타임에서 바꿀 수 없습니다. 바꾸려면 환경변수를 수정하고 다시 배포하세요.
