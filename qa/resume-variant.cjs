const assert=require('node:assert/strict');
(async()=>{const{createServer}=await import('vite');const server=await createServer({server:{middlewareMode:true}});
 try{const{remapResumeVariant,lessonsFor,partSteps}=await server.ssrLoadModule('/src/lib.js');let checked=0;
  for(const from of ['idea','prd'])for(const to of ['idea','prd'])for(const lesson of lessonsFor({panel:{variant:from}}))for(let part=0;part<lesson.parts.length;part++){
   const definition=lesson.parts[part];const old=partSteps(definition,from,part);
   const destination=lessonsFor({panel:{variant:to}}).find(l=>l.id===lesson.id).parts[part];const next=partSteps(destination,to,part);
   for(let step=0;step<old.length;step++){
    const resume=Object.freeze({lesson:lesson.id,part,step});const mapped=remapResumeVariant(resume,from,to);
    assert.equal(mapped.lesson,lesson.id);assert.equal(mapped.part,part);assert.ok(mapped.step>=0&&mapped.step<next.length);
    if(definition===destination&&next.includes(old[step]))assert.equal(next[mapped.step],old[step],'same actual step is preserved');else assert.equal(mapped.step,0,'missing/different curriculum restarts part');
    assert.deepEqual(resume,{lesson:lesson.id,part,step});checked++;
   }
  }
  for(const invalid of [null,[],{}, {lesson:'unknown',part:0,step:0},{lesson:'em',part:99,step:0},{lesson:'em',part:0,step:-1},{lesson:'em',part:0,step:NaN}])assert.equal(remapResumeVariant(invalid,'idea','prd'),null);
  assert.equal(remapResumeVariant({lesson:'em',part:0,step:0},'bad','prd'),null);
  assert.deepEqual(remapResumeVariant({lesson:'em',part:0,step:999},'idea','prd'),{lesson:'em',part:0,step:4});
  console.log(`PASS ${checked} variant-step mappings, conservative fallbacks, invalid resume and immutable input`);
 }finally{await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
