// 평가 패널 참가자 번호 P1~P4 → 마지막 출석 자동 세팅(11/18 18:40 QA)
// P1 처음 가입한 상태, P2·P3·P4 마지막 출석 1·2·4일 전. 앱 기록만 처음으로, 평가 설정과 행동 기록은 남는다.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const ymd = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); const z = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };

(async () => {
  const { preview } = await import('vite');
  const server = await preview({ preview: { port: 0, host: '127.0.0.1' } });
  const browser = await chromium.launch({ channel: process.env.QA_BROWSER_CHANNEL });
  try {
    const page = await browser.newPage({ viewport: { width: 360, height: 640 } });
    await page.addInitScript((seed) => {
      if (!localStorage.getItem('dinga-v1')) localStorage.setItem('dinga-v1', JSON.stringify(seed));
    }, { attendances: [{ date: ymd(0), method: 'sound' }], history: { [ymd(0)]: 300 }, resume: { lesson: 'em', part: 1, step: 0 }, done: { em: [true, false, false] }, panel: { variant: 'idea', judge: 'allok', alert: 'off' } });
    await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/?fresh=0');
    await page.locator('.widget').click(); await page.locator('.splash').waitFor({ state: 'detached' });
    const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('dinga-v1')));
    const logs = () => page.evaluate(() => JSON.parse(localStorage.getItem('dinga-log') || '[]'));
    const panel = async () => { for (let i = 0; i < 3; i += 1) await page.mouse.click(345, 18); await page.getByRole('heading', { name: '평가 패널' }).waitFor(); };
    const pid = () => page.getByPlaceholder('예: P1');
    const enter = async (value) => { await pid().fill(value); await pid().press('Enter'); await page.waitForTimeout(150); };
    await panel();
    const logBefore = (await logs()).length;
    for (const [value, ago] of [['P3', 2], ['P2', 1], ['P4', 4]]) {
      await enter(value);
      const s = await state();
      assert.equal(s.panel.pid, value);
      assert.deepEqual(s.attendances.map((a) => a.date), [ymd(-ago)], `${value}: last attendance ${ago} days ago`);
      assert.deepEqual(s.history, {}, `${value}: practice record starts empty`);
      assert.equal(s.resume, null); assert.deepEqual(s.done.em, [false, false, false]);
      assert.equal(s.panel.judge, 'allok', 'evaluation settings stay'); assert.equal(s.panel.variant, 'idea');
      await page.getByText(`${value}: 마지막 출석 ${ago}일 전으로 시작해요`).waitFor();
    }
    await enter('P1');
    assert.deepEqual((await state()).attendances, [], 'P1: freshly joined, no attendance');
    const lg = await logs();
    assert.ok(lg.length > logBefore && lg.filter((e) => e.type === 'participant_preset').map((e) => e.pid).join() === 'P3,P2,P4,P1', 'behavior log kept and records each preset');
    // 같은 번호에서 입력칸을 다시 눌렀다 떼도 다시 지우지 않는다
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('dinga-v1')); s.history = { x: 1 }; localStorage.setItem('dinga-v1', JSON.stringify(s)); });
    await pid().click(); await pid().press('Enter'); await page.waitForTimeout(150);
    assert.equal((await logs()).filter((e) => e.type === 'participant_preset').length, 4, 'same participant number is not reset again');
    // 다른 번호(P7)는 자동 세팅하지 않는다
    await enter('P7');
    assert.equal((await logs()).filter((e) => e.type === 'participant_preset').length, 4, 'other numbers keep the data');
    console.log('PASS participant number P1~P4 sets last attendance (none/1/2/4 days ago), keeps settings and behavior log, no repeat reset');
  } finally { await browser.close(); await new Promise((resolve) => server.httpServer.close(resolve)); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
