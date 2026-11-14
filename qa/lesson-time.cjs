const assert=require('node:assert/strict');const{chromium}=require('playwright');
const btn=(p,name)=>p.getByRole('button',{name,exact:true});
const advance=(p,ms)=>p.evaluate(ms=>{window.lessonClock+=ms;},ms);
async function panel(p){await p.evaluate(()=>{for(let i=0;i<3;i++)window.dispatchEvent(new PointerEvent('pointerdown',{clientX:375,clientY:18,bubbles:true}));});await p.getByRole('heading',{name:'평가 패널',exact:true}).waitFor();}
async function rate(p,value){await panel(p);await p.locator('.panel-row',{hasText:'속도'}).locator('select').selectOption(String(value));await btn(p,'닫기').click();}
(async()=>{const{createServer}=await import('vite');const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
 try{const browser=await chromium.launch({channel:process.env.QA_BROWSER_CHANNEL});try{let failures=0;
 for(const kind of ['slow-down','speed-up','segments','paused','native-wait','threshold-save','threshold-discard']){const context=await browser.newContext({viewport:{width:390,height:844}});const p=await context.newPage();
 try{await p.addInitScript(speed=>{const d=new Date();const date=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');localStorage.setItem('dinga-v1',JSON.stringify({attendances:[{date,method:'manual'}],panel:{speed,alert:'off'},resume:{lesson:'em',part:0,step:0}}));window.lessonClock=Date.now();Date.now=()=>window.lessonClock;},kind==='speed-up'?1:3);
 await p.goto('http://127.0.0.1:'+server.httpServer.address().port);await p.locator('.widget').click();await p.locator('.splash').waitFor({state:'detached'});await btn(p,'이어서 연습하기 ›').click();await btn(p,'다음').waitFor();
 let expected;
 if(kind==='slow-down'){await advance(p,21000);await rate(p,1);await advance(p,5000);expected=68;}
 if(kind==='speed-up'){await advance(p,30000);await rate(p,3);await advance(p,5000);expected=45;}
 if(kind==='segments'){await advance(p,10500);await rate(p,1);await advance(p,5500);await rate(p,3);await advance(p,12500);expected=74;}
 if(kind==='native-wait'){await advance(p,20000);assert.equal(await p.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);window.lessonClock+=40000;return event.defaultPrevented;}),true);await p.waitForTimeout(50);await rate(p,1);await advance(p,5000);expected=65;}
 if(kind==='threshold-save'){await advance(p,20000);await rate(p,1);expected=60;}
 if(kind==='threshold-discard'){await advance(p,19500);await rate(p,1);await advance(p,1499);expected=59;}
 if(kind==='paused'){await advance(p,20000);await panel(p);await advance(p,90000);await p.locator('.panel-row',{hasText:'속도'}).locator('select').selectOption('1');await advance(p,40000);await btn(p,'닫기').click();await advance(p,7000);await btn(p,'막혔어요').click();await advance(p,30000);await btn(p,'다시 해볼게요').click();expected=67;}
 await btn(p,'나가기').click();await advance(p,80000);await p.locator('.sheet').getByRole('button',{name:'나가기',exact:true}).click();
 const result=await p.evaluate(()=>({s:JSON.parse(localStorage.getItem('dinga-v1')),event:JSON.parse(localStorage.getItem('dinga-log')).filter(e=>e.type==='exit').at(-1)}));
 assert.equal(result.event.seconds,expected,'elapsed time uses each active segment rate');assert.equal(result.event.saved,expected>=60);assert.equal(Object.values(result.s.history).reduce((a,b)=>a+b,0),expected>=60?expected:0);assert.equal(result.s.done.em[0],false);assert.deepEqual(result.s.resume,{lesson:'em',part:0,step:0});console.log('PASS lesson elapsed '+kind);
 }catch(e){failures++;console.error('FAIL '+kind+': '+e.message);}finally{await context.close();}}
 if(failures)process.exitCode=1;
 }finally{await browser.close();}}finally{await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
