const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const { preview } = await import('vite');
  const server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
  const browser = await chromium.launch({ channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError'); };
      if (!localStorage.getItem('dinga-v1')) localStorage.setItem('dinga-v1', JSON.stringify({
        resume: { lesson: 'em', part: 0, step: 1 },
        panel: { variant: 'idea', judge: 'mic' }
      }));
    });
    await page.goto(process.env.QA_URL || server.resolvedUrls.local[0]);
    await page.locator('.widget').click();
    await page.locator('.splash').waitFor({ state: 'detached' });
    for (let i = 0; i < 3; i++) await page.mouse.click(360, 18);
    await page.getByRole('button', { name: '파트 3 카메라 테스트 열기', exact: true }).click();
    await page.getByRole('heading', { name: '첫 곡 · 완주', exact: true }).waitFor();
    const panel = await page.evaluate(() => JSON.parse(localStorage.getItem('dinga-v1')).panel);
    assert.notEqual(panel.judge, 'allok', 'shortcut must not leave fake judging on');
    assert.equal(panel.alert, 'auto');
    assert.equal(panel.speed, 1);
    await page.getByRole('button', { name: /바로 시작/ }).click();
    await page.locator('.palert').waitFor({ timeout: 7000 });
    assert.deepEqual(errors, []);
    console.log('PASS locked fresh course with saved Em resume → panel shortcut → part 3 → start → timed cue');
  } finally {
    await browser.close();
    await new Promise(resolve => server.httpServer.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
