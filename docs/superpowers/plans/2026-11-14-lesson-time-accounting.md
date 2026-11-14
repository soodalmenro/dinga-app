# Lesson Time Accounting Plan

> **For agentic workers:** Execute inline with superpowers:executing-plans, TDD and one fresh-context final review.

**Goal:** Evaluation speed changes must not revalue earlier lesson time or change eligibility for the 60-second exit save.

**Spec:** Continued autonomous quality development; physical device/guitar tests stay last. Existing PRD completion credits (180 seconds, custom transition 120 seconds) and explicit exit threshold (60 seconds) remain authoritative.

**Architecture:** Keep existing pause/native-dialog exclusion in Lesson. Accumulate elapsed active milliseconds per speed segment rather than multiplying the entire session by the latest speed. No storage schema change or new dependency.

**Tech Stack:** React 18, Vite, Playwright/Edge.

## Constraints and rulings
- Reuse the existing clean checkout and a codex feature branch; existing authorized main→Vercel rollout remains in force.
- Completed parts retain nominal credits. This change concerns elapsed exit time and diagnostic seconds only.
- Panel, exit/stuck dialog, background, lost input and native unload waiting remain excluded.
- Store fractional segment milliseconds; round only at the final elapsed-seconds boundary.
- Alternatives: locking speed would remove an existing evaluation control; fixing one initial speed would ignore later explicit changes. Segment accounting preserves both controls and prior time.

## Tasks
- [x] RED: Browser reproductions for 3→1 retained saved time, 1→3 sub-minute exit, multiple changes/fractional segments and paused time exclusion. Observe failures before implementation.
- [x] GREEN: Minimal Lesson segment accounting; focused regression. Broader checkpoint/native-dialog/panel checks below.
- [x] Both builds, full regression, fresh read-only review, docs, main rollout and live smoke.

## Ledger
- Root cause: `elapsed()` multiplies all prior active time by current `s.panel.speed`, so changing speed rewrites elapsed time retroactively.
- RED four browser cases: actual/expected seconds 26/68, 105/45, 85/74, 27/67. GREEN all four after segment accounting. Expanded threshold/native-wait cases pending.
- Expanded seven browser cases all passed, including native-wait and exact 60 / just-under-60 thresholds. Final read-only review found no confirmed actionable issues in pause overlap, native resume or segment precision.
- Both builds passed. Source JS `index-ZtuH3N9l.js`, CSS `index-BHK6GL20.css`. Final full and focused regressions pending.
- Final regression: full 140 pass / 0 fail; checkpoint/unload 10, panel pause/rate 9, settings integrity 8 and quality 10 all passed. `git diff --check` clean. No source changes after builds or final review.
- Rollout: source `860f728` fast-forwarded/pushed to main; Vercel `dinga-ol7njb8u3-hci24.vercel.app` Ready Production. Live smoke passed all six workflows with exact local JS/CSS match. Added `QA_URL` target selection to the elapsed-time fixture and ran all seven boundary scenarios against `https://dinga-app.vercel.app/`: all passed. Physical testing remains last.
