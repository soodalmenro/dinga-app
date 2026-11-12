const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const path = require('node:path');
const os = require('node:os');

async function inspect(browser, url, width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  const button = (name) => page.getByRole('button', { name, exact: true });
  async function screen(name) {
    await page.waitForTimeout(250);
    const overflow = await page.locator('.screen').evaluate((el) => el.scrollWidth - el.clientWidth);
    if (width === 320) await page.screenshot({ path: path.join(os.tmpdir(), 'dinga-' + name + '.png') });
    assert.ok(overflow <= 1, name + ' horizontal overflow ' + overflow);
    console.log('PASS', width, height, name);
  }
  try {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError'); };
      const d = new Date();
      const date = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
      localStorage.setItem('dinga-v1', JSON.stringify({
        attendances: [{ date, method: 'manual' }],
        panel: { speed: 100, judge: 'mic' },
      }));
    });
    await page.goto(url);
    await page.locator('.widget').click();
    await button('이어서 연습하기 ›').waitFor();
    await page.locator('.splash').waitFor({ state: 'detached' });
    await screen('home');
    await button('이어서 연습하기 ›').click();
    await button('코스 이어하기').waitFor();
    await screen('course');
    await button('MY').click();
    await button('곡 연습하러 가기').click();
    await page.getByText('마이크 없이 진행해요', { exact: true }).waitFor();
    await screen('song');
    await page.getByRole('button', { name: /바로 시작/ }).click();
    await page.getByRole('heading', { name: '곡 연습 리포트' }).waitFor();
    await screen('report');
    await button('완료').scrollIntoViewIfNeeded();
    await button('완료').click();
    await button('한 번 더 연주하기').waitFor();
  } finally { await page.close(); }
}

(async () => {
  const { preview } = await import('vite');
  const server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
  try {
    const browser = await chromium.launch({ channel: process.env.QA_BROWSER_CHANNEL });
    try {
      for (const [width, height] of [[320, 568], [360, 640], [390, 844]]) {
        await inspect(browser, 'http://127.0.0.1:' + server.httpServer.address().port, width, height);
      }
    } finally { await browser.close(); }
  } finally { await server.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
