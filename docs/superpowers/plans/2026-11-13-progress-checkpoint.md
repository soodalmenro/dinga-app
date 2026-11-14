# Lesson Checkpoint and Unload Protection Plan

> **For agentic workers:** Execute inline with TDD and final read-only review.

**Goal:** 새로고침·브라우저 이탈로 레슨 위치가 사라지는 경로를 줄이고 저장 전 연습 결과의 이탈을 안내한다.

**Spec:** User said continue development; physical guitar/device tests stay last. Existing single-page navigation and explicit exit, completion/time accounting, local-only data remain authoritative.

**Architecture:** Save a normal lesson checkpoint when its active step changes. Preserve completion flags and history; clear checkpoint on successful completion. Save song-step checkpoint before course handoff. A shared beforeunload hook protects active unfinished lesson/song attempts and removes its listener when inactive/unmounted. Browser-native prompts have platform limits and do not replace checkpoints.

## Constraints
- 기존 완료180초/전환120초·명시적 나가기60초 기준을 바꾸지 않는다.
- 체크포인트는 단계 위치이며 미완료 결과·점수·시간을 자동 성공으로 저장하지 않는다.
- 복습·독립 전환은 정규 코스의 이어하기 위치를 덮어쓰지 않는다.
- 완료한 파트가 새로고침으로 미완료가 되거나 체크포인트가 다시 살아나지 않아야 한다.
- 기존 내부 나가기 확인창 유지. 새 화면별 URL·서버·원음/영상 저장 없음.
- 실기 요청으로 자동 전환하지 않는다.

## Tasks
- [x] RED→GREEN: normal lesson checkpoint survives reload at exact step; completed progress clears and remains completed; review/custom do not overwrite course resume; course-song entry preserves correct checkpoint.
- [x] RED→GREEN: native unload guard for unfinished practice, dismiss keeps current attempt, explicit exit/complete removes guard. Hook listener lifecycle and browser fallback.
- [ ] Relevant storage/course/quality regressions, both builds and full QA; final read-only review; document scope and browser limits; authorized main→Vercel and deployed verification.

## Ledger
- Ruling: existing checkout on feature branch and existing rollout. Checkpoint does not award time or persist partial audio judgments. The native prompt is a secondary safeguard, not a guarantee against OS termination.
- RED→GREEN: normal lesson and course-song entry had null resume; native guards absent. Repeated completion skip awarded540 instead of180. Checkpoint, handoff and synchronous finish ref fix these cases without changing normal completion accounting.
- Native test ruling: installed Playwright closes browser.newPage's owned context before running unload. Use explicit context/page; actual close and Back prompts/dismiss pass. Native-dialog wait counted in lesson elapsed (24s vs total24.822s at debug speed3); callback/ref exclusion now removes blocked time and clips at overlapping suspension.
- Storage: checkpoint-save-retry preserves latest step after quota failure. Completion-save-retry exposed disabled guard while completed state remained unpersisted; App storage-error guard remains until successful retry. Both tests pass.
- Review: independent read-only review found no blocking issues, including App/Lesson listener overlap, checkpoint clearing and native-clock overlap. Root owns runtime evidence.
- 11/14 execution: initial runs spanned an idle/environment change and failed at navigation/element stability. Sandbox/default shell stopped responding; explicit host Windows PowerShell responds. No product changes made to explain these failures; fresh builds preserve index-_P2xow8U.js / index-BHK6GL20.css. Fresh10 cases, storage regression and local built-artifact smoke pass; full/focused checks still pending.
- 11/14 fresh full QA140/0, quality10, storage recovery and local built-artifact smoke pass. Waiting only for final participant handoff/practice exceptions in the running focused chain before rollout.
- Final pre-rollout verification: fresh focused chain exit0, including participant handoff and practice exceptions (microphone cancellation,8bar pause and report round trip). All runtime checks and both builds pass on current source. No product changes after builds/review.
