const assert=require('node:assert/strict');const{chromium}=require('playwright');
(async()=>{
 const{createServer}=await import('vite');const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
 try{const browser=await chromium.launch({channel:process.env.QA_BROWSER_CHANNEL});
 try{let failures=0;
 for(const variant of ['reduce','no-preference','legacy']){
  const preference=variant==='legacy'?'no-preference':variant;
  const page=await browser.newPage({reducedMotion:preference});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.addInitScript(legacy=>{
    window.motionFrames=0;window.motionQueries=[];
    const native=window.matchMedia.bind(window);window.matchMedia=query=>{const media=native(query),listeners=new Set();window.motionQueries.push(listeners);const add=media.addEventListener.bind(media),remove=media.removeEventListener.bind(media);media.addEventListener=(type,fn,...rest)=>{if(type==='change')listeners.add(fn);return add(type,fn,...rest);};media.removeEventListener=(type,fn,...rest)=>{if(type==='change')listeners.delete(fn);return remove(type,fn,...rest);};if(legacy){const oldAdd=media.addListener.bind(media),oldRemove=media.removeListener.bind(media);media.addEventListener=undefined;media.removeEventListener=undefined;media.addListener=fn=>{listeners.add(fn);oldAdd(fn);};media.removeListener=fn=>{listeners.delete(fn);oldRemove(fn);};}return media;};
    const clear=CanvasRenderingContext2D.prototype.clearRect;CanvasRenderingContext2D.prototype.clearRect=function(...args){if(this.canvas.closest('#motion-probe'))window.motionFrames++;return clear.apply(this,args);};
   },variant==='legacy');
   await page.goto('http://127.0.0.1:'+server.httpServer.address().port);
   await page.evaluate(async()=>{
    const React=(await import('/node_modules/.vite/deps/react.js')).default;const{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;const{Piki,Confetti}=await import('/src/ui.jsx');
    window.motionBaseline=window.motionQueries.reduce((n,set)=>n+set.size,0);
    const host=document.createElement('div');host.id='motion-probe';host.style.cssText='position:fixed;inset:0;background:white;z-index:999';document.body.appendChild(host);
    window.motionRoot=createRoot(host);window.motionRoot.render(React.createElement(React.Fragment,null,React.createElement(Piki,{name:'happy',size:180}),React.createElement(Confetti)));
   });
   const character=page.locator('#motion-probe .piki');await character.waitFor();await page.waitForTimeout(250);
   if(preference==='reduce'){
    assert.equal(await character.evaluate(el=>el.getAnimations().length),0,'reduced motion disables initial character animation');
    await character.click();assert.equal(await character.evaluate(el=>el.getAnimations().length),0,'tap respects reduced motion');
    assert.equal(await page.evaluate(()=>window.motionFrames),0,'no confetti drawing on initial reduced setting');
   }else{
    assert.ok(await character.evaluate(el=>el.getAnimations().length)>0,'default character animation retained');
    assert.ok(await page.evaluate(()=>window.motionFrames)>0,'default confetti retained');
    await character.click();await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>document.querySelector('#motion-probe .piki').getAnimations().length===0);
    const frames=await page.evaluate(()=>window.motionFrames);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>window.motionFrames),frames,'live setting change cancels canvas frames');
    await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>document.querySelector('#motion-probe .piki').getAnimations().length>0);
   }
   await page.evaluate(()=>window.motionRoot.unmount());
   assert.equal(await page.evaluate(()=>window.motionQueries.reduce((n,set)=>n+set.size,0)),await page.evaluate(()=>window.motionBaseline),'unmount removes preference listeners');
   assert.deepEqual(errors,[]);console.log('PASS motion preference '+variant+' and cleanup');
  }catch(error){failures++;console.error('FAIL '+variant+': '+error.message);}finally{await page.close();}
 }
 if(failures)process.exitCode=1;
 }finally{await browser.close();}}finally{await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
