const assert = require('node:assert/strict');
const { chromium } = require('playwright');

async function rehearse(browser, url) {
  const page = await browser.newPage({ viewport: { width: 360, height: 640 } });
  const button = (name) => page.getByRole('button', { name, exact: true });
  async function panel() {
    for (let i = 0; i < 3; i += 1) await page.mouse.click(345, 18);
    await page.getByRole('heading', { name: '평가 패널' }).waitFor();
  }
  try {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError'); };
    });
    await page.goto(url);
    await page.locator('.widget').waitFor();
    for (const pid of ['P1', 'P2']) {
      await panel();
      await page.getByPlaceholder('예: P1').fill(pid);
      await button('닫기').click();
      await page.locator('.widget').click();
      await button('출석하기').click();
      await button('마이크 없이 출석하기').click();
      await button('학습').waitFor();
      await page.reload();
      await page.locator('.widget').click();
      await button('출석완료').waitFor();
      assert.ok(await button('출석완료').isDisabled());
      await panel();
      await button('복사').click();
      const log = JSON.parse(await page.locator('.logbox').inputValue());
      const visits = log.filter((event) => event.type === 'attend');
      assert.deepEqual(visits.map((event) => event.pid), pid === 'P1' ? ['P1'] : ['P1', 'P2']);
      assert.ok(visits.every((event) => event.method === 'manual'));
      await page.locator('.panel-row').filter({ hasText: '상태 초기화' }).getByRole('button').click();
      await page.locator('.widget').waitFor();
      const state = await page.evaluate(() => JSON.parse(localStorage.getItem('dinga-v1')));
      assert.equal(state.attendances.length, 0);
      assert.deepEqual(state.history, {});
    }
  } finally { await page.close(); }
}

(async () => {
  const { preview } = await import('vite');
  const server = await preview({ preview: { port: 0, host: '127.0.0.1' } });
  try {
    const browser = await chromium.launch({ channel: process.env.QA_BROWSER_CHANNEL });
    try {
      await rehearse(browser, 'http://127.0.0.1:' + server.httpServer.address().port);
      console.log('PASS participant handoff, persisted attendance and log export');
    } finally { await browser.close(); }
  } finally { await server.close(); }
})().catch((err) => { console.error(err); process.exitCode = 1; });
