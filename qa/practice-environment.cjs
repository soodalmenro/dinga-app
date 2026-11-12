const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } }); await server.listen();
  try {
    const browser = await chromium.launch({ channel: process.env.QA_BROWSER_CHANNEL, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const errors = []; page.on('pageerror', (error) => errors.push(error.message));
      await page.addInitScript(() => {
        window.prepTests = { requests: 0, stopped: 0, amplitude: .025, audioMode: 'allow' };
        const acquire = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = (constraints) => {
          window.prepTests.requests += 1;
          const get = async () => {
            const stream = await acquire(constraints);
            stream.getTracks().forEach((track) => { const stop = track.stop.bind(track); track.stop = () => { window.prepTests.stopped += 1; stop(); }; });
            return stream;
          };
          if (constraints.audio && window.prepTests.audioMode === 'deny') return Promise.reject(new DOMException('Denied', 'NotAllowedError'));
          if (constraints.audio && window.prepTests.audioMode === 'defer') return new Promise((resolve) => { window.grantPrepMic = async () => resolve(await get()); });
          if (constraints.video && window.prepTests.cameraMode === 'defer') return new Promise((resolve) => { window.grantPrepCamera = async () => resolve(await get()); });
          return get();
        };
        window.Pose = class {
          setOptions() {} onResults(callback) { this.callback = callback; } async initialize() {} async close() {}
          async send() { if (window.prepTests.failSend) throw new Error('test failure'); this.callback({ poseLandmarks: window.prepTests.landmarks || [] }); }
        };
      });
      await page.goto('http://127.0.0.1:' + server.httpServer.address().port);
      await page.evaluate(async () => { const { mic } = await import('/src/lib.js'); mic.level = () => window.prepTests.amplitude; });
      await page.locator('.widget').click(); await page.locator('.splash').waitFor({ state: 'detached' });
      await page.getByRole('button', { name: '연습 환경 확인', exact: true }).waitFor({ timeout: 2500 });
      await page.getByRole('button', { name: '연습 환경 확인', exact: true }).click();
      assert.equal(await page.evaluate(() => window.prepTests.requests), 0);
      await page.getByRole('button', { name: '마이크 확인하기', exact: true }).click();
      await page.getByRole('heading', { name: '기타 줄을 한 번 튕겨 주세요', exact: true }).waitFor();
      await page.evaluate(() => { window.prepTests.amplitude = .2; });
      await page.getByRole('button', { name: '이 기준으로 사용하기', exact: true }).click();
      const calibrated = await page.evaluate(async () => (await import('/src/lib.js')).threshold());
      assert.ok(calibrated > .05 && calibrated <= .15);
      const expiry = await page.evaluate(async () => {
        const { makeOnsetDetector, threshold } = await import('/src/lib.js');
        const originalNow = Date.now; let hits = 0;
        window.prepTests.amplitude = .06;
        const stop = makeOnsetDetector(() => { hits += 1; });
        await new Promise((resolve) => setTimeout(resolve, 150));
        const before = hits;
        Date.now = () => originalNow() + 600001;
        await new Promise((resolve) => setTimeout(resolve, 150));
        const after = hits; const current = threshold();
        stop(); Date.now = originalNow;
        return { before, after, current };
      });
      assert.deepEqual(expiry, { before: 0, after: 1, current: .05 });
      await page.getByRole('button', { name: '카메라 확인하기', exact: true }).click();
      await page.getByText('상체가 잘 보이지 않아요', { exact: true }).waitFor();
      await page.evaluate(() => {
        const lm = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: 0 }));
        for (const [i, x, y] of [[7,.35,.2],[8,.65,.2],[11,.3,.4],[12,.7,.4],[13,.25,.5],[15,.3,.6],[17,.32,.63],[19,.34,.63]]) lm[i] = { x, y, visibility: 1 };
        window.prepTests.landmarks = lm;
      });
      await page.getByText('확인할 부위가 보여요', { exact: true }).waitFor();
      if (process.env.QA_CAPTURE === '1') {
        await page.getByRole('region', { name: '카메라 위치 준비', exact: true }).screenshot({ path: require('node:path').join(require('node:os').tmpdir(), 'dinga-environment-camera.png') });
      }
      await page.evaluate(() => { window.prepTests.landmarks[15].visibility = 0; });
      await page.getByText('코드 잡는 팔과 손을 보여 주세요', { exact: true }).waitFor();
      await page.getByRole('button', { name: '확인 마치기', exact: true }).click();
      assert.ok(await page.evaluate(() => window.prepTests.stopped) >= 2);
      const persistent = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('dinga-v1'))));
      assert.equal(/calibration|data:image|threshold/.test(persistent), false);
      const events = await page.evaluate(() => JSON.parse(localStorage.getItem('dinga-log')).filter((event) => event.type === 'input_calibration'));
      assert.ok(events.length > 0 && events.every((event) => !Object.hasOwn(event, 'threshold') && !Object.hasOwn(event, 'floor') && !Object.hasOwn(event, 'peak')));
      console.log('PASS optional preparation, explicit permissions, calibrated threshold, framing and cleanup');
      await page.getByRole('button', { name: '연습 환경 확인', exact: true }).click();
      await page.evaluate(() => { window.prepTests.audioMode = 'defer'; });
      await page.getByRole('button', { name: '마이크 확인하기', exact: true }).click();
      await page.getByRole('button', { name: '마이크 확인 중단', exact: true }).click();
      const beforeLate = await page.evaluate(() => window.prepTests.stopped);
      await page.evaluate(() => window.grantPrepMic());
      await page.waitForTimeout(150);
      assert.ok(await page.evaluate(() => window.prepTests.stopped) > beforeLate);
      assert.equal(await page.evaluate(async () => (await import('/src/lib.js')).mic.state), 'idle');
      await page.evaluate(() => { window.prepTests.audioMode = 'deny'; });
      await page.getByRole('button', { name: '마이크 확인하기', exact: true }).click();
      await page.getByText(/마이크를 사용할 수 없어요/).waitFor();
      await page.evaluate(() => { window.prepTests.audioMode = 'allow'; window.prepTests.amplitude = .1; });
      await page.getByRole('button', { name: '마이크 다시 확인', exact: true }).click();
      await page.getByRole('heading', { name: '기타 줄을 한 번 튕겨 주세요', exact: true }).waitFor();
      await page.evaluate(() => { window.prepTests.amplitude = .4; });
      await page.getByText(/주변 소음이 커요/).waitFor();
      assert.equal(await page.getByRole('button', { name: '이 기준으로 사용하기', exact: true }).count(), 0);
      await page.evaluate(() => { window.prepTests.amplitude = .005; });
      await page.getByRole('button', { name: '마이크 다시 확인', exact: true }).click();
      await page.getByRole('heading', { name: '기타 줄을 한 번 튕겨 주세요', exact: true }).waitFor();
      await page.evaluate(() => { window.prepTests.amplitude = .02; });
      await page.getByText(/시험 소리가 충분히 구분되지 않았어요/).waitFor();
      await page.getByRole('button', { name: '기본 기준으로 사용하기', exact: true }).click();
      assert.equal(await page.evaluate(async () => (await import('/src/lib.js')).threshold()), .05);
      console.log('PASS cancellation with late permission, denial, excessive noise and insufficient signal');
      await page.getByRole('button', { name: '마이크 다시 확인', exact: true }).click();
      await page.getByRole('heading', { name: '잠시 조용히 있어 주세요', exact: true }).waitFor();
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.prepHidden || false });
        window.prepHidden = true; document.dispatchEvent(new Event('visibilitychange'));
      });
      await page.getByText(/입력 확인을 멈췄어요/).waitFor();
      assert.equal(await page.evaluate(async () => (await import('/src/lib.js')).mic.state), 'idle');
      await page.evaluate(() => { window.prepHidden = false; document.dispatchEvent(new Event('visibilitychange')); });
      await page.getByRole('button', { name: '마이크 다시 확인', exact: true }).click();
      await page.getByRole('heading', { name: '잠시 조용히 있어 주세요', exact: true }).waitFor();
      await page.evaluate(() => { const until = performance.now() + 350; while (performance.now() < until) {} });
      await page.getByText(/입력 확인을 멈췄어요/).waitFor();
      await page.evaluate(() => { window.prepTests.cameraMode = 'defer'; });
      await page.getByRole('button', { name: '카메라 다시 확인', exact: true }).click();
      await page.getByRole('button', { name: '카메라 확인 중단', exact: true }).click();
      const beforeCamera = await page.evaluate(() => window.prepTests.stopped);
      await page.evaluate(() => window.grantPrepCamera());
      await page.waitForTimeout(150);
      assert.ok(await page.evaluate(() => window.prepTests.stopped) > beforeCamera);
      await page.evaluate(() => { window.prepTests.cameraMode = 'allow'; window.prepTests.failSend = true; });
      await page.getByRole('button', { name: '카메라 확인하기', exact: true }).click();
      await page.getByText(/촬영 위치 확인이 멈췄어요/).waitFor();
      assert.equal(await page.locator('.setup-camera video').evaluate((video) => !!video.srcObject?.active), false);
      await page.evaluate(() => { window.prepTests.failSend = false; });
      await page.getByRole('button', { name: '카메라 다시 확인', exact: true }).click();
      await page.getByText('코드 잡는 팔과 손을 보여 주세요', { exact: true }).waitFor();
      for (const [width, height] of [[320,568],[360,640],[390,844]]) {
        await page.setViewportSize({ width, height });
        assert.ok(await page.locator('.screen').evaluate((el) => el.scrollWidth - el.clientWidth) <= 1);
        await page.getByRole('button', { name: '확인 마치기', exact: true }).scrollIntoViewIfNeeded();
      }
      await page.getByRole('button', { name: '확인 마치기', exact: true }).click();
      console.log('PASS hidden/stalled capture cancellation, late camera release, model retry and mobile layout');
      await page.getByRole('button', { name: '연습 환경 확인', exact: true }).click();
      await page.evaluate(() => { window.prepTests.cameraMode = 'defer'; });
      await page.getByRole('button', { name: '카메라 확인하기', exact: true }).click();
      await page.getByRole('button', { name: '확인 마치기', exact: true }).click();
      const beforeExit = await page.evaluate(() => window.prepTests.stopped);
      await page.evaluate(() => window.grantPrepCamera());
      await page.waitForTimeout(150);
      assert.ok(await page.evaluate(() => window.prepTests.stopped) > beforeExit);
      assert.deepEqual(errors, []);
      console.log('PASS leaving during pending camera permission has no errors and releases late track');
      const reset = await page.evaluate(async () => {
        const { mic, applyInputCalibration, resetAll, threshold } = await import('/src/lib.js');
        await mic.start(); applyInputCalibration({ ok:true, threshold:.1 });
        const before = threshold(); resetAll(); const after = threshold(); mic.stop();
        return { before, after };
      });
      assert.deepEqual(reset, { before:.1, after:.05 });
      console.log('PASS participant reset clears active calibration');
      await page.close();
    } finally { await browser.close(); }
  } finally { await server.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
