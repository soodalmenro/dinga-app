const assert = require('node:assert/strict');
const { chromium } = require('playwright');

async function check(browser, url) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.addInitScript(() => {
      const date = new Date();
      const day = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
      localStorage.setItem('dinga-v1', JSON.stringify({
        panel: { alert: 'real' },
        attendances: [{ date: day, method: 'manual' }],
        resume: { lesson: 'em', part: 0, step: 1 },
      }));
      window.poseTests = { initializations: 0, sends: 0, stopped: 0, failSend: false };
      window.Pose = class {
        setOptions() {}
        onResults(callback) { this.result = callback; }
        async initialize() {
          window.poseTests.initializations += 1;
          if (window.poseTests.initializations === 1) throw new Error('test load failure');
        }
        async close() {}
        async send() {
          window.poseTests.sends += 1;
          if (window.poseTests.hangSend) {
            await new Promise((resolve) => { window.releaseHungFrame = () => { this.result({ poseLandmarks: [] }); resolve(); }; });
            return;
          }
          if (window.poseTests.failSend) throw new Error('test inference failure');
          const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
          landmarks[11] = { x: 0.3, y: 0.4, visibility: 1 };
          landmarks[12] = { x: 0.7, y: 0.4, visibility: 1 };
          this.result({ poseLandmarks: window.poseTests.landmarks || landmarks });
        }
      };
      const acquire = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      let attempts = 0;
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        if (constraints.audio) throw new DOMException('Denied', 'NotAllowedError');
        attempts += 1;
        if (attempts === 1) throw new DOMException('Denied', 'NotAllowedError');
        const stream = await acquire(constraints);
        for (const track of stream.getTracks()) {
          const stop = track.stop.bind(track);
          track.stop = () => { window.poseTests.stopped += 1; stop(); };
        }
        return stream;
      };
    });
    await page.goto(url);
    await page.locator('.widget').click();
    await page.getByRole('button', { name: '이어서 연습하기 ›', exact: true }).click();
    await page.getByRole('button', { name: '카메라 다시 켜기', exact: true }).click();
    await page.getByRole('button', { name: '자세 판정 다시 시도', exact: true }).click();
    await page.getByText('손목이 안 보여요', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.poseTests.initializations), 2);
    console.log('PASS denied camera retry, model initialization retry and occluded wrist guidance');

    const measured = await page.evaluate(async () => {
      const { measure, judge } = await import('/src/pose.js');
      const missing = measure([], 'left', 480, 640);
      const invalid = measure([{ x: NaN, y: Infinity }], 'left', 480, 640);
      return { missing, invalid, issues: judge(missing) };
    });
    assert.deepEqual(measured.missing, { wrist: null, tilt: null, neck: null });
    assert.deepEqual(measured.invalid, measured.missing);
    assert.deepEqual(measured.issues, []);
    console.log('PASS missing and invalid landmarks produce no posture verdict');

    await page.evaluate(() => { window.poseTests.failSend = true; });
    await page.getByRole('button', { name: '자세 판정 다시 시도', exact: true }).waitFor();
    await page.evaluate(() => { window.poseTests.failSend = false; });
    await page.getByRole('button', { name: '자세 판정 다시 시도', exact: true }).click();
    await page.getByText('손목이 안 보여요', { exact: true }).waitFor();
    console.log('PASS inference failure shown and retry resumes tracking');
    await page.evaluate(() => { window.poseTests.hangSend = true; });
    await page.getByRole('button', { name: '자세 판정 다시 시도', exact: true }).waitFor();
    await page.evaluate(() => { window.poseTests.hangSend = false; });
    await page.getByRole('button', { name: '자세 판정 다시 시도', exact: true }).click();
    await page.getByText('손목이 안 보여요', { exact: true }).waitFor();
    const statusBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('dinga-log')).filter((entry) => entry.type === 'pose_status').length);
    await page.evaluate(() => window.releaseHungFrame());
    await page.waitForTimeout(100);
    const statusAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('dinga-log')).filter((entry) => entry.type === 'pose_status').length);
    assert.equal(statusAfter, statusBefore);
    console.log('PASS hung inference times out, reloads model and ignores stale results');

    await page.getByRole('button', { name: '다음', exact: true }).click();
    await page.getByRole('heading', { name: '파트 완료!', exact: true }).waitFor();
    const stopped = await page.evaluate(() => window.poseTests.stopped);
    assert.ok(stopped > 0);
    const sends = await page.evaluate(() => window.poseTests.sends);
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate(() => window.poseTests.sends), sends);
    assert.equal(await page.locator('.pip').count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS completion releases camera and stops inference without page errors');
    const continuity = await page.evaluate(async () => {
      const { watchPosture } = await import('/src/pose.js');
      const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
      for (const [i, x, y] of [[13, 0.2, 0.4], [15, 0.4, 0.4], [19, 0.4, 0.2], [17, 0.41, 0.2]]) {
        landmarks[i] = { x, y, visibility: 1 };
      }
      const issues = [];
      window.poseTests.landmarks = landmarks;
      const stop = watchPosture({ readyState: 2, videoWidth: 480, videoHeight: 640 }, {
        onIssue: (kind) => issues.push(kind), onStatus: () => {},
      });
      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      await delay(1000);
      const beforeHold = issues.length;
      window.poseTests.landmarks = null;
      await delay(400);
      window.poseTests.landmarks = landmarks;
      await delay(1000);
      const afterGap = issues.length;
      await delay(900);
      stop();
      return { beforeHold, afterGap, issues };
    });
    assert.equal(continuity.beforeHold, 0);
    assert.equal(continuity.afterGap, 0);
    assert.deepEqual(continuity.issues, ['wrist']);
    console.log('PASS sustained wrist threshold and visibility gap reset');
  } finally { await page.close(); }
}

async function checkLatePermission(browser, url) {
  const page = await browser.newPage();
  try {
    await page.addInitScript(() => {
      const d = new Date();
      const date = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
      localStorage.setItem('dinga-v1', JSON.stringify({
        panel: { variant: 'prd' },
        attendances: [{ date, method: 'manual' }],
        resume: { lesson: 'em', part: 0, step: 0 },
      }));
      window.lateCameraStops = 0;
      navigator.mediaDevices.getUserMedia = (constraints) => {
        if (constraints.audio) return Promise.reject(new DOMException('Denied', 'NotAllowedError'));
        return new Promise((resolve) => {
          window.approveCamera = () => resolve({ getTracks: () => [{ stop: () => { window.lateCameraStops += 1; } }] });
        });
      };
    });
    await page.goto(url);
    await page.locator('.splash').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: '이어서 연습하기', exact: true }).click();
    await page.waitForFunction(() => typeof window.approveCamera === 'function');
    await page.getByRole('button', { name: '나가기', exact: true }).click();
    await page.locator('.sheet').getByRole('button', { name: '나가기', exact: true }).click();
    await page.getByRole('heading', { name: '학습', exact: true }).waitFor();
    await page.evaluate(() => window.approveCamera());
    await page.waitForFunction(() => window.lateCameraStops === 1);
    console.log('PASS late camera permission after leaving releases acquired track');
  } finally { await page.close(); }
}

(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  try {
    const browser = await chromium.launch({
      channel: process.env.QA_BROWSER_CHANNEL,
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    });
    try {
      const url = 'http://127.0.0.1:' + server.httpServer.address().port;
      await check(browser, url);
      await checkLatePermission(browser, url);
    }
    finally { await browser.close(); }
  } finally { await server.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
