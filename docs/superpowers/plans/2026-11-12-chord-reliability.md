# Chord Recognition Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 불확실한 소리를 Em/G/C로 강제 분류하지 않고 판정 범위를 표시하며, 같은 입력으로 변경 전후를 비교한다.

**Architecture:** 음 구성 판정을 독립적인 순수 함수로 분리한다. 기존 guessChord는 chord/null 호환 래퍼를 유지한다. 곡 판정의 c:null은 미확정으로 저장하며 무음·잘못된 코드·마이크 미사용과 구분한다.

**Tech Stack:** Existing React 18 / Vite 6, Node tests, Edge browser QA; no new dependencies.

**Spec:** User-approved next bundle: abstain on ambiguous chord input + deterministic replay verification, with honest score/report handling. Camera guidance and input calibration remain the following bundle; real guitar testing remains last.

## Global Constraints

- Provisional engineering thresholds, not calibrated recognition accuracy or probability.
- Silence remains a missed sound; ambiguous detected sound is not a wrong chord.
- Timing can be measured independently; unknown chords suppress chord accuracy and overall score for that attempt.
- Unknown-chord attempts cannot update best; completion and lesson progress remain valid.
- Preserve existing simulated/no-microphone/legacy report behavior and browser-local storage.
- No recordings or raw audio are stored. Fixtures are synthetic feature vectors, not guitar recordings.

## Review Focus

- Shared tones, a single note, uniform noise, and out-of-vocabulary spectra must abstain.
- Invalid shape, NaN, Infinity, negatives and zero energy must never produce a chord or throw.
- Gain scaling must not change a valid positive spectrum decision.
- Mixed uncertain/correct/wrong/silent bars must preserve timing and avoid unsupported advice.
- New reports must survive reload; legacy reports without coverage fields must still render.

### Task 1: Replay harness and conservative classifier

- [x] Add deterministic fixtures for clear chords, shared tones, single notes, broadband noise, invalid inputs, competing chord mixtures and scaling.
- [x] Run against existing guessChord; confirm ambiguous cases fail.
- [x] Implement `analyzeChord(chroma, chordNotes)` returning chord/reason/support/margin/version using provisional support >=0.85, lead >=0.12, each chord tone >=0.08 of energy. Preserve guessChord wrapper.
- [x] Replay baseline and new classifier side by side. Assert abstention cases and clear controls, print decision changes; never call synthetic acceptance rate real accuracy.

### Task 2: Integrate uncertain outcomes and report coverage

- [x] Add failing summary and browser tests for unknown sound with valid timing; no false correct/wrong marker or weak-transition advice, no best update.
- [x] Integrate independent timing, c:null abstention, per-bar diagnostic fields and classifier version. Separate unknown sound from unmeasured microphone state.
- [x] Persist coverage; show played/total and uncertain bars, independently render timing, suppress overall/chord score when unknown, preserve old records.
- [x] Validate all-known, all-unknown, mixed, silent, no-mic, simulation, partial and empty results.

### Task 3: Verify, review, document and deploy

- [x] Run replay tests, browser uncertainty/reload tests, existing quality QA, full QA, mobile layout, both builds and dependency audit.
- [x] Fresh read-only review; resolve confirmed defects and rerun affected checks.
- [ ] Document engineering thresholds and synthetic-only evidence. Commit, deploy via existing authorized GitHub/Vercel flow, verify deployed bundle and smoke flow.

## Execution ledger

- Ruling: continue in the existing dedicated checkout and established deployment flow, per user's repeated instruction to progress autonomously; no additional worktree or repeated approval ceremony.
- Ruling: the abstention rule favors withheld scores over a deceptively strong score based on a small selected subset. This can withhold valid attempts until real-guitar calibration; copy must explain it.
- Task 1 complete: legacy replay had 15 contract failures (12 forced classifications and 3 invalid inputs); the new replay passes 18 vectors plus invalid/scale controls.
- Task 2 complete: summary test first failed on unknown chord scored as 0; now all 7 summary classes pass. Browser confirms timing 100%, uncertain 12, unchanged best 81, lesson completion, reload, corrupt new fields rejected and legacy accepted.
- Ruling: generated-audio replay exposed 48kHz Em bin leakage. Increase spectral FFT 8192→16384 without loosening thresholds; keep onset FFT1024. All 20 generated-audio cases pass. Longer analysis window and transient/device costs remain unverified in real use.
- Review: fresh read-only review found no confirmed regressions; reviewer independently ran vector and summary tests. Browser/audio results were verified by the implementer; reviewer could not independently start browser tests without the bundled Playwright path.
- Task 3 verification complete: final FFT16384 build full QA 140/140; feature-vector18 + audio20 + summary7 classes + browser/reload/damaged/legacy + quality10 + mobile12 + storage checks passed. Both builds succeeded; runtime audit0. Rollout uses existing authorized main→Vercel flow; deployed smoke verifies exact asset equality.
