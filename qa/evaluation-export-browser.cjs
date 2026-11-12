const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
(async()=>{
  const { createServer }=await import('vite');
  const server=await createServer({server:{host:'127.0.0.1',port:0}}); await server.listen();
  try {
    const browser=await chromium.launch({channel:process.env.QA_BROWSER_CHANNEL});
    try {
      const page=await browser.newPage({viewport:{width:360,height:640},acceptDownloads:true});
      await page.addInitScript(()=>{
        localStorage.setItem('dinga-v1',JSON.stringify({panel:{pid:'P1'}}));
        localStorage.setItem('dinga-log',JSON.stringify([
          {t:'2026-11-12T10:00:00.000Z',pid:'P1',type:'input_check',ok:false,reason:'noise'},
          {t:'2026-11-12T10:00:01.000Z',pid:'P2',type:'attend',method:'manual'},
        ]));
        Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('Denied');}}});
      });
      await page.goto('http://127.0.0.1:'+server.httpServer.address().port);
      await page.locator('.widget').waitFor();
      for(let i=0;i<3;i+=1) await page.mouse.click(345,18);
      await page.getByRole('heading',{name:'평가 패널',exact:true}).waitFor();
      await page.setViewportSize({width:320,height:568});
      assert.ok(await page.locator('.sheet').evaluate(node=>node.scrollWidth-node.clientWidth)<=1,'evaluation panel must fit 320px');
      assert.ok(await page.locator('label[for="evaluation-scope"]').evaluate(node=>node.getBoundingClientRect().height)<=40,'file scope label must remain readable, not a vertical column');
      if(process.env.QA_CAPTURE==='1') await page.getByLabel('파일 저장 범위').locator('..').screenshot({path:require('node:path').join(require('node:os').tmpdir(),'dinga-export-controls.png')});
      await page.setViewportSize({width:360,height:640});
      await page.getByRole('button',{name:'복사',exact:true}).click();
      await page.getByText(/자동 복사를 완료하지 못했어요/).waitFor({timeout:2500});
      const legacy=JSON.parse(await page.locator('.logbox').inputValue());
      assert.ok(Array.isArray(legacy)&&legacy.some(event=>event.pid==='P2'));
      await page.evaluate(()=>{navigator.clipboard.writeText=async(text)=>{window.copiedEvaluation=text;};});
      await page.getByRole('button',{name:'복사',exact:true}).click();
      await page.getByText('전체 행동 기록을 복사했어요.',{exact:true}).waitFor();
      assert.ok(Array.isArray(await page.evaluate(()=>JSON.parse(window.copiedEvaluation))));
      await page.getByPlaceholder('예: P1').fill('P2');
      await page.locator('.logbox').waitFor({state:'detached',timeout:2000});
      await page.getByPlaceholder('예: P1').fill('P1');
      await page.getByRole('button',{name:'복사',exact:true}).click();
      const downloadEvent=page.waitForEvent('download');
      await page.getByRole('button',{name:'JSON 저장',exact:true}).click();
      const download=await downloadEvent;
      assert.ok(download.suggestedFilename().startsWith('dinga-evaluation-P1-'));
      const exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
      assert.equal(exported.schemaVersion,1);
      assert.equal(JSON.parse(await page.locator('.logbox').inputValue()).schemaVersion,1);
      assert.ok(JSON.parse(await page.locator('.logbox').inputValue()).events.every(event=>event.pid==='P1'));
      assert.ok(exported.events.every(event=>event.pid==='P1'));
      assert.ok(exported.events.some(event=>event.reason==='noise'));
      assert.ok(exported.app.bundle===null||exported.app.bundle.endsWith('.js'));
      assert.equal(exported.settingsAtExport.judge,'mic');
      await page.getByLabel('파일 저장 범위').selectOption('all');
      const allEvent=page.waitForEvent('download');
      await page.getByRole('button',{name:'JSON 저장',exact:true}).click();
      const all=JSON.parse(fs.readFileSync(await (await allEvent).path(),'utf8'));
      assert.ok(all.events.some(event=>event.pid==='P2'));
      await page.evaluate(async()=>{
        const { logEvent, getLogStorageMode }=await import('/src/lib.js');
        const original=Storage.prototype.setItem;
        window.restoreEvaluationStorage=()=>{Storage.prototype.setItem=original;};
        Storage.prototype.setItem=function(key,value){if(key==='dinga-log') throw new DOMException('Full','QuotaExceededError');return original.call(this,key,value);};
        logEvent('export_probe',{reason:'memory-only'});
        if(getLogStorageMode()!=='memory') throw new Error('log persistence must be visible');
      });
      await page.getByRole('button',{name:'복사',exact:true}).click();
      await page.getByText(/기록이 이 창에만 남아 있어요/).waitFor();
      const memoryDownload=page.waitForEvent('download');
      await page.getByRole('button',{name:'JSON 저장',exact:true}).click();
      const memory=JSON.parse(fs.readFileSync(await (await memoryDownload).path(),'utf8'));
      assert.equal(memory.retention.storage,'memory');
      assert.ok(memory.events.some(event=>event.type==='export_probe'));
      await page.evaluate(async()=>{window.restoreEvaluationStorage();const lib=await import('/src/lib.js');lib.logEvent('export_recovered');});
      await page.evaluate(()=>{navigator.clipboard.writeText=()=>new Promise(()=>{});});
      await page.getByRole('button',{name:'복사',exact:true}).click();
      await page.getByText(/자동 복사를 완료하지 못했어요/).waitFor({timeout:3500});
      await page.getByRole('button',{name:'비우기',exact:true}).click();
      assert.equal(await page.locator('.logbox').count(),0);
      await page.waitForTimeout(200);
      assert.equal(await page.locator('.logbox').count(),0);
      await page.evaluate(()=>{navigator.clipboard.writeText=()=>new Promise(resolve=>{window.resolveEvaluationCopy=resolve;});});
      await page.getByRole('button',{name:'복사',exact:true}).click();
      await page.getByRole('button',{name:'비우기',exact:true}).click();
      await page.evaluate(()=>window.resolveEvaluationCopy());
      await page.waitForTimeout(100);
      assert.equal(await page.locator('.logbox').count(),0);
      assert.equal(await page.getByText('전체 행동 기록을 복사했어요.',{exact:true}).count(),0);
      await page.getByRole('button',{name:'복사',exact:true}).click();
      await page.getByRole('button',{name:'닫기',exact:true}).click();
      await page.evaluate(()=>window.resolveEvaluationCopy());
      await page.waitForTimeout(100);
      console.log('PASS explicit clipboard outcomes, manual fallback, participant/all JSON downloads and clear');
      await page.evaluate(()=>localStorage.setItem('dinga-log',JSON.stringify(new Array(4000).fill({t:'2026-11-12T10:00:00.000Z',pid:'P1',type:'open'}))));
      for(let i=0;i<3;i+=1) await page.mouse.click(345,18);
      await page.getByText(/최근 4000건까지 보관/).waitFor();
      const cappedEvent=page.waitForEvent('download');
      await page.getByRole('button',{name:'JSON 저장',exact:true}).click();
      const capped=JSON.parse(fs.readFileSync(await (await cappedEvent).path(),'utf8'));
      assert.equal(capped.retention.mayBeTruncated,true);
      assert.equal(capped.summary.eventCount,4000);
      console.log('PASS retention limit notice and 4000-event JSON export');
      await page.close();
    } finally {await browser.close();}
  } finally {await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
