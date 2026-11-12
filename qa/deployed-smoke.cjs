const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: process.env.QA_BROWSER_CHANNEL });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      window.smokeMediaRequests = 0;
      navigator.mediaDevices.getUserMedia = async () => { window.smokeMediaRequests += 1; throw new DOMException('Denied', 'NotAllowedError'); };
      const d = new Date();
      const date = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
      localStorage.setItem('dinga-v1', JSON.stringify({ attendances: [{ date, method: 'manual' }], panel: { speed: 20, judge: 'allok' } }));
    });
    const response = await page.goto(process.env.QA_URL || 'https://dinga-app.vercel.app/');
    assert.equal(response.status(), 200);
    const expected = fs.readFileSync('dist/index.html', 'utf8').match(/src="([^"]+\.js)"/)[1];
    const deployed = await page.locator('script[type="module"]').getAttribute('src');
    assert.equal(deployed, expected, 'deployed bundle must match the reviewed local build');
    await page.locator('.widget').click();
    await page.locator('.splash').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: '연습 환경 확인', exact: true }).click();
    await page.getByRole('heading', { name: '연습 환경 확인', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.smokeMediaRequests), 0);
    await page.getByRole('button', { name: '마이크 확인하기', exact: true }).click();
    await page.getByText(/마이크를 사용할 수 없어요/).waitFor();
    await page.getByRole('button', { name: '확인 마치기', exact: true }).click();
    await page.getByRole('button', { name: 'MY', exact: true }).click();
    await page.getByRole('button', { name: '곡 연습하러 가기', exact: true }).click();
    await page.getByRole('button', { name: /바로 시작/ }).click();
    await page.getByRole('heading', { name: '곡 연습 리포트' }).waitFor();
    await page.getByText(/모의 판정 결과예요/).waitFor();
    const result = await page.evaluate(() => JSON.parse(localStorage.getItem('dinga-v1')).songPractice);
    assert.equal(result.last.complete, true);
    assert.equal(result.last.judge, 'allok');
    assert.equal(result.last.score, 100);
    assert.equal(result.best, 0);
    for (let i = 0; i < 3; i += 1) await page.mouse.click(375, 18);
    await page.getByRole('heading', { name: '평가 패널', exact: true }).waitFor();
    const fileEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'JSON 저장', exact: true }).click();
    const file = JSON.parse(fs.readFileSync(await (await fileEvent).path(), 'utf8'));
    assert.equal(file.app.bundle, expected);
    assert.equal(file.summary.unversionedEvents, 0);
    const end = file.events.filter((event) => event.type === 'songplay_end').at(-1);
    assert.equal(end.diagnostics.length, 12);
    assert.ok(end.diagnostics.every((verdict) => verdict.reason === 'simulated'));
    assert.ok(file.events.every((event) => event.bundle === expected));
    assert.deepEqual(errors, []);
    console.log('PASS deployed bundle, setup fallback, song/report, participant JSON and versioned diagnostics');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
