const assert=require('node:assert/strict');
(async()=>{const{createChordBarEvidence}=await import('../src/chordBarEvidence.js');const votes=createChordBarEvidence();
const sample=(chord,sourceAt,now=sourceAt+400,elapsed=sourceAt)=>votes.sample({observation:{usable:true,chord,sourceAt,stableMs:500},now,elapsed:elapsed+400,barMs:3000});
sample('Em',900);sample('Em',900);assert.equal(votes.take(0).chord,null,'same observation cannot be multiplied');sample('G',3200);sample('G',3300);assert.equal(votes.take(1).chord,'G');
sample('C',6200);sample('C',6300);sample('Em',6400);sample('Em',6500);assert.equal(votes.take(2).chord,null,'tied evidence abstains');
sample('C',9200);sample('C',9300);assert.equal(votes.take(3).chord,'C');sample('Em',400,9000,8400);assert.equal(votes.take(0).chord,null,'stale source never reused');votes.clear();assert.equal(votes.take(3).chord,null);
for(const sourceAt of[12300,12400])votes.sample({observation:{usable:true,chord:'G',sourceAt,stableMs:500},now:13000,elapsed:13000,barMs:3000,minimumSourceAt:12500});assert.equal(votes.take(4).chord,null,'audio produced during pause cannot vote after resume');
console.log('PASS source-mapped chord bars, unique observations, unknown/tied/stale/pause evidence and clear');})().catch(e=>{console.error(e);process.exitCode=1;});
