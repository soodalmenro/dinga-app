const assert=require('node:assert/strict');
(async()=>{
 const{createBarSpectrum}=await import('../src/barSpectrum.js');const capture=createBarSpectrum();
 const em=Array.from({length:12},(_,i)=>[4,7,11].includes(i)?1:0);const c=Array.from({length:12},(_,i)=>[0,4,7].includes(i)?1:0);
 const frame={bar:0,at:100,barStart:0,firstOnset:0,settleMs:300,level:.2,threshold:.03,chroma:()=>em};
 assert.equal(capture.sample(frame),false);
 assert.equal(capture.sample({...frame,at:320,level:0}),true,'capture the first fresh window even after a short sound decays');
 assert.equal(capture.sample({...frame,at:360,level:0}),false);
 assert.equal(capture.sample({...frame,at:400}),true);
 assert.equal(capture.sample({...frame,bar:1,barStart:1000,firstOnset:1000,at:1320,chroma:()=>c}),true);
 assert.deepEqual(capture.take(0),{chroma:em.map(v=>v*2),samples:2});
 assert.deepEqual(capture.take(1),{chroma:c,samples:1});
 assert.equal(capture.sample({...frame,at:500,firstOnset:undefined}),false);
 assert.equal(capture.sample({...frame,at:500,chroma:()=>new Array(12).fill(NaN)}),false);
 capture.sample({...frame,at:600});capture.clear();assert.equal(capture.take(0).samples,0);
 console.log('PASS onset settling, short-sound evidence, independent bar allocation, invalid input and reset');
})().catch(error=>{console.error(error);process.exitCode=1;});
