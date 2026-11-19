const assert=require('node:assert/strict');
const {chromium}=require('playwright');
async function open(browser,url,state={}){
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.addInitScript(state=>{
  const d=new Date();const date=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  localStorage.setItem('dinga-v1',JSON.stringify({attendances:[{date,method:'manual'}],panel:{speed:4,alert:'off',judge:'allok'},...state}));
  window.mediaTests={audioMode:'allow',audio:[],video:[],wake:[]};
  const acquire=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia=constraints=>{
   const get=async()=>{const stream=await acquire(constraints);window.mediaTests[constraints.audio?'audio':'video'].push(stream);return stream;};
   if(constraints.audio&&window.mediaTests.audioMode==='deny')return Promise.reject(new DOMException('Denied','NotAllowedError'));
   if(constraints.audio&&window.mediaTests.audioMode==='defer')return new Promise(resolve=>{window.releaseRecoveryMic=async()=>resolve(await get());});
   return get();
  };
  const NativeContext=window.AudioContext;
  window.AudioContext=class extends NativeContext{createMediaStreamSource(...args){window.mediaTests.microphoneContext=this;return super.createMediaStreamSource(...args);}};
  Object.defineProperty(navigator,'wakeLock',{configurable:true,value:{request:async()=>{const lock=new EventTarget();lock.released=false;lock.release=async()=>{lock.released=true;lock.dispatchEvent(new Event('release'));};window.mediaTests.wake.push(lock);return lock;}}});
 },state);
 await page.goto(url);await page.locator('.widget').click();await page.locator('.splash').waitFor({state:'detached'});
 await page.evaluate(async()=>{const{mic}=await import('/src/lib.js');mic.level=()=>window.testAmplitude||0;});
 return page;
}
const button=(page,name)=>page.getByRole('button',{name,exact:true});
const endAudio=page=>page.evaluate(()=>{const track=window.mediaTests.audio.at(-1).getAudioTracks()[0];track.stop();track.dispatchEvent(new Event('ended'));});
(async()=>{
 const{createServer}=await import('vite');const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
 try{
  const browser=await chromium.launch({channel:process.env.QA_BROWSER_CHANNEL,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
  try{
   const url='http://127.0.0.1:'+server.httpServer.address().port;
   let page=await open(browser,url,{resume:{lesson:'em',part:1,step:0}});
   try{
    await button(page,'이어서 연습하기 ›').click();await page.waitForFunction(async()=>(await import('/src/lib.js')).mic.state==='on');
    await page.waitForFunction(()=>window.mediaTests.audio.length>0,{},{timeout:2000});
    await endAudio(page);
    await page.getByRole('heading',{name:'마이크 연결이 끊겼어요',exact:true}).waitFor({timeout:2500});
    await button(page,'마이크 다시 연결').click();await button(page,'연습 계속하기').waitFor();
    for(let i=0;i<4;i++){await page.evaluate(()=>{window.testAmplitude=.2;});await page.waitForTimeout(100);await page.evaluate(()=>{window.testAmplitude=0;});await page.waitForTimeout(100);}
    assert.equal(await page.locator('.dots i.on').count(),0,'reconnected input cannot advance before explicit continue');
    await button(page,'연습 계속하기').click();
    for(let i=0;i<4;i++){await page.evaluate(()=>{window.testAmplitude=.2;});await page.waitForTimeout(100);await page.evaluate(()=>{window.testAmplitude=0;});await page.waitForTimeout(100);}
    await page.waitForFunction(()=>document.querySelectorAll('.dots i.on').length===4);
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.lossHidden||false});window.lossHidden=true;document.dispatchEvent(new Event('visibilitychange'));});
    await page.evaluate(()=>window.mediaTests.microphoneContext.suspend());
    await page.getByRole('heading',{name:'마이크 연결이 끊겼어요',exact:true}).waitFor();
    await page.evaluate(()=>{window.lossHidden=false;document.dispatchEvent(new Event('visibilitychange'));});
    await page.evaluate(()=>{window.mediaTests.audioMode='defer';});
    await button(page,'마이크 다시 연결').click();await button(page,'마이크 없이 계속하기').click();
    assert.equal(await page.getByRole('heading',{name:'연습을 잠시 멈췄어요',exact:true}).count(),0,'one explicit recovery choice should also acknowledge the visibility pause');
    await page.evaluate(()=>window.releaseRecoveryMic());await page.waitForTimeout(150);
    assert.equal(await page.evaluate(async()=>(await import('/src/lib.js')).mic.state),'idle');
    assert.ok(await page.evaluate(()=>window.mediaTests.audio.at(-1).getTracks().every(t=>t.readyState==='ended')));
    // 11/18 미니카메라 삭제: 자세 알림이 '실제 판정'이 아니면 레슨 중 카메라를 켜지 않는다(카메라 재연결은 pose-reliability가 본다)
    await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>window.mediaTests.video.length),0,'no camera stream during lesson play');
    console.log('PASS lesson track/context loss, explicit resume, late retry cancellation, no lesson camera');
   }finally{await page.close();}
   page=await open(browser,url);
   try{
    await button(page,'MY').click();await button(page,'곡 연습하러 가기').click();
    await page.waitForFunction(async()=>(await import('/src/lib.js')).mic.state==='on');
    await page.evaluate(async()=>{const{mic,content}=await import('/src/lib.js');mic.level=()=>document.querySelector('.sp-beat i')?.classList.contains('on') ? 0.2 : 0;mic.chroma=()=>{const name=document.querySelector('.sp-bar.now b')?.textContent.trim()||'Em';return Array.from({length:12},(_,i)=>content.chordNotes[name].includes(i)?1:0);};});
    await page.getByRole('button',{name:/바로 시작/}).click();await page.locator('.sp-bar.ok').first().waitFor();
    const completed=await page.locator('.sp-bar.ok').count();await page.waitForTimeout(400);await endAudio(page);
    await page.getByRole('heading',{name:'마이크 연결이 끊겼어요',exact:true}).waitFor();await page.waitForTimeout(2200);
    assert.equal(await page.locator('.sp-bar.ok').count(),completed);
    await page.evaluate(()=>{window.mediaTests.audioMode='deny';});await button(page,'마이크 다시 연결').click();
    await button(page,'마이크 다시 연결').waitFor({state:'visible'});await page.waitForTimeout(150);
    assert.equal(await page.locator('.sp-bar.ok').count(),completed);
    await page.evaluate(()=>{window.mediaTests.audioMode='allow';});await button(page,'마이크 다시 연결').click();await button(page,'연습 계속하기').waitFor();
    await page.waitForTimeout(1000);assert.equal(await page.locator('.sp-bar.ok').count(),completed);
    await button(page,'연습 계속하기').click();await page.getByRole('heading',{name:'곡 연습 리포트',exact:true}).waitFor();
    const result=await page.evaluate(()=>JSON.parse(localStorage.getItem('dinga-v1')).songPractice.last);
    assert.equal(result.complete,true);assert.ok(result.score>=90);
    console.log('PASS twelve-bar recovery preserves completed bars, rejects failed retry and replays unfinished bar');
   }finally{await page.close();}
   // 마이크 판정은 진짜 코드 소리가 필요해서(실제 소리 검사가 따로 본다) 여기서는 소리 크기로 세는 모의 판정(random)으로 끊김 복구만 본다
   page=await open(browser,url,{ptab:'transition',panel:{speed:12,alert:'off',judge:'random'}});
   try{
    await button(page,'연습').click();await page.getByRole('button',{name:'연습하기',exact:true}).first().click();
    await page.waitForFunction(async()=>(await import('/src/lib.js')).mic.state==='on');await page.evaluate(()=>{window.testAmplitude=.2;});
    await page.locator('.bars .bar.ok, .bars .bar.late, .bars .bar.none').first().waitFor();await endAudio(page);
    await page.getByRole('heading',{name:'마이크 연결이 끊겼어요',exact:true}).waitFor();await button(page,'마이크 없이 계속하기').click();
    await button(page,'시작하기').waitFor();assert.equal(await page.locator('.bars .bar.ok, .bars .bar.late, .bars .bar.none').count(),0);
    await page.getByText('모의 판정으로 진행해요',{exact:true}).waitFor();await button(page,'시작하기').click();
    await page.getByRole('heading',{name:'전환 연습 결과',exact:true}).waitFor();
    const result=await page.evaluate(()=>JSON.parse(localStorage.getItem('dinga-v1')).song.last);assert.equal(result.judge,'random');assert.equal(result.bars.length,8);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('dinga-log')).filter(e=>e.type==='song_start').length),2,'explicit simulation conversion starts a new attempt');
    console.log('PASS eight-bar no-mic recovery restarts with explicit simulated provenance');
   }finally{await page.close();}
   page=await open(browser,url,{resume:{lesson:'em',part:1,step:0}});
   try{
    await button(page,'이어서 연습하기 ›').click();await page.waitForFunction(()=>window.mediaTests.wake.length>0);
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.wakeHidden||false});window.wakeHidden=true;document.dispatchEvent(new Event('visibilitychange'));});
    await page.waitForFunction(()=>window.mediaTests.wake[0].released);
    await page.evaluate(()=>{window.wakeHidden=false;document.dispatchEvent(new Event('visibilitychange'));});
    await page.waitForFunction(()=>window.mediaTests.wake.length>=2);
    await button(page,'계속 연습하기').click();
    console.log('PASS active practice releases and reacquires screen wake lock across visibility');
   }finally{await page.close();}
   page=await open(browser,url);
   try{
    await page.evaluate(async()=>{
     const React=(await import('/node_modules/.vite/deps/react.js')).default;
     const ReactDOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
     const{usePracticePause}=await import('/src/usePracticePause.js');
     const host=document.createElement('div');document.body.appendChild(host);
     function Probe(){const pause=usePracticePause();window.readRecoveryPause=()=>({at:pause.pausedAt.current,paused:pause.pauseRef.current});window.resumeRecoveryPause=pause.resume;return null;}
     window.pauseProbeRoot=ReactDOM.createRoot(host);window.pauseProbeRoot.render(React.createElement(Probe));
    });
    await page.waitForFunction(()=>!!window.readRecoveryPause);
    const paused=await page.evaluate(async()=>{
     const original=Date.now;let time=1000;Date.now=()=>time;
     Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.recoveryHidden||false});
     window.recoveryHidden=true;document.dispatchEvent(new Event('visibilitychange'));await new Promise(r=>setTimeout(r,50));
     time=5000;document.dispatchEvent(new Event('visibilitychange'));const state=window.readRecoveryPause();
     window.recoveryHidden=false;document.dispatchEvent(new Event('visibilitychange'));window.resumeRecoveryPause();Date.now=original;return state;
    });
    assert.deepEqual(paused,{at:1000,paused:true});
    console.log('PASS repeated hidden events preserve the first pause timestamp');
   }finally{await page.close();}
  }finally{await browser.close();}
 }finally{await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
