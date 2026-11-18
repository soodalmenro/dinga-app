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
    await page.getByText(/사진 한 장으로 본 참고 결과예요|자세를 살펴보지 못했어요/).waitFor({ timeout: 60000 });
    const text = await page.locator('.screen').innerText();
    assert.ok(text.includes('사진 한 장으로 본 참고 결과예요'), 'models load and run on the captured photo: ' + text.slice(0, 200));
    assert.ok(['손목', '왼손 높이', '어깨', '엄지'].every((name) => text.includes(name)), 'four posture rows');
    assert.ok((text.match(/확인 어려움/g) || []).length >= 3, 'no person in the fake camera → unknown, never a made-up ok');
    const log = await page.evaluate(() => JSON.parse(localStorage.getItem('dinga-log')).filter((e) => e.type === 'posture').at(-1));
    assert.equal(log.mode, 'real'); assert.equal(log.failed, undefined);
    console.log('PASS S7 photo runs MediaPipe pose+hand and reports unknown for an empty frame');
    await button('연습 시작').click();
    await page.locator('.dots').waitFor();
    for (let i = 0; i < 3; i++) await page.mouse.click(375, 20);
    await button('지금 띄우기').click();
    await page.locator('.palert').waitFor({ timeout: 8000 });
    await page.locator('.grow .coach-card video').waitFor({ timeout: 8000 });
    assert.equal(await page.locator('.pip.coach').count(), 0, 'no small top-right camera window');
    assert.equal(await page.locator('.grow .coach-card img').count(), 1, 'correction picture under the camera');
    await page.locator('.palert').waitFor({ state: 'detached', timeout: 8000 });
    assert.equal(await page.locator('.coach-card').count(), 0, 'camera window leaves with the alert');
    console.log('PASS posture alert shows camera + correction picture in the character spot for 3 seconds');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await new Promise((r) => server.httpServer.close(r)); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
