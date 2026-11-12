const assert = require('node:assert/strict');
const { chromium } = require('playwright');

async function check(browser, url, judge) {
  const viewport = judge === 'mic' ? { width: 360, height: 640 } : { width: 390, height: 844 };
  const page = await browser.newPage({ viewport });
  try {
    await page.addInitScript((mode) => {
      navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError'); };
      localStorage.setItem('dinga-v1', JSON.stringify({
        panel: { judge: mode, speed: 100 },
        songPractice: { last: null, count: 2, best: 81 },
      }));
    }, judge);
    await page.goto(url);
    await page.locator('.widget').click();
    await page.getByRole('button', { name: 'MY', exact: true }).click();
    await page.getByRole('button', { name: '곡 연습하러 가기' }).click();
    await page.getByText('마이크 없이 진행해요', { exact: true }).waitFor();
    await page.getByRole('button', { name: /바로 시작/ }).click();
    if (judge === 'mic') {
      await page.locator('.sp .iconbtn').click();
      const confirmation = page.getByRole('heading', { name: '연주를 그만할까요?' });
      await confirmation.waitFor();
      // At panel speed 100 the full track finishes within two seconds.
      await page.waitForTimeout(2200);
      assert.ok(await confirmation.isVisible(), '나가기 확인 중에는 자동 완주하지 않아야 한다');
      await page.getByRole('button', { name: '계속하기' }).click();
    }
    await page.getByText('곡 연습 리포트', { exact: true }).waitFor();
    assert.ok(await page.locator('.screen').evaluate((el) => el.scrollWidth <= el.clientWidth));
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('dinga-v1')));
    const { last, best, count } = state.songPractice;
    assert.equal(last.score, judge === 'mic' ? null : 100);
    assert.equal(last.beatAcc, last.score);
    assert.equal(last.chordAcc, last.score);
    assert.equal(best, judge === 'mic' ? 81 : 100);
    assert.equal(last.complete, true);
    assert.equal(count, 3);
    assert.equal(state.challenge.done, true);
    assert.ok(state.history[last.date] > 0);
    if (judge === 'mic') {
      assert.match(await page.locator('body').innerText(), /측정 안 됨/);
      assert.deepEqual(last.trans, {});
      assert.ok(last.secs.every((sec) => sec.state === 'unmeasured'));
    }
    await page.getByRole('button', { name: '완료', exact: true }).click();
    await page.getByRole('button', { name: '연습', exact: true }).click();
    await page.getByRole('button', { name: '코드 전환', exact: true }).click();
    await page.locator('.card').filter({ hasText: 'Em ↔ G' }).getByRole('button', { name: '연습하기' }).click();
    await page.getByRole('button', { name: '시작하기' }).waitFor();
    assert.match(await page.locator('body').innerText(), /모의 판정/);
    await page.getByRole('button', { name: '시작하기' }).click();
    await page.getByRole('heading', { name: '전환 연습 결과' }).waitFor();
    assert.match(await page.locator('body').innerText(), /모의 판정/);
    const transition = await page.evaluate(() => JSON.parse(localStorage.getItem('dinga-v1')).song.last);
    assert.equal(transition.judge, judge === 'mic' ? 'random' : judge);
    assert.equal(transition.bars.length, 8);
    assert.ok(transition.bars.every((bar) => ['ok', 'late', 'none'].includes(bar)));
    if (judge === 'allok') assert.ok(transition.bars.every((bar) => bar === 'ok'));
  } finally {
    await page.close();
  }
}

(async () => {
  const { preview } = await import('vite');
  const server = await preview({ preview: { port: 0, host: '127.0.0.1' } });
  try {
    const browser = await chromium.launch({ channel: process.env.QA_BROWSER_CHANNEL });
    try {
      const url = 'http://127.0.0.1:' + server.httpServer.address().port;
      for (const mode of ['mic', 'allok']) {
        await check(browser, url, mode);
        console.log('PASS', mode);
      }
    } finally { await browser.close(); }
  } finally { await server.close(); }
})().catch((err) => { console.error(err); process.exitCode = 1; });
