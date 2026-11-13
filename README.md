# 딩가 (Dinga) 프로토타입

기타 연습 습관 앱 평가용 프로토타입. React + Vite. 서버와 로그인 없이 폰 브라우저에만 저장한다.

[개발 전달본](docs/HANDOFF.md)에서 구현 범위, 판정 방식, 평가 설정과 마지막 실기 항목을 확인할 수 있다.

## 실행

```bash
npm install
npm run dev      # 개발 서버. 터미널에 나오는 Network 주소를 폰에서 열 수 있다
npm run build    # 배포용 파일을 dist 폴더에 만든다
```

마이크와 카메라는 https 주소(또는 localhost)에서만 켜진다. 폰에서 시험하려면 Vercel에 올린 주소로 여는 것이 가장 쉽다.

## 배포 (Vercel)

1. 이 폴더를 GitHub 저장소에 올린다.
2. vercel.com에서 저장소를 가져온다. 앱 폴더를 저장소 루트로 올리면 Root Directory는 기본값이다. 상위 HCI 폴더를 올리면 Root Directory를 `dinga-app`으로 지정한다. `vercel.json`에 Vite, 빌드 명령 `npm run build`, 출력 폴더 `dist`가 지정돼 있다.
3. 나온 주소를 폰에서 열고, 브라우저 메뉴의 "홈 화면에 추가"로 설치한다.

## 폴더 구조

- `src/content.json` 문구와 데이터: 캐릭터 대사, 레슨 단계 목록, 코드 운지, 곡 진행, 팁, 친구 샘플, 소리 기준값
- `src/lib.js` 저장, 날짜 계산, 표정 규칙, 마이크 소리 감지
- `src/App.jsx` 폰 홈 화면(위젯), 홈, 출석, 학습, 연습, MY(같은 곡 챌린지), 기록, 숨은 패널
- `src/Lesson.jsx` 레슨 실행(설명, 코드, 연주, 박자, 안 보고 치기, 전환)과 연주 중 자세 알림
- `src/pose.js` 연주 중 자세 판정(손목 꺾임, 어깨). `public/pose` 폴더의 판정 파일을 쓴다
- `src/Song.jsx` 8마디 코드 전환 연습과 마디별 결과
- `src/SongPlay.jsx` 가사 위에 코드를 표시하는 12마디 곡 연습과 곡 연습 리포트
- `src/ui.jsx` 캐릭터, 탭, 코드 다이어그램 같은 공통 부품
- `src/motion.json` 캐릭터 움직임 키프레임
- `src/img` 캐릭터 이미지

## 숨은 패널 (평가 진행용)

화면 오른쪽 위를 빠르게 세 번 누르면 열린다.

- 참가자 번호: 세션을 시작할 때 적는다. 행동 기록에 함께 남는다
- 상태 초기화: 참가자 사이에 누른다 (참가자 번호와 행동 기록은 남는다)
- 행동 기록 복사/비우기: 화면 이동, 단계, 막혔어요, 건너뛰기, 나가기, 권한 거부, 출석 방식, 자세 결과, 곡 결과가 시간과 함께 남는다. 세션이 끝나면 복사해서 기록 양식에 붙인다
- 마지막 출석: 표정 단계를 만들 때 쓴다 (1일 전 삐짐, 2일 전 째려봄, 4일 전 지침, 7일 전 녹아내림)
- 레슨 1~3 완료 처리, 단계 건너뛰기, 표정 고정, 속도 ×3
- 곡 판정: 마이크 소리 / 랜덤 / 모두 성공 / 전환 어려움
- 자세 결과: 시뮬레이션 / 참가자가 직접 선택 (화면 구성이 PRD 원본일 때만 쓴다)
- 화면 구성: 아이디어 반영 / PRD 원본 (아래 "두 가지 화면 구성" 참고)
- 폰 홈 화면(위젯) 보기: 마지막 출석을 바꾼 뒤 위젯 표정을 확인할 때 쓴다
- 자세 알림: 정해진 시점(기본. 연주 단계 5초 뒤, 파트당 한 번) / 실제 판정 / 진행자가 띄움 / 끔. [지금 띄우기]는 어느 방식에서나 한 번 띄운다

## 두 가지 화면 구성

