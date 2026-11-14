# Song Completion Guard Plan

> **For agentic workers:** Execute inline with superpowers:executing-plans, TDD and one fresh-context final read-only review.

**Goal:** A twelve-bar practice attempt saves its result/time/count at most once; attendance completion also emits its event once.

**Spec:** Continue development after giving a bounded remaining-work estimate. Physical guitar/phone testing remains last. Keep measured/simulated best-score rules and nominal/partial time rules unchanged.

**Architecture:** A per-mounted-attempt ref guards SongPlay.finish before any update/event/navigation. Report retry mounts a new attempt and receives a fresh guard. Do not use debounce/time delays or block intentional retries.

## Constraints
- Existing checkout on codex branch and authorized main→Vercel rollout.
- Partial result never increments completion count or replaces best. Full result increments once. Separate retried attempts remain separate.
- Preserve course completion/resume semantics, microphone recovery, panel pause and automatic completion.
- No storage schema change, new dependency or physical-test handoff.

## Tasks
- [x] RED: repeated end clicks within one task produce duplicate end events/time; valid normal controls.
- [x] GREEN: minimal per-attempt guard; partial double end, auto finish, report retry and empty end controls.
- [x] Relevant no-mic/score/quality/full regression; builds; review/docs; main rollout and live verification.

## Ledger
- RED: two synchronous clicks on the real end button produced 2 songplay_end events instead of 1 before implementation.
- GREEN: original partial double-end regression passed. Expanded five browser cases passed: partial-double, automatic completion, retry, empty-end cancellation then play, course retry. Count/best/time/events and course resume/completion assertions passed. Fresh read-only review found no actionable issues.
- Both builds passed; JS `index-C0NFN9QA.js`, CSS `index-BHK6GL20.css`. Final no-mic/quality/report/storage/full regressions pending; source unchanged after review/build.
- Expanded scope within the same completion task: Attend already deduplicates dates, but duplicate manual completion emits two attend events. Actual RED 2 vs1 observed before App change. Added the same per-mounted-completion guard before any mic/update/log side effects. Explicit reset/unmount still creates a fresh completion.
- Intermediate SongPlay-only full 140, no-mic 2, quality 10, report exceptions 3 and storage checks passed. Final App addition requires a fresh build/full run and participant/attendance controls; do not count intermediate results as final-source verification.
- Final six browser cases passed after attendance guard. Added seventh save-failure/retry control; final read-only combined review found no actionable issues in sound/manual completion, new participant/reset, retries or course semantics.
- Seventh save-failure/retry control passed. Final combined builds passed; JS `index-8fNEi9pw.js`, CSS `index-BHK6GL20.css`. Final-source full/quality/participant/attendance controls pending.
- Final combined-source verification: full 140 pass / 0 fail, quality 10, participant handoff and attendance panel pause/resume passed. New completion seven paths passed. Final read-only review and diff checks clean. Remaining pre-physical estimate revised to2~3hours for course/design reconciliation plus final handoff; recognition accuracy remains unverified.
- Rollout: source `960078a` fast-forwarded/pushed to main; Vercel `dinga-hlnllhhoe-hci24.vercel.app` Ready Production. Live `https://dinga-app.vercel.app/` matched reviewed JS/CSS and passed six smoke workflows and all seven completion scenarios, including duplicate attendance and save retry. Physical guitar/phone testing remains last.
