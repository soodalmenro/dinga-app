const assert = require('node:assert/strict');
const notes = require('../src/content.json').chordNotes;
(async()=>{
  const {createServer}=await import('vite');const server=await createServer({server:{middlewareMode:true}});
  try{
    const {analyzeChord}=await server.ssrLoadModule('/src/chordRecognition.js');
    const vector=values=>Array.from({length:12},(_,i)=>values[i]||0);
    for(const [name,below,above,reason] of [
      ['support',vector({4:.849999/3,7:.849999/3,11:.849999/3,1:.150001}),vector({4:.850001/3,7:.850001/3,11:.850001/3,1:.149999}),'off-chord'],
      ['margin',vector({4:.4400005,7:.4400005,11:.119999}),vector({4:.4399995,7:.4399995,11:.120001}),'ambiguous'],
      ['tone',vector({2:.4600005,7:.4600005,11:.079999}),vector({2:.4599995,7:.4599995,11:.080001}),'missing-tones'],
    ]){
      assert.equal(analyzeChord(below,notes).reason,reason,name+' conservative lower boundary');assert.ok(analyzeChord(above,notes).chord,name+' upper control recognized');
    }
    let ambiguous=0,checks=0;
    for(const [a,b] of [['Em','G'],['Em','C'],['G','C']])for(let step=0;step<=100;step++){
      const mix=step/100;const input=Array.from({length:12},(_,i)=>(notes[a].includes(i)?(1-mix)/3:0)+(notes[b].includes(i)?mix/3:0));
      const result=analyzeChord(input,notes);assert.ok(result.chord===null||result.chord===a||result.chord===b,'mixture must not invent an unrelated chord');
      if(step===0)assert.equal(result.chord,a);if(step===100)assert.equal(result.chord,b);if(result.chord===null)ambiguous++;
      for(const gain of [1e-12,1e12])assert.equal(analyzeChord(input.map(v=>v*gain),notes).chord,result.chord);
      checks++;
    }
    assert.ok(ambiguous>0);console.log(`PASS three decision boundaries and ${checks} chord mixtures with gain controls (${ambiguous} abstentions); feature contracts, not weak-guitar accuracy`);
  }finally{await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
