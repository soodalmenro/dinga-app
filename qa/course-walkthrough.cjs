const assert=require('node:assert/strict');const{chromium}=require('playwright');const content=require('../src/content.json');
const btn=(p,name)=>p.getByRole('button',{name,exact:true});const state=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('dinga-v1')));
(async()=>{const{createServer}=await import('vite');const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
 try{const browser=await chromium.launch({channel:process.env.QA_BROWSER_CHANNEL});try{let failures=0;
 for(const variant of process.env.QA_COURSE_VARIANTS?.split(',')||['idea','prd']){const context=await browser.newContext({viewport:{width:375,height:812}});const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));const progressFailures=[];
 try{await p.addInitScript(variant=>{const d=new Date();const date=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');if(!localStorage.getItem('dinga-v1'))localStorage.setItem('dinga-v1',JSON.stringify({attendances:[{date,method:'manual'}],panel:{variant,speed:30,judge:'allok',alert:'off'}}));navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError');};},variant);
 await p.goto(process.env.QA_URL||'http://127.0.0.1:'+server.httpServer.address().port);if(variant==='idea')await p.locator('.widget').click();await p.locator('.splash').waitFor({state:'detached'});
 let partCount=0;
 for(let lesson=0;lesson<4;lesson++)for(let part=0;part<3;part++){
  await btn(p,'학습').click();if(variant==='idea')await btn(p,'코스 이어하기').click();else await p.locator('.card.lesson.tap').nth(lesson).click();
  if(variant==='idea')assert.equal(await p.locator('.screen > button.card.lesson.tap').last().isDisabled(),partCount<9,'completion lesson unlocks after nine code parts');
  if(process.env.QA_CAPTURE==='1'&&variant==='idea'&&part===0&&[0,3].includes(lesson)){await p.waitForTimeout(300);await p.screenshot({path:require('node:path').resolve('..',`dinga-course-modal-${lesson}.png`),animations:'disabled'});}
  await p.locator('.sheet .card.lesson').nth(part).click();let finished=false;let lastObserved=-1;let transitionNo=0;let inTransition=false;let captured=false;
  for(let turn=0;turn<400&&!finished;turn++){
   if(await p.getByRole('heading',{name:'파트 완료!',exact:true}).count()){finished=true;break;}
   if(await p.getByRole('heading',{name:variant==='idea'?'곡 연습 리포트':'곡 리포트',exact:true}).count()){finished=true;break;}
   const song=p.locator('.screen.sp');if(await song.count()){const start=p.getByRole('button',{name:/바로 시작/});if(await start.count())await start.click();await p.getByRole('heading',{name:'곡 연습 리포트',exact:true}).waitFor({timeout:20000});finished=true;break;}
   const embed=p.locator('.embed');if(await embed.count()){
    if(!inTransition){transitionNo++;inTransition=true;lastObserved=-1;}
    const start=btn(p,'시작하기');if(await start.count())await start.click();
    const observed=await p.evaluate(()=>{const screen=document.querySelector('.screen');return{bars:screen?.querySelectorAll('.embed .bars .bar.ok,.embed .bars .bar.late,.embed .bars .bar.none').length||0,progress:screen?.querySelectorAll('.prog i.on').length||0};});
    if(observed.bars>0&&observed.bars!==lastObserved){lastObserved=observed.bars;if(observed.progress!==observed.bars)progressFailures.push({lesson,part,transitionNo,...observed});}
    if(process.env.QA_CAPTURE==='1'&&!captured&&lesson===1&&part===2&&observed.bars>=2){captured=true;await p.screenshot({path:require('node:path').resolve('..','dinga-course-transition.png'),animations:'disabled'});}
    await p.waitForTimeout(80);continue;
   }else inTransition=false;
   const legacyStart=btn(p,'시작하기');if(await legacyStart.count()){await legacyStart.click();continue;}
   const skip=btn(p,'다음 단계로');if(await skip.count()){await skip.click();continue;}
   const finger=p.getByRole('button',{name:/^(올렸어요|다 올렸어요)$/});if(await finger.count()){await finger.click();continue;}
   const next=btn(p,'다음');if(await next.count()){await next.click({timeout:15000});await p.waitForTimeout(60);continue;}
   await p.waitForTimeout(80);
  }
  assert.ok(finished,`normal UI finishes ${variant} lesson${lesson} part${part}`);partCount++;
  const s=await state(p);assert.equal(s.done[content.lessons[lesson].id][part],true);assert.equal(Object.values(s.done).flat().filter(Boolean).length,partCount);assert.equal(s.resume,null);assert.equal(s.songPractice.best,0);assert.deepEqual(errors,[]);
  console.log(`PASS normal ${variant} ${content.lessons[lesson].id}/${part+1} (${partCount}/12)`);
  if(lesson===3&&part===2&&variant==='idea'){await p.getByRole('button',{name:'완료',exact:true}).click();await btn(p,'홈').click();}else await btn(p,'홈으로').click();
 }
 const s=await state(p);const seconds=Object.values(s.history).reduce((a,b)=>a+b,0);if(progressFailures.length){failures++;console.error('FAIL embedded parent progress '+JSON.stringify(progressFailures.slice(0,8)));}assert.equal(seconds,2160,`${variant}12 completed course parts credit36minutes`);await btn(p,'학습').click();if(variant==='idea'){await btn(p,'곡 다시 치기').waitFor();assert.ok((await p.locator('.screen').innerText()).includes('12/12'));if(process.env.QA_CAPTURE==='1'){await p.waitForTimeout(300);await p.screenshot({path:require('node:path').resolve('..','dinga-course-complete.png'),animations:'disabled'});}}assert.ok(await p.locator('img.piki').evaluateAll(images=>images.every(img=>img.naturalWidth>0&&!img.src.includes('figma.com'))),'existing local character assets render');console.log(`PASS course ${variant} 12/12, resume cleared,2160seconds`);
 }catch(e){failures++;console.error('FAIL course '+variant+': '+e.message);}finally{await context.close();}}
 if(failures)process.exitCode=1;
 }finally{await browser.close();}}finally{await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
