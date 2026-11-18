# 자세 판정 · 손 인식 · 인식 안내 (팀원 인수용)

브랜치 `feature/hand-tracking-guidance` (`feature/pose-judgment-debug` 위에 쌓임).
**기본 동작은 바뀌지 않는다.** 알림 기본값은 그대로 `auto`(시뮬레이션)이고, 아래 기능은 숨김 패널(우상단 3번 탭)에서 켤 때만 동작한다.
기획서와 달라지는 부분(실제 판정·손 모델)은 팀 확정 후 기본값으로 올릴 것 (기획서 8.3, 평가 중 판정 기준 임의 변경 금지).

## 새 모듈
| 파일 | 역할 |
|---|---|
| `src/handMetrics.js` | 순수 계산. 손가락 굽힘(`fingerBends`), 엄지(`thumbMetrics`), 손목 꺾임(`wristFlexion`, Pose 팔뚝 + Hands 손 방향), 코드 잡는 손 고르기(`pickHand`) |
| `src/hands.js` | MediaPipe Hands 로더/감시. `watchHands(video, {intervalMs, complexity, onStatus})` → `{latest, status, stop}`. 모델은 `public/hands/` 자체 호스팅 |
| `src/poseGuidance.js` | `trackingGuidance(...)` → `{level: fix/tip/ok, code, title, instruction}`. 문구·임계값은 이 파일에서만 수정. `PLACEMENT_TIPS`는 폰 위치 팁 |
| `src/PostureGuidance.jsx` | 안내 표시 UI (ok면 아무것도 안 그림, fix면 "폰 위치 팁" 펼침) |
| `src/devFlags.js` | 숨김 패널 플래그(`dinga-handtrack`) 저장/이벤트 |
| `src/pose.js` | `measure`에 `wristH`/`fingers`/`thumb` 추가(손 데이터가 있을 때만), `judge`는 손목 값을 `wristH > wrist3d > wrist` 순으로 사용, 기준선도 같은 종류끼리만 비교 |

## 켜는 법 (폰, HTTPS 필요)
숨김 패널 → 자세 알림 = **실제 판정**, 자세 판정 디버그 화면 = **켬**, 손 인식(실험) = **켬**.
(패널의 "파트 3 카메라 테스트 열기" 버튼은 알림을 auto로 되돌리니 누르지 말 것.)
디버그 화면에서 "기준 자세 저장"(올바른 자세로 3초)을 하면 개인 기준선으로 판정한다.

## 이어서 할 일 / 주의
- 손가락·엄지 값은 **표시만** 한다. 알림 판정에는 쓰지 않는다 (검증된 기준 없음). 쓰려면 실제 기타 연주 영상/폰으로 값 분포부터 확인.
- 정면 폰 카메라만으로 "어느 프렛·줄을 눌렀나"는 판정할 수 없다. 손 모델은 손목 꺾임·손 형태 보조용.
- 첫 켤 때 모델 약 16MB 다운로드, CPU 부하 증가. 느린 폰은 `content.json`의 `poseThresholds.handModel`을 0(lite)으로.
- 실기기 정확도는 아직 검증 전이다. 임계값(`wristDelta` 25°, `tiltDelta` 8°, `neckDrop` 0.75)은 초안.
- 영상·사진은 저장/전송하지 않는다 (모든 추론은 브라우저 안).

## 테스트
`node qa/hand-metrics.cjs`, `node qa/pose-guidance.cjs`, `node qa/pose-baseline.cjs` 외 기존 `qa/pose-*.cjs`, 그리고 `npm run build`.
