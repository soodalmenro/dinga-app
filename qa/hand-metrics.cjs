// 손 21개 관절 계산(handMetrics) · 손 모델 값이 판정에 들어가는 경로(pose.js) 검사 (브라우저 없이 실행)
const assert = require('node:assert/strict');

(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { middlewareMode: true } });
  try {
    const hm = await server.ssrLoadModule('/src/handMetrics.js');
    const pose = await server.ssrLoadModule('/src/pose.js');

    // 손끝이 위로 곧게 편 손. 손목(0.5,0.7) 아래에서 위로 손가락이 뻗는다
    const straightHand = () => {
      const lm = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.7, z: 0 }));
      const cols = { 1: 0.43, 5: 0.46, 9: 0.5, 13: 0.54, 17: 0.58 };
      for (const [start, x] of Object.entries(cols)) {
        const s = Number(start);
        for (let k = 0; k < 4; k += 1) lm[s + k] = { x, y: 0.62 - k * 0.05, z: 0 };
      }
      lm[0] = { x: 0.5, y: 0.7, z: 0 };
      return lm;
    };

    // ---- 1) 손가락 굽힘
    const flat = hm.fingerBends(straightHand(), 480, 640);
    for (const f of ['index', 'middle', 'ring', 'pinky']) assert.ok(flat[f].pip < 1 && flat[f].dip < 1, `${f}: 곧게 편 손가락은 굽힘 0: ${JSON.stringify(flat[f])}`);
    const curled = straightHand();
    curled[6] = { x: 0.46, y: 0.57, z: 0 }; curled[7] = { x: 0.52, y: 0.57, z: 0 }; curled[8] = { x: 0.52, y: 0.62, z: 0 }; // 검지를 접음
    const bends = hm.fingerBends(curled, 480, 640);
    assert.ok(bends.index.pip > 60, `접은 검지의 굽힘은 크게 나와야 함: ${bends.index.pip}`);
    assert.ok(bends.middle.pip < 1, '다른 손가락은 그대로');
    assert.deepEqual(hm.fingerBends([], 480, 640).index, { pip: null, dip: null });
    console.log('PASS finger bends: straight ~0, curled index large, invalid input gives null');

    // ---- 2) 엄지
    const thumb = hm.thumbMetrics(straightHand(), 480, 640);
    assert.ok(Number.isFinite(thumb.reach) && thumb.reach > 0, `엄지 거리 값: ${thumb.reach}`);
    assert.ok(thumb.bend < 5, `곧은 엄지의 굽힘은 작아야 함: ${thumb.bend}`);
    assert.equal(hm.palmSize([], 480, 640), null);
    console.log('PASS thumb metrics and palm size');

    // ---- 3) 손목 꺾임: 팔뚝(Pose)과 손 방향(Hands)의 각도
    const poseLm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
    poseLm[13] = { x: 0.5, y: 0.9, visibility: 1 }; poseLm[15] = { x: 0.5, y: 0.7, visibility: 1 }; // 왼팔: 팔꿈치 아래, 손목 위
    const straight = hm.wristFlexion(straightHand(), poseLm, 'left', 480, 640);
    assert.ok(straight.deg2d < 1, `곧은 손목은 0°: ${straight.deg2d}`);
    const bentHand = straightHand(); bentHand[9] = { x: 0.65, y: 0.7, z: 0 };
    assert.ok(Math.abs(hm.wristFlexion(bentHand, poseLm, 'left', 480, 640).deg2d - 90) < 8, '손이 옆으로 꺾이면 약 90°');
    const poseWorld = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }));
    poseWorld[13] = { x: 0, y: 0.2, z: 0 }; poseWorld[15] = { x: 0, y: 0, z: 0 };
    const handWorldStraight = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 })); handWorldStraight[9] = { x: 0, y: -0.08, z: 0 };
    const handWorldDeep = structuredClone(handWorldStraight); handWorldDeep[9] = { x: 0, y: 0, z: -0.08 }; // 손이 카메라 쪽으로 꺾임
    assert.ok(hm.wristFlexion(straightHand(), poseLm, 'left', 480, 640, handWorldStraight, poseWorld).deg3d < 1);
    const deep = hm.wristFlexion(straightHand(), poseLm, 'left', 480, 640, handWorldDeep, poseWorld);
    assert.ok(deep.deg2d < 1 && Math.abs(deep.deg3d - 90) < 1, `2D는 곧게, 3D는 90°로 보이는 경우: ${JSON.stringify(deep)}`);
    assert.deepEqual(hm.wristFlexion(straightHand(), poseLm, 'left', 0, 640), { deg2d: null, deg3d: null });
    console.log('PASS wrist flexion from hand axis, 3D catches depth bending');

    // ---- 4) 코드 잡는 손 고르기: Pose 손목에서 가장 가까운 손
    const near = straightHand(); const far = straightHand().map((p) => ({ ...p, x: p.x + 0.3 }));
    const results = { multiHandLandmarks: [far, near], multiHandWorldLandmarks: [handWorldDeep, handWorldStraight], multiHandedness: [{ score: 0.9 }, { score: 0.8 }] };
    const picked = hm.pickHand(results, { x: 0.5, y: 0.7 });
    assert.equal(picked.landmarks, near, '더 가까운 손을 골라야 함');
    assert.equal(picked.world, handWorldStraight);
    assert.equal(picked.score, 0.8);
    assert.equal(hm.pickHand(results, { x: 0.05, y: 0.05 }), null, '너무 멀면 null');
    assert.equal(hm.pickHand(null, { x: 0.5, y: 0.7 }), null);
    assert.equal(hm.pickHand(results, null), null);
    console.log('PASS pickHand chooses the hand nearest the pose wrist');

    // ---- 5) pose.js: 손 모델 값이 있을 때만 wristH·fingers·thumb가 생기고, 판정은 wristH를 우선한다
    const shoulders = structuredClone(poseLm);
    for (const [i, x, y] of [[11, 0.35, 0.5], [12, 0.65, 0.5], [7, 0.4, 0.3], [8, 0.6, 0.3], [17, 0.49, 0.68], [19, 0.51, 0.68]]) shoulders[i] = { x, y, visibility: 1 };
    const without = pose.measure(shoulders, 'left', 480, 640);
    assert.equal('wristH' in without, false); assert.equal('fingers' in without, false);
    const withHand = pose.measure(shoulders, 'left', 480, 640, undefined, { landmarks: straightHand(), world: null });
    assert.ok(withHand.wristH < 1, `손 모델 손목 값: ${withHand.wristH}`);
    assert.ok(withHand.fingers && withHand.thumb);
    const th = { wristDeg: 45, tiltDeg: 12, neckRatio: 0.3, wristDelta: 25, tiltDelta: 8, neckDrop: 0.75 };
    assert.deepEqual(pose.judge({ wrist: 5, wrist3d: 5, wristH: 70 }, th), ['wrist'], '손 모델 값을 우선해서 판정');
    assert.deepEqual(pose.judge({ wrist: 70, wrist3d: 70, wristH: 5 }, th), [], '손 모델이 곧다고 하면 2D/3D 값은 무시');
    assert.deepEqual(pose.judge({ wristH: 60 }, th, { wristH: 30 }), ['wrist'], '같은 종류(wristH) 기준과 비교');
    assert.deepEqual(pose.judge({ wristH: 50 }, th, { wrist3d: 10 }), ['wrist'], '같은 종류 기준이 없으면 고정 수치(45°)로 판정');
    const sum = pose.summarizeBaseline([10, 11, 12, 13, 14].map((wristH) => ({ wristH })));
    assert.equal(sum.wristH, 12);
    console.log('PASS pose.measure/judge/baseline use the hand-model wrist value first');
  } finally {
    await server.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
