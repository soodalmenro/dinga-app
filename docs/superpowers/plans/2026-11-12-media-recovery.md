# Media Recovery and Transient Verification Plan

> **For agentic workers:** Use superpowers:executing-plans inline, TDD and final read-only review.

**Goal:** 연습 중 입력 중단·화면 복귀에 안전하게 대응하고, 잘못된 자세 좌표와 이전 코드의 분석 잔상을 검증한다.

**Architecture:** 미디어 트랙 관찰과 wake-lock 세대 관리를 순수 모듈로 분리한다. 공유 마이크 상태를 구독해 손실을 알리고, 복구 후 명시적 계속하기를 요구한다. 12마디는 완료 마디를 보존하고 미완료 마디부터 다시 측정한다. 8마디에서 마이크 없이 모의 모드로 바꾸면 혼합 출처를 피하려 시도를 새로 시작한다. 자세 입력의 경계·가시성을 검증하고 반복 숨김의 최초 시점을 보존한다.

**Spec:** User approved device recovery, coordinate validation, return-to-screen handling, then synthetic short/decaying/changing chord verification. Real guitar validation remains last.

## Global Constraints

- 권한 재요청은 명시적 버튼에서만. 복구가 끝나도 사용자 계속하기 전 자동 진행하지 않는다.
- 입력 없는 시간을 소리/박자 성공으로 계산하지 않는다. 이전 스트림·미완료 마디의 샘플을 새 입력과 섞지 않는다.
- 취소/중복 요청/늦은 응답/오래된 release 이벤트가 새 자원을 덮어쓰지 않아야 한다.
- 화면 밖·잘못된 가시성·잘못된 영상 크기는 판정하지 않는다. 촬영 안내와 계산은 같은 유효성 정의를 공유하되 안내에는 추가 여백을 사용한다.
- 기존 판정 모드·완료·보관·내보내기·마이크 없는 사용을 유지한다. 원음·영상 저장/업로드 없음.
- 합성 어택·감쇠·전환은 공학적 계약이며 실제 기타 정확도를 뜻하지 않는다.

## Review Focus

- 트랙 ended/mute/inactive와 AudioContext 중단은 입력을 즉시 비활성화하고 타이머를 정지시켜야 한다.
- 같은 연습에서 재연결 후 미완료 마디는 새 입력으로 측정하며 모의 전환은 출처가 분리돼야 한다.
- 중복 hidden 이벤트는 최초 중단 시각을 바꾸지 않고, wake-lock 대기 응답은 종료 후 해제돼야 한다.
- NaN/Infinity/화면 밖 좌표·가시성·0/음수 영상 크기는 경고를 만들지 않아야 한다.
- 짧은 어택/감쇠/코드 경계에서 분석기 이전 창을 현재 코드로 오인하지 않도록 합성 입력으로 비교한다.

### Task 1: Core lifecycle contracts
- [x] RED→GREEN: shared stream liveness/ended/mute observation and listener removal.
- [x] RED→GREEN: wake-lock dedup, late response after disable, hidden/visible reacquisition and old release isolation.
- [x] RED→GREEN: repeated hidden preserves earliest pause; pose calculation rejects invalid dimensions/coordinates/visibility.

### Task 2: Device recovery UI and state integration
- [x] Add microphone state subscription and interrupted recovery, context/track disposal and pending request guards.
- [x] Hook and recovery dialog: retry → connected → explicit continue, or explicit no-mic/exit. Pause lessons/attendance/8bar/12bar; preserve/restart only valid progress.
- [x] Observe camera track loss in lesson/legacy capture/setup; stop stale tracking and offer explicit retry.
- [x] Browser tests for input loss/retry/denied/late responses, no-mic conversion, camera loss, visibility and source integrity.

### Task 3: Transient sound evidence
- [x] Generate short/decaying/changing tones at44.1/48k through the real audio pipeline; record failing cases before adjusting code.
- [x] If needed, allocate spectral samples to their own bar and wait for a fresh post-onset analysis window; missing evidence stays uncertain. Test clear controls and legacy continuous tones.

### Task 4: Review and rollout
- [x] Targeted and existing quality/device/pose/storage/export/full QA, both builds, fresh review and documentation.
- [ ] Commit→existing main→Vercel; verify bundle and core/user recovery flow.

## Ledger
- Ruling: use existing checkout on feature branch and authorized rollout flow, with no repeated approval ceremony.
- Ruling: a resumed12bar exercise replays the unfinished bar, keeping measured completed bars. Changing8bar actual input to simulation restarts that attempt rather than mixing provenance.

- RED→GREEN: invalid out-of-frame pose produced a finite wrist angle before validation; valid dimensions/bounds/confidence now gate calculations.
- RED→GREEN: transient baseline confirmed the previous chord in 6/10 conditions. Bar-isolated fresh windows alone retained analyser smoothing residue; smoothing=0 removes it while keeping per-bar aggregation.
- Review: final read-only lifecycle review found no additional confirmed important issues after combining visibility and microphone recovery acknowledgment.
- Verification 2026-11-13: core lifecycle, invalid pose, bar spectrum, calibration and export unit contracts pass; camera loss/capture/model-load tests pass; full built-app QA140/0 and local built-bundle smoke (including reconnection) pass. Both builds succeed, asset index-DFIhbvOW.js.

- Final focused run: quality10, pose reliability, environment preparation, participant export/retention, storage, mobile12, media recovery5, continuous audio20, uncertain-report browser and transient audio10 all pass (exit0). Rollout checkbox remains pending until remote verification.
