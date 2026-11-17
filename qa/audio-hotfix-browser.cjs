const assert=require('node:assert/strict');const{chromium}=require('playwright');
(async()=>{const{createServer}=await import('vite');const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();let browser;
try{browser=await chromium.launch({channel:process.env.QA_BROWSER_CHANNEL,args:['--autoplay-policy=no-user-gesture-required']});const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async c=>{if(!c.audio)throw new DOMException('Denied','NotAllowedError');const ac=new AudioContext(),dest=ac.createMediaStreamDestination(),buffer=ac.createBuffer(1,ac.sampleRate,ac.sampleRate);const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=.3*(Math.random()*2-1);const node=ac.createBufferSource();node.buffer=buffer;node.loop=true;node.connect(dest);await ac.resume();node.start();return dest.stream;};});
 await page.goto(process.env.QA_URL||'http://127.0.0.1:'+server.httpServer.address().port);await page.locator('.widget').click();await page.locator('.splash').waitFor({state:'detached'});await page.getByRole('button',{name:'출석하기',exact:true}).click();await page.waitForTimeout(4000);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('dinga-v1')).attendances.length),0,'sustained loud noise must not count as guitar attendance');
 assert.equal(await page.getByRole('heading',{name:'출석 완료!',exact:true}).count(),0);
 console.log('PASS real microphone loud noise cannot complete attendance');
}finally{await browser?.close();await server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
