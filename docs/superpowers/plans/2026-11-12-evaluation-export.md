# Evaluation Export Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline, test-driven-development, final read-only review.

**Goal:** 실기 마지막 단계에서 참가자별 기록을 확실히 회수하고 판정 출처·보류 이유를 재확인할 수 있게 한다.

**Architecture:** 기존 전체 행동 기록 배열 복사는 유지하고 성공/거부/무응답 결과를 안내한다. 평가 패널에 참가자별/전체 JSON 파일 저장을 추가한다. 순수 export builder는 명시적 필드만 포함하며 상태 스냅샷은 참가자 귀속이 불명확하므로 포함하지 않는다. 새 곡 종료 이벤트에 원음 없는 마디별 판정 진단을 기록한다.

**Spec:** User requested continued maximum software development before real guitar testing. Current gaps: silent clipboard rejection, mixed participant records, per-bar diagnostic reasons absent from exportable events.

**Tech Stack:** Existing React18/Vite6, browser clipboard/Blob download, pure Node and Edge tests, no new dependencies/backend.

## Global Constraints

- No upload, messaging, recordings, landmarks, device IDs, RMS samples or calibration values.
- Preserve existing ‘복사’ array format/all participants for existing evaluation consumers; new file scope is explicitly separate and defaults to current participant (blank means unassigned only).
- File schemaVersion1 includes exportedAt, selected event summary, exact bundle filename, basic browser/capability information, settingsAtExport explicitly current rather than historical.
- Snapshot records lacking participant identity are not attributed or exported as participant results. Old events remain with diagnostics absent, never reconstructed.
- All metadata and diagnostics are allowlisted; unknown/nested media fields are discarded.
- Never label a clipboard attempt successful before fulfillment. Timeout/denial retains manually selectable text. File status indicates request, not confirmed save.
- Files never delete browser records. Warn at the existing4000-event retention boundary.

## Review Focus

- Scope filtering must preserve exact PID identity, including blank/Unicode, without mixing participants.
- Serialization must preserve zero/false/null values, reject non-finite numbers and strip raw media/calibration/unknown keys.
- Clipboard denial, missing API, hanging promise and stale responses after clear/unmount must be safe.
- Download filename must not contain path traversal/control characters; Blob is the reviewed JSON and URLs are released after the download can start.
- Simulated/no-mic/uncertain verdicts must remain distinct; invalid legacy events cannot break exports or fabricate diagnostics.

### Task 1: Export/copy contracts

- [x] Add failing unit tests; implement buildEvaluationExport(events, options), evaluationFilename(report), copyEvaluationText(text, clipboard, timeoutMs).
- [x] Test participant/all/blank selection, summaries, sanitized nested verdicts/settings/environment, filenames, malformed inputs and clipboard outcomes.

### Task 2: Panel and diagnostic integration

- [x] Add failing browser tests for clipboard failure/success/timeout, file scope/content and retention notice. Preserve legacy copy contract.
- [x] Add explicit status/manual fallback, file scope selector/JSON save, preview fallback for unsupported downloads.
- [x] Add per-bar verdict diagnostics to new songplay_end events. Keep simulation and unmeasured markers, no signal samples.
- [x] Browser-check lifecycle races, small screens, legacy handoff, storage failure and new diagnostics.

### Task 3: Verify and ship

- [x] Run unit/browser/handoff/storage/quality/full QA and both builds. Read-only review, resolve reproduced defects.
- [ ] Document file schema, privacy, current-setting semantics and old diagnostic gaps. Commit→main→Vercel and verify deployed version/flow.

## Ledger

- Ruling: use existing checkout on feature branch and established authorized deploy flow; continue without repeating permissions.
- Ruling: export event records only; current app history/last reports lack reliable participant attribution and must not be mislabeled.
- Verification: unit contracts, actual participant/all/memory/4000-event downloads, denied/hung/stale clipboard, PID/scope preview consistency,320px readable controls, existing handoff/storage/chord diagnostic/quality10 and full140 pass. Both builds succeed; read-only review found no confirmed regressions.
- Additional RED→GREEN: mutable PID left prior preview visible; save kept legacy-all preview instead of file payload; label wrapped vertically at320px. Fixed state invalidation, exact file preview and scoped grid layout; targeted browser QA and visual capture passed.
- Ruling: newly written events include the actual bundle asset path. Exporting bundle and recorded bundle are distinct; legacy/development/inline unknowns remain unversioned. Memory-only journal is labeled and recoverable; unreadable storage never implies complete data.
