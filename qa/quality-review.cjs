const assert = require('node:assert/strict');
const { chromium } = require('playwright');

async function openPage(browser, url, state = {}, audio = 'deny', camera = false) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(({ state, audio, camera }) => {
    const d = new Date();
    const date = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
    localStorage.setItem('dinga-v1', JSON.stringify({
      attendances: [{ date, method: 'manual' }], panel: { speed: 20 }, ...state,
    }));
    const acquire = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = (constraints) => {
      if (!constraints.audio) return camera ? acquire(constraints) : Promise.reject(new DOMException('Denied', 'NotAllowedError'));
      if (audio === 'allow') return acquire(constraints);
      if (audio === 'defer') return new Promise((resolve) => { window.grantMic = async () => resolve(await acquire(constraints)); });
      return Promise.reject(new DOMException('Denied', 'NotAllowedError'));
    };
  }, { state, audio, camera });
  await page.goto(url);
  await page.evaluate(async () => {
    const { mic } = await import('/src/lib.js');
    mic.level = () => window.testAmplitude || 0;
    mic.chroma = () => [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1];
  });
  if (state.panel && state.panel.variant === 'prd') {
    await page.locator('.splash').waitFor({ state: 'detached' });
  } else {
    await page.locator('.widget').click();
    await page.locator('.splash').waitFor({ state: 'detached' });
  }
  return page;
}
const button = (page, name) => page.getByRole('button', { name, exact: true });
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('dinga-v1')));

async function permissions(browser, url) {
  let page = await openPage(browser, url, { attendances: [] }, 'defer');
  try {
    await button(page, '출석하기').click();
    await button(page, '마이크 없이 출석하기').click();
    await button(page, '코스 이어하기').waitFor();
    await page.evaluate(() => window.grantMic());
    assert.equal((await stored(page)).attendances.length, 1);
    await button(page, '학습').waitFor();
    console.log('PASS ignored permission prompt can be skipped without late response replacing attendance');
  } finally { await page.close(); }
  page = await openPage(browser, url, { resume: { lesson: 'em', part: 1, step: 0 } }, 'defer');
  try {
    await button(page, '이어서 연습하기 ›').click();
    assert.ok(await button(page, '다음').isDisabled());
    await page.evaluate(() => window.grantMic());
    await page.waitForFunction(async () => (await import('/src/lib.js')).mic.state === 'on');
    for (let i = 0; i < 4; i += 1) {
      await page.evaluate(() => { window.testAmplitude = 0.2; });
      await page.waitForTimeout(100);
      await page.evaluate(() => { window.testAmplitude = 0; });
      await page.waitForTimeout(100);
    }
    await page.waitForFunction(() => document.querySelectorAll('.dots i.on').length === 4);
    assert.ok(await button(page, '다음').isEnabled());
    console.log('PASS resumed play subscribes when microphone permission resolves late');
  } finally { await page.close(); }
}

async function overlayPause(browser, url) {
  const page = await openPage(browser, url, {
    panel: { speed: 20, judge: 'allok' },
    done: { em: [true, true, true], g: [true, true, true], c: [true, true, true], song: [false, false, false] },
    resume: { lesson: 'song', part: 0, step: 1 },
  });
  try {
    await button(page, '이어서 연습하기 ›').click();
    await button(page, '시작하기').click();
    await page.locator('.bars .bar.ok').first().waitFor();
    await button(page, '나가기').click();
    const dialog = page.getByRole('dialog', { name: '지금 나갈까요?' });
    await dialog.waitFor();
    const completed = await page.locator('.bars .bar.ok').count();
    await page.waitForTimeout(2100);
    assert.equal(await page.locator('.bars .bar.ok').count(), completed);
    assert.equal(await page.locator('.embed .big').innerText(), 'Em ↔ G');
    await button(page, '계속하기').click();
    await page.getByText('G ↔ C', { exact: true }).waitFor();
    console.log('PASS parent exit dialog pauses embedded transition and preserves current lesson step');
  } finally { await page.close(); }
}

