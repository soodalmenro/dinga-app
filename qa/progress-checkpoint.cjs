const assert=require('node:assert/strict');const{chromium}=require('playwright');
const button=(p,name)=>p.getByRole('button',{name,exact:true});
const state=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('dinga-v1')));
async function home(p){await p.locator('.widget').click();await p.locator('.splash').waitFor({state:'detached'});}
async function open(browser,url,seed={}){const context=await browser.newContext({viewport:{width:390,height:844}});const p=await context.newPage();await p.addInitScript(seed=>{
 const d=new Date();const date=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 if(!localStorage.getItem('dinga-v1'))localStorage.setItem('dinga-v1',JSON.stringify({attendances:[{date,method:'manual'}],panel:{speed:3,judge:'allok',alert:'off'},...seed}));
 navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError');};
 },seed);await p.route('**/__qa_previous',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Previous page</title><p>Previous page</p>'}));await p.goto(url+'/__qa_previous');await p.goto(url);if(seed.panel?.variant==='prd')await p.locator('.splash').waitFor({state:'detached'});else await home(p);return p;}
async function reload(p){const accept=d=>d.accept();p.on('dialog',accept);try{await p.reload();}finally{p.off('dialog',accept);}await home(p);}
async function startPart(p,n=0){await button(p,'학습').click();await button(p,'코스 이어하기').click();await p.locator('.sheet .card.lesson').nth(n).click();}
const guard=p=>p.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;});
(async()=>{const{createServer}=await import('vite');const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
 try{const browser=await chromium.launch({channel:process.env.QA_BROWSER_CHANNEL});
 try{const url='http://127.0.0.1:'+server.httpServer.address().port;let failures=0;
 for(const kind of process.env.QA_CHECKPOINT_CASES?.split(',')||['checkpoint','checkpoint-save-retry','completion-save-retry','complete-once','review','custom','course-song','lesson-unload','song-unload','transition-unload']){let p;
 try{
  const resume={lesson:'g',part:1,step:2};
  const seed=kind==='review'?{done:{em:[true,true,true]},resume}:kind==='custom'?{panel:{variant:'prd',speed:3},resume}:kind==='course-song'?{done:{em:[true,true,true],g:[true,true,true],c:[true,true,true]}}:['lesson-unload','complete-once'].includes(kind)?{done:{em:[true,false,false]},resume:{lesson:'em',part:0,step:3}}:kind==='transition-unload'?{ptab:'transition'}:{};
  p=await open(browser,url,seed);
  if(kind==='checkpoint'){
   await startPart(p);await button(p,'다음').click();await p.getByRole('button',{name:/^(건너뛰기|다음 단계로)$/}).click();/* S7: 첫 연주 앞 자세 촬영(카메라가 없으면 '다음 단계로') */await button(p,'다음').click();await button(p,'다음').click();await p.locator('.dots').waitFor();await p.waitForTimeout(100);
   assert.deepEqual((await state(p)).resume,{lesson:'em',part:0,step:3},'step is checkpointed without explicit exit');
   assert.deepEqual((await state(p)).history,{});await reload(p);await button(p,'이어서 연습하기 ›').click();await p.locator('.dots').waitFor();
   assert.equal((await state(p)).done.em[0],false);await button(p,'다음').click();await p.getByRole('heading',{name:'파트 완료!',exact:true}).waitFor();
   const complete=await state(p);assert.equal(complete.resume,null);assert.equal(complete.done.em[0],true);assert.equal(Object.values(complete.history).reduce((a,b)=>a+b,0),180);assert.equal(await guard(p),false);
   await reload(p);assert.equal((await state(p)).resume,null);assert.equal((await state(p)).done.em[0],true);assert.deepEqual((await state(p)).history,complete.history);
  }else if(kind==='checkpoint-save-retry'){
   await p.evaluate(()=>{window.checkpointSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='dinga-v1')throw new DOMException('Full','QuotaExceededError');return window.checkpointSetItem.call(this,key,value);};});
   await startPart(p);await button(p,'다음').click();await p.getByRole('button',{name:/^(건너뛰기|다음 단계로)$/}).click();/* S7: 첫 연주 앞 자세 촬영(카메라가 없으면 '다음 단계로') */await button(p,'다음').click();await button(p,'다음').click();await p.locator('.dots').waitFor();await button(p,'저장 다시 시도').waitFor();
   assert.equal((await state(p)).resume,null,'failed checkpoint does not claim a persisted position');
   await p.evaluate(()=>{Storage.prototype.setItem=window.checkpointSetItem;});/* 다음 자동 저장이 먼저 성공하면 알림이 사라질 수 있다 */if(await button(p,'저장 다시 시도').isVisible().catch(()=>false))await button(p,'저장 다시 시도').click({timeout:3000}).catch(()=>{});await p.waitForTimeout(300);
   assert.deepEqual((await state(p)).resume,{lesson:'em',part:0,step:3},'retry saves latest in-memory checkpoint');
   await reload(p);await button(p,'이어서 연습하기 ›').click();await p.locator('.dots').waitFor();
  }else if(kind==='completion-save-retry'){
   await startPart(p);await button(p,'다음').click();await p.getByRole('button',{name:/^(건너뛰기|다음 단계로)$/}).click();/* S7: 첫 연주 앞 자세 촬영(카메라가 없으면 '다음 단계로') */await button(p,'다음').click();await button(p,'다음').click();await p.locator('.dots').waitFor();
   await p.evaluate(()=>{window.checkpointSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='dinga-v1')throw new DOMException('Full','QuotaExceededError');return window.checkpointSetItem.call(this,key,value);};});
   await button(p,'다음').click();await p.getByRole('heading',{name:'파트 완료!',exact:true}).waitFor();await button(p,'저장 다시 시도').waitFor();await p.waitForTimeout(100);
   assert.equal(await guard(p),true,'unsaved completion retains unload protection');
   await p.evaluate(()=>{Storage.prototype.setItem=window.checkpointSetItem;});await button(p,'저장 다시 시도').click();await p.waitForTimeout(100);
   assert.equal(await guard(p),false,'persisted completion releases unload protection');assert.equal((await state(p)).done.em[0],true);assert.equal((await state(p)).resume,null);
  }else if(kind==='complete-once'){
   await button(p,'이어서 연습하기 ›').click();await p.locator('.dots').waitFor();await button(p,'다음').click();await p.getByRole('heading',{name:'파트 완료!',exact:true}).waitFor();
   const before=await state(p);await p.evaluate(()=>{window.dispatchEvent(new Event('dinga-skip'));window.dispatchEvent(new Event('dinga-skip'));});await p.waitForTimeout(100);
   assert.deepEqual((await state(p)).history,before.history,'completed screen cannot award time again');
   assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('dinga-log')).filter(e=>e.type==='part_done').length),1);
  }else if(kind==='review'){
   await button(p,'연습').click();await p.locator('.card').filter({hasText:'Em 코드'}).getByRole('button',{name:'연습하기',exact:true}).click();await p.locator('.dots').waitFor();await button(p,'다음').click();await p.waitForTimeout(100);
   assert.deepEqual((await state(p)).resume,resume,'review cannot replace course resume');
  }else if(kind==='custom'){
   await button(p,'연습').click();await p.locator('.card').filter({hasText:'Em ↔ G'}).getByRole('button',{name:'연습하기',exact:true}).click();await p.waitForTimeout(150);
   assert.deepEqual((await state(p)).resume,resume,'custom transition cannot replace course resume');
  }else if(kind==='course-song'){
   await startPart(p,2);await p.locator('.sp-bar').first().waitFor();await p.waitForTimeout(100);
   assert.deepEqual((await state(p)).resume,{lesson:'song',part:2,step:0},'course song handoff retains a checkpoint');
   await reload(p);await button(p,'이어서 연습하기 ›').click();await p.locator('.sp-bar').first().waitFor();assert.equal((await state(p)).songPractice.count,0);assert.deepEqual((await state(p)).history,{});
  }else{
   if(kind==='lesson-unload'){await button(p,'이어서 연습하기 ›').click();await p.locator('.dots').waitFor();}
   else if(kind==='song-unload'){await button(p,'MY').click();await button(p,'곡 연습하러 가기').click();assert.equal(await guard(p),false,'waiting song has no unfinished result');await p.getByRole('button',{name:/바로 시작/}).click();}
   else{await button(p,'연습').click();await button(p,'연습하기').first().click();await button(p,'시작하기').click();}
   await p.waitForTimeout(100);assert.equal(await guard(p),true,'unfinished practice registers unload protection');
   const activation=await p.evaluate(()=>navigator.userActivation.hasBeenActive);
   let listener;const dialogEvent=new Promise(resolve=>{listener=d=>resolve(d);p.on('dialog',listener);});
   await p.close({runBeforeUnload:true});const dialog=await Promise.race([dialogEvent,new Promise(resolve=>setTimeout(()=>resolve(null),2500))]);
   assert.ok(dialog,'actual browser prompts before closing active practice (activation='+activation+',closed='+p.isClosed()+')');assert.equal(dialog.type(),'beforeunload');
   if(kind==='lesson-unload')await new Promise(resolve=>setTimeout(resolve,2500));
   await dialog.dismiss();p.off('dialog',listener);assert.equal(p.isClosed(),false);
   if(kind==='lesson-unload'){
    let backListener;const backDialog=new Promise(resolve=>{backListener=d=>resolve(d);p.on('dialog',backListener);});const back=p.goBack({timeout:5000}).catch(()=>null);
    const confirm=await Promise.race([backDialog,new Promise(resolve=>setTimeout(()=>resolve(null),2500))]);assert.ok(confirm,'browser Back prompts before leaving unfinished lesson');await confirm.dismiss();p.off('dialog',backListener);await back;
    assert.equal(new URL(p.url()).pathname,'/','canceling Back keeps current lesson');
   }
   await button(p,kind==='lesson-unload'?'나가기':kind==='song-unload'?'곡 연습 나가기':'전환 연습 나가기').click();await p.locator('.sheet').getByRole('button',{name:'나가기',exact:true}).click();
   await p.waitForTimeout(100);assert.equal(await guard(p),false,'explicit exit removes unload listener');
   if(kind==='lesson-unload'){
    const timeline=await p.evaluate(()=>{const log=JSON.parse(localStorage.getItem('dinga-log'));return{step:log.find(e=>e.type==='step'),exit:log.filter(e=>e.type==='exit').at(-1)};});
    const observed=(Date.parse(timeline.exit.t)-Date.parse(timeline.step.t))/1000*3;
    assert.ok(timeline.exit.seconds<=Math.ceil(observed-7.5)+1,`native dialog time excluded (${timeline.exit.seconds} vs total ${observed})`);
   }
  }
  console.log('PASS checkpoint/unload '+kind);
 }catch(error){failures++;console.error('FAIL '+kind+': '+error.message);}finally{if(p)await p.context().close();}}
 if(failures)process.exitCode=1;
 }finally{await browser.close();}}finally{await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
