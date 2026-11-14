# Course Final Audit Plan

> **For agentic workers:** Execute inline using executing-plans, TDD and a final fresh-context read-only review.

**Goal:** Reconcile current course1's12parts against the latest Figma handoff and prove the complete normal-button flow in both variants.

**Sources:** Figma file7P8BU0iGlHRnj52Z7q1JBb: development35:40 (latest section9/96:2 overrides older rows), comments11/11, revision77:6; actual modal frames80:16/80:172. Screens80:313/80:408 are empty frames, not implementation requirements. User authorizes about1hour sustained development, with physical testing last.

## Constraints
- React/Vite/local persistence and existing source/assets remain authoritative; do not rebuild from exported code or change physical recognition thresholds.
- Course1 is four lessons ×three parts. Completing a course part credits180seconds; standalone transition120seconds. Course12bar partial/standalone result duration rules stay intact unless an explicit contradictory requirement is confirmed.
- Idea uses courseSong, Em/G/C9part prerequisite lock; course2/3 locked; MY song shortcut unlocked for study. No weekly goal reintroduction.
- Native media denial must still allow every part via normal UI. No dinga-skip to claim a complete course test.
- Preserve no-mic/unmeasured/simulated assessment distinction, retry, checkpoint and export behavior.

## Tasks
- [x] Read Figma hierarchy/context/screens/comments and map all12parts, priorities and intentional differences.
- [x] RED: full normal-button walkthrough both variants; embedded transition parent progress matches finished bars; full course credits nominal12×180.
- [x] Fix only confirmed course defects; prove GREEN, including repeated transition remount and mixed-speed pause/recovery.
- [x] Inspect actual rendered course/modal/transition layouts and document asset reuse/out-of-scope visual differences.
- [x] Both builds, relevant/full regressions, final read-only review and authorized main/Vercel/live rollout. Update remaining scope accurately.

## Ledger
- Hour started2026-11-14 13:02:51UTC; target around14:02:51UTC. Productive work budget; no physical-test handoff.
- Source inspection: idea embedded Song never reports completed bars to Lesson.tbar, unlike legacy Transition. SongPlay full course credits tempo-derived duration instead of nominal course-part credit. Both require reproduction before changes.
- Retrieved current native PRD through connected Google Docs. Section3.1 confirms nominal ~3min part credit; Figma35:97 explicitly180seconds. Latest Figma9 overrides week goals/old8bar completion route but does not change course-part credits.
- Fixture corrections before meaningful RED: handle actual finger-placement buttons and legacy Song start/home controls. Product remained unchanged. Then all24normal parts finished: idea parent progress remained0 while1..7bars completed, idea total2070seconds vs2160expected; legacy total2160passed.
- GREEN after minimal fixes: all24normal parts passed, both totals2160 and resume cleared. Embedded Song reports completed-bar count to parent; Progress adds accessible name/current/max/unit without visual changes. Its missing semantic progress target was separately RED before markup change.
- Focused progress3passed: pause/rate preservation, remount/reset to second transition, real-input loss then explicit simulated restart/reset. Completion9passed including fast125% course credit180, unmeasured course credit180, partial/retry/save-retry and retained best rules. Added fromLesson/creditedSeconds to end-event diagnostics; no raw input persisted.
- No recognition-threshold changes. Timed alerts, legacy photo simulation, future locked courses and unlocked MY study shortcut remain unchanged. Existing course modal decorations and synonymous code-part title wording are noted visual/copy differences, not silently declared pixel-identical.
- Final production/single-file builds passed; source bundle index-D3lk-zEd.js / index-BHK6GL20.css. Whole suite140/140 passed. Full24part walkthrough, progress3, completion9, quality10, export browser/unit and mobile12 passed on this source.
- Captured and inspected course modals, transition and completion. Initial static Home image bounds check sampled an intentional idle jump; the static layout check now uses reduced motion, then restores the preference. Design/content retry passed, and the separate default/reduced/legacy motion cleanup checks3/3 passed. This does not assert that every animated frame stays inside its stage.
- Fresh-context read-only source/test/export review returned no actionable findings. No source changes after final builds/review; only QA capture/static-layout conditions and documentation changed.
- Integrated source commit bda4d0c into main by fast-forward and pushed without force. Vercel production deployment dinga-8nlx726tt-hci24.vercel.app reached Ready. Public alias https://dinga-app.vercel.app matched the reviewed JS/CSS bundles.
- Live: deployed smoke6, normal24part walkthrough (idea/prd2160seconds each), completion9 and embedded progress2 (pause/rate, remount) passed, all exit0. Source-import-only input-restart remains a local check, not a claimed live check.
- Added a QA-only download assertion and ran live course-retry/course-fast: both passed. Actual JSON files preserve complete/partial events, fromLesson=true and full credit180; this verifies the integrated download path, not only the event-cleaner unit.
- Remaining pre-physical scope is modal decoration/spacing/copy alignment plus its verification/deployment, estimated45–90minutes. Physical guitar/phone testing stays last. No recognition accuracy claim.
