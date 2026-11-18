// 자세 촬영(S7) 실제 판정과 자세 알림 카메라 창 위치를 빌드된 앱에서 확인한다.
// 가짜 카메라 영상에는 사람이 없으므로 모델이 실제로 돌고 모든 항목이 '확인 어려움'이 되는지 본다.
// 사람 자세의 정확도는 이 검사로 알 수 없다(실제 폰·기타로 확인).
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const { preview } = await import('vite');
  const server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'error' });
  const url = server.resolvedUrls.local[0];
  const browser = await chromium.launch({ channel: process.env.QA_BROWSER_CHANNEL, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['camera', 'microphone'] });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      if (localStorage.getItem('dinga-v1')) return;
      const d = new Date(), z = (n) => String(n).padStart(2, '0');
      localStorage.setItem('dinga-v1', JSON.stringify({ attendances: [{ date: `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`, method: 'manual' }], panel: { variant: 'idea', judge: 'allok', alert: 'manual', speed: 1, posture: 'real' }, resume: { lesson: 'em', part: 0, step: 0 } }));
    });
    const button = (name) => page.getByRole('button', { name, exact: true }).first();
    await page.goto(url); await page.locator('.widget').click();
    await button('이어서 연습하기 ›').click();
    await button('다음').click();
    await page.getByText('자세 확인', { exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector('.cam video')?.readyState >= 2, null, { timeout: 15000 });
    await page.getByRole('button', { name: /촬영/ }).click();
    await page.getByText(/사진으로 확인한 결과예요|자세를 살펴보지 못했어요/).waitFor({ timeout: 60000 });
    const text = await page.locator('.screen').innerText();
    assert.ok(text.includes('사진으로 확인한 결과예요'), 'models load and run on the captured photo: ' + text.slice(0, 200));
    assert.ok(['손목', '어깨', '엄지'].every((name) => text.includes(name)), 'three posture rows');
    // 11/18 18:40 QA: 사진으로 못 본 곳은 '괜찮음'을 지어내지 않고 '확인 어려움' + 체크 없음(참가자가 직접 고름)
    assert.equal(await page.locator('.card button.pill.ok, .card button.pill.warn').count(), 0, 'nothing is pre-checked when the photo shows no person');
    assert.equal((text.match(/확인 어려움/g) || []).length, 3, 'three rows say the photo could not show them');
    assert.ok(text.includes('확인 어려운 곳은 직접 골라 주세요') || text.includes('자세를 살펴보지 못했어요'), 'tells the participant to choose');
    const log = await page.evaluate(() => JSON.parse(localStorage.getItem('dinga-log')).filter((e) => e.type === 'posture').at(-1));
    assert.equal(log.mode, 'real'); assert.equal(log.failed, undefined); assert.deepEqual(log.measured, { wrist: false, shoulder: false, thumb: false, guitar: null }, 'unmeasured parts are recorded');
    console.log('PASS S7 photo runs MediaPipe pose+hand; unseen parts show 확인 어려움 with nothing checked');
    await button('연습 시작').click();
    await button('다음').click(); await button('다음').click(); // Em 손가락 카드 → 운지법 → 파트 완료(18:40: 파트 1에 소리 내기 없음)
    await page.getByRole('heading', { name: '파트 완료!', exact: true }).waitFor();
    await button('다음 파트').click(); const skip = page.getByRole('button', { name: /^(건너뛰기|다음 단계로)$/ }); await skip.first().waitFor({ timeout: 8000 }).then(() => skip.first().click()).catch(() => {});
    await page.locator('.dots').waitFor();
    for (let i = 0; i < 3; i++) await page.mouse.click(375, 20);
    await button('지금 띄우기').click(); await page.waitForTimeout(2500);
    assert.equal(await page.locator('.palert').count(), 0, '18:40: no posture alert on the lesson screen');
    assert.equal(await page.locator('.coach-card, .pip').count(), 0, 'no mini camera');
    assert.equal(await page.evaluate(() => !!document.querySelector('video.eye')?.srcObject), false, 'no camera stream during play in timed/manual mode');
    console.log('PASS no posture alert or camera during lesson play (18:40)');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await new Promise((r) => server.httpServer.close(r)); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
