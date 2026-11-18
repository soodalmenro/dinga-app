// 자세 촬영 사진 판정(judgePhoto) 규칙 검사. 모델 없이 관절 좌표만 넣어 본다.
const assert = require('node:assert/strict');
(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { middlewareMode: true }, logLevel: 'error' });
  try {
    const { judgePhoto } = await server.ssrLoadModule('/src/postureCheck.js');
    const W = 480, H = 640;
    const body = (over = {}) => {
      const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.1 }));
      const set = (i, x, y) => { lm[i] = { x, y, visibility: 0.95 }; };
      set(11, 0.62, 0.35); set(12, 0.38, 0.35); set(7, 0.56, 0.18); set(8, 0.44, 0.18);
      set(13, 0.75, 0.55); set(15, 0.85, 0.45); set(16, 0.45, 0.62);
      for (const [i, x, y] of over.points || []) set(i, x, y);
      return lm;
    };
    const hand = (wx, wy, dx, dy) => Array.from({ length: 21 }, (_, i) => ({ x: wx + (i === 0 ? 0 : dx * (i === 9 ? 1 : 0.8)), y: wy + (i === 0 ? 0 : dy * (i === 9 ? 1 : 0.8)) }));
    const straight = hand(0.85, 0.45, 0.05, -0.05); // 팔뚝(팔꿈치→손목)과 같은 방향
    const bent = hand(0.85, 0.45, 0.0667, 0.0375); // 팔뚝과 약 90도
    let r = judgePhoto(body(), [straight], W, H);
    assert.equal(r.shoulder.status, 'ok'); assert.equal(r.hand.status, 'ok'); assert.equal(r.wrist.status, 'ok', JSON.stringify(r.wrist)); assert.equal(r.thumb.status, 'unknown');
    r = judgePhoto(body(), [bent], W, H);
    assert.equal(r.wrist.status, 'warn', 'bent wrist ' + JSON.stringify(r.wrist));
    r = judgePhoto(body({ points: [[12, 0.38, 0.45]] }), [straight], W, H);
    assert.equal(r.shoulder.status, 'warn', 'tilted shoulders');
    r = judgePhoto(body({ points: [[11, 0.62, 0.22]] }), [straight], W, H);
    assert.equal(r.shoulder.status, 'warn', 'one shoulder raised toward the ear');
    r = judgePhoto(body({ points: [[15, 0.85, 0.70]] }), [hand(0.85, 0.70, 0.05, -0.05)], W, H);
    assert.equal(r.hand.status, 'warn', 'fretting hand below strumming hand');
    r = judgePhoto(body(), [hand(0.2, 0.9, 0.05, -0.05)], W, H);
    assert.equal(r.wrist.status, 'unknown', 'a hand far from the fretting wrist is not used');
    r = judgePhoto(body({ points: [[15, 0.85, 0.45]] }).map((p, i) => (i === 16 ? { ...p, visibility: 0.1 } : p)), [straight], W, H);
    assert.equal(r.hand.status, 'unknown', 'strumming hand not visible');
    r = judgePhoto(null, [], W, H);
    assert.ok(['wrist', 'hand', 'shoulder', 'thumb'].every((k) => r[k].status === 'unknown'), 'no person → all unknown');
    console.log('PASS photo posture rules: shoulder level/raised, fretting hand height, wrist bend, hidden thumb, unmatched hand, missing person');
  } finally { await server.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
