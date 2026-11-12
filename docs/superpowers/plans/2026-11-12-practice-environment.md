# Practice Environment Preparation Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for inline implementation; test-driven-development and final independent review.

**Goal:** 카메라에 필요한 부위가 보이는지 안내하고, 주변 소음과 시험 연주를 확인한 입력 기준을 선택적으로 적용한다.

**Architecture:** 홈에서 선택적으로 여는 환경 확인 화면을 추가한다. 소음 2초·시험 연주 2초는 실제 관측한 샘플로 계산한다. 순수 계산 함수와 세션 보정 상태를 분리하고, 실제 카메라 관절 인식에서 촬영 위치 안내를 계산한다. 기본 자세 알림 모드는 유지한다.

**Spec:** User approved continuation of camera framing guidance and microphone input preparation, with real guitar verification last.

**Tech Stack:** React18/Vite6, existing MediaPipe Pose/WebAudio, pure Node QA and Edge browser QA; no new dependencies.

## Global Constraints

- 환경 확인은 선택 사항이며 기존 출석·학습 흐름을 막지 않는다.
- 보정 입력은 원음 없이 RMS 값만 일시적으로 사용한다. 영상도 저장하지 않는다.
- 관측 샘플이 부족하거나 소음이 높거나 시험 소리가 부족하면 보정을 적용하지 않는다.
- 보정은 기본 기준보다 낮추지 않으며 최대0.15, 동일 입력 장치·10분만 유효하다. 장치 식별 불가 시 현재 캡처 세대에서만 유효하다. 새로고침·초기화 시 기본값으로 돌아간다.
- 촬영 안내의 ‘부위가 보임’은 올바른 자세나 정확도 보장이 아니다. 기존 정해진 시점 알림을 실제 판정으로 바꾸지 않는다.
- 대기 취소·거부·실패·백그라운드·화면 종료 후 늦은 권한 응답과 카메라/오디오 자원을 정리한다.

## Review Focus

- 숨김/긴 프레임 공백은 소음 관측 시간으로 인정하지 않으며 보정을 취소한다.
- 신호 부재·급격한 소음·클리핑·잘못된 값은 안전하게 기본값을 유지한다.
- 보정 후 장치 변경·시간 만료·식별 불가 장치 재연결은 기본값으로 복귀한다.
- 화면 밖/가린 손목·팔꿈치·어깨·귀·손끝을 ‘촬영 준비됨’으로 표시하지 않는다.
- 준비 화면의 요청 취소/종료/재시도는 늦게 도착한 스트림을 해제하고 기존 모델 복구 경로를 유지한다.

### Task 1: Pure calibration and framing contracts

- [x] Add failing tests, then implement `deriveInputCalibration(noise, signal, base=0.05)` with >=30 noise and >=30 signal samples, noise p95, threshold=max(base,noise*2.5+0.01), reject threshold>0.15, require >=2 signal frames above threshold and peak>=1.8*threshold, reject clipping>=0.95.
- [x] Implement memory-only profile keyed by deviceId or capture generation with10min expiry; test defaults, expiry, mismatch, reset.
- [x] Add failing framing tests, then implement `cameraFraming(landmarks,hand,focus)` using visible in-frame joints, shoulder span>=0.12 and focus-specific required joints. Return actionable Korean title/instruction and readiness.

### Task 2: Environment screen and integration

- [x] Add optional home route with mic noise/signal sampling, explicit apply/retry/default choice and camera preview/live framing. No permission requested until its button is pressed.
- [x] Connect microphone device identity, session threshold, reset on participant reset. Integrate framing status into Pose callbacks and actionable real-mode lesson guidance.
- [x] Browser tests for success/quiet signal/noise, denial/cancel/late response, background cancellation, expiry/device guards, camera model failure/retry, framing and resource cleanup. Verify no recordings/profile in persistent storage.

### Task 3: Verify and ship

- [x] Run targeted QA, existing quality/pose/storage/mobile/full QA, synthetic audio pipeline, both builds and audit. Read-only review and resolve confirmed defects.
- [ ] Document thresholds and unverified device behavior. Commit, integrate to existing main, deploy and verify exact production bundle and flow.

## Ledger

- Ruling: existing user authorization covers autonomous execution and established main→Vercel deployment. Use current checkout on a feature branch, no additional worktree or repeated approval ceremony.
- Ruling: optional preparation avoids inserting mandatory calibration into the PRD evaluation flow; it never claims calibrated guitar accuracy.
- Verification: new environment browser lifecycle groups pass, pure calibration/framing and Pose-focus contracts pass; full QA140/140, quality10, mobile12, pose/storage/uncertain report, audio20, both builds and audit0 pass.
- Review fixes: camera failed-state stream release, lesson focus propagation, numeric calibration log removal; failing tests reproduced each behavior. Additional pending-permission exit test reproduced null-ref cleanup error; explicit ref guard passed. Expiry test reproduced stale detector threshold; dynamic reads passed. Default-device alias uses groupId or capture-local identity.