| | 아이디어 반영 (기본) | PRD 원본 |
|---|---|---|
| 시작 | 폰 홈 화면(위젯) → 누르면 스플래시 → 홈 | 스플래시 → 홈 |
| 자세 | 연주 단계에서 작은 카메라 + 알림 (피그마 P1) | 파트 첫 단계에서 촬영 → 결과 (피그마 14 · 15) |
| 학습 | 코스 1에서 Em·G·C 연습 → 완주하기 파트 3에서 곡 연습 | 챕터 1 · 필수 코드, 레슨 4개 |
| MY | 친구와 같은 곡 연습 → 곡 연습 바로가기 (피그마 C1 ~ C3) | 친구와 같은 곡 연습 목록 |

상태 초기화를 해도 화면 구성, 자세 알림 방식, 곡 판정, 참가자 번호는 남는다.

## 연주 중 자세 판정 (패널에서 '실제 판정'을 골랐을 때)

기본은 '정해진 시점'이다(11/11 팀 결정). 이때는 실제 자세와 상관없이 알림이 뜬다.

- 전면 카메라 영상을 폰 안에서만 계산한다(MediaPipe Pose, `public/pose`). 영상과 사진은 저장하지도 보내지도 않는다.
- 보는 것: 코드 잡는 손(기본 왼손)의 손목 꺾임, 어깨 기울기와 올라감. 엄지는 판정하지 않는다.
- 기준을 넘은 자세가 1.5초 이어지면 알림 한 줄과 진동 1번. 알림 사이 15초, 파트당 최대 3번.
- 기준값은 `content.json`의 `poseThresholds`. 검증된 수치가 아니라 시작값이다. 실제 폰과 기타로 맞춰야 한다.
- 작은 카메라 아래 글자: "자세 보는 중" / "몸이 안 보여요"(폰 위치를 다시 잡으라는 뜻) / "판정 꺼짐"(판정 파일을 못 불러옴).
- Em·C 레슨에서는 목표 부위가 가려지면 손목·어깨 안내를 표시한다. 판정이 실패하면 미리보기를 눌러 다시 시도할 수 있다. 권한 거부 상태에서는 ‘카메라 다시 켜기’를 제공한다.
- 실제 폰과 기타 테스트는 [팀 테스트 안내](docs/TEAM_TESTING.md)를 따른다.

## 실제로 되는 것과 아닌 것

- 실제: 소리 크기 감지(출석 2초, 연주 횟수, 곡 마디별 소리 시작 시점), 박자 타이머, 연주 중 자세 판정(손목·어깨), 기록 저장
- 출석에서는 소리 크기를 사용한다. 12마디 곡 연습은 Em·G·C를 추정하며 실제 기타 정확도는 리허설에서 확인해야 한다. 기본 판정 모드에서 마이크 없이 연습하면 완주는 기록하고 점수·정확도는 미측정으로 표시한다.
- 8마디 전환 연습에서 마이크를 사용할 수 없으면 수동 시작과 모의 판정을 제공한다.
- 위젯은 앱 안의 모의 홈 화면이다. 친구 목록은 샘플 데이터이며 PRD 원본 구성의 자세 결과는 시뮬레이션이다.

## 리허설에서 맞출 것

평가용 HTTPS 주소를 폰에서 열고 다음 순서로 한 세션을 진행한다.

1. 화면 오른쪽 위를 세 번 눌러 평가 패널을 열고 참가자 번호를 입력한다. 화면 구성은 ‘아이디어 반영’, 자세 알림은 ‘정해진 시점’, 속도는 ×1, 곡 판정은 ‘마이크 소리’로 둔다.
2. 위젯을 눌러 출석한다. 기타 소리가 2초 쌓이면 출석이 인정되는지, 10초 동안 소리가 없으면 다시 하기와 건너뛰기가 보이는지 확인한다.
3. Em 파트에서 연주 단계의 작은 카메라와 자세 알림을 확인한다. 홈으로 나왔다가 ‘이어서 연습하기’로 저장된 단계에 돌아간다.
4. 곡 연습과 8마디 전환 연습을 각각 마친다. 중간에 ✕ 확인창을 열고 기다렸다가 계속하기를 눌러 진행이 이어지는지 확인한다. 리포트로 돌아오면 폰의 마이크 사용 표시도 확인한다.
5. 평가 패널의 행동 기록 ‘복사’를 누르고 기록을 평가 양식에 붙인다. 패널의 상태 초기화 후 다음 참가자 번호를 입력한다. 초기화 후에도 행동 기록은 보존된다.

