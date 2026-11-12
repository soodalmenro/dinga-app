// 연주 중 자세 판정 (MediaPipe Pose). 계산은 이 폰 안에서만 하고 영상은 저장·전송하지 않는다.
// 보는 것: 코드 잡는 손의 손목 꺾임, 어깨 기울기·올라감. 엄지는 카메라로 가려져서 판정하지 않는다.
// 기준값은 content.json poseThresholds. 검증된 수치가 아니라 시작값이므로 실제 폰과 기타로 맞춰야 한다.
import content from './content.json';

const BASE = `${import.meta.env.BASE_URL}pose/`;
let pose = null; let loading = null; let handler = null;

function loadScript(src) {
  return new Promise((res, rej) => {
    const el = document.createElement('script');
    el.src = src; el.onload = res; el.onerror = () => rej(new Error('script'));
    document.head.appendChild(el);
  });
}

// 처음 한 번만 불러온다. 실패하면 false (그러면 자세 알림 없이 연습한다)
export function initPose() {
  if (pose) return Promise.resolve(true);
  if (!loading) {
    loading = (async () => {
      if (!window.Pose) await loadScript(`${BASE}pose.js`);
      const p = new window.Pose({ locateFile: (f) => `${BASE}${f}` });
      p.setOptions({ modelComplexity: 0, smoothLandmarks: true, enableSegmentation: false, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      p.onResults((r) => { if (handler) handler(r); });
      await p.initialize();
      pose = p;
      return true;
    })().catch(() => { loading = null; return false; });
  }
  return loading;
}

const deg = (r) => (r * 180) / Math.PI;
// 관절 좌표(0~1)로 자세 값을 잰다. w, h는 영상 크기
export function measure(lm, hand, w, h) {
  const P = (i) => ({ x: lm[i].x * w, y: lm[i].y * h, v: lm[i].visibility == null ? 1 : lm[i].visibility });
  const S = hand === 'right' ? { el: 14, wr: 16, pk: 18, ix: 20 } : { el: 13, wr: 15, pk: 17, ix: 19 };
  const out = { wrist: null, tilt: null, neck: null };
  const el = P(S.el); const wr = P(S.wr); const ix = P(S.ix); const pk = P(S.pk);
  if (el.v > 0.5 && wr.v > 0.5 && ix.v > 0.4 && pk.v > 0.4) {
    const fx = wr.x - el.x; const fy = wr.y - el.y; // 팔뚝 방향
    const hx = (ix.x + pk.x) / 2 - wr.x; const hy = (ix.y + pk.y) / 2 - wr.y; // 손 방향
    const d = Math.hypot(fx, fy) * Math.hypot(hx, hy);
    if (d > 0) out.wrist = deg(Math.acos(Math.max(-1, Math.min(1, (fx * hx + fy * hy) / d)))); // 0 = 곧게 폄
  }
  const L = P(11); const R = P(12); const eL = P(7); const eR = P(8);
  if (L.v > 0.5 && R.v > 0.5) {
    const width = Math.hypot(L.x - R.x, L.y - R.y);
    if (width > 0) {
      out.tilt = deg(Math.atan2(Math.abs(L.y - R.y), Math.abs(L.x - R.x))); // 어깨선 기울기
      if (eL.v > 0.5 && eR.v > 0.5) out.neck = ((L.y - eL.y) + (R.y - eR.y)) / 2 / width; // 귀~어깨 거리. 작을수록 어깨가 올라감
    }
  }
  return out;
}
export function judge(m, th = content.poseThresholds) {
  const bad = [];
  if (m.wrist != null && m.wrist > th.wristDeg) bad.push('wrist');
  if ((m.tilt != null && m.tilt > th.tiltDeg) || (m.neck != null && m.neck < th.neckRatio)) bad.push('shoulder');
  return bad;
}

// 영상에서 자세를 계속 본다. 같은 문제가 holdMs 동안 이어지면 onIssue를 부른다
export function watchPosture(video, { onIssue, onStatus }) {
  const th = content.poseThresholds;
  let stopped = false; let busy = false; const since = { wrist: 0, shoulder: 0 };
  handler = (r) => {
    if (stopped) return;
    const lm = r.poseLandmarks; const now = performance.now();
    if (!lm) { since.wrist = 0; since.shoulder = 0; onStatus('nobody'); return; }
    const m = measure(lm, th.hand, video.videoWidth || 480, video.videoHeight || 640);
    const bad = judge(m, th);
    onStatus(m.wrist == null && m.tilt == null ? 'nobody' : 'seen', m);
    ['wrist', 'shoulder'].forEach((k) => {
      if (!bad.includes(k)) { since[k] = 0; return; }
      if (!since[k]) since[k] = now;
      else if (now - since[k] >= th.holdMs) { since[k] = 0; onIssue(k, m); }
    });
  };
  const loop = async () => {
    if (stopped) return;
    if (pose && !busy && video.readyState >= 2) { busy = true; try { await pose.send({ image: video }); } catch (e) {} busy = false; }
    setTimeout(loop, 250); // 1초에 약 4번이면 충분하고 폰이 덜 뜨거워진다
  };
  loop();
  return () => { stopped = true; handler = null; };
}

// 폰에서 기준값을 맞출 때 콘솔에서 써 볼 수 있게 열어 둔다
if (typeof window !== 'undefined') window.dingaPose = { measure, judge };
