const assert=require('node:assert/strict');const{chromium}=require('playwright');
const btn=(p,name)=>p.getByRole('button',{name,exact:true});
(async()=>{const{createServer}=await import('vite');const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
 try{const browser=await chromium.launch({channel:process.env.QA_BROWSER_CHANNEL});try{
 for(const valid of [false,true]){const context=await browser.newContext({viewport:{width:360,height:640}});const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{await p.addInitScript(valid=>{if(localStorage.getItem('dinga-v1'))return;const d=new Date();const date=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');const flag=valid?true:'false';localStorage.setItem('dinga-v1',JSON.stringify({attendances:[{date,method:'manual'}],history:{[date]:180},done:{em:[true,true,true],g:[true,true,true],c:[true,true,true],song:[true,true,true]},challenge:{done:flag},resume:{lesson:'g',part:1,step:2},songPractice:{best:valid?82:250,count:valid?4:1.5,last:{secs:[{name:'인트로',state:'good'}],trans:{},score:80,complete:flag,fromLesson:flag,firstComplete:flag,challengeFirst:flag}},panel:{pid:'P9'}}));},valid);
 await p.goto(process.env.QA_URL||'http://127.0.0.1:'+server.httpServer.address().port);await p.locator('.widget').click();await p.locator('.splash').waitFor({state:'detached'});
 await btn(p,'MY').click();await btn(p,valid?'한 번 더 연주하기':'곡 연습하러 가기').waitFor();assert.equal(await btn(p,valid?'곡 연습하러 가기':'한 번 더 연주하기').count(),0);
 await btn(p,'연습').click();await btn(p,'곡 연습').click();const text=await p.locator('.screen').innerText();assert.equal(text.includes('최고 250점'),false);assert.equal(text.includes('최고 82점'),valid);
 await p.reload();await p.locator('.widget').click();await p.locator('.splash').waitFor({state:'detached'});
 const s=await p.evaluate(()=>JSON.parse(localStorage.getItem('dinga-v1')));assert.equal(s.songPractice.best,valid?82:0);assert.equal(s.songPractice.count,valid?4:0);assert.equal(s.challenge.done,valid);for(const key of ['complete','fromLesson','firstComplete','challengeFirst'])assert.equal(s.songPractice.last[key],valid);assert.deepEqual(s.resume,{lesson:'g',part:1,step:2});assert.equal(Object.values(s.history).reduce((a,b)=>a+b,0),180);assert.equal(s.done.song.every(Boolean),true);assert.equal(s.panel.pid,'P9');assert.deepEqual(errors,[]);console.log('PASS stored record UI, reload and preserved progress: '+(valid?'valid legacy':'damaged fields'));
 }finally{await context.close();}}
 }finally{await browser.close();}}finally{await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
