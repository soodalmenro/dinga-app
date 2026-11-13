const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const duration=Number(process.env.QA_SOAK_MS||300000);assert.ok(Number.isFinite(duration)&&duration>=60000&&duration<=1800000);
  const {createServer}=await import('vite');const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
  try{
    const browser=await chromium.launch({channel:process.env.QA_BROWSER_CHANNEL,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
    try{
      const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(()=>{
        const d=new Date();const date=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
        localStorage.setItem('dinga-v1',JSON.stringify({attendances:[{date,method:'manual'}],panel:{alert:'real'},resume:{lesson:'em',part:0,step:1}}));
        window.steady={streams:[],contexts:[],models:0,sends:0,inFlight:0,maximum:0};
        const acquire=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia=async c=>{const st=await acquire(c);window.steady.streams.push(st);return st;};
        const Native=window.AudioContext;window.AudioContext=class extends Native{constructor(...args){super(...args);window.steady.contexts.push(this);}createMediaStreamSource(...args){this.steadyInput=true;return super.createMediaStreamSource(...args);}};
        window.Pose=class{constructor(){window.steady.models++;}setOptions(){}onResults(fn){this.callback=fn;}async initialize(){}async close(){}async send(){const s=window.steady;s.inFlight++;s.maximum=Math.max(s.maximum,s.inFlight);s.sends++;try{this.callback({poseLandmarks:[]});}finally{s.inFlight--;}}};
      });
      await page.goto('http://127.0.0.1:'+server.httpServer.address().port);await page.locator('.widget').click();await page.locator('.splash').waitFor({state:'detached'});
      await page.getByRole('button',{name:'이어서 연습하기 ›',exact:true}).click();await page.waitForFunction(()=>window.steady.sends>0);
      // Keep the stage open while retaining real capture and analyser reads; this is a resource soak, not an audio accuracy test.
      await page.evaluate(async()=>{const{mic}=await import('/src/lib.js');const read=mic.level.bind(mic);mic.level=()=>{read();return 0;};});
      let previous=0;const start=Date.now();
      while(Date.now()-start<duration){
        await page.waitForTimeout(Math.min(30000,duration-(Date.now()-start)));
        const snapshot=await page.evaluate(()=>({streams:window.steady.streams.length,live:window.steady.streams.flatMap(s=>s.getTracks()).filter(t=>t.readyState==='live').length,models:window.steady.models,sends:window.steady.sends,maximum:window.steady.maximum,contexts:window.steady.contexts.filter(c=>c.steadyInput&&c.state!=='closed').length,ends:JSON.parse(localStorage.getItem('dinga-log')).filter(e=>e.type==='part_done').length}));
        assert.equal(snapshot.streams,2);assert.equal(snapshot.live,2);assert.equal(snapshot.models,1);assert.equal(snapshot.maximum,1);assert.equal(snapshot.contexts,1);assert.equal(snapshot.ends,0);assert.ok(snapshot.sends>previous);previous=snapshot.sends;
        console.log('PASS steady '+Math.round((Date.now()-start)/1000)+'s '+JSON.stringify(snapshot));assert.deepEqual(errors,[]);
      }
      await page.getByRole('button',{name:'나가기',exact:true}).click();await page.locator('.sheet').getByRole('button',{name:'나가기',exact:true}).click();
      await page.waitForFunction(()=>window.steady.streams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))&&window.steady.contexts.filter(c=>c.steadyInput).every(c=>c.state==='closed'));
      const sends=await page.evaluate(()=>window.steady.sends);await page.waitForTimeout(600);assert.equal(await page.evaluate(()=>window.steady.sends),sends);
      assert.deepEqual(errors,[]);console.log('PASS real-time resource soak '+duration+'ms and final release; excludes physical-device heat, heap profiling and recognition accuracy');
    }finally{await browser.close();}
  }finally{await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
