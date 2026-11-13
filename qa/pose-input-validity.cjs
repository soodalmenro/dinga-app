const assert=require('node:assert/strict');
(async()=>{
 const {createServer}=await import('vite');const server=await createServer({server:{middlewareMode:true}});
 try{
  const {measure,judge}=await server.ssrLoadModule('/src/pose.js');
  const lm=Array.from({length:33},()=>({x:.5,y:.5,visibility:0}));
  for(const [i,x,y] of [[13,.2,.4],[15,.4,.4],[19,.4,.2],[17,.41,.2],[11,.3,.4],[12,.7,.4],[7,.3,.2],[8,.7,.2]])lm[i]={x,y,visibility:1};
  assert.ok(measure(lm,'left',480,640).wrist>45);
  for(const invalid of [-.2,1.2,NaN,Infinity]){const points=structuredClone(lm);points[15].x=invalid;assert.equal(measure(points,'left',480,640).wrist,null);}
  for(const visibility of [-1,2,NaN,Infinity,null]){const points=structuredClone(lm);points[15].visibility=visibility;assert.equal(measure(points,'left',480,640).wrist,null);}
  for(const [w,h] of [[0,640],[480,-1],[Infinity,640],[480,NaN]])assert.deepEqual(measure(lm,'left',w,h),{wrist:null,tilt:null,neck:null});
  assert.deepEqual(judge({wrist:Infinity,tilt:NaN,neck:-Infinity}),[]);
  const mirrored=lm.map(point=>({...point,x:1-point.x}));
  const original=measure(lm,'left',480,640), reflected=measure(mirrored,'left',480,640);
  for(const key of ['wrist','tilt','neck'])assert.ok(Math.abs(original[key]-reflected[key])<1e-9,'mirror invariance '+key);
  const right=structuredClone(lm);for(const [left,r] of [[13,14],[15,16],[17,18],[19,20]]){right[r]=right[left];right[left]={x:.5,y:.5,visibility:0};}
  assert.equal(measure(right,'right',480,640).wrist,original.wrist);
  assert.equal(measure(right,'left',480,640).wrist,null);
  console.log('PASS mirrored coordinates and explicit right-hand selection preserve geometry');
  console.log('PASS pose calculation rejects out-of-frame/invalid confidence/dimensions and nonfinite verdicts');
 }finally{await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
