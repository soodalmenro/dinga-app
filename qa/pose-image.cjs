const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  assert.ok(process.env.POSE_TEST_IMAGE, 'Set POSE_TEST_IMAGE to a local human-pose test image');
  const { createServer } = await import('vite');
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  try {
    const browser = await chromium.launch({ channel: process.env.QA_BROWSER_CHANNEL });
    try {
      const page = await browser.newPage();
      await page.route('**/__pose_fixture.jpg', (route) => route.fulfill({ path: process.env.POSE_TEST_IMAGE, contentType: 'image/jpeg' }));
      await page.goto('http://127.0.0.1:' + server.httpServer.address().port);
      const result = await page.evaluate(async () => {
        const { initPose, watchPosture } = await import('/src/pose.js');
        if (!(await initPose())) throw new Error('Model initialization failed');
        const image = new Image();
        image.src = '/__pose_fixture.jpg';
        await image.decode();
        Object.assign(image, { readyState: 4, videoWidth: image.naturalWidth, videoHeight: image.naturalHeight });
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => { stop(); reject(new Error('No pose detected')); }, 20000);
          const stop = watchPosture(image, {
            onIssue: () => {},
            onStatus: (status, measured) => {
              if (status !== 'seen') return;
              clearTimeout(timer);
              stop();
              resolve(measured);
            },
          });
        });
      });
      assert.ok(Number.isFinite(result.tilt));
      console.log('PASS real MediaPipe model detected example body:', result);
      await page.close();
    } finally { await browser.close(); }
  } finally { await server.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
