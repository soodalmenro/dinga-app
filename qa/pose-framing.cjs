const assert = require('node:assert/strict');
(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { middlewareMode: true } });
  try {
    const lm = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: 0 }));
    for (const [i,x,y] of [[7,.35,.2],[8,.65,.2],[11,.3,.4],[12,.7,.4]]) lm[i] = { x,y,visibility:1 };
    global.window = { Pose: class {
      setOptions() {} onResults(fn) { this.callback = fn; } async initialize() {} async close() {}
      async send() { this.callback({ poseLandmarks: lm }); }
    } };
    const { initPose, watchPosture } = await server.ssrLoadModule('/src/pose.js');
    assert.equal(await initPose(), true);
    for (const focus of ['shoulder', 'wrist']) {
      let framing;
      const stop = watchPosture({ readyState:2, videoWidth:480, videoHeight:640 }, { focus, onIssue:()=>{}, onStatus:(status,measure,guide)=>{framing=guide;} });
      await new Promise((resolve)=>setTimeout(resolve,20)); stop();
      assert.equal(framing.ready, focus === 'shoulder');
      if (focus === 'wrist') assert.equal(framing.reason, 'hand');
    }
    console.log('PASS posture watcher forwards focus-specific framing requirements');
  } finally { await server.close(); delete global.window; }
})().catch((error)=>{console.error(error);process.exitCode=1;});
