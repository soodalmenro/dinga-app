# Camera Preview Readiness Plan

> **For agentic workers:** Execute inline with superpowers:executing-plans, TDD and one fresh-context final review.

**Goal:** PRD posture capture must not produce a verdict without a valid captured frame.

**Spec:** Continued quality development; physical phone/guitar verification stays last. Existing PRD simulated/self-selected posture results remain authoritative; no change to recognition thresholds/defaults.

**Architecture:** Separate stream acquisition from preview readiness. Capture requires live input and actual decoded video dimensions/data; play errors or a bounded 10-second first-frame wait lead to retry/skip. Capture rechecks validity and fails safely if canvas drawing/encoding cannot produce an image. Generation guards ignore stale play/stream responses and unmount cleans listeners/timers/tracks.

## Constraints and decisions
- Reuse existing checkout on codex branch and authorized main→Vercel rollout.
- Permission prompts remain cancellable via skip/exit; first-frame timeout begins only after stream acquisition.
- Do not persist image data or infer a posture when capture fails.
- Keep result camera release, retry, countdown cancel/pause and explicit skip behavior.
- Valid frame checks rather than arbitrary delay: a fixed delay neither guarantees usable video nor handles image encoding failure.

## Tasks
- [x] RED: no first frame, rejected playback, lost readiness during countdown and canvas failure produce no verdict; valid/retry/late response controls.
- [x] GREEN: minimal preview/capture readiness handling and cleanup; focused browser tests.
- [ ] Existing camera loss, preparation, quality, pause and full regression; both builds; final review, docs, rollout/live checks.

## Ledger
- Root cause: cameraReady is set when getUserMedia resolves; playback errors are ignored; capture falls back to invented dimensions and proceeds after draw/encoding failure.
- Fixture correction before meaningful RED: seed today's attendance so Home exposes resume. Product was unchanged during correction.
- RED: no-frame, playback rejection, countdown frame loss and canvas failure all failed as expected; valid capture/retry control passed. GREEN: all five passed after implementation.
- Expanded final ten cases all passed, adding 10-second no-frame release, late frame recovery, empty encoded image, stale playback rejection and stale permission acquisition. Captured images are absent from persisted state/log and all acquired tracks end on exit.
- Fresh read-only review found no actionable issues in cleanup, retry, generation guards and pause interaction.
- Both builds passed; JS `index-CkggqHIh.js`, CSS `index-BHK6GL20.css`. Existing camera loss/retry and interrupted model-loading cases passed. Full/quality/panel regressions pending; no source changes after review/build.
- Quality retake assertion observed the video's first frame before the UI readiness poll committed. Updated its bounded wait to require both a live decoded preview and enabled capture button; retained the explicit assertion. Product source unchanged; rerun quality/panel checks.
- Final local regression: full 140 pass / 0 fail, quality 10 and panel pause/rate 9 passed; camera track-loss 2 and new preview 10 also passed. `git diff --check` clean. Both builds and final read-only review completed.
