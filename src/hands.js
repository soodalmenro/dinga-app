// 손 21개 관절 추적 (MediaPipe Hands, public/hands). 계산은 이 폰 안에서만 하고 영상은 저장·전송하지 않는다.
// 자세 판정(pose.js)이 손목·손가락 값을 더 정확히 재도록 옆에서 돕는 모델이다. 평가 패널에서 켤 때만 불러온다.
// 쓰는 쪽: const tracker = watchHands(video); ... tracker.latest() ... tracker.stop()
const BASE = `${import.meta.env.BASE_URL}hands/`;
let model = null; let loading = null; let handler = null;

function discard(m) {
  if (model === m) { model = null; loading = null; }
  try { if (m.close) Promise.resolve(m.close()).catch(() => {}); } catch (error) {}
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

// 처음 한 번만 불러온다. 실패하면 false (그러면 손 인식 없이 기존 방식으로 판정한다)
// complexity: 0 = lite(가볍고 덜 정확), 1 = full(손가락 인식이 더 정확하지만 무거움)
export function initHands(complexity = 1) {
  if (model) return Promise.resolve(true);
  if (!loading) {
    loading = (async () => {
      if (!window.Hands) await loadScript(`${BASE}hands.js`);
      const m = new window.Hands({ locateFile: (f) => `${BASE}${f}` });
      // 두 손을 모두 찾은 뒤 Pose의 손목과 가까운 쪽을 고른다(pickHand). 한 손만 찾으면 박자 치는 손을 잡을 수 있다.
      m.setOptions({ maxNumHands: 2, modelComplexity: complexity, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5, selfieMode: false });
      m.onResults((r) => { if (model === m && handler) handler(r); });
      let timer;
      try {
        await Promise.race([
          m.initialize(),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('hands_timeout')), 30000); }),
        ]);
      } catch (error) {
        discard(m);
        throw error;
      } finally { clearTimeout(timer); }
      model = m;
      return true;
    })().catch(() => { loading = null; return false; });
  }
  return loading;
}

// 영상에서 일정 간격으로 손을 찾는다. latest()는 가장 최근 결과(없으면 null), status()는 'loading' | 'ready' | 'error'
export function watchHands(video, { intervalMs = 250, complexity = 1, onStatus } = {}) {
  let stopped = false; let timer; let sending = false; let errors = 0; let lastFrameTime = null;
  let state = 'loading'; let last = null;
  const setState = (next) => { if (state !== next) { state = next; if (onStatus) onStatus(next); } };
  const receive = (results) => { last = { results, time: performance.now() }; };
  const usable = () => video?.readyState >= 2 && Number.isFinite(video.videoWidth) && video.videoWidth > 0
    && Number.isFinite(video.videoHeight) && video.videoHeight > 0 && !(typeof document !== 'undefined' && document.hidden);

  const loop = async () => {
    if (stopped) return;
    const frameTime = video?.currentTime;
    const sameFrame = Number.isFinite(frameTime) && frameTime === lastFrameTime;
    if (model && usable() && !sameFrame && !sending) {
      lastFrameTime = Number.isFinite(frameTime) ? frameTime : null;
      sending = true; handler = receive;
      const current = model;
      let inferenceTimer;
      try {
        await Promise.race([
          current.send({ image: video }),
          new Promise((_, reject) => { inferenceTimer = setTimeout(() => reject(new Error('inference_timeout')), 10000); }),
        ]);
        errors = 0; setState('ready');
      } catch (error) {
        errors += 1;
        if (!stopped && (errors >= 3 || error.message === 'inference_timeout')) {
          discard(current); stopped = true; last = null; setState('error');
        }
      } finally {
        clearTimeout(inferenceTimer);
        if (handler === receive) handler = null;
        sending = false;
      }
    }
    if (!stopped) timer = setTimeout(loop, intervalMs);
  };

  initHands(complexity).then((okay) => {
    if (stopped) return;
    if (!okay) { stopped = true; setState('error'); return; }
    loop();
  });

  return {
    // 마지막 결과가 maxAgeMs보다 오래됐으면 null (손이 사라진 것으로 본다)
    latest: (maxAgeMs = 700) => (last && performance.now() - last.time <= maxAgeMs ? last.results : null),
    status: () => state,
    stop: () => { stopped = true; clearTimeout(timer); if (handler === receive) handler = null; },
  };
}
