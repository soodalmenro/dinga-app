const assert=require('node:assert/strict');const{chromium}=require('playwright');
const button=(p,name)=>p.getByRole('button',{name,exact:true});
async function panel(p){await p.evaluate(()=>{for(let i=0;i<3;i++)window.dispatchEvent(new PointerEvent('pointerdown',{clientX:375,clientY:18,bubbles:true}));});await p.getByRole('heading',{name:'평가 패널',exact:true}).waitFor();}
async function open(browser,url,state,allowAudio=false){const p=await browser.newPage({viewport:{width:390,height:844}});await p.addInitScript(({state,allowAudio})=>{
 const d=new Date();const date=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 localStorage.setItem('dinga-v1',JSON.stringify({attendances:[{date,method:'manual'}],panel:{speed:3,judge:'allok',alert:'off'},...state}));
 window.panelStreams=[];window.panelSends=0;window.Pose=class{setOptions(){}onResults(fn){this.callback=fn;}async initialize(){}async close(){}async send(){window.panelSends++;this.callback({poseLandmarks:[]});}};
 const acquire=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async c=>{if(c.audio&&!allowAudio)throw new DOMException('Denied','NotAllowedError');const st=await acquire(c);window.panelStreams.push(st);return st;};
 },{state,allowAudio});await p.goto(url);if(state.panel?.variant!=='prd')await p.locator('.widget').click();await p.locator('.splash').waitFor({state:'detached'});return p;}
(async()=>{const{createServer}=await import('vite');const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
 try{const browser=await chromium.launch({channel:process.env.QA_BROWSER_CHANNEL,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 try{let failures=0;const url='http://127.0.0.1:'+server.httpServer.address().port;
 const kinds=process.env.QA_PANEL_CASES?.split(',')||['twelve','eight','capture','attendance','setup','twelve-rate','eight-rate','twelve-rate-early','eight-rate-early'];
 for(const kind of kinds){let p;
 try{
  const twelve=kind.startsWith('twelve');
  p=await open(browser,url,kind==='capture'?{panel:{variant:'prd',speed:1},resume:{lesson:'em',part:0,step:0}}:kind.startsWith('eight')?{ptab:'transition'}:kind==='attendance'?{attendances:[],panel:{speed:1}}:{},['attendance','setup'].includes(kind));
  if(kind==='attendance'){
   await button(p,'출석하기').click();await p.waitForFunction(async()=>(await import('/src/lib.js')).mic.state==='on');
   await p.evaluate(async()=>{/* 출석은 소리 크기가 아니라 코드 인식으로 센다(11/18). 코드가 들리는 상태를 흉내 낸다 */await import('/src/guitarEar.js');window.dingaEar.status=()=>'ready';window.dingaEar.hearing=()=>(window.panelAmplitude||0)>0;window.panelAmplitude=.2;});await p.waitForTimeout(650);await panel(p);
   const before=await p.getByText(/듣고 있어요 ·/).innerText();await p.waitForTimeout(2500);
   assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('dinga-v1')).attendances.length),0,'panel sound cannot complete attendance');
   assert.equal(await p.getByText(/듣고 있어요 ·/).innerText(),before,'observed sound remains stable behind panel');
   await p.evaluate(()=>{window.panelAmplitude=0;});await button(p,'닫기').click();assert.equal(await p.getByText(/듣고 있어요 ·/).innerText(),before,'panel close preserves prior observed sound');
   await p.evaluate(()=>{window.panelAmplitude=.2;});await p.getByRole('heading',{name:'출석 완료!',exact:true}).waitFor();
   assert.ok(await p.evaluate(()=>window.panelStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))),'sound attendance releases microphone at completion');
   await panel(p);await p.waitForTimeout(2500);assert.equal(await p.getByRole('heading',{name:'출석 완료!',exact:true}).count(),1,'panel pauses completion navigation');
   await button(p,'닫기').click();await p.getByRole('heading',{name:'출석 완료!',exact:true}).waitFor({state:'detached'});
  }else if(kind==='setup'){
   await button(p,'연습 환경 확인').click();await panel(p);await button(p,'닫기').click();
   assert.equal(await button(p,'마이크 확인하기').count(),1,'idle microphone check remains idle');assert.equal(await button(p,'카메라 확인하기').count(),1,'idle camera check remains idle');
   await button(p,'마이크 확인하기').click();await p.getByRole('heading',{name:'잠시 조용히 있어 주세요',exact:true}).waitFor();
   await button(p,'카메라 확인하기').click();await p.waitForFunction(()=>window.panelSends>0);await panel(p);
   await p.waitForTimeout(300);assert.ok(await p.evaluate(()=>window.panelStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))),'panel cancels preparation captures');
   const sends=await p.evaluate(()=>window.panelSends);await button(p,'닫기').click();await p.waitForTimeout(600);assert.equal(await p.evaluate(()=>window.panelSends),sends,'preparation needs explicit retry');
   await button(p,'카메라 다시 확인').click();await p.waitForFunction(n=>window.panelSends>n,sends);
  }else if(kind==='capture'){
   await button(p,'이어서 연습하기').click();await p.waitForFunction(()=>document.querySelector('.cam video')?.readyState>=2);await button(p,'촬영 (3초 뒤)').click();
   await panel(p);const before=await p.locator('.cam .count').innerText();await p.waitForTimeout(3500);
   assert.equal(await p.evaluate(()=>document.querySelector('.cam .count')?.textContent),before,'capture must stop behind panel');await button(p,'닫기').click();await button(p,'연습 시작').waitFor();
  }else{
   if(twelve){await button(p,'MY').click();await button(p,'곡 연습하러 가기').click();await p.getByRole('button',{name:/바로 시작/}).click();}
   else{await button(p,'연습').click();await button(p,'연습하기').first().click();await button(p,'시작하기').click();}
   const bars=twelve?'.sp-bar.ok':'.bars .bar.ok';if(kind.endsWith('-early'))await p.waitForTimeout(250);else await p.locator(bars).first().waitFor();await panel(p);
   const before=await p.locator(bars).count();
   if(kind.includes('-rate')){
    await p.locator('.panel-row',{hasText:'속도'}).locator('select').selectOption('1');await button(p,'닫기').click();await p.waitForTimeout(250);
    const all=twelve?'.sp-bar':'.bars .bar';assert.equal(await p.evaluate(all=>[...document.querySelectorAll(all)].findIndex(el=>el.classList.contains('now')),all),before,'rate change must replay unfinished bar without revisiting completed bars');
    assert.equal(await p.evaluate(type=>JSON.parse(localStorage.getItem('dinga-log')).filter(e=>e.type===type).length,twelve?'songplay_start':'song_start'),1,'rate restart must not duplicate attempt start');
    console.log('PASS evaluation rate change preserves completed '+kind);continue;
   }
   await p.waitForTimeout(4500);assert.equal(await p.locator(bars).count(),before,'practice must not advance behind panel');
   await button(p,'닫기').click();await p.waitForFunction(({bars,before})=>document.querySelectorAll(bars).length>before,{bars,before});
  }
  console.log('PASS evaluation panel pauses and resumes '+kind);
 }catch(error){failures++;console.error('FAIL '+kind+': '+error.message);}finally{await p?.close();}}
 if(failures)process.exitCode=1;
 }finally{await browser.close();}}finally{await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
