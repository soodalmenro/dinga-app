# Evaluation Setting Integrity Plan

> **For agentic workers:** Execute inline with TDD and final read-only review.

**Goal:** 화면 구성 변경이 이어하기 단계를 잘못 해석하거나 한 연습의 참가자가 도중에 달라지는 경로를 방지한다.

**Spec:** User requested continued development; physical tests remain last. Existing idea/PRD variants, participant-local journal and manual participant reset stay authoritative.

**Architecture:** A pure resume remapping function preserves the canonical step when regular lesson variants differ only by posture filtering. Different song definitions restart the same part conservatively. Panel receives active-screen status, disables participant/variant edits there and guards their callbacks; other evaluation controls and exports remain available.

## Constraints
- 저장 형식은 기존 lesson/part/step을 유지하고 완료·시간·점수는 바꾸지 않는다.
- 대응하지 않는 촬영 단계·서로 다른 곡 구성은 같은 파트의 첫 단계로 보낸다. 임의의 다른 단계로 진행시키지 않는다.
- 연습 화면에서는 참가자 번호·화면 구성을 바꾸지 않는다. 나가기·초기화 후 다시 설정할 수 있다.
- 참가자 번호 변경만으로 데이터를 자동 삭제하지 않는다. 새 참가자의 기존 수동 초기화 절차를 안내한다.
- 속도·자세 알림·단계 건너뛰기·복사/JSON 회수 유지. 원음·영상 저장 없음.

## Tasks
- [x] RED→GREEN: idea↔PRD retained lesson step, posture fallback, song part fallback, corrupt resume, no mutation/completion/time changes.
- [x] RED→GREEN: active practice disables PID/variant edits, outside-screen edits still work, resume survives reload; other panel actions remain usable.
- [x] Relevant checkpoint/panel/export/quality/full QA and both builds; read-only review; document and deploy via existing main→Vercel flow.

## Ledger
- Ruling: use existing checkout on feature branch with established authorized rollout; no physical-testing handoff.
- RED: all four initial browser cases failed before implementation (two wrong resume indices, two editable active settings). GREEN: all four passed, then all eight expanded route/clear-log/export checks passed.
- Pure mapping checks: 134 steps across both variants/directions passed, including conservative fallbacks and immutable input.
- Read-only final review: no confirmed findings in mapping, active route locks, checkpoint/native guards, reset, clear-log and exports.
- Both production builds passed; JS `index-B_1WC27M.js`, CSS `index-BHK6GL20.css`. Broader regression and deployment verification pending.
- Existing full-suite fixture tried editing PID on the attendance screen. The new lock correctly blocked it; moved its unchanged PID assertion/setup before entering attendance and reran the suite. Product lock was not weakened.
- Final full regression: 140 pass / 0 fail. Checkpoint/unload 10, evaluation pause/rate 9, clipboard/download/retention export, participant handoff and quality 10 all passed. Built-preview smoke passed all six workflows including the new settings mapping/lock check. `git diff --check` clean.
- Rollout: source commit `871cdf8` fast-forwarded and pushed to main. Vercel `dinga-4rm9dsi3x-hci24.vercel.app` Ready (Production). Live `https://dinga-app.vercel.app/` matched local JS/CSS and passed all six smoke workflows, including variant mapping and active settings lock. No physical-test handoff; recognition accuracy still requires the final real-device/guitar phase.
