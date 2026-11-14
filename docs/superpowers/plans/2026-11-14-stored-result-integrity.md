# Stored Result Integrity Plan

> **For agentic workers:** Execute inline using superpowers:executing-plans, TDD and one final fresh-context read-only review.

**Goal:** Restored local records must not invent completion or retain impossible best scores/counts.

**Spec:** Continued autonomous quality work. Existing valid/legacy records, local-only persistence, nominal completion credits and last-stage physical testing remain authoritative.

**Architecture:** Normalize at `load()` using strict true flags, safe nonnegative integer counts and bounded percentage best scores. Preserve valid reports and unrelated progress/history. Reject impossible numbers to zero rather than clamp to an invented perfect score. Stored report retry flags become strict booleans so malformed strings cannot turn a standalone retry into a course attempt.

**Tech Stack:** Existing React/Vite, Vite SSR unit checks and Playwright Edge.

## Constraints and decisions
- Reuse existing checkout on a codex feature branch; established main→Vercel rollout authorized.
- No new schema, dependency, destructive reset, server, data upload or physical-test handoff.
- Preserve valid measured/simulated report content and bests even when the latest report is partial/simulated. No guessing which historical attempt produced best.
- Missing legacy flags default false; only literal true means complete/fromLesson/firstComplete/challengeFirst.
- Scope excludes speculative re-scoring or reconstructing discarded results; normalize only known invalid fields.

## Tasks
- [x] RED: invalid best/count, string/object completion/retry flags and challenge status; positive legacy roundtrip controls and unrelated data preservation.
- [x] GREEN: minimum load-boundary normalization and actual browser recovery. Broader legacy storage regression pending.
- [ ] Relevant score/participant/setting/quality checks, both builds, review, docs and existing rollout with live verification.

## Ledger
- Root cause: `nonnegative` accepts out-of-range best and fractional/unsafe counts; report spreads and raw challenge preserve truthy non-boolean flags.
- RED: six unit checks failed (invalid best/count, challenge/report flags, missing legacy boolean); valid-record control passed. GREEN: all initial seven checks passed. Two real-browser UI/reload cases passed, preserving history, resume, completed parts and participant ID.
- Final pure checks: all eight passed, including preserving a valid historical best when the latest attempt is unscored/simulated. Fresh read-only review found no actionable issues and confirmed current writer/legacy compatibility.
- Both builds passed; JS `index-VTSTWIAh.js`, CSS `index-BHK6GL20.css`. Final full and relevant storage/score/participant/quality regressions pending.
- Focused regressions passed: legacy migration and storage failure/retry, both stored-record browser cases, uncertain/unmeasured/partial score summaries, participant handoff/export and quality 10. Full regression pending; source unchanged after final review/build.
- Final full regression: 140 pass / 0 fail. Pure recovery checks 8, browser recovery/preservation 2 and focused checks above passed. Ready for established rollout.
