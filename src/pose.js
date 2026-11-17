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
const finite = Number.isFinite;

// 두 3차원 벡터 사이의 각도(0 = 같은 방향). 길이가 0이면 null
function angleBetween3(a, b) {
  const d = Math.hypot(a[0], a[1], a[2]) * Math.hypot(b[0], b[1], b[2]);
  if (!(d > 0)) return null;
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return deg(Math.acos(Math.max(-1, Math.min(1, dot / d))));
}

// 관절 좌표(0~1)로 자세 값을 잰다. w, h는 영상 크기
// world(선택): MediaPipe의 poseWorldLandmarks(미터 단위 3차원). 있으면 손목 각도를 깊이까지 넣어 다시 잰다(wrist3d).
//   정면 카메라에서는 팔뚝이 카메라 쪽으로 뻗어 2차원 각도가 줄어 보이는데, 3차원 값은 그 왜곡이 덜하다.
export function measure(lm, hand, w, h, world) {
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
    if (Array.isArray(world)) {
      const W = (i) => { const p = world[i]; return p && finite(p.x) && finite(p.y) && finite(p.z) ? p : null; };
      const e = W(S.el); const r = W(S.wr); const i1 = W(S.ix); const k1 = W(S.pk);
      if (e && r && i1 && k1) {
        const a3 = angleBetween3([r.x - e.x, r.y - e.y, r.z - e.z], [(i1.x + k1.x) / 2 - r.x, (i1.y + k1.y) / 2 - r.y, (i1.z + k1.z) / 2 - r.z]);
        if (a3 !== null) out.wrist3d = a3; // 3차원 값이 있을 때만 키를 만든다
      }
    }
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
// 기준 자세(baseline): 사용자가 올바르게 앉은 몇 초의 중앙값. 폰 위치·각도가 사람마다 달라서
// 고정 수치(wristDeg 등)보다 "내 기준에서 얼마나 벗어났나"가 더 안정적이다. 메모리에만 두고 저장·전송하지 않는다.
const BASELINE_MIN_SAMPLES = 5;
const DELTA_DEFAULTS = { wristDelta: 25, tiltDelta: 8, neckDrop: 0.75 };
let baseline = null;
export const getBaseline = () => (baseline ? { ...baseline } : null);
export const clearBaseline = () => { baseline = null; };

function median(values) {
  const v = values.filter(finite).sort((a, b) => a - b);
  if (v.length < BASELINE_MIN_SAMPLES) return null;
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}
export function summarizeBaseline(samples) {
  const out = { wrist: median(samples.map((s) => s.wrist)), wrist3d: median(samples.map((s) => s.wrist3d)), tilt: median(samples.map((s) => s.tilt)), neck: median(samples.map((s) => s.neck)), samples: samples.length };
  return [out.wrist, out.wrist3d, out.tilt, out.neck].some((v) => v !== null) ? out : null;
}

// base가 있으면 "기준에서 벗어난 정도"로, 없으면 기존처럼 고정 수치로 판정한다.
// 손목은 3차원 값(wrist3d)이 있으면 그것을 우선하고, 기준도 같은 종류끼리만 비교한다.
export function judge(m, th = content.poseThresholds, base = null) {
  const bad = [];
  const d = { ...DELTA_DEFAULTS, ...th };
  const use3d = finite(m?.wrist3d);
  const wrist = use3d ? m.wrist3d : m?.wrist;
  const wristBase = base ? (use3d ? base.wrist3d : base.wrist) : null;
  if (finite(wrist)) {
    if (finite(wristBase) ? wrist - wristBase > d.wristDelta : wrist > th.wristDeg) bad.push('wrist');
  }
  const tiltBad = finite(m?.tilt) && (base && finite(base.tilt) ? Math.abs(m.tilt - base.tilt) > d.tiltDelta : m.tilt > th.tiltDeg);
  const neckBad = finite(m?.neck) && (base && finite(base.neck) ? m.neck < base.neck * d.neckDrop : m.neck < th.neckRatio);
  if (tiltBad || neckBad) bad.push('shoulder');
  return bad;
}

// 영상에서 자세를 계속 본다. 같은 문제가 holdMs 동안 이어지면 onIssue를 부른다
export function watchPosture(video, { onIssue, onStatus, focus = 'all' }) {
  const th = content.poseThresholds;
  const maxObservationGap = 1000;
  let stopped = false; let timer; let errors = 0; const since = { wrist: null, shoulder: null };
  // 기준선 근처에서 판정이 한두 프레임 흔들려도 지속 시간이 바로 0으로 돌아가지 않게, 이 시간 넘게 괜찮아야 초기화한다
  const graceMs = 400; const goodSince = { wrist: null, shoulder: null };
  let calib = null; let fps = 0; let lastReceive = null;
  let lastObservation = null; let lastFrameTime = null; let frameStartedAt = null; let frameWidth; let frameHeight;
  const finishCalibration = (cancel) => {
    if (!calib) return;
    const c = calib; calib = null; clearTimeout(c.timer);
    if (cancel) { c.resolve(null); return; }
    const b = summarizeBaseline(c.samples);
    if (b) baseline = b;
    c.resolve(b ? { ...b } : null);
  };
  // 올바르게 앉은 상태에서 ms 동안 값을 모아 기준 자세로 저장한다. 값이 부족하면 null (기존 기준은 유지)
  const calibrate = (ms = 3000) => new Promise((resolve) => {
    finishCalibration(true);
    calib = { until: performance.now() + ms, samples: [], resolve, timer: setTimeout(() => finishCalibration(false), ms + 2000) };
  });
  const usableVideo = () => video?.readyState >= 2 && Number.isFinite(video.videoWidth) && video.videoWidth > 0
    && Number.isFinite(video.videoHeight) && video.videoHeight > 0 && !(typeof document !== 'undefined' && document.hidden);
  const resetObservation = () => {
    since.wrist = null; since.shoulder = null; goodSince.wrist = null; goodSince.shoulder = null; lastObservation = null;
    onStatus('nobody', null, cameraFraming(null, th.hand, focus));
  };
  const receive = (r) => {
    if (stopped) return;
    const lm = r.poseLandmarks; const now = performance.now();
    if (!usableVideo() || now - frameStartedAt > maxObservationGap || video.videoWidth !== frameWidth || video.videoHeight !== frameHeight || !lm) { resetObservation(); return; }
    if (lastObservation !== null && now - lastObservation > maxObservationGap) { since.wrist = null; since.shoulder = null; }
    lastObservation = now;
    const m = measure(lm, th.hand, frameWidth, frameHeight, r.poseWorldLandmarks);
    const bad = judge(m, th, baseline);
    if (calib) { calib.samples.push(m); if (now >= calib.until) finishCalibration(false); }
    if (lastReceive !== null && now > lastReceive) { const f = 1000 / (now - lastReceive); fps = fps ? fps * 0.8 + f * 0.2 : f; }
    lastReceive = now;
    // 네 번째 인자는 디버그 화면용 부가 정보다. 기존 호출부는 무시해도 된다.
    onStatus(m.wrist == null && m.tilt == null ? 'nobody' : 'seen', m, cameraFraming(lm, th.hand, focus),
      { landmarks: lm, world: r.poseWorldLandmarks, measured: m, baseline, bad, fps, inferenceMs: now - frameStartedAt, thresholds: th, calibrating: !!calib });
    ['wrist', 'shoulder'].forEach((k) => {
      if (!bad.includes(k)) {
        if (since[k] != null) {
          if (goodSince[k] == null) goodSince[k] = now;
          else if (now - goodSince[k] >= graceMs) { since[k] = null; goodSince[k] = null; }
        }
        return;
      }
      goodSince[k] = null;
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
  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    finishCalibration(true);
    if (handler === receive) handler = null;
    if (sending && sending.receive === receive) {
      discardPose(sending.model);
      sending = null;
    }
  };
  stop.calibrate = calibrate;
  stop.clearBaseline = clearBaseline;
  return stop;
}

// 폰에서 기준값을 맞출 때 콘솔에서 써 볼 수 있게 열어 둔다
if (typeof window !== 'undefined') window.dingaPose = { measure, judge, getBaseline, clearBaseline, summarizeBaseline };
