# Recognition Boundary and Repeated Use Plan

> **For agentic workers:** Use superpowers:executing-plans inline, TDD and one final fresh read-only review.

**Goal:** 실기 전 자세 판정의 관측 연속성과 반복 연습의 자원·기록 안정성을 검증하고 재현된 결함을 수정한다.

**Architecture:** 기존 React/Vite·공유 미디어 모듈을 유지한다. 실제 watcher 경로의 결정적 시간·영상 입력 검사와 실제 브라우저의 반복 화면·장치 검사로 관측 공백, 자원 유지와 중복 기록을 탐지한다.

**Spec:** User approved remaining plan: recognition edge cases, repeated/long usage, mobile final check, team handoff; actual phone/guitar verification remains last. Existing HANDOFF.md and MEDIA_RECOVERY.md retain product behavior.

## Global Constraints
- 기획된 기본 자세 알림 시뮬레이션과 실제 판정 선택을 유지한다.
- 관측되지 않은 시간·동일한 멈춘 영상으로 자세 지속 시간을 만들지 않는다. 불충분한 코드 증거는 보류한다.
- 원음·영상·주파수 배열 저장/전송 없음. 합성·가상 장치 검사를 실기 정확도로 해석하지 않는다.
- 기존 checkout에서 기능 브랜치를 사용하고 승인된 main→Vercel 흐름으로 배포한다.

## Review Focus
- 숨김·프레임 멈춤·느린 추론·잘못된 영상 크기 뒤 첫 결과가 즉시 경고를 발생시키지 않아야 한다.
- 재시도·종료 뒤 오래된 모델 응답이 새 watcher에 전달되거나 새 모델을 제거하지 않아야 한다.
- 반복 레슨/환경 확인/곡 진입·종료 뒤 스트림·AudioContext·잠금·모델 작업이 누적되지 않아야 한다.
- 한 번의 완료가 중복 집계되거나 모의 결과가 실제 최고 기록을 갱신하지 않아야 한다.
- 작은 화면·확대·가로 보기에서 복구 버튼과 현재 상태를 읽고 조작할 수 있어야 한다.

## Tasks
- [x] 1. Reproduce watcher continuity gaps/frozen frames/invalid dimensions; minimally fix confirmed failures; preserve valid hold, occlusion reset, handedness and framing.
- [x] 2. Exercise repeated browser practice/setup/recovery and completion/exit cycles; assert all tracks/contexts released and no duplicated completion records. Fix reproduced failures with RED→GREEN.
- [x] 3. Check mobile layout/orientation/enlarged text and chord weak/boundary controls. Update handoff, run relevant regression/full QA and both builds, final read-only review.
- [x] 4. Commit, integrate and deploy; verify exact production bundle and core/recovery/export flow. Record results and limitations.

## Ledger
- Ruling: reuse the current clean checkout on codex/recognition-soak; no additional worktree or repeated approval needed for established authorized workflow.
- Pre-flight: Task1 changes watcher results consumed by lessons and setup; Task2 tests both consumers; mobile/legacy pose regression must use the same final source. Do not edit product source during browser runs.
- Estimates in the conversation are planning ranges, not a requirement to occupy time or invent changes when checks pass.

- RED→GREEN: original watcher failed six continuity cases (long gap, repeated frame, unavailable video, hidden, delayed result, zero dimensions); valid sustained control passed. Fresh-video/dimensions/result-age guards fixed them. Added 2fps RED→GREEN to preserve valid low-rate observations while skipping duplicates. All10 watcher cases pass including changed dimensions and backward timeline; right-hand/mirror, invalid geometry and framing controls pass.
- Repeated-use baseline:15 UI cycles pass with ended tracks, closed input contexts, detached input observers, no post-exit inference/wake lock;5 completions produce5 terminal events and no simulated best. First real-time300000ms resource run passes; final source soak and full regression pending.
- Review: independent final reviewer found no confirmed Critical/Important issue; added its two suggested deterministic cases (dimension change and backward timestamp), both pass.
- Test ruling: camera-track-loss used visible nobody guide as proof of inference. New invalid-video guard can report that guide before first decoded frame. Wait for actual model sends on retry, then assert guide; initial canceled model still must send0. This changes the test synchronization, not product behavior.

- Final source:300000ms real-time soak passed,1186 inference calls with fixed2 streams/2 live tracks/1 input context/1 model/maximum1 concurrent inference, then all captures closed. Full built-app QA140/0, both builds (index-B3toWdB0.js), local bundle/export/recovery smoke, pose reliability, camera retry synchronization, environment, quality10, media recovery5 and repeated UI15 pass. Mobile12 final run passed.

- Final mobile12 and recovery orientation/text-size3 pass; screenshots reviewed for narrow/landscape recovery. No additional product change justified by these checks. Real device performance and guitar recognition remain last.

- Rollout verified: app commit5ebc7bf, Ready production deployment dinga-pyj58zwaa-hci24.vercel.app with dinga-app.vercel.app alias. Production smoke exit0 verifies exact index-B3toWdB0.js, setup fallback, song/report, participant JSON/versioned diagnostics, track loss→retry→explicit continue. Remaining actual phone/guitar validation is intentionally last.
