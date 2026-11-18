// 자세 촬영(S7) 사진 한 장을 실제로 본다. MediaPipe Tasks Vision(Apache-2.0)의
// 몸 관절 33점(PoseLandmarker)과 손 관절 21점(HandLandmarker)을 폰 안에서 계산한다.
// 사진·좌표는 저장하거나 보내지 않는다. 결과는 사진 한 장으로 본 참고값이다.
//
// 판정 기준 (어쿠스틱 체이서 「통기타를 연주하는 바른 자세」, 피그마 14·15 가이드 선):
//  - 어깨: 양쪽 높이가 비슷하고, 한쪽이 귀 쪽으로 올라가지 않는다.
//          (왼손이 너무 낮으면 오른 어깨가 올라간다)
//  - 왼손 높이: 코드 잡는 손이 소리 내는 손(사운드홀 쪽)보다 약간 위에 있다.
//          (너무 낮으면 손목을 많이 꺾게 되고 어깨가 올라간다)
//  - 손목: 팔뚝과 손이 크게 꺾이지 않는다.
//  - 엄지: 넥 뒤에 가려져 카메라로 보지 않는다(항상 '확인 어려움').
// 손목 기준 30도(poseThresholds.photoWristDeg): 인체공학 기준(RULA)은 굴곡·신전 15도부터 위험 점수를 올리고,
// 기타 해부학 교본은 왼손목 굴곡을 10~20도 이내로 권한다. 정면 사진의 2차원 각도는 오차가 커서(MediaPipe
// 손 관절 오차 3~8도, 웹캠 손목 각도 측정은 일관되지 않다는 연구) 여유를 두었다. 어깨 기울기 기준은 근거 문헌이
// 없어 참고값이다. 정면 카메라 한 장이라 깊이 방향 꺾임은 덜 보인다. 실제 기타로 맞추기 전의 시작값이다.
import content from './content.json';

const BASE = `${import.meta.env.BASE_URL}vision`;
let loading = null;

// 처음 한 번만 불러온다(모델 약 13MB + wasm 약 15MB). 실패하면 다음 호출에서 다시 시도한다.
export function loadPostureCheck() {
  if (!loading) {
    loading = (async () => {
      // 첫 화면을 무겁게 하지 않도록 자세 촬영 때 처음 불러온다
      const { FilesetResolver, PoseLandmarker, HandLandmarker } = await import('@mediapipe/tasks-vision');
      const files = await FilesetResolver.forVisionTasks(BASE);
      const options = (model, extra) => ({ baseOptions: { modelAssetPath: `${BASE}/${model}`, delegate: 'CPU' }, runningMode: 'IMAGE', ...extra });
      const pose = await PoseLandmarker.createFromOptions(files, options('pose_landmarker_lite.task', { numPoses: 1 }));
      const hands = await HandLandmarker.createFromOptions(files, options('hand_landmarker.task', { numHands: 2 }));
      return { pose, hands };
    })().catch((error) => { loading = null; throw error; });
  }
  return loading;
}

const withTimeout = (promise, ms) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('posture_timeout')), ms))]);

export const POSTURE_ITEMS = ['wrist', 'hand', 'shoulder', 'thumb'];
const unknown = (reason) => ({ status: 'unknown', reason });

