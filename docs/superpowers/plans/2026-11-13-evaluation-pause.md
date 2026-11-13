# Evaluation Panel Pause Plan

> **For agentic workers:** Execute inline with TDD and final read-only review.

**Goal:** 평가 패널 조작 중 연습·촬영·입력 측정이 진행되지 않도록 한다.

**Spec:** User requested continuing development before final hardware testing. Current panel actions/modes remain available; user-visible practice must pause behind dialogs and time without observation must not count.

**Architecture:** App passes panel visibility as a pause prop to practice routes. Existing lesson/song suspended state consumes it. Attendance keeps its accumulated observed samples while skipping panel-covered frames. Environment preparation cancels measurements/tracking and requires explicit retry, as with background interruption.

## Constraints
- 기존 패널의 단계 건너뛰기·수동 자세 알림·판정 모드·초기화·내보내기 유지.
- 패널을 닫으면 진행 중 연습은 이어가되 패널 시간·소리를 성공으로 세지 않는다.
- 환경 측정은 중단 뒤 자동으로 다시 시작하지 않는다. 나간 뒤 늦은 자원 응답은 해제한다.
- 영상·원음 저장 없음. 실기는 마지막이며 개발 진행 지시를 실기 요청으로 해석하지 않는다.

## Tasks
- [x] RED→GREEN:12bar/8bar progress, legacy capture countdown, attendance accumulation and environment measurement behind evaluation panel.
- [x] Integrate panel pause with route state, preserve attendance across panel close and explicit recovery; retain existing panel actions.
- [ ] Relevant regression, full QA and builds; final read-only review; document and deploy through existing flow.

## Ledger
- Ruling: existing checkout on feature branch, authorized main→Vercel flow. No hardware prerequisite.

- RED→GREEN:12bar progressed1→2,8bar1→4, capture3→no countdown, attendance0→1 record, preparation captures stayed live behind panel. Integrated panel pause passes5 paths. Additional RED→GREEN: sound attendance retained live microphone at completion and idle checks falsely became interrupted. Completion now releases input and only active preparation is canceled.
- Final read-only review found no confirmed Critical/Important issues. Both builds succeed, index-Cn8CnM8K.js and index-BHK6GL20.css. Full and focused regression pending.

- Scope refinement from reproduced defects: changing panel speed3→1 made both song views lose current bar (-1 vs expected1), because elapsed milliseconds belonged to old beat duration. Replay unfinished bar at new duration, preserve completed results, clear hits/spectrum and restart interval. Four rate cases include first-bar rewind; they caught duplicate start events2 vs1. Log once per attempt; explicit eight-bar simulation conversion resets the start flag as a new attempt. Reviewer follow-up found no confirmed Critical/Important issues.
- Prior pause-only build passed full140, quality10, environment, media5, repeated15, participant export/handoff. Final source (including rate/log fixes) needs fresh builds, final9 and affected regression.

- Final9 browser scenarios pass (exit0), including early rate changes logging exactly1 start. On explicit8bar actual→simulation conversion a new start remains required and is asserted in media-recovery regression. Added panel hint explaining unfinished-bar replay. Final builds and affected regression follow; no product edits during those runs.

- Final build assets:index-BkCDOlbI.js / index-BHK6GL20.css. Local built smoke exit0 checks JS/CSS, report/JSON, microphone recovery, reduced motion and deployed-style panel pause/rate/start logging. Final media recovery5 pass including explicit conversion generating a second legitimate start. Full140 and affected quality/chord reporting still running.

- Final verification complete before rollout:9 panel cases exit0; full140/0 on final index-BkCDOlbI.js; final media5/quality10/chord report browser exit0; both builds and independent review done. Built artifact smoke including panel/rate/logging passes.
