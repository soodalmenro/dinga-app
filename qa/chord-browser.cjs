const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const path = require('node:path');
const os = require('node:os');

(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  try {
    const browser = await chromium.launch({ channel: process.env.QA_BROWSER_CHANNEL, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.addInitScript(() => {
        if (localStorage.getItem('dinga-v1')) return;
        const d = new Date();
        const date = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
        localStorage.setItem('dinga-v1', JSON.stringify({
          attendances: [{ date, method: 'manual' }], panel: { speed: 4, alert: 'off' },
          done: { em: [true, true, true], g: [true, true, true], c: [true, true, true], song: [true, true, false] },
          resume: { lesson: 'song', part: 2, step: 0 }, songPractice: { last: null, count: 0, best: 81 },
        }));
      });
      await page.goto('http://127.0.0.1:' + server.httpServer.address().port);
      await page.locator('.widget').click();
      await page.locator('.splash').waitFor({ state: 'detached' });
      await page.getByRole('button', { name: '이어서 연습하기 ›', exact: true }).click();
      await page.waitForFunction(async () => (await import('/src/lib.js')).mic.state === 'on');
      await page.evaluate(async () => {
        const { mic } = await import('/src/lib.js');
        // One deterministic onset on the first displayed beat of each bar.
        mic.level = () => document.querySelector('.sp-beat i')?.classList.contains('on') ? 0.2 : 0;
        mic.chroma = () => new Array(12).fill(1);
      });
      await page.getByRole('button', { name: /바로 시작/ }).click();
      await page.locator('.sp-bar.uncertain').first().waitFor();
      assert.equal(await page.locator('.sp-bar.uncertain').first().innerText().then((t) => t.includes('✓')), false);
      await page.getByText('코드를 판단하기 어려워요', { exact: true }).waitFor();
      await page.getByRole('heading', { name: '곡 연습 리포트' }).waitFor();
      const state = await page.evaluate(() => JSON.parse(localStorage.getItem('dinga-v1')));
      const report = state.songPractice.last;
      assert.equal(report.score, null);
      assert.equal(report.chordAcc, null);
      assert.equal(report.beatAcc, 100);
      assert.equal(report.coverage.uncertain, 12);
      assert.equal(report.coverage.evaluated, 0);
      assert.equal(report.complete, true);
      assert.equal(state.done.song[2], true);
      assert.equal(state.songPractice.best, 81);
      assert.ok(report.bars.every((bar) => bar.c === null && bar.reason === 'off-chord' && bar.classifier === 'chroma-guard-v1'));
      const event = await page.evaluate(() => JSON.parse(localStorage.getItem('dinga-log')).filter((event) => event.type === 'songplay_end').at(-1));
      assert.equal(event.diagnostics.length, 12);
      assert.ok(event.diagnostics.every((verdict) => verdict.reason === 'off-chord' && verdict.c === null && verdict.expected));
      assert.equal(await page.getByRole('button', { name: /전환 연습하러 가기/ }).count(), 0);
      await page.getByText(/연주 12\/12마디 · 코드 평가 0마디 · 판정 어려움 12마디/).waitFor();
      console.log('PASS uncertain microphone input preserves timing/completion, withholds score/best and avoids false advice');
      await page.reload();
      const loaded = await page.evaluate(async () => (await import('/src/lib.js')).load());
      assert.deepEqual(loaded.songPractice.last, report);
      const recovery = await page.evaluate(async () => {
        const { load } = await import('/src/lib.js');
        const saved = localStorage.getItem('dinga-v1');
        const state = JSON.parse(saved);
        const original = state.songPractice.last;
        state.songPractice.last = { ...original, coverage: { played: {}, total: 12, evaluated: 0, uncertain: 12 } };
        localStorage.setItem('dinga-v1', JSON.stringify(state));
        const badCoverage = load().songPractice.last;
        state.songPractice.last = { ...original, trans: { 'Em → G': { ok: 0, n: 1, uncertain: 2 } } };
        localStorage.setItem('dinga-v1', JSON.stringify(state));
        const badTransition = load().songPractice.last;
        const legacy = { ...original, secs: original.secs.map((section) => ({ name: section.name, state: 'good' })), trans: {}, score: 80, chordAcc: 80, beatAcc: 80 };
        delete legacy.coverage; delete legacy.bars;
        state.songPractice.last = legacy;
        localStorage.setItem('dinga-v1', JSON.stringify(state));
        const oldReport = load().songPractice.last;
        localStorage.setItem('dinga-v1', saved);
        return { badCoverage, badTransition, oldReport };
      });
      assert.equal(recovery.badCoverage, null);
      assert.equal(recovery.badTransition, null);
      assert.equal(recovery.oldReport.score, 80);
      await page.evaluate(async () => {
        const React = await import('/node_modules/.vite/deps/react.js');
        const ReactDOM = await import('/node_modules/.vite/deps/react-dom_client.js');
        const { SongReport } = await import('/src/SongPlay.jsx');
        const { load } = await import('/src/lib.js');
        const host = document.createElement('div'); host.className = 'app';
        document.body.replaceChildren(host);
        ReactDOM.default.createRoot(host).render(React.default.createElement(SongReport, { s: load(), go: () => {}, params: {} }));
      });
      await page.getByRole('heading', { name: '곡 연습 리포트' }).waitFor();
      for (const [width, height] of [[320, 568], [360, 640], [390, 844]]) {
        await page.setViewportSize({ width, height });
        const overflow = await page.locator('.screen').evaluate((el) => el.scrollWidth - el.clientWidth);
        assert.ok(overflow <= 1, 'uncertain report horizontal overflow at ' + width);
        await page.getByRole('button', { name: '완료', exact: true }).scrollIntoViewIfNeeded();
      }
      await page.setViewportSize({ width: 320, height: 568 });
      await page.locator('.screen').evaluate((el) => { el.scrollTop = 0; });
      await page.screenshot({ path: path.join(os.tmpdir(), 'dinga-uncertain-report.png') });
      assert.deepEqual(errors, []);
      console.log('PASS uncertain report survives storage reload and renders at 320/360/390px');
      await page.close();
    } finally { await browser.close(); }
  } finally { await server.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
