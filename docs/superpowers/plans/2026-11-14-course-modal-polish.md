# Course modal visual finish

User approved continuing the remaining modal decoration/spacing/copy work and deployment, without another design discussion. Reuse the current checkout on codex/course-modal-polish; no new worktree or dependencies.

## Design and scope

Figma80:16 and80:172 high-fidelity context/screens are the visual targets. Keep existing React/CSS, hi/yay WebP assets (visually confirmed exact character artwork), current readable text colors and latest12bar course content. Basic cards/badges use existing native components/tokens; close/check/chevron use local Figma SVG assets. Do not import a screenshot or exported screen as UI.

Course-only modal: opaque navy backdrop, white350px sheet at390 viewport,20px inner padding,14px card gaps,88px code cards/96px completion cards, floating hi66px/yay80px. Preserve separate scrollable sheet, focus trap/restore, Escape/outside close,44px close target and original resume actions. Reserve80px above/below on short viewports so the decoration remains visible; sheet scrolls instead of clipping controls. Keep all other dialogs and PRD comparison layout unchanged. Idea code-part2 label becomes 코드 잡기 without changing legacy content data.

Completion subtitle retains Em/G/C pills; do not restore Figma's obsolete8bar description (latest development section9 says12bars). Existing p.sub/latest content is authoritative for part descriptions.

## Tasks

- [x] Baseline/design capture and meaningful mobile/keyboard/scroll regression for course modals. Reproduce missing decoration/copy before editing.
- [x] Minimal Modal decoration/class extension plus Course-only native layout, local icon slots and idea title. Verify390 geometry and320/short/enlarged layouts; compare captures to targets.
- [x] Both builds, whole140 suite and relevant course24/progress/completion/quality/mobile/motion/export regressions. One fresh read-only final review, integrate authorized main/Vercel deployment and live smoke/course/modal checks.
- [x] Update handoff/remaining-work documents with verified state and physical testing last.

## Ledger

- Existing main149d38d clean; preceding whole140 and live24/9/6/2 checks passed. Physical recognition thresholds, timing and storage unaffected by this scope.
- RED: original modal has no Figma character decoration. Added scoped Modal decoration/class extension and Course-only layout; existing hi/yay artwork reused, SVG close/check/chevron downloaded through the supplied curl instructions with root20/18/18 sizes retained.
- Initial geometry/keyboard11 conditions passed. Captures inspected at390,320 enlarged and667×320; source background SVG fill metadata confirms34324A. Both builds passed before final focus finding.
- Fresh read-only final review: one P2 visible-focus issue at App.jsx restoration. Enhanced test independently reproduced song320×568 target451..511 while screen ends492. Final fix pass will allow scrolling on restoration and rerun the full suite. No other findings/minor deferrals.
- Initial full suite stopped at a brittle .sheet .iconbtn selector after the deliberate icon restyle; replaced its four close selectors with the existing accessible button label, preserving all assertions and flows.
- Final: fixed P2 visible-focus restoration — restored focus must be inside .screen scrollport RED→GREEN; default focus() now scrolls the corresponding lesson into view. Final modal11/11 and quality10/10 passed. Final whole suite pending at this ledger entry; no re-review round.
- Final builds passed: JS index-Tdxh_uQ5.js / CSS index-C_Vl6adR.css; single-file805.97kB (gzip471.40kB). No product source changes after these builds. Final390px screenshots inspected for both character slots, SVG sizes, sheet/card geometry and latest song copy.
- Earlier focused group passed normal24parts, progress3, completion9 (including actual JSON credit downloads), mobile12, design/content, motion3, export browser, resume134 and settings8. Those preceded only the final focus-scroll change; final modal/quality and whole suite cover that fix, and live checks will use the final bundle.
- Final whole suite140/140 passed with exit0 on the final production build. The P2 fix pass is verified by modal11/11, quality10/10 and whole140/140. No remaining review findings; no recognition or curriculum changes.
- Source commit0c168b6 fast-forwarded into main and pushed without force. Vercel dinga-936sv2nu0-hci24.vercel.app reached Ready; https://dinga-app.vercel.app matches reviewed JS index-Tdxh_uQ5.js and CSS index-C_Vl6adR.css.
- Live final bundle: deployed smoke6/6, normal24parts (both variants2160seconds), modal11/11 including visible focus, completion9/9 including two actual JSON credit downloads passed, all exit0. No real guitar/camera accuracy inference from these software checks.
- Handoff, audit, modal provenance and remaining-work documents updated. The previously scheduled45–90minute visual/deployment work is now handled. No separately scheduled pre-physical feature/visual tasks remain in the agreed course1 scope. Physical guitar/phone validation and evidence-based corrections remain last.
