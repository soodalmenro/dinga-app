const assert=require('node:assert/strict');
(async()=>{
 const {createWakeLockController,observeMediaStream,mediaStreamIsLive}=await import('../src/mediaLifecycle.js');
 class Track extends EventTarget { constructor(){super();this.readyState='live';this.muted=false;} }
 const track=new Track(); const stream=new EventTarget();stream.getTracks=()=>[track];
 assert.equal(mediaStreamIsLive(stream),true);let losses=0;
 const stop=observeMediaStream(stream,()=>{losses+=1;});track.dispatchEvent(new Event('mute'));assert.equal(losses,1);
 stop();track.dispatchEvent(new Event('ended'));assert.equal(losses,1);
 track.readyState='ended';assert.equal(mediaStreamIsLive(stream),false);
 assert.equal(mediaStreamIsLive({getTracks:()=>[]}),false);
 let visible=true;let requests=0;let releasePending;const locks=[];
 class Lock extends EventTarget {constructor(){super();this.released=false;}async release(){this.released=true;this.dispatchEvent(new Event('release'));}}
 const controller=createWakeLockController({isVisible:()=>visible,request:()=>{requests+=1;return new Promise(resolve=>{releasePending=()=>{const lock=new Lock();locks.push(lock);resolve(lock);};});}});
 const first=controller.setActive(true);controller.refresh();assert.equal(requests,1);
 await controller.setActive(false);releasePending();await first;assert.equal(locks[0].released,true);
 const second=controller.setActive(true);releasePending();await second;assert.equal(requests,2);
 visible=false;await controller.suspend();assert.equal(locks[1].released,true);
 visible=true;const third=controller.refresh();releasePending();await third;assert.equal(requests,3);
 locks[1].dispatchEvent(new Event('release'));await controller.refresh();assert.equal(requests,3);
 await controller.setActive(false);assert.equal(locks[2].released,true);
 console.log('PASS stream liveness/listener cleanup and wake dedup/late/visibility/stale release contracts');
})().catch(error=>{console.error(error);process.exitCode=1;});
