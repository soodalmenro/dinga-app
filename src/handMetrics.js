// 손 21개 관절(MediaPipe Hands)로 손목 꺾임·손가락 굽힘·엄지 위치를 잰다.
// 여기서는 "잰다"까지만 한다. 어떤 값이 나쁜 자세인지는 검증된 기준이 없어서 정하지 않았다(pose.js judge 참고).
// 좌표는 0~1 정규화 좌표이고, 각도를 재려면 영상 크기(w, h)를 같이 넘겨야 한다.
//
// 관절 번호: 0 손목 / 엄지 1~4 / 검지 5~8 / 중지 9~12 / 약지 13~16 / 새끼 17~20 (각 손가락 MCP→PIP→DIP→TIP)
const finite = Number.isFinite;
export const FINGERS = { index: [5, 6, 7, 8], middle: [9, 10, 11, 12], ring: [13, 14, 15, 16], pinky: [17, 18, 19, 20] };
// 화면에 그릴 뼈대 연결선
export const HAND_BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [9, 10], [10, 11], [11, 12], [13, 14], [14, 15], [15, 16], [0, 17], [17, 18], [18, 19], [19, 20], [5, 9], [9, 13], [13, 17]];

const deg = (r) => (r * 180) / Math.PI;
const ok = (p) => p && finite(p.x) && finite(p.y);

function angleBetween(u, v) {
  const d = Math.hypot(u[0], u[1], u[2]) * Math.hypot(v[0], v[1], v[2]);
  if (!(d > 0)) return null;
  return deg(Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / d))));
}

// 점 a→b 방향 벡터. 세 점 모두 z가 있으면 깊이(z)도 쓴다(Hands의 z는 손목 기준이고 x와 비슷한 크기)
function vec(a, b, w, h, useZ) {
  return [(b.x - a.x) * w, (b.y - a.y) * h, useZ ? (b.z - a.z) * w : 0];
}

// b 관절의 각도(a-b-c). 180 = 곧게 폄
export function jointAngle(lm, a, b, c, w = 1, h = 1) {
  const A = lm?.[a]; const B = lm?.[b]; const C = lm?.[c];
  if (!ok(A) || !ok(B) || !ok(C)) return null;
  const useZ = finite(A.z) && finite(B.z) && finite(C.z);
  return angleBetween(vec(B, A, w, h, useZ), vec(B, C, w, h, useZ));
}

// 손가락별 굽힘 정도(0 = 곧게 폄, 클수록 많이 굽힘). pip = 중간 마디, dip = 끝 마디
export function fingerBends(lm, w = 1, h = 1) {
  const out = {};
  for (const [name, [mcp, pip, dip, tip]] of Object.entries(FINGERS)) {
    const p = jointAngle(lm, mcp, pip, dip, w, h);
    const d = jointAngle(lm, pip, dip, tip, w, h);
    out[name] = { pip: p === null ? null : 180 - p, dip: d === null ? null : 180 - d };
  }
  return out;
}

// 손바닥 크기(손목~중지 뿌리 거리). 손가락 길이 비교의 기준으로 쓴다
export function palmSize(lm, w = 1, h = 1) {
  if (!ok(lm?.[0]) || !ok(lm?.[9])) return null;
  const d = Math.hypot((lm[9].x - lm[0].x) * w, (lm[9].y - lm[0].y) * h);
  return d > 0 ? d : null;
}

// 엄지: reach = 엄지 끝~검지 뿌리 거리 / 손바닥 크기 (작을수록 검지 쪽에 붙음), bend = 엄지 끝 마디 굽힘
export function thumbMetrics(lm, w = 1, h = 1) {
  const palm = palmSize(lm, w, h);
  const out = { reach: null, bend: null };
  if (palm && ok(lm?.[4]) && ok(lm?.[5])) out.reach = Math.hypot((lm[4].x - lm[5].x) * w, (lm[4].y - lm[5].y) * h) / palm;
  const a = jointAngle(lm, 2, 3, 4, w, h);
  if (a !== null) out.bend = 180 - a;
  return out;
}

// 손목 꺾임: 팔뚝 방향(Pose의 팔꿈치→손목)과 손 방향(Hands의 손목→중지 뿌리)의 각도. 0 = 곧게 폄.
// Pose의 손(검지·새끼손가락 두 점)보다 Hands가 손 방향을 훨씬 안정적으로 준다.
// deg3d는 두 모델의 3차원 좌표(world)가 모두 있을 때만 계산한다. 두 모델의 좌표 원점이 달라 방향끼리만 비교하며, 실제 폰으로 검증 전이다.
export function wristFlexion(handLm, poseLm, hand, w, h, handWorld, poseWorld) {
  const out = { deg2d: null, deg3d: null };
  if (!(w > 0) || !(h > 0)) return out;
  const el = hand === 'right' ? 14 : 13; const wr = hand === 'right' ? 16 : 15;
  const E = poseLm?.[el]; const W = poseLm?.[wr];
  if (ok(E) && ok(W) && ok(handLm?.[0]) && ok(handLm?.[9])) {
    out.deg2d = angleBetween(vec(E, W, w, h, false), vec(handLm[0], handLm[9], w, h, false));
  }
  const pe = poseWorld?.[el]; const pw = poseWorld?.[wr]; const h0 = handWorld?.[0]; const h9 = handWorld?.[9];
  const all = [pe, pw, h0, h9];
  if (all.every((p) => p && finite(p.x) && finite(p.y) && finite(p.z))) {
    out.deg3d = angleBetween([pw.x - pe.x, pw.y - pe.y, pw.z - pe.z], [h9.x - h0.x, h9.y - h0.y, h9.z - h0.z]);
  }
  return out;
}

// 여러 손 중 코드 잡는 쪽 손 고르기: Pose가 찾은 같은 쪽 손목에 가장 가까운 손.
// (Hands의 왼손/오른손 표시는 거울 영상 기준이라 정면 카메라에서 뒤바뀔 수 있어서 쓰지 않는다)
export function pickHand(results, wristPoint, maxDistance = 0.15) {
  const hands = results?.multiHandLandmarks;
  if (!Array.isArray(hands) || !hands.length || !ok(wristPoint)) return null;
  let best = null;
  hands.forEach((landmarks, i) => {
    if (!ok(landmarks?.[0])) return;
    const distance = Math.hypot(landmarks[0].x - wristPoint.x, landmarks[0].y - wristPoint.y);
    if (distance <= maxDistance && (!best || distance < best.distance)) {
      const score = results.multiHandedness?.[i]?.score;
      best = { landmarks, world: results.multiHandWorldLandmarks?.[i] || null, score: finite(score) ? score : null, distance };
    }
  });
  return best;
}
