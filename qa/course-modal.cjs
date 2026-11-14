const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const button = (page, name) => page.getByRole('button', { name, exact: true });

async function inspect(browser, url, { width, height, song = false, enlarged = false, legacy = false }) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.addInitScript(({ song, legacy }) => {
      const d = new Date();
      const date = [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
      localStorage.setItem('dinga-v1', JSON.stringify({
        attendances: [{ date, method: 'manual' }], panel: { variant: legacy ? 'prd' : 'idea', speed: 20, judge: 'allok' },
        done: { em: song ? [true,true,true] : [true,false,false], g: [song,song,song], c: [song,song,song], song: [false,false,false] },
        resume: { lesson: song ? 'song' : 'em', part: song ? 0 : 1, step: 0 },
      }));
      navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied','NotAllowedError'); };
    }, { song, legacy });
    await page.goto(url);
    if (!legacy) await page.locator('.widget').click();
    await page.locator('.splash').waitFor({ state: 'detached' });
    await button(page, '학습').click();
    if (!legacy) await button(page, '코스 이어하기').click();
    else await page.locator('.card.lesson.tap').first().click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    assert.equal(await dialog.evaluate(node => node === document.activeElement), true);
    if (legacy) {
      assert.equal(await page.locator('.course-parts').count(), 0);
      await dialog.getByText('파트 2 · 코드 만들기', { exact: true }).waitFor();
    } else {
      assert.equal(await page.locator('.course-part-mascot img').count(), 1, 'course modal includes its Figma character decoration');
      assert.ok(await page.locator('.course-part-mascot img').evaluate(img => img.complete && img.naturalWidth > 0 && !img.src.includes('figma.com')));
      if (!song) await dialog.getByText('파트 2 · 코드 잡기', { exact: true }).waitFor();
      else assert.equal(await dialog.locator('.course-part-chords .pill').count(), 3);
      if (enlarged) await page.addStyleTag({ content: '.course-parts h1,.course-parts b,.course-parts .sub { font-size:24px!important }' });
      await page.waitForTimeout(250);
      const geometry = await page.evaluate(() => {
        const modal = document.querySelector('.course-parts');
        const sheet = modal.querySelector('.sheet');
        const image = modal.querySelector('.course-part-mascot img');
        const s = sheet.getBoundingClientRect(), m = image.getBoundingClientRect();
        const close = sheet.querySelector('[aria-label="레슨 선택 닫기"]').getBoundingClientRect();
        return { sheet: { x:s.x,y:s.y,width:s.width,height:s.height }, mascot: { x:m.x,y:m.y,width:m.width,height:m.height },
          horizontal: sheet.scrollWidth-sheet.clientWidth, close: { width:close.width,height:close.height },
          viewport: { width:innerWidth,height:innerHeight }, backdrop:getComputedStyle(modal).backgroundColor,
          cards:[...sheet.querySelectorAll('.card.lesson')].map(card=>card.getBoundingClientRect().height) };
      });
      assert.ok(geometry.horizontal<=1, 'no horizontal overflow: '+JSON.stringify(geometry));
      assert.ok(geometry.mascot.y>=0 && geometry.mascot.y+geometry.mascot.height<=geometry.viewport.height, 'decoration remains visible');
      assert.ok(geometry.mascot.y<geometry.sheet.y && geometry.mascot.y+geometry.mascot.height>geometry.sheet.y, 'decoration overlaps sheet top');
      assert.ok(geometry.close.width>=44 && geometry.close.height>=44, 'close has a 44px touch target');
      assert.equal(geometry.backdrop, 'rgb(52, 50, 74)');
      assert.ok(geometry.cards.every(h=>h>=(song?96:88)), 'readable card height');
      const assets=await dialog.locator('img').evaluateAll(images=>images.map(img=>({src:img.src,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,width:img.getBoundingClientRect().width,height:img.getBoundingClientRect().height})));
      assert.ok(assets.every(img=>img.naturalWidth>0&&!img.src.includes('figma.com')), 'every visible static asset is local and non-empty');
      const closeAsset=await dialog.locator('.course-part-close img').evaluate(img=>({width:img.getBoundingClientRect().width,height:img.getBoundingClientRect().height}));
      assert.deepEqual(closeAsset,{width:20,height:20},'original close SVG root dimensions');
      assert.ok(await dialog.locator('.course-part-chevron').evaluateAll(images=>images.every(img=>img.getBoundingClientRect().width===18&&img.getBoundingClientRect().height===18)),'original chevron SVG root dimensions');
      if(width===390 && !enlarged) {
        assert.equal(geometry.sheet.width,350);
        assert.ok(Math.abs(geometry.sheet.height-(song?434:406))<=8, 'Figma sheet height: '+JSON.stringify(geometry));
      }
      const last = dialog.locator('.card.lesson').last();
      await last.scrollIntoViewIfNeeded();
      assert.ok(await last.evaluate(node=>{const r=node.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1;}), 'last part remains reachable');
      if (process.env.QA_CAPTURE==='1') {
        await dialog.evaluate(node=>{node.scrollTop=0;});
        await page.screenshot({ path:path.resolve('..',`dinga-modal-${song?'song':'em'}-${width}x${height}${enlarged?'-large':''}.png`), animations:'disabled' });
      }
    }
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    assert.ok(await dialog.evaluate(node=>node.contains(document.activeElement)), 'focus stays in dialog');
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state:'detached' });
    const trigger=page.locator('.screen > button.card.lesson.tap').nth(song?3:0);
    assert.ok(await trigger.evaluate(node=>node===document.activeElement), 'focus returns to the corresponding lesson trigger');
    const focused=await trigger.evaluate(node=>{const r=node.getBoundingClientRect(),s=node.closest('.screen').getBoundingClientRect();return{top:r.top,bottom:r.bottom,screenTop:s.top,screenBottom:s.bottom};});
    assert.ok(focused.top>=Math.max(0,focused.screenTop)-1&&focused.bottom<=Math.min(height,focused.screenBottom)+1,'restored focus is visible: '+JSON.stringify(focused));
    await trigger.click();
    await dialog.waitFor();
    await button(page,'레슨 선택 닫기').click();
    await dialog.waitFor({state:'detached'});
    await trigger.click();
    await dialog.waitFor();
    await page.locator('.modal').click({position:{x:5,y:5}});
    await dialog.waitFor({state:'detached'});
    assert.deepEqual(errors,[]);
    console.log(`PASS modal ${legacy?'prd':song?'song':'em'} ${width}x${height}${enlarged?' enlarged':''}`);
  } finally { await page.close(); }
}

(async()=>{
  const { createServer }=await import('vite');
  const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
  try {
    const browser=await chromium.launch({channel:process.env.QA_BROWSER_CHANNEL});
    try {
      const url=process.env.QA_URL||'http://127.0.0.1:'+server.httpServer.address().port;
      for(const [width,height] of [[390,844],[320,568],[430,932],[667,320]]) {
        for(const song of [false,true]) await inspect(browser,url,{width,height,song});
      }
      for(const song of [false,true]) await inspect(browser,url,{width:320,height:568,song,enlarged:true});
      await inspect(browser,url,{width:390,height:844,legacy:true});
    } finally { await browser.close(); }
  } finally { await server.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
