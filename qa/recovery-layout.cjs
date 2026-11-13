const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const {createServer} = await import('vite'); const server = await createServer({server:{host:'127.0.0.1',port:0}}); await server.listen();
  try {
    const browser = await chromium.launch({channel:process.env.QA_BROWSER_CHANNEL,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
    try {
      for (const [width,height,scale] of [[320,568,1.5],[844,390,1],[568,320,1.5]]) {
        const page = await browser.newPage({viewport:{width,height}}); const errors=[];page.on('pageerror',e=>errors.push(e.message));
        try {
          await page.addInitScript(()=>{
            const d=new Date();const date=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
            localStorage.setItem('dinga-v1',JSON.stringify({attendances:[{date,method:'manual'}],panel:{alert:'off'},resume:{lesson:'em',part:0,step:1}}));
            const acquire=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
            navigator.mediaDevices.getUserMedia=async c=>{if(!c.audio)throw new DOMException('Denied','NotAllowedError');const st=await acquire(c);window.layoutAudio=st;return st;};
          });
          await page.goto('http://127.0.0.1:'+server.httpServer.address().port);await page.locator('.widget').click();await page.locator('.splash').waitFor({state:'detached'});
          await page.getByRole('button',{name:'이어서 연습하기 ›',exact:true}).click();await page.waitForFunction(()=>!!window.layoutAudio);
          await page.evaluate(()=>{const t=window.layoutAudio.getAudioTracks()[0];t.stop();t.dispatchEvent(new Event('ended'));});
          await page.getByRole('heading',{name:'마이크 연결이 끊겼어요',exact:true}).waitFor();
          if(scale!==1)await page.evaluate(scale=>{
            const sizes=[...document.querySelectorAll('.sheet h1,.sheet h2,.sheet .sub,.sheet button')].map(el=>[el,parseFloat(getComputedStyle(el).fontSize)*scale]);
            sizes.forEach(([el,size])=>el.style.fontSize=size+'px');
          },scale);
          const sheet=page.getByRole('dialog');assert.ok(await sheet.evaluate(el=>el.scrollWidth-el.clientWidth<=1),'no recovery dialog horizontal clipping');
          if(process.env.QA_SCREENSHOT_DIR){await page.waitForTimeout(250);await page.screenshot({path:require('node:path').join(process.env.QA_SCREENSHOT_DIR,`recovery-${width}-${height}.png`)});}
          await page.getByRole('button',{name:'마이크 다시 연결',exact:true}).click();
          await page.getByRole('button',{name:'연습 계속하기',exact:true}).click();
          await page.getByRole('heading',{name:'마이크를 다시 연결했어요',exact:true}).waitFor({state:'detached'});
          assert.deepEqual(errors,[]);console.log(`PASS recovery ${width}x${height}, dialog text ${scale*100}%, retry and continue operable`);
        }finally{await page.close();}
      }
    }finally{await browser.close();}
  }finally{await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
