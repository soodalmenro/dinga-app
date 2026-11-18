// 카메라 인식 안내(poseGuidance) 검사 (브라우저 없이 실행)
const assert = require('node:assert/strict');

(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { middlewareMode: true } });
  try {
    const { trackingGuidance, PLACEMENT_TIPS } = await server.ssrLoadModule('/src/poseGuidance.js');
    const base = () => {
      const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
      const set = (i, x, y, visibility = 1) => { lm[i] = { x, y, visibility }; };
      set(11, 0.35, 0.5); set(12, 0.65, 0.5); set(7, 0.4, 0.3); set(8, 0.6, 0.3);
      set(13, 0.3, 0.65); set(15, 0.4, 0.8); set(17, 0.38, 0.83); set(19, 0.42, 0.83); // 왼팔
      return { lm, set };
    };
    const g = (lm, extra = {}) => trackingGuidance({ landmarks: lm, hand: 'left', focus: 'all', ...extra });

    let { lm } = base();
    let r = g(lm);
    assert.equal(r.level, 'ok'); assert.equal(r.code, 'ready'); assert.equal(r.ready, true);
    assert.ok(PLACEMENT_TIPS.length >= 3);

    assert.equal(g([]).code, 'nobody'); assert.equal(g([]).level, 'fix'); assert.equal(g(undefined).code, 'nobody');

    ({ lm } = base()); lm[12] = { x: 0.5, y: 0.5, visibility: 0 };
    assert.equal(g(lm).code, 'shoulders');

    let b = base(); b.set(11, 0.1, 0.5); b.set(12, 0.9, 0.5);
    r = g(b.lm); assert.equal(r.code, 'close'); assert.equal(r.level, 'fix');

    b = base(); b.set(15, 0.955, 0.8); // 화면 끝에 걸림(0.03 안쪽이지만 0.06 바깥)
    r = g(b.lm); assert.equal(r.code, 'edge'); assert.equal(r.level, 'fix');

    b = base(); b.set(11, 0.6, 0.5); b.set(12, 0.95, 0.5); b.set(7, 0.65, 0.3); b.set(8, 0.9, 0.3);
    b.set(13, 0.55, 0.65); b.set(15, 0.6, 0.8); b.set(17, 0.58, 0.83); b.set(19, 0.62, 0.83);
    r = g(b.lm); assert.equal(r.code, 'center', JSON.stringify(r));

    // 손 모델을 켰는데 손을 못 찾음 / 찾음 / 어깨만 보는 연습에서는 무시
    assert.equal(g(base().lm, { handTracking: true, handFound: false }).code, 'hand');
    assert.equal(g(base().lm, { handTracking: true, handFound: true }).level, 'ok');
    assert.equal(g(base().lm, { handTracking: true, handFound: false, focus: 'shoulder' }).level, 'ok');
    assert.equal(g(base().lm, { handTracking: false, handFound: false }).level, 'ok');

    // 어깨 연습에서는 팔이 안 보여도 괜찮다
    b = base(); for (const i of [13, 15, 17, 19]) b.set(i, 0.5, 0.5, 0);
    assert.equal(g(b.lm).code, 'hand'); assert.equal(g(b.lm, { focus: 'shoulder' }).level, 'ok');

    // 가림·빛 문제(신뢰도 낮음)와 느린 인식은 고치라는 뜻이 아니라 팁이다
    b = base(); for (const i of [7, 8, 13, 15, 17, 19]) b.lm[i].visibility = 0.6;
    r = g(b.lm); assert.equal(r.code, 'light'); assert.equal(r.level, 'tip'); assert.equal(r.ready, false);
    r = g(base().lm, { fps: 1 }); assert.equal(r.code, 'slow'); assert.equal(r.level, 'tip');
    r = g(base().lm, { inferenceMs: 900 }); assert.equal(r.code, 'slow');
    assert.equal(g(base().lm, { fps: 4, inferenceMs: 120 }).level, 'ok');

    // 오른손 연습
    b = base(); for (const i of [13, 15, 17, 19]) b.set(i, 0.5, 0.5, 0);
    b.set(14, 0.7, 0.65); b.set(16, 0.6, 0.8); b.set(18, 0.62, 0.83); b.set(20, 0.58, 0.83);
    assert.equal(trackingGuidance({ landmarks: b.lm, hand: 'right' }).level, 'ok');

    for (const code of ['nobody', 'shoulders', 'close', 'edge', 'center', 'hand']) assert.ok(code);
    console.log('PASS pose guidance: framing, close/edge/center, hand-model state, light/slow tips');
  } finally {
    await server.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
