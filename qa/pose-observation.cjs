const assert = require('node:assert/strict');

(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { middlewareMode: true } });
  const landmarks = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: 0 }));
  for (const [i, x, y] of [[13,.2,.4],[15,.4,.4],[19,.4,.2],[17,.41,.2]]) landmarks[i] = { x, y, visibility: 1 };
  let defer = false, finishFrame, sends = 0;
  const oldWindow = global.window, oldDocument = global.document, oldPerformance = global.performance;
  const realSetTimeout = global.setTimeout, realClearTimeout = global.clearTimeout;
  try {
    global.window = { Pose: class {
      setOptions() {} onResults(fn) { this.result = fn; } async initialize() {} async close() {}
      async send() { sends++; if (defer) await new Promise(resolve => { finishFrame = resolve; }); this.result({ poseLandmarks: landmarks }); }
    } };
    const { initPose, watchPosture } = await server.ssrLoadModule('/src/pose.js');
    assert.equal(await initPose(), true);
    let now = 0, nextId = 0; const timers = new Map();
    global.performance = { now: () => now };
    global.document = { hidden: false };
    global.setTimeout = (fn, ms) => { const id = ++nextId; timers.set(id, { fn, at: now + ms }); return id; };
    global.clearTimeout = id => timers.delete(id);
    const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
    const tick = async delta => {
      now += delta;
      const pending = [...timers].filter(([,t]) => t.at <= now).sort((a,b) => a[1].at - b[1].at)[0];
      if (pending) { timers.delete(pending[0]); pending[1].fn(); } await flush();
    };
    let failures = 0;
    for (const kind of ['continuous', 'low-frame-rate', 'long-gap', 'frozen-frame', 'unready-video', 'hidden-result', 'delayed-result', 'dimension-change', 'backward-time', 'zero-dimensions']) {
      now = 0; timers.clear(); defer = ['delayed-result', 'dimension-change'].includes(kind); global.document.hidden = false;
      const issues = [], statuses = [];
      const video = { readyState: 2, videoWidth: kind === 'zero-dimensions' ? 0 : 480, videoHeight: 640, currentTime: kind === 'backward-time' ? 10 : 0 };
      const stop = watchPosture(video, { onIssue: issue => issues.push(issue), onStatus: status => statuses.push(status) });
      try {
        await flush();
        if (kind === 'continuous') {
          for (let i = 0; i < 6; i++) { video.currentTime += .25; await tick(250); }
          assert.deepEqual(issues, ['wrist'], 'fresh continuous bad posture still triggers the configured hold');
        } else if (kind === 'low-frame-rate') {
          for (let i = 0; i < 6; i++) { if (i % 2) video.currentTime += .5; await tick(250); }
          assert.deepEqual(issues, ['wrist'], 'two fresh frames per second are valid observations within the gap limit');
        } else if (kind === 'long-gap') {
          video.currentTime = 2; await tick(2000);
          assert.deepEqual(issues, [], 'unobserved time must not satisfy posture hold');
          for (let i = 0; i < 6; i++) { video.currentTime += .25; await tick(250); }
          assert.deepEqual(issues, ['wrist'], 'fresh observations after gap can satisfy a new hold');
        } else if (kind === 'frozen-frame') {
          const before = sends; for (let i = 0; i < 8; i++) await tick(250);
          assert.deepEqual(issues, [], 'a frozen frame is not repeated evidence');
          assert.equal(sends, before, 'do not repeatedly infer the same decoded frame');
        } else if (kind === 'unready-video') {
          video.readyState = 1; await tick(2000); video.readyState = 2; video.currentTime = 2; await tick(250);
          assert.deepEqual(issues, [], 'missing video resets posture hold');
        } else if (kind === 'hidden-result') {
          global.document.hidden = true; video.currentTime = 2; await tick(2000);
          global.document.hidden = false; video.currentTime = 2.25; await tick(250);
          assert.deepEqual(issues, [], 'hidden time cannot cause a posture warning');
        } else if (kind === 'delayed-result') {
          await tick(2000); defer = false; finishFrame(); await flush();
          assert.ok(!statuses.includes('seen'), 'old inference result is not current posture');
          video.currentTime = 2.25; await tick(250);
          assert.deepEqual(issues, []);
        } else if (kind === 'dimension-change') {
          await tick(250); video.videoWidth = 640; defer = false; finishFrame(); await flush();
          assert.ok(!statuses.includes('seen'), 'results for old frame geometry are discarded');
          video.currentTime = .5; await tick(250);
          assert.ok(statuses.includes('seen'), 'new geometry can be observed normally');
          assert.deepEqual(issues, []);
        } else if (kind === 'backward-time') {
          for (let i=0;i<4;i++){video.currentTime+=.25;await tick(250);}
          video.currentTime=1;await tick(250);video.currentTime=1.25;await tick(250);
          assert.deepEqual(issues, [], 'a reset video timeline starts a fresh posture hold');
          for(let i=0;i<5;i++){video.currentTime+=.25;await tick(250);}
          assert.deepEqual(issues, ['wrist']);
        } else {
          for (let i = 0; i < 8; i++) { video.currentTime += .25; await tick(250); }
          assert.deepEqual(issues, [], 'invalid dimensions cannot be replaced by invented frame geometry');
          assert.ok(!statuses.includes('seen'));
        }
        console.log('PASS posture observation ' + kind);
      } catch (error) { failures++; console.error('FAIL posture observation ' + kind + ': ' + error.message); }
      finally { stop(); await flush(); }
    }
    if (failures) process.exitCode = 1;
  } finally {
    global.setTimeout = realSetTimeout; global.clearTimeout = realClearTimeout;
    global.performance = oldPerformance; global.window = oldWindow; global.document = oldDocument;
    await server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
