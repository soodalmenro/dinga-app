const assert = require('node:assert/strict');
const { chromium } = require('playwright');

async function check(browser, url) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(url);
    const micChecks = await page.evaluate(async () => {
      const { mic } = await import('/src/lib.js');
      let requests = 0;
      let resolveRequest;
      let stops = 0;
      navigator.mediaDevices.getUserMedia = () => {
        requests += 1;
        return new Promise((resolve) => { resolveRequest = resolve; });
      };
      const first = mic.start();
      const second = mic.start();
      mic.stop();
      resolveRequest({ getTracks: () => [{ stop: () => { stops += 1; } }] });
      return { values: await Promise.all([first, second]), requests, stops, state: mic.state };
    });
    assert.deepEqual(micChecks, { values: [false, false], requests: 1, stops: 1, state: 'idle' });
    console.log('PASS shared microphone request and cancellation after leaving');

    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError'); };
      localStorage.setItem('dinga-v1', JSON.stringify({
        panel: { speed: 20, judge: 'allok' },
        ptab: 'transition',
      }));
    });
    await page.reload();
    await page.locator('.widget').click();
    await page.getByRole('button', { name: '연습', exact: true }).click();
    await page.getByRole('button', { name: '연습하기', exact: true }).first().click();
    await page.getByRole('button', { name: '시작하기', exact: true }).click();
    await page.locator('.bars .bar.ok').first().waitFor();
    await page.locator('.screen > .row .iconbtn').click();
    await page.getByRole('heading', { name: '연주를 그만할까요?' }).waitFor();
    const completed = await page.locator('.bars .bar.ok').count();
    await page.waitForTimeout(2300);
    assert.equal(await page.locator('.bars .bar.ok').count(), completed);
    assert.ok(await page.getByRole('heading', { name: '연주를 그만할까요?' }).isVisible());
    await page.getByRole('button', { name: '계속하기', exact: true }).click();
    await page.getByRole('heading', { name: '전환 연습 결과' }).waitFor();
    const result = await page.evaluate(() => JSON.parse(localStorage.getItem('dinga-v1')).song.last);
    assert.equal(result.bars.length, 8);
    assert.ok(result.bars.every((bar) => bar === 'ok'));
    console.log('PASS eight-bar pause, preserved progress and resume');

    await page.getByRole('button', { name: '완료', exact: true }).click();
    for (let i = 0; i < 3; i += 1) await page.mouse.click(375, 18);
    await page.locator('.panel-row').filter({ hasText: '곡 판정' }).locator('select').selectOption('hard');
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    await page.getByRole('button', { name: 'MY', exact: true }).click();
    await page.getByRole('button', { name: /곡 연습하러 가기|한 번 더 연주하기/ }).click();
    await page.getByRole('button', { name: /바로 시작/ }).click();
    await page.getByRole('heading', { name: '곡 연습 리포트' }).waitFor();
    const original = await page.evaluate(() => JSON.parse(localStorage.getItem('dinga-v1')).songPractice.last);
    await page.getByRole('button', { name: /전환 연습하러 가기/ }).click();
    await page.getByRole('button', { name: '시작하기', exact: true }).click();
    await page.getByRole('heading', { name: '전환 연습 결과' }).waitFor();
    await page.getByRole('button', { name: '완료', exact: true }).click();
    await page.getByRole('heading', { name: '곡 연습 리포트' }).waitFor();
    const returned = await page.evaluate(() => JSON.parse(localStorage.getItem('dinga-v1')).songPractice.last);
    assert.deepEqual(returned, original);
    console.log('PASS song report round trip preserves original results');
  } finally { await page.close(); }
}

(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  try {
    const browser = await chromium.launch({ channel: process.env.QA_BROWSER_CHANNEL });
    try { await check(browser, 'http://127.0.0.1:' + server.httpServer.address().port); }
    finally { await browser.close(); }
  } finally { await server.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
