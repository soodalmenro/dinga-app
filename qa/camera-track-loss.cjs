const assert=require('node:assert/strict');const{chromium}=require('playwright');
async function instrument(page,variant){await page.addInitScript(variant=>{
 const d=new Date();const date=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 localStorage.setItem('dinga-v1',JSON.stringify({attendances:[{date,method:'manual'}],panel:{variant,speed:3},resume:variant==='prd'?{lesson:'em',part:0,step:0}:null}));
 window.cameraLossStreams=[];window.cameraLossSends=0;
 const acquire=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
 navigator.mediaDevices.getUserMedia=async constraints=>{if(constraints.audio)throw new DOMException('Denied','NotAllowedError');const stream=await acquire(constraints);window.cameraLossStreams.push(stream);return stream;};
 window.Pose=class{setOptions(){}onResults(fn){this.callback=fn;}async close(){}async initialize(){await new Promise(resolve=>{window.finishCameraModel=resolve;});}async send(){window.cameraLossSends++;this.callback({poseLandmarks:[]});}};
 },variant);}
const lose=page=>page.evaluate(()=>{const track=window.cameraLossStreams.at(-1).getVideoTracks()[0];track.stop();track.dispatchEvent(new Event('ended'));});
(async()=>{const{createServer}=await import('vite');const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
 try{const browser=await chromium.launch({channel:process.env.QA_BROWSER_CHANNEL,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 try{const url='http://127.0.0.1:'+server.httpServer.address().port;
 let page=await browser.newPage();await instrument(page,'prd');await page.goto(url);await page.locator('.splash').waitFor({state:'detached'});
 await page.getByRole('button',{name:'이어서 연습하기',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.cam video')?.readyState>=2);
 await lose(page);await page.getByRole('button',{name:'카메라 다시 켜기',exact:true}).waitFor();
 await page.getByRole('button',{name:'카메라 다시 켜기',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.cam video')?.readyState>=2);
 await page.getByRole('button',{name:'촬영 (3초 뒤)',exact:true}).click();await lose(page);await page.waitForTimeout(1300);
 assert.equal(await page.getByRole('button',{name:'연습 시작',exact:true}).count(),0);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('dinga-v1')).posture),null);
 await page.close();console.log('PASS legacy camera loss/retry cancels capture without storing a posture verdict');
 page=await browser.newPage();await instrument(page,'idea');await page.goto(url);await page.locator('.widget').click();await page.locator('.splash').waitFor({state:'detached'});
 await page.getByRole('button',{name:'연습 환경 확인',exact:true}).click();await page.getByRole('button',{name:'카메라 확인하기',exact:true}).click();
 await page.waitForFunction(()=>!!window.finishCameraModel);await lose(page);
 await page.getByText(/카메라 연결이 끊겼어요/).waitFor();await page.evaluate(()=>window.finishCameraModel());await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>window.cameraLossSends),0);
 assert.equal(await page.locator('.setup-camera video').evaluate(v=>!!v.srcObject?.active),false);
 await page.getByRole('button',{name:'카메라 다시 확인',exact:true}).click();await page.getByText('상체가 잘 보이지 않아요',{exact:true}).waitFor();
 assert.ok(await page.evaluate(()=>window.cameraLossSends)>0);await page.getByRole('button',{name:'확인 마치기',exact:true}).click();
 assert.ok(await page.evaluate(()=>window.cameraLossStreams.every(stream=>stream.getTracks().every(track=>track.readyState==='ended'))));
 await page.close();console.log('PASS camera loss during model load ignores late completion and safely reconnects');
 }finally{await browser.close();}}finally{await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
