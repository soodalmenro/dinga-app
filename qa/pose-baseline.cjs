// 3차원 손목 각도 · 기준 자세(baseline) 판정 · 기준 저장(calibrate) 검사 (브라우저 없이 실행)
const assert = require('node:assert/strict');

(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { middlewareMode: true } });
  const oldWindow = global.window;
  let cleanup = null;
  try {
    const frames = [];
    global.window = { Pose: class {
      setOptions() {} onResults(fn) { this.result = fn; } async initialize() {} async close() {}
      async send() { this.result(frames.shift() || frames.last || { poseLandmarks: [] }); }
    } };
    const { measure, judge, summarizeBaseline, getBaseline, clearBaseline, initPose, watchPosture } = await server.ssrLoadModule('/src/pose.js');

    // ---- 1) measure: 3차원 값은 world가 있을 때만 생긴다
    const lm = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: 0 }));
    for (const [i, x, y] of [[13, .2, .4], [15, .4, .4], [19, .6, .4], [17, .6, .41], [11, .3, .4], [12, .7, .4], [7, .3, .2], [8, .7, .2]]) lm[i] = { x, y, visibility: 1 };
    // 2D로는 팔뚝과 손이 같은 방향(곧게 폄)처럼 보이지만, 깊이(z)로는 손이 카메라 쪽으로 꺾인 경우
    const world = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }));
    world[13] = { x: -0.2, y: 0, z: 0 }; world[15] = { x: 0, y: 0, z: 0 };
    world[19] = { x: 0.05, y: 0, z: -0.12 }; world[17] = { x: 0.05, y: 0.01, z: -0.12 };
    const flat = measure(lm, 'left', 480, 640);
    assert.ok(flat.wrist < 5, `2D 각도는 곧게 폄처럼 보여야 함: ${flat.wrist}`);
    assert.equal('wrist3d' in flat, false, 'world가 없으면 wrist3d 키가 없어야 함');
    const deep = measure(lm, 'left', 480, 640, world);
    assert.ok(deep.wrist3d > 45, `3D 각도는 꺾임으로 보여야 함: ${deep.wrist3d}`);
    const badWorld = structuredClone(world); badWorld[15].z = NaN;
    assert.equal('wrist3d' in measure(lm, 'left', 480, 640, badWorld), false, '유효하지 않은 3D 좌표는 무시');
    assert.deepEqual(measure(lm, 'left', 0, 640, world), { wrist: null, tilt: null, neck: null });
    console.log('PASS measure adds wrist3d only for valid world landmarks and catches depth bending');

    // ---- 2) judge: 3D 우선, 기준이 있으면 편차로 판정
    const th = { wristDeg: 45, tiltDeg: 12, neckRatio: 0.3, wristDelta: 25, tiltDelta: 8, neckDrop: 0.75 };
    assert.deepEqual(judge({ wrist: 10, wrist3d: 60 }, th), ['wrist'], '3D가 있으면 3D로 판정');
    assert.deepEqual(judge({ wrist: 60 }, th), ['wrist'], '3D가 없으면 2D로 판정(기존 동작)');
    const base = { wrist: 30, wrist3d: 30, tilt: 6, neck: 0.8 };
    assert.deepEqual(judge({ wrist3d: 50 }, th, base), [], '기준(30)보다 20° 커도 delta(25) 안이면 괜찮음');
    assert.deepEqual(judge({ wrist3d: 60 }, th, base), ['wrist'], '기준보다 30° 크면 벗어남');
    assert.deepEqual(judge({ tilt: 10 }, th, base), [], '기준 6° 대비 4° 차이는 괜찮음');
    assert.deepEqual(judge({ tilt: 18 }, th, base), ['shoulder'], '기준 대비 12° 차이는 벗어남');
    assert.deepEqual(judge({ neck: 0.5 }, th, base), ['shoulder'], '귀–어깨 비가 기준의 75% 아래로 줄면 어깨 올라감');
    assert.deepEqual(judge({ neck: 0.7 }, th, base), []);
    assert.deepEqual(judge({ wrist3d: 50 }, th, { tilt: 6 }), ['wrist'], '같은 종류의 기준이 없으면 고정 수치로 판정');
    assert.deepEqual(judge({ wrist: Infinity, tilt: NaN, neck: -Infinity, wrist3d: NaN }, th, base), []);
    console.log('PASS judge prefers 3D, uses baseline deltas and falls back to fixed thresholds');

    // ---- 3) summarizeBaseline: 중앙값, 샘플 부족이면 null
    const samples = [10, 12, 14, 100, 11, 13].map((wrist3d) => ({ wrist3d, tilt: 5, neck: 0.8 }));
    const sum = summarizeBaseline(samples);
    assert.equal(sum.wrist3d, 12.5);
    assert.equal(sum.wrist, null);
    assert.equal(summarizeBaseline([{ wrist3d: 10 }, { wrist3d: 11 }]), null);
    console.log('PASS baseline summary uses the median and needs enough samples');

    // ---- 4) watchPosture: calibrate가 기준을 저장하고, 기준 지우기가 동작한다
    assert.equal(await initPose(), true);
    clearBaseline();
    let t = 0;
    const video = { readyState: 4, videoWidth: 480, videoHeight: 640, get currentTime() { t += 0.1; return t; } };
    const make = (wr) => { const l = structuredClone(lm); const w = structuredClone(world); w[19] = { x: 0.2, y: 0, z: 0 }; w[17] = { x: 0.2, y: 0.01, z: 0 }; w[15] = { x: 0, y: 0, z: 0 }; w[13] = { x: -0.2, y: 0, z: 0 }; return { poseLandmarks: l, poseWorldLandmarks: w, wr }; };
    frames.last = make();
    const statuses = [];
    const stop = watchPosture(video, { onIssue() {}, onStatus: (...args) => statuses.push(args) });
    cleanup = stop; // 검사가 중간에 실패해도 감시 루프를 멈춘다
    assert.equal(typeof stop, 'function', 'watchPosture는 계속 정지 함수를 돌려줘야 함');
    assert.equal(typeof stop.calibrate, 'function');
    const saved = await stop.calibrate(1400);
    assert.ok(saved && saved.samples >= 5, `기준이 저장돼야 함: ${JSON.stringify(saved)}`);
    assert.ok(Math.abs(saved.wrist3d) < 3, `곧게 편 자세의 3D 각도는 거의 0: ${saved.wrist3d}`);
    assert.equal(getBaseline().samples, saved.samples);
    const withDebug = statuses.find((s) => s[3] && s[3].measured);
    assert.ok(withDebug, 'onStatus 네 번째 인자로 디버그 정보가 와야 함');
    assert.ok(Number.isFinite(withDebug[3].measured.wrist3d));
    stop.clearBaseline();
    assert.equal(getBaseline(), null);
    const pending = stop.calibrate(60000);
    stop();
    assert.equal(await pending, null, '정지하면 진행 중인 기준 저장은 취소(null)');
    console.log('PASS watchPosture calibrate saves a baseline, exposes debug data and cancels on stop');
  } finally {
    if (cleanup) cleanup();
    global.window = oldWindow;
    await server.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
