const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require('playwright');
const content = JSON.parse(require('node:fs').readFileSync(path.join(__dirname, '../src/content.json'), 'utf8'));
const openNotes = { 6: 4, 5: 9, 4: 2, 3: 7, 2: 11, 1: 4 };
for (const [name, chord] of Object.entries(content.chords)) {
  const strings = [...chord.open, ...chord.mute, ...chord.dots.map((dot) => dot.string)];
  assert.deepEqual([...strings].sort(), [1, 2, 3, 4, 5, 6], name + ' covers all six strings exactly once');
  const pitches = chord.open.map((string) => openNotes[string]);
  for (const dot of chord.dots) {
    assert.ok(dot.finger >= 1 && dot.finger <= 4 && dot.fret >= 1 && dot.fret <= 4);
    pitches.push((openNotes[dot.string] + dot.fret) % 12);
  }
  assert.deepEqual([...new Set(pitches)].sort(), [...content.chordNotes[name]].sort(), name + ' fingering matches chord tones');
}
assert.equal(content.songPractice.sections.length, 3);
for (const section of content.songPractice.sections) {
  const bars = section.lines.flat();
  assert.equal(bars.length, 4);
  assert.ok(bars.every(([chord]) => content.chords[chord]));
}
console.log('PASS Em/G/C fingering, chord tones and 12-bar song content');

async function check(browser, url) {
  const page = await browser.newPage({ viewport: { width: 360, height: 640 } });
  const button = (name) => page.getByRole('button', { name, exact: true });
  try {
    await page.addInitScript(() => {
      const day = (offset) => {
        const d = new Date();
        d.setDate(d.getDate() + offset);
        return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
      };
      localStorage.setItem('dinga-v1', JSON.stringify({
        attendances: [{ date: day(0), method: 'manual' }],
        history: { [day(-1)]: 120, [day(-2)]: 59, [day(-3)]: 60 },
        panel: { speed: 10 },
      }));
      navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError'); };
    });
    await page.goto(url);
    await page.locator('.widget').click();
    await page.locator('.splash').waitFor({ state: 'detached' });
    await page.waitForTimeout(500);
    // Static layout bounds exclude the intentional idle jump/rotation frames.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.querySelector('.stage .piki')?.getAnimations().length === 0);
    const contained = await page.locator('.stage').evaluate((stage) => {
      const parent = stage.getBoundingClientRect();
      const image = stage.querySelector('img').getBoundingClientRect();
      return { inside: image.top >= parent.top && image.bottom <= parent.bottom, parent: parent.toJSON(), image: image.toJSON() };
    });
    await page.screenshot({ path: path.join(os.tmpdir(), 'dinga-audit-home.png') });
    assert.ok(contained.inside, 'Home character fits within the stage: ' + JSON.stringify(contained));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await button('MY').click();
    assert.equal(await page.locator('.week .guitar-icon').count(), 7);
    assert.equal(await page.locator('.week .guitar-icon.off').count(), 5);
    await page.locator('.week .guitar-icon img').evaluateAll((images) => Promise.all(images.map((image) => image.decode())));
    const geometry = await page.locator('.week .guitar-icon img').evaluateAll((images) => images.map((image) => ({
      loaded: image.naturalWidth > 0, width: parseFloat(getComputedStyle(image).width), height: parseFloat(getComputedStyle(image).height),
    })));
    assert.ok(geometry.every((image) => image.loaded && image.width > 12 && image.width < 14 && image.height > 26 && image.height < 29));
    await page.screenshot({ path: path.join(os.tmpdir(), 'dinga-audit-my.png') });
    await page.getByRole('button', { name: /기록 보기/ }).click();
    const cards = await page.locator('.screen .card').allTextContents();
    assert.ok(cards.some((card) => card.includes('수동 출석') && card.includes('0분')));
    assert.ok(cards.some((card) => card.includes('출석 안 함') && card.includes('2분')));
    await page.screenshot({ path: path.join(os.tmpdir(), 'dinga-audit-history.png') });
    console.log('PASS practice-day icons, attendance-only day, practice without attendance and original icon geometry');

    await page.setViewportSize({ width: 320, height: 568 });
    await page.locator('.screen > .row .iconbtn').click();
    await button('곡 연습하러 가기').click();
    await page.getByText('마이크 없이 진행해요', { exact: true }).waitFor();
    await page.getByRole('button', { name: /바로 시작/ }).click();
    await page.locator('.sp-map span.on').filter({ hasText: '후렴' }).waitFor();
    const visible = await page.locator('.sp-body').evaluate((container) => {
      const active = container.querySelector('.sp-bar.now').getBoundingClientRect();
      const viewport = container.getBoundingClientRect();
      return active.top >= viewport.top - 1 && active.bottom <= viewport.bottom + 1;
    });
    assert.ok(visible, 'Current chorus bar stays visible inside the score');
    assert.ok(await page.locator('.sp-body').evaluate((container) => container.scrollTop > 0), 'Score scrolls on a small screen');
    await page.screenshot({ path: path.join(os.tmpdir(), 'dinga-audit-song.png') });
    await page.getByRole('heading', { name: '곡 연습 리포트', exact: true }).waitFor();
    console.log('PASS score follows current bar through the chorus and completes');
  } finally { await page.close(); }
}

(async () => {
  const { preview } = await import('vite');
  const server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
  try {
    const browser = await chromium.launch({ channel: process.env.QA_BROWSER_CHANNEL });
    try { await check(browser, 'http://127.0.0.1:' + server.httpServer.address().port); }
    finally { await browser.close(); }
  } finally { await server.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