// 관절 좌표(0~1)로 판정한다. 화면·모델 없이 시험할 수 있게 따로 둔다.
// pose: 33점, hands: [21점, ...], w·h: 사진 크기(px), side: 코드 잡는 손('left'|'right')
export function judgePhoto(pose, hands, w, h, side = 'left', th = content.poseThresholds) {
  const result = { wrist: unknown('손이 화면에 보이지 않아요'), hand: unknown('양손이 함께 보이지 않아요'), shoulder: unknown('양쪽 어깨가 보이지 않아요'), thumb: unknown('엄지는 넥 뒤에 가려져 카메라로 보지 않아요'), points: null };
  if (!Array.isArray(pose) || !(w > 0) || !(h > 0)) return result;
  const seen = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1 && (p.visibility === undefined || p.visibility >= 0.5);
  const at = (p) => ({ x: p.x * w, y: p.y * h });
  const deg = (r) => (r * 180) / Math.PI;
  const I = side === 'right' ? { sh: 12, el: 14, wr: 16, ear: 8, other: 15 } : { sh: 11, el: 13, wr: 15, ear: 7, other: 16 };
  const L = pose[11]; const R = pose[12];
  const points = { shoulders: null, arm: null, hand: null, other: null };

  if (seen(L) && seen(R)) {
    const a = at(L); const b = at(R); const width = Math.hypot(a.x - b.x, a.y - b.y);
    points.shoulders = [L, R];
    if (width > 0) {
      const tilt = deg(Math.atan2(Math.abs(a.y - b.y), Math.abs(a.x - b.x)));
      const lift = (shoulder, ear) => (seen(ear) ? (at(shoulder).y - at(ear).y) / width : null); // 귀~어깨 높이. 작을수록 어깨가 올라감
      const left = lift(L, pose[7]); const right = lift(R, pose[8]);
      const raised = [left, right].some((v) => v !== null && v < th.neckRatio)
        || (left !== null && right !== null && Math.min(left, right) < Math.max(left, right) * 0.7);
      const bad = tilt > th.tiltDeg || raised;
      result.shoulder = { status: bad ? 'warn' : 'ok', value: Math.round(tilt), reason: tilt > th.tiltDeg ? '어깨선이 한쪽으로 기울었어요' : raised ? '한쪽 어깨가 올라갔어요' : '양쪽 어깨 높이가 비슷해요' };
    }
  }

  const fret = pose[I.wr]; const strum = pose[I.other];
  if (seen(fret) && seen(strum)) {
    const lower = at(fret).y - at(strum).y; // 양수 = 코드 잡는 손이 더 아래
    points.other = strum;
    result.hand = lower > h * 0.02
      ? { status: 'warn', value: Math.round(lower), reason: '코드 잡는 손이 소리 내는 손보다 낮아요' }
      : { status: 'ok', value: Math.round(lower), reason: '코드 잡는 손이 소리 내는 손보다 위에 있어요' };
  }

  const elbow = pose[I.el];
  if (seen(elbow) && seen(fret)) {
    points.arm = [pose[I.sh], elbow, fret];
    // 손 관절은 왼손/오른손 표시가 화면 반전에 따라 바뀌므로, 몸의 손목과 가장 가까운 손을 고른다
    const near = (hands || []).filter((hand) => Array.isArray(hand) && hand.length >= 21)
      .map((hand) => ({ hand, gap: Math.hypot((hand[0].x - fret.x) * w, (hand[0].y - fret.y) * h) }))
      .sort((x, y) => x.gap - y.gap)[0];
    if (near && near.gap < Math.max(w, h) * 0.12) {
      const e = at(elbow); const wr = at(near.hand[0]); const mid = at(near.hand[9]);
      const fx = wr.x - e.x; const fy = wr.y - e.y; const hx = mid.x - wr.x; const hy = mid.y - wr.y;
      const d = Math.hypot(fx, fy) * Math.hypot(hx, hy);
      if (d > 0) {
        const bend = deg(Math.acos(Math.max(-1, Math.min(1, (fx * hx + fy * hy) / d)))); // 0 = 곧게 폄
        points.hand = [near.hand[0], near.hand[5], near.hand[9], near.hand[17]];
        result.wrist = bend > (th.photoWristDeg ?? th.wristDeg)
          ? { status: 'warn', value: Math.round(bend), reason: '손목이 많이 꺾였어요' }
          : { status: 'ok', value: Math.round(bend), reason: '손목이 곧게 펴져 있어요' };
      }
    } else result.wrist = unknown('손이 기타에 가려 확인하기 어려워요');
  }
  result.points = points;
  return result;
}

// 사진(canvas·img)을 받아 판정 결과를 돌려준다. 모델을 못 불러오거나 시간이 넘으면 예외.
export async function checkPosture(image, { side = content.poseThresholds.hand, timeoutMs = 20000 } = {}) {
  const { pose, hands } = await withTimeout(loadPostureCheck(), timeoutMs);
  const p = pose.detect(image); const hd = hands.detect(image);
  return judgePhoto(p.landmarks?.[0] || null, hd.landmarks || [], image.width, image.height, side);
}