- `content.json`의 `soundThreshold.mid` (지금 0.05). 통기타 소리와 주변 소음으로 확인해 조정한다.
- `content.json`의 `poseThresholds` (손목 45도, 어깨 기울기 12도, 귀~어깨 비율 0.3). 기타를 든 자세에서 알림이 너무 자주 뜨거나 안 뜨면 조정한다. 폰을 세워 두는 위치도 같이 정한다.
- 곡 판정에서 "전환 늦음" 기준은 `Song.jsx`의 `beatMs * 0.6` (마디 첫 소리가 반 박 넘게 늦을 때).

## 자동 점검 (qa/qa.cjs)

PRD 기준 동작을 폰 크기 브라우저에서 자동으로 확인하는 스크립트다. 가짜 마이크·카메라를 쓰므로 실제 기타 소리 인식은 확인하지 못한다.

```bash
npm run build && npm run preview -- --port 4173   # 다른 터미널에서
npm i -D playwright && npx playwright install chromium
node qa/qa.cjs
node qa/song-without-mic.cjs
node qa/participant-handoff.cjs
node qa/practice-exceptions.cjs
node qa/mobile-layout.cjs
node qa/pose-reliability.cjs
node qa/storage-recovery.cjs
node qa/design-content.cjs
node qa/quality-review.cjs
node qa/chord-replay.cjs
node qa/chord-summary.cjs
node qa/chord-audio.cjs
node qa/chord-browser.cjs
node qa/practice-environment-unit.cjs
node qa/pose-framing.cjs
node qa/practice-environment.cjs
node qa/evaluation-export-unit.cjs
node qa/evaluation-export-browser.cjs
node qa/lifecycle-core.cjs
node qa/pose-input-validity.cjs
node qa/bar-spectrum-unit.cjs
node qa/media-recovery.cjs
node qa/camera-track-loss.cjs
node qa/chord-transients.cjs
node qa/pose-observation.cjs
node qa/chord-boundaries.cjs
node qa/repeated-use.cjs
node qa/practice-soak.cjs
node qa/recovery-layout.cjs
```

Edge로 점검할 때는 환경 변수 `QA_BROWSER_CHANNEL`을 `msedge`로 지정한다. 전체 QA는 기본적으로 4173번 포트를 사용하며 `QA_URL`로 대상을 바꿀 수 있다. 마이크 거부 회귀 테스트는 빌드 결과를 임시 로컬 포트에서 열어 확인한다.

권한 대기·중단·재시도·점수 신뢰성에 관한 발견과 수정, 검증의 한계는 [품질 재검토](docs/QUALITY_REVIEW.md)에 정리했다.

불명확한 소리의 판정 보류, FFT 해상도, 합성 입력 반복 검증은 [코드 판정 보강](docs/CHORD_RELIABILITY.md)에 정리했다. 합성 검사 통과는 실제 기타 인식률을 의미하지 않는다.

홈의 선택적 [연습 환경 확인](docs/PRACTICE_ENVIRONMENT.md)에서 촬영 위치와 마이크 입력을 준비한다. 입력 보정은 같은 장치에서 최대 10분 적용되며 저장하지 않는다.

평가 패널에서 [참가자별 JSON 기록 회수](docs/EVALUATION_EXPORT.md)를 할 수 있다. 기존 전체 배열 복사도 유지하며 실패 시 수동 복사를 안내한다.

배포 뒤 `node qa/deployed-smoke.cjs`로 운영 번들과 로컬 `dist`의 일치, 위젯→곡→리포트 경로를 확인할 수 있다. 먼저 `npm run build`를 실행한다. 새 브라우저 세션의 모의 입력을 사용하며 `QA_URL`로 대상 주소를 바꿀 수 있다.

연습 중 장치 중단·명시적 재연결·화면 복귀와 새 분석 창의 코드 판정은 [입력 중단 복구](docs/MEDIA_RECOVERY.md)를 참고한다.

추적 공백·멈춘 영상·느린 결과의 자세 지속 시간 처리, 반복 사용과 5분 연속 자원 검사는 [인식 경계와 반복 사용](docs/RECOGNITION_SOAK.md)에 정리했다.
