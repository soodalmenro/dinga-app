const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } }); await server.listen();
  try {
    const browser = await chromium.launch({ channel: process.env.QA_BROWSER_CHANNEL, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        const d = new Date(); const date = [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
        localStorage.setItem('dinga-v1', JSON.stringify({ attendances: [{date,method:'manual'}], panel: { speed: 20, judge: 'allok', alert: 'real' }, resume: {lesson:'em',part:0,step:3} }));
        window.soak = { streams: [], contexts: [], locks: [], sends: 0, listeners: [] };
        const observe = target => {
          const records = new Map(); window.soak.listeners.push(records);
          const add = target.addEventListener.bind(target), remove = target.removeEventListener.bind(target);
          target.addEventListener = (type, callback, options) => { if (!records.has(type)) records.set(type, new Set()); records.get(type).add(callback); add(type,callback,options); };
          target.removeEventListener = (type, callback, options) => { records.get(type)?.delete(callback); remove(type,callback,options); };
        };
        const acquire = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = async constraints => { const stream = await acquire(constraints); observe(stream); stream.getTracks().forEach(observe); window.soak.streams.push(stream); return stream; };
        const NativeContext = window.AudioContext;
        window.AudioContext = class extends NativeContext {
          constructor(...args) { super(...args); observe(this); window.soak.contexts.push(this); }
          createMediaStreamSource(...args) { this.soakInput = true; return super.createMediaStreamSource(...args); }
        };
        window.Pose = class { setOptions() {} onResults(fn) {this.callback=fn;} async initialize() {} async close() {} async send() {window.soak.sends++;this.callback({poseLandmarks:[]});} };
        Object.defineProperty(navigator,'wakeLock',{configurable:true,value:{request:async()=>{const lock=new EventTarget();lock.released=false;lock.release=async()=>{lock.released=true;lock.dispatchEvent(new Event('release'));};window.soak.locks.push(lock);return lock;}}});
      });
      const button = name => page.getByRole('button',{name,exact:true});
      await page.goto('http://127.0.0.1:'+server.httpServer.address().port); await page.locator('.widget').click(); await page.locator('.splash').waitFor({state:'detached'});
      const assertReleased = async label => {
        await page.waitForFunction(() => window.soak.streams.every(s=>s.getTracks().every(t=>t.readyState==='ended')) && window.soak.contexts.filter(c=>c.soakInput).every(c=>c.state==='closed') && window.soak.locks.every(l=>l.released));
        const snapshot = await page.evaluate(async () => ({
          state: (await import('/src/lib.js')).mic.state,
          listeners: window.soak.listeners.reduce((n,types)=>n+[...types.values()].reduce((a,set)=>a+set.size,0),0),
          openContexts: window.soak.contexts.filter(c=>c.state!=='closed').length,
        }));
        assert.equal(snapshot.state,'idle',label); assert.equal(snapshot.listeners,0,label+' detached input listeners');
        assert.ok(snapshot.openContexts<=2,label+' only cached effects and one gesture-primed context may remain');
        const sends = await page.evaluate(()=>window.soak.sends); await page.waitForTimeout(350);
        assert.equal(await page.evaluate(()=>window.soak.sends),sends,label+' no inference after exit');
      };
      for(let i=0;i<4;i++) {
        await button('연습 환경 확인').click(); await button('마이크 확인하기').click(); await page.getByRole('heading',{name:'잠시 조용히 있어 주세요',exact:true}).waitFor();
        await button('카메라 확인하기').click(); await page.getByText('상체가 잘 보이지 않아요',{exact:true}).waitFor();
        await button('확인 마치기').click(); await assertReleased('setup '+i);
      }
      console.log('PASS four setup cycles release tracks, input contexts, observers and inference');
      for(let i=0;i<6;i++) {
        await button('이어서 연습하기 ›').click(); await page.waitForFunction(()=>document.querySelector('video.eye')?.readyState>=2);
        await page.waitForFunction(async()=>(await import('/src/lib.js')).mic.state==='on');
        const before = await page.evaluate(()=>window.soak.sends); await page.waitForFunction(n=>window.soak.sends>n,before);
        if(i%2===0) {
          await page.evaluate(()=>{const t=window.soak.streams.filter(s=>s.getAudioTracks().length).at(-1).getAudioTracks()[0];t.stop();t.dispatchEvent(new Event('ended'));});
          await page.getByRole('heading',{name:'마이크 연결이 끊겼어요',exact:true}).waitFor(); await button('마이크 다시 연결').click(); await button('연습 계속하기').click();
        }
        await button('나가기').click(); await page.locator('.sheet').getByRole('button',{name:'나가기',exact:true}).click();
        await button('홈').click(); await assertReleased('lesson '+i);
      }
      console.log('PASS six lesson exit/recovery cycles leave no active capture, observers, inference or wake lock');
      for(let i=1;i<=5;i++) {
        await button('MY').click(); await page.getByRole('button',{name:i===1?'곡 연습하러 가기':'한 번 더 연주하기',exact:true}).click();
        await page.getByRole('button',{name:/바로 시작/}).click(); await page.getByRole('heading',{name:'곡 연습 리포트',exact:true}).waitFor();
        await assertReleased('report '+i); await page.waitForTimeout(300);
        const stored = await page.evaluate(()=>({state:JSON.parse(localStorage.getItem('dinga-v1')), ends:JSON.parse(localStorage.getItem('dinga-log')).filter(e=>e.type==='songplay_end')}));
        assert.equal(stored.state.songPractice.count,i,'one completion per attempt'); assert.equal(stored.ends.length,i,'one terminal event per attempt');
        assert.equal(stored.state.songPractice.best,0,'simulations never set actual best');
        await button('완료').click();
      }
      console.log('PASS five complete song cycles increment once each and retain simulated provenance');
      assert.deepEqual(errors,[]); console.log('PASS fifteen UI cycles in one page without page errors; resource counters are not heap or device performance measurements');
    } finally { await browser.close(); }
  } finally { await server.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
