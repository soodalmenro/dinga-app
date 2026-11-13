// 연주 중 자세 판정 (MediaPipe Pose). 계산은 이 폰 안에서만 하고 영상은 저장·전송하지 않는다.
// 보는 것: 코드 잡는 손의 손목 꺾임, 어깨 기울기·올라감. 엄지는 카메라로 가려져서 판정하지 않는다.
// 기준값은 content.json poseThresholds. 검증된 수치가 아니라 시작값이므로 실제 폰과 기타로 맞춰야 한다.
import content from './content.json';
import { cameraFraming } from './cameraFraming.js';
import { validLandmark } from './landmarkValidity.js';

const BASE = `${import.meta.env.BASE_URL}pose/`;
let pose = null; let loading = null; let handler = null; let sending = null;

function discardPose(model) {
  if (pose === model) { pose = null; loading = null; }
  try { if (model.close) Promise.resolve(model.close()).catch(() => {}); } catch (error) {}
}

function loadScript(src) {
  return new Promise((res, rej) => {
    const el = document.createElement('script');
    const fail = () => { clearTimeout(timer); el.remove(); rej(new Error('script')); };
    const timer = setTimeout(fail, 20000);
    el.src = src;
    el.onload = () => { clearTimeout(timer); res(); };
    el.onerror = fail;
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
      p.onResults((r) => { if (pose === p && handler) handler(r); });
      let timer;
      try {
        await Promise.race([
          p.initialize(),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('pose_timeout')), 30000); }),
        ]);
      } catch (error) {
        discardPose(p);
        throw error;
      } finally { clearTimeout(timer); }
      pose = p;
      return true;
    })().catch(() => { loading = null; return false; });
  }
  return loading;
}

const deg = (r) => (r * 180) / Math.PI;
// 관절 좌표(0~1)로 자세 값을 잰다. w, h는 영상 크기
export function measure(lm, hand, w, h) {
  const out = { wrist: null, tilt: null, neck: null };
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return out;
  const P = (i) => {
    const point = lm && lm[i];
    if (!validLandmark(point)) return { x: 0, y: 0, v: 0 };
    return { x: point.x * w, y: point.y * h, v: point.visibility === undefined ? 1 : point.visibility };
  };
  const S = hand === 'right' ? { el: 14, wr: 16, pk: 18, ix: 20 } : { el: 13, wr: 15, pk: 17, ix: 19 };
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
  if (Number.isFinite(m?.wrist) && m.wrist > th.wristDeg) bad.push('wrist');
  if ((Number.isFinite(m?.tilt) && m.tilt > th.tiltDeg) || (Number.isFinite(m?.neck) && m.neck < th.neckRatio)) bad.push('shoulder');
  return bad;
}

// 영상에서 자세를 계속 본다. 같은 문제가 holdMs 동안 이어지면 onIssue를 부른다
export function watchPosture(video, { onIssue, onStatus, focus = 'all' }) {
  const th = content.poseThresholds;
  const maxObservationGap = 1000;
  let stopped = false; let timer; let errors = 0; const since = { wrist: null, shoulder: null };
  let lastObservation = null; let lastFrameTime = null; let frameStartedAt = null; let frameWidth; let frameHeight;
  const usableVideo = () => video?.readyState >= 2 && Number.isFinite(video.videoWidth) && video.videoWidth > 0
    && Number.isFinite(video.videoHeight) && video.videoHeight > 0 && !(typeof document !== 'undefined' && document.hidden);
  const resetObservation = () => {
    since.wrist = null; since.shoulder = null; lastObservation = null;
    onStatus('nobody', null, cameraFraming(null, th.hand, focus));
  };
  const receive = (r) => {
    if (stopped) return;
    const lm = r.poseLandmarks; const now = performance.now();
    if (!usableVideo() || now - frameStartedAt > maxObservationGap || video.videoWidth !== frameWidth || video.videoHeight !== frameHeight || !lm) { resetObservation(); return; }
    if (lastObservation !== null && now - lastObservation > maxObservationGap) { since.wrist = null; since.shoulder = null; }
    lastObservation = now;
    const m = measure(lm, th.hand, frameWidth, frameHeight);
    const bad = judge(m, th);
    onStatus(m.wrist == null && m.tilt == null ? 'nobody' : 'seen', m, cameraFraming(lm, th.hand, focus));
    ['wrist', 'shoulder'].forEach((k) => {
      if (!bad.includes(k)) { since[k] = null; return; }
      if (since[k] == null) since[k] = now;
      else if (now - since[k] >= th.holdMs) { since[k] = null; onIssue(k, m); }
    });
  };
  const loop = async () => {
    if (stopped) return;
    const frameTime = video?.currentTime;
    const sameFrame = Number.isFinite(frameTime) && frameTime === lastFrameTime;
    if (!usableVideo()) resetObservation();
    else if (sameFrame) {
      if (lastObservation !== null && performance.now() - lastObservation > maxObservationGap) resetObservation();
    }
    else if (pose && !sending) {
      if (Number.isFinite(frameTime) && lastFrameTime !== null && frameTime < lastFrameTime) resetObservation();
      lastFrameTime = Number.isFinite(frameTime) ? frameTime : null;
      frameStartedAt = performance.now(); frameWidth = video.videoWidth; frameHeight = video.videoHeight;
      const model = pose;
      const job = { model, receive };
      sending = job;
      handler = receive;
      let inferenceTimer;
      try {
        await Promise.race([
          model.send({ image: video }),
          new Promise((_, reject) => {
            inferenceTimer = setTimeout(() => reject(new Error('inference_timeout')), 10000);
          }),
        ]);
        errors = 0;
      } catch (error) {
        since.wrist = null; since.shoulder = null;
        errors += 1;
        if (!stopped && (errors >= 3 || error.message === 'inference_timeout')) {
          discardPose(model);
          stopped = true;
          onStatus('error');
        }
      } finally {
        clearTimeout(inferenceTimer);
        if (handler === receive) handler = null;
        if (sending === job) sending = null;
      }
    }
    if (!stopped) timer = setTimeout(loop, 250);
  };
  loop();
  return () => {
    stopped = true;
    clearTimeout(timer);
    if (handler === receive) handler = null;
    if (sending && sending.receive === receive) {
      discardPose(sending.model);
      sending = null;
    }
  };
}

// 폰에서 기준값을 맞출 때 콘솔에서 써 볼 수 있게 열어 둔다
if (typeof window !== 'undefined') window.dingaPose = { measure, judge };