async function retryAndScores(browser, url) {
  let page = await openPage(browser, url, {
    panel: { speed: 20, judge: 'allok' },
    done: { em: [true, true, true], g: [true, true, true], c: [true, true, true], song: [true, true, false] },
    resume: { lesson: 'song', part: 2, step: 0 },
    songPractice: { last: null, best: 81, count: 0 },
  });
  try {
    await button(page, '이어서 연습하기 ›').click();
    await page.getByRole('button', { name: /바로 시작/ }).click();
    await page.locator('.sp-bar.ok').first().waitFor();
    await page.getByRole('button', { name: /끝내기/ }).click();
    await page.getByRole('heading', { name: '곡 연습 리포트' }).waitFor();
    let state = await stored(page);
    assert.equal(state.songPractice.last.fromLesson, true);
    assert.equal(state.songPractice.best, 81);
    await page.getByText(/모의 판정 결과예요/).waitFor();
    await button(page, '다시 연주').click();
    await page.getByRole('button', { name: /바로 시작/ }).click();
    await page.getByRole('heading', { name: '곡 연습 리포트' }).waitFor();
    state = await stored(page);
    assert.equal(state.done.song[2], true);
    assert.equal(state.songPractice.last.complete, true);
    assert.equal(state.songPractice.last.judge, 'allok');
    assert.equal(state.songPractice.best, 81);
    console.log('PASS final-lesson retry retains course completion and simulated scores stay separate from best');
  } finally { await page.close(); }
  page = await openPage(browser, url, { panel: { speed: 2 }, songPractice: { last: null, count: 0, best: 81 } }, 'allow');
  try {
    await button(page, 'MY').click();
    await button(page, '곡 연습하러 가기').click();
    await page.waitForFunction(async () => (await import('/src/lib.js')).mic.state === 'on');
    await page.evaluate(() => { window.testAmplitude = 0.2; });
    await page.locator('.sp-bar.ok').first().waitFor();
    await page.getByRole('button', { name: /끝내기/ }).click();
    await page.getByRole('heading', { name: '곡 연습 리포트' }).waitFor();
    const state = await stored(page);
    assert.equal(state.songPractice.last.score, 100);
    assert.equal(state.songPractice.last.complete, false);
    assert.equal(state.songPractice.best, 81);
    const summary = await page.evaluate(async () => {
      const { summarizeSong } = await import('/src/SongPlay.jsx');
      return summarizeSong(Array.from({ length: 12 }, () => ({ t: 'ok', c: false })));
    });
    assert.equal(summary.beatAcc, 100);
    assert.equal(summary.chordAcc, 0);
    assert.ok(summary.secs.every((section) => section.state === 'check'));
    assert.ok(Object.values(summary.trans).every((pair) => pair.late === 0 && pair.chord === pair.n));
    const edgeCases = await page.evaluate(async () => {
      const { summarizeSong } = await import('/src/SongPlay.jsx');
      return {
        silent: summarizeSong(Array.from({ length: 12 }, () => ({ t: 'none', c: false }))),
        unmeasured: summarizeSong(Array.from({ length: 12 }, () => ({ t: 'unmeasured', c: null }))),
        partial: summarizeSong([{ t: 'ok', c: true }]),
      };
    });
    assert.equal(edgeCases.silent.score, 0);
    assert.ok(edgeCases.silent.secs.every((section) => section.state === 'retry'));
    assert.ok(Object.values(edgeCases.silent.trans).every((pair) => pair.missed === pair.n && pair.late === 0));
    assert.equal(edgeCases.unmeasured.score, null);
    assert.equal(Object.keys(edgeCases.unmeasured.trans).length, 0);
    assert.equal(edgeCases.partial.played, 1);
    assert.ok(edgeCases.partial.secs.slice(1).every((section) => section.state === 'skip'));
    console.log('PASS perfect partial attempt does not replace best; chord errors stay distinct from timing');
  } finally { await page.close(); }
  page = await openPage(browser, url, { panel: { speed: 4 } }, 'allow');
  try {
    await button(page, 'MY').click();
    await button(page, '곡 연습하러 가기').click();
    await page.waitForFunction(async () => (await import('/src/lib.js')).mic.state === 'on');
    await page.evaluate(async () => {
      const { mic, content } = await import('/src/lib.js');
      mic.level = () => performance.now() % 200 < 100 ? 0.2 : 0;
      mic.chroma = () => {
        const name = document.querySelector('.sp-bar.now b')?.textContent.trim() || 'Em';
        return Array.from({ length: 12 }, (_, index) => content.chordNotes[name].includes(index) ? 1 : 0);
      };
    });
    await page.getByRole('heading', { name: '곡 연습 리포트' }).waitFor();
    const state = await stored(page);
    assert.equal(state.songPractice.last.complete, true);
    assert.equal(state.songPractice.last.judge, 'mic');
    assert.ok(state.songPractice.last.score > 80);
    assert.equal(state.songPractice.best, state.songPractice.last.score);
    console.log('PASS eligible complete microphone attempt updates best with measured result');
  } finally { await page.close(); }
}

