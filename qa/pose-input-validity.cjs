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
  console.log('PASS pose calculation rejects out-of-frame/invalid confidence/dimensions and nonfinite verdicts');
 }finally{await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
