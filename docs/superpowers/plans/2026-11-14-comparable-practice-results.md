# Comparable Practice Results Plan

> **For agentic workers:** Execute inline with superpowers:executing-plans, TDD and one fresh-context final review.

**Goal:** Eight-bar reports compare previous results only when exercise, chart order, tempo and known judging mode match.

**Spec:** Continued autonomous quality development; existing two-result storage, PRD/idea flows and final physical testing remain authoritative.

**Architecture:** Add a pure comparison predicate next to Song/Report. Keep stored previous results unchanged. Render comparison for equal known conditions; distinguish incompatible previous results from a genuinely first attempt. Same-mode simulated comparisons remain explicitly labeled as simulated.

## Constraints and decisions
- Reuse current clean checkout on a codex branch and established authorized main→Vercel deployment.
- Same ordered eight chords, pair/full-song identity, tempo, known execution speed and exact known judge (`mic|random|allok|hard`) are required. Do not treat missing legacy provenance as microphone data or assume normal speed.
- Legacy full-song reports without chart use the existing content chart; pair reports without chart are not guessed comparable.
- Retain the existing two-result history structure. Add only execution `speed` metadata to new eight-bar results; null means changed during play. No deleted result, score recalculation, recognition threshold or physical testing.
- Alternatives: retaining unconditional comparison misleads; searching older attempts requires new storage/history. Compare only the retained immediately previous result when conditions match.

## Tasks
- [x] RED: actual Report rendering mixes different pairs, tempo and judging modes; positive same-condition/first-attempt controls.
- [x] GREEN: predicate and precise report messages; condition boundaries + real-browser report flow.
- [x] Update incompatible old QA expectation; relevant report/storage/layout and full regressions, both builds, review/docs and live rollout.

## Ledger
- Root cause: Report compares any `s.song.prev` without checking exercise/tempo/mode; current full QA even expects hard→allok to count as improvement.
- Fixture correction: use Node's React/server renderer, Vite only for application modules. Product unchanged before meaningful RED.
- RED: six incompatible-render cases failed; expanded nine incompatible cases failed including speed/unknown/mixed rates. Same-condition positive passed. GREEN: all ten render cases plus simulation labels/first/legacy/invalid controls passed.
- Ruling: add speed provenance to new results because nominal tempo alone does not identify actual execution tempo. Mid-play changes remain non-comparable even if final speed matches; a deliberate new actual→simulation attempt resets rate provenance with other attempt data. Legacy results without speed are preserved but not compared.
- Existing full-suite hard→allok expectation updated to require suppression, preserving the previous-result retention assertion. Real-browser matching-mode positive is covered separately.
- All seven browser cases passed, including mid-attempt speed change, first attempt, previous result/time preservation and reload. Fresh read-only review found no actionable issues in report rules, speed provenance or legacy storage compatibility.
- Both builds passed; JS `index-av-qhljI.js`, CSS `index-BHK6GL20.css`. Existing pure stored-result recovery 8 passed. Final full/report/recovery/panel/layout regressions pending; no source changes after review/build.
- Final full regression: 140 pass / 0 fail. Stored-result 8, storage recovery/retry, media recovery 5, panel pause/rate 9, report/exception 3 and mobile layout 12 all passed. New comparison browser fixture additionally checks the incompatible-report message at 320px; final narrow-screen run pending.
- Final comparison browser run: all seven passed, including 320px incompatible-report containment and stored metadata/results preserved after reload. `git diff --check` clean.
- Rollout: source `4387e7c` fast-forwarded/pushed to main; Vercel `dinga-ksw98wbx0-hci24.vercel.app` Ready Production. Live `https://dinga-app.vercel.app/` matched reviewed JS/CSS and passed six smoke workflows plus all seven comparison browser cases. Physical phone/guitar testing remains last.
