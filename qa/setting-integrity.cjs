const assert=require('node:assert/strict');const{chromium}=require('playwright');
const button=(p,name)=>p.getByRole('button',{name,exact:true});
const state=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('dinga-v1')));
async function panel(p){await p.evaluate(()=>{for(let i=0;i<3;i++)window.dispatchEvent(new PointerEvent('pointerdown',{clientX:375,clientY:18,bubbles:true}));});await p.getByRole('heading',{name:'평가 패널',exact:true}).waitFor();}
async function open(browser,url,variant,step,patch={}){const context=await browser.newContext({viewport:{width:390,height:844}});const p=await context.newPage();p.on('dialog',d=>d.accept());await p.addInitScript(({variant,step,patch})=>{
 const d=new Date();const date=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 if(!localStorage.getItem('dinga-v1'))localStorage.setItem('dinga-v1',JSON.stringify({attendances:[{date,method:'manual'}],panel:{variant,pid:'P1',alert:'off',judge:'allok',speed:3},resume:{lesson:'em',part:1,step},...patch}));
 navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError');};
 },{variant,step,patch});await p.goto(url);if(variant==='idea')await p.locator('.widget').click();await p.locator('.splash').waitFor({state:'detached'});return p;}
(async()=>{const{createServer}=await import('vite');const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
 try{const browser=await chromium.launch({channel:process.env.QA_BROWSER_CHANNEL});
 try{const url='http://127.0.0.1:'+server.httpServer.address().port;let failures=0;
 for(const kind of process.env.QA_SETTING_CASES?.split(',')||['idea-prd','prd-idea','active-variant','active-pid','song-lock','transition-lock','attendance-lock','setup-lock']){let p;
 try{
  const from=kind==='prd-idea'?'prd':'idea',step=from==='prd'?1:0; p=await open(browser,url,from,step,kind==='attendance-lock'?{attendances:[]}:{});
  const variant=()=>p.locator('.panel-row',{hasText:'화면 구성'}).locator('select');const pid=()=>p.getByPlaceholder('예: P1');
  if(kind.startsWith('active')){
   await p.getByRole('button',{name:/이어서 연습하기/}).click();await p.locator('.dots').waitFor();await panel(p);
   if(kind==='active-variant')assert.equal(await variant().isDisabled(),true,'active lesson cannot change its screen schema');
   else assert.equal(await pid().isDisabled(),true,'active attempt cannot change participant attribution');
   assert.equal(await p.locator('.panel-row',{hasText:'자세 알림'}).locator('select').first().isEnabled(),true,'posture evaluation controls remain usable');
   if(kind==='active-pid'){await p.locator('.panel-row',{hasText:'전체 행동 기록'}).getByRole('button',{name:'비우기',exact:true}).click();await p.getByText('전체 행동 기록 (0건)',{exact:true}).waitFor();}
   await button(p,'닫기').click();await button(p,'나가기').click();await p.locator('.sheet').getByRole('button',{name:'나가기',exact:true}).click();
   await button(p,'홈').click();await panel(p);assert.equal(await pid().isEnabled(),true);assert.equal(await variant().isEnabled(),true);
  }else if(kind.endsWith('-lock')){
   if(kind==='song-lock'){await button(p,'MY').click();await button(p,'곡 연습하러 가기').click();await p.locator('.sp-bar').first().waitFor();}
   if(kind==='transition-lock'){await button(p,'연습').click();await button(p,'코드 전환').click();await button(p,'연습하기').first().click();await p.locator('.bars .bar').first().waitFor();}
   if(kind==='attendance-lock'){await button(p,'출석하기').click();await button(p,'출석 화면 닫기').waitFor();}
   if(kind==='setup-lock')await button(p,'연습 환경 확인').click();
   await panel(p);assert.equal(await pid().isDisabled(),true);assert.equal(await variant().isDisabled(),true);assert.equal(await button(p,'JSON 저장').isEnabled(),true,'record export remains available');await button(p,'닫기').click();
   if(kind==='song-lock'||kind==='transition-lock'){await button(p,kind==='song-lock'?'곡 연습 나가기':'전환 연습 나가기').click();await p.locator('.sheet').getByRole('button',{name:'나가기',exact:true}).click();await button(p,'홈').click();}
   else await button(p,kind==='setup-lock'?'확인 마치기':'출석 화면 닫기').click();
   await panel(p);assert.equal(await pid().isEnabled(),true);assert.equal(await variant().isEnabled(),true);
  }else{
   await panel(p);const to=from==='idea'?'prd':'idea';await variant().selectOption(to);const expected=to==='prd'?1:0;
   await p.waitForTimeout(100);assert.deepEqual((await state(p)).resume,{lesson:'em',part:1,step:expected},'variant change preserves the same play step');
   assert.deepEqual((await state(p)).history,{});assert.equal((await state(p)).done.em[0],false);
   await pid().fill('P7');await p.waitForFunction(()=>JSON.parse(localStorage.getItem('dinga-v1')).panel.pid==='P7');assert.equal((await state(p)).panel.pid,'P7');await button(p,'닫기').click();await p.reload();
   if(to==='idea')await p.locator('.widget').click();await p.locator('.splash').waitFor({state:'detached'});
   await p.getByRole('button',{name:/이어서 연습하기/}).click();await p.locator('.dots').waitFor();
   assert.deepEqual((await state(p)).resume,{lesson:'em',part:1,step:expected});
  }
  console.log('PASS setting integrity '+kind);
 }catch(error){failures++;console.error('FAIL '+kind+': '+error.message);}finally{if(p)await p.context().close();}}
 if(failures)process.exitCode=1;
 }finally{await browser.close();}}finally{await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
