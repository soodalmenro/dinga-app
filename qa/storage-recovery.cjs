const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  try {
    const browser = await chromium.launch({ channel: process.env.QA_BROWSER_CHANNEL });
    try {
      const page = await browser.newPage({ viewport: { width: 360, height: 640 } });
      await page.goto('http://127.0.0.1:' + server.httpServer.address().port);
      const result = await page.evaluate(async () => {
        const lib = await import('/src/lib.js');
        localStorage.setItem('dinga-v1', JSON.stringify({
          done: { em: [true] }, songPractice: { count: 2 },
          history: { '2026-11-12': 90 }, panel: { pid: 'P4' },
        }));
        const legacy = lib.load();
        localStorage.setItem('dinga-v1', JSON.stringify({
          done: null, attendances: [null, { date: 12 }], history: null,
          resume: { lesson: 'unknown', part: -1, step: -1 },
          panel: { speed: 0, variant: 'bad' }, song: null,
        }));
        const damaged = lib.load();
        localStorage.setItem('dinga-log', '{}');
        const malformedLog = lib.getLog();
        const original = Storage.prototype.setItem;
        let saved;
        let sessionLog;
        try {
          Storage.prototype.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); };
          saved = lib.save(legacy);
          lib.logEvent('storage_test');
          sessionLog = lib.getLog();
        } finally { Storage.prototype.setItem = original; }
        return { legacy, damaged, malformedLog, saved, sessionLog, restored: lib.save(legacy) };
      });
      assert.deepEqual(result.legacy.done.em, [true, false, false]);
      assert.deepEqual(result.legacy.done.c, [false, false, false]);
      assert.equal(result.legacy.songPractice.count, 2);
      assert.equal(result.legacy.songPractice.best, 0);
      assert.equal(result.legacy.panel.pid, 'P4');
      assert.equal(result.legacy.history['2026-11-12'], 90);
      assert.deepEqual(result.damaged.attendances, []);
      assert.deepEqual(result.damaged.history, {});
      assert.deepEqual(result.damaged.done.song, [false, false, false]);
      assert.equal(result.damaged.resume, null);
      assert.equal(result.damaged.panel.speed, 1);
      assert.equal(result.damaged.panel.variant, 'idea');
      assert.deepEqual(result.malformedLog, []);
      assert.equal(result.saved, false);
      assert.equal(result.restored, true);
      assert.ok(result.sessionLog.some((event) => event.type === 'storage_test'));
      console.log('PASS legacy state migration, damaged data recovery and in-session log fallback');
      await page.addInitScript(() => {
        window.storageBlocked = true;
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (key === 'dinga-v1' && window.storageBlocked) throw new DOMException('Full', 'QuotaExceededError');
          return original.call(this, key, value);
        };
      });
      await page.reload();
      await page.getByRole('alert').waitFor();
      await page.screenshot({ path: require('node:path').join(require('node:os').tmpdir(), 'dinga-storage-warning.png') });
      await page.evaluate(() => { window.storageBlocked = false; });
      await page.getByRole('button', { name: '저장 다시 시도', exact: true }).click();
      await page.getByRole('alert').waitFor({ state: 'detached' });
      console.log('PASS visible storage failure and retry recovery');
      await page.close();
    } finally { await browser.close(); }
  } finally { await server.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
