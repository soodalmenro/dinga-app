const assert = require('node:assert/strict');
(async () => {
  const { buildEvaluationExport, evaluationFilename, copyEvaluationText, songDiagnostics } = await import('../src/evaluationExport.js');
  const time = '2026-11-12T10:00:00.000Z';
  const events = [
    { t:time,pid:'P1',type:'songplay_end',bundle:'/assets/index-original.js',score:0,mic:false,coverage:{played:1,total:12,evaluated:0,uncertain:1,raw:[1]},diagnostics:[{index:1,expected:'Em',t:'ok',c:null,detectedChord:null,reason:'ambiguous',classifier:'chroma-guard-v1',audio:'data:audio/test',chroma:[1]}],threshold:.1,image:'data:image/test' },
    { t:time,pid:'P2',type:'attend',method:'manual' },
    { t:time,pid:'',type:'open' },
    { t:time,pid:' P1 ',type:'open' },
    { t:'invalid',pid:'P1',type:'bad' },null,
  ];
  const options = { scope:'participant',pid:'P1',exportedAt:time,bundle:'/assets/index-test.js',settings:{judge:'mic',alert:'real',speed:1,deviceId:'secret',threshold:.1},environment:{userAgent:'test-browser',secureContext:true,clipboard:true,mediaDevices:true,deviceId:'secret'} };
  const report = buildEvaluationExport(events, options);
  assert.equal(report.schemaVersion,1);
  assert.equal(report.events.length,1);
  assert.equal(report.participant,'P1');
  assert.equal(report.summary.eventCount,1);
  assert.equal(report.summary.types.songplay_end,1);
  assert.equal(report.summary.invalidEvents,1);
  assert.equal(report.events[0].score,0);
  assert.equal(report.events[0].mic,false);
  assert.equal(report.events[0].diagnostics[0].c,null);
  assert.equal(report.events[0].diagnostics[0].reason,'ambiguous');
  assert.equal(report.environment.userAgent,'test-browser');
  assert.equal(report.app.bundle,'/assets/index-test.js');
  assert.equal(report.events[0].bundle,'/assets/index-original.js');
  assert.equal(report.summary.unversionedEvents,0);
  const text=JSON.stringify(report);
  for(const key of ['threshold','deviceId','chroma','image','raw']) assert.equal(text.includes(`"${key}":`),false,key);
  for(const value of ['secret','data:']) assert.equal(text.includes(value),false,value);
  assert.equal(buildEvaluationExport(events,{...options,pid:''}).events.length,1);
  assert.equal(buildEvaluationExport(events,{...options,pid:' P1 '}).events.length,1);
  assert.equal(buildEvaluationExport(events,{...options,scope:'all'}).events.length,4);
  assert.equal(buildEvaluationExport([],{...options,pid:'없음'}).summary.eventCount,0);
  assert.equal(buildEvaluationExport(new Array(4000).fill(events[1]),options).retention.mayBeTruncated,true);
  assert.equal(buildEvaluationExport(events,{...options,logStorage:'memory'}).retention.storage,'memory');
  assert.equal(buildEvaluationExport(null,null).summary.eventCount,0);
  const malicious=buildEvaluationExport([{t:time,pid:'P1',type:'__proto__',score:Infinity,method:'data:image/test'}],options);
  assert.equal(malicious.summary.types.__proto__,1);
  assert.equal(Object.hasOwn(malicious.events[0],'score'),false);
  assert.equal(Object.hasOwn(malicious.events[0],'method'),false);
  const name=evaluationFilename({...report,participant:'../../P1\n<test>'});
  assert.ok(name.endsWith('.json')); assert.equal(/[\\/\r\n<>]/.test(name),false);
  assert.equal(buildEvaluationExport(events,{...options,bundle:'https://private.example/token'}).app.bundle,null);
  const values=[];
  assert.equal((await copyEvaluationText('hello',{writeText:async(text)=>values.push(text)},10)).ok,true);
  assert.deepEqual(values,['hello']);
  assert.equal((await copyEvaluationText('x',null,10)).ok,false);
  assert.equal((await copyEvaluationText('x',{writeText:()=>Promise.reject(new Error('denied'))},10)).ok,false);
  assert.equal((await copyEvaluationText('x',{writeText:()=>new Promise(()=>{})},10)).reason,'timeout');
  assert.equal((await copyEvaluationText('x',{writeText:()=>{throw new Error('no');}},10)).ok,false);
  const verdicts=songDiagnostics([{t:'ok',c:null,reason:'ambiguous',classifier:'chroma-guard-v1'},{t:'none',c:false},{t:'unmeasured',c:null}],['Em','G','C'],'mic');
  assert.deepEqual(verdicts.map(v=>v.reason),['ambiguous','no-onset','no-microphone']);
  assert.equal(verdicts[0].classifier,'chroma-guard-v1');
  assert.equal(songDiagnostics([{t:'ok',c:true}],['Em'],'allok')[0].reason,'simulated');
  const course=buildEvaluationExport([{t:time,pid:'P1',type:'songplay_end',fromLesson:true,creditedSeconds:180}],options).events[0];
  assert.equal(course.fromLesson,true);assert.equal(course.creditedSeconds,180);
  for(const creditedSeconds of [-1,1.5,Number.MAX_SAFE_INTEGER+1,'180']){const bad=buildEvaluationExport([{t:time,pid:'P1',type:'songplay_end',fromLesson:'false',creditedSeconds}],options).events[0];assert.equal(Object.hasOwn(bad,'fromLesson'),false);assert.equal(Object.hasOwn(bad,'creditedSeconds'),false);}
  assert.equal(buildEvaluationExport([{t:time,pid:'P1',type:'camera_failed',stage:'capture'}],options).events[0].stage,'capture');
  assert.equal(Object.hasOwn(buildEvaluationExport([{t:time,pid:'P1',type:'camera_failed',stage:'data:image/private'}],options).events[0],'stage'),false);
  console.log('PASS export participant isolation, schema, privacy allowlist, diagnostics, credit metadata, filenames and clipboard outcomes');
})().catch(error=>{console.error(error);process.exitCode=1;});