async function backgroundAndKeyboard(browser, url) {
  const page = await openPage(browser, url, { panel: { speed: 20, judge: 'allok' } });
  try {
    await button(page, 'MY').click();
    await button(page, '곡 연습하러 가기').click();
    await page.getByRole('button', { name: /바로 시작/ }).click();
    await page.locator('.sp-bar.ok').first().waitFor();
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.testHidden || false });
      window.testHidden = true;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const completed = await page.locator('.sp-bar.ok').count();
    await page.waitForTimeout(5000);
    assert.equal(await page.locator('.sp-bar.ok').count(), completed);
    await page.evaluate(() => { window.testHidden = false; document.dispatchEvent(new Event('visibilitychange')); });
    await button(page, '계속 연주하기').click();
    await page.getByRole('heading', { name: '곡 연습 리포트' }).waitFor();
    console.log('PASS background switch preserves observed bars until explicit resume');
    await button(page, '완료').click();
    await button(page, '학습').click();
    await button(page, '코스 이어하기').click();
    const dialog = page.getByRole('dialog', { name: 'Em 코드 연습', exact: true });
    await dialog.waitFor();
    assert.equal(await dialog.evaluate((node) => node === document.activeElement), true);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    assert.ok(await dialog.evaluate((node) => node.contains(document.activeElement)));
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    console.log('PASS dialog naming, keyboard focus containment and Escape dismissal');
  } finally { await page.close(); }
}

async function cameraAndObservedTime(browser, url) {
  let page = await openPage(browser, url, { attendances: [], panel: { speed: 1 } }, 'allow');
  try {
    await button(page, '출석하기').click();
    await page.getByText('듣고 있어요', { exact: true }).waitFor();
    await page.evaluate(() => {
      window.testAmplitude = 0.2;
      const until = performance.now() + 2300;
      while (performance.now() < until) { /* 브라우저가 관측하지 못한 긴 프레임 간격 */ }
      requestAnimationFrame(() => { window.testAmplitude = 0; });
    });
    await page.waitForTimeout(300);
    assert.equal((await stored(page)).attendances.length, 0);
    await page.getByText(/듣고 있어요/).waitFor();
    console.log('PASS suspended frame gap is not credited as two seconds of attendance sound');
  } finally { await page.close(); }
  page = await openPage(browser, url, { panel: { variant: 'prd', speed: 2 }, resume: { lesson: 'em', part: 0, step: 0 } }, 'deny', true);
  try {
    await button(page, '이어서 연습하기').click();
    await page.waitForFunction(() => document.querySelector('.cam video')?.readyState >= 2);
    await button(page, '촬영 (3초 뒤)').click();
    await button(page, '나가기').click();
    const count = await page.locator('.cam .count').innerText();
    await page.waitForTimeout(2000);
    assert.equal(await page.locator('.cam .count').innerText(), count);
    await button(page, '계속하기').click();
    await button(page, '다시 찍기').click();
    await page.waitForFunction(() => {
      const video = document.querySelector('.cam video');
      const capture = [...document.querySelectorAll('button')].find(button => button.textContent === '촬영 (3초 뒤)');
      return video?.readyState >= 2 && video.srcObject?.active && capture?.disabled === false;
    });
    assert.ok(await button(page, '촬영 (3초 뒤)').isEnabled());
    console.log('PASS capture pauses behind exit dialog and retake attaches a live preview');
  } finally { await page.close(); }
}

(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  try {
    const browser = await chromium.launch({
      channel: process.env.QA_BROWSER_CHANNEL,
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    });
    try {
      const url = 'http://127.0.0.1:' + server.httpServer.address().port;
      await permissions(browser, url);
      await overlayPause(browser, url);
      await retryAndScores(browser, url);
      await backgroundAndKeyboard(browser, url);
      await cameraAndObservedTime(browser, url);
    } finally { await browser.close(); }
  } finally { await server.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
