# Motion Accessibility and Readable Dialog Plan

> **For agentic workers:** Execute inline with TDD and one final read-only review.

**Goal:** 실기를 기다리지 않고 동작 줄이기 설정과 확대 글자에서의 팝업 가독성을 보완한다.

**Spec:** User reiterated development must precede physical guitar tests. Existing product scope, design and default evaluation modes remain authoritative. Do not prompt for real tests or add unrelated backend/account features.

**Architecture:** React hook observes the platform reduced-motion preference. Character entry/idle/tap and confetti respect it, including changes while mounted. CSS decorative transitions/scrolling respect the same preference. Dialog text wraps on word boundaries where possible without hiding controls.

## Constraints
- 캐릭터 이미지·대사·연습 타이밍·코드/자세 판정 수식을 유지한다.
- 기본 설정에서 기존 모션을 유지한다. 동작 줄이기는 장식적 움직임만 억제한다.
- 새 외부 의존성과 권한 요청 없음. 실제 폰·기타 검증은 마지막으로 유지한다.

## Tasks
- [x] RED→GREEN: actual browser reduced-motion preference suppresses character entry/idle/tap and confetti; changing preference cancels active motion, restore works, unmount removes preference listeners.
- [x] Improve dialog word wrapping/padding for large Korean text; verify 320px and landscape controls and screenshots.
- [x] Relevant quality/mobile/recovery regressions, both builds and final read-only review; commit→main→Vercel and verify deployed artifact/flows.

## Ledger
- Ruling: keep current checkout on feature branch and established authorized rollout. Hardware validation is not a dependency of these implementation fixes.

- RED→GREEN: browser initial reduce still animated the character; dynamic reduce timed out waiting for animations to stop. Hook+animation/canvas cleanup fixes both. Default/reduced settings, tap, change/restore and listener teardown pass.
- Dialog:320px150% text now wraps Korean words and larger buttons without clipping; all3 recovery layouts pass, screenshots inspected. Both builds succeed (index-DP7Tc7Xh.js / index-BHK6GL20.css). Independent read-only review found no Important/Critical issues; reviewer could not independently run Playwright without our NODE_PATH, root executed the browser checks.

- Regression evidence: quality10, mobile12, recovery layout3 and participant handoff pass. Built-app smoke verifies JS/CSS, report/JSON, microphone retry and reduced-motion initial/tap/live changes. Full QA first run timed out waiting for song report; cause not established. Added failure-state diagnostics and rerunning unchanged product build rather than weakening criteria.

- Final verification: reduced/default/legacy media-query browser cases exit0; local built JS/CSS/report/JSON/recovery/live-motion smoke exit0; quality10/mobile12/recovery3/handoff exit0; full140/0 rerun on unchanged app after first unreproduced timeout. First cause remains unknown, retained diagnostic capture. Both builds and read-only review complete.

- Rollout:ad001e3 deployed Ready at dinga-m3k168zvx-hci24.vercel.app. Production dinga-app.vercel.app smoke exit0 verifies reviewed index-DP7Tc7Xh.js and index-BHK6GL20.css, result/participant JSON, microphone reconnection and initial/tap/live reduced-motion changes. Development-first instruction retained; no physical test request.
