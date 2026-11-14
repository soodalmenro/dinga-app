const assert=require('node:assert/strict');
(async()=>{const{createServer}=await import('vite');const server=await createServer({server:{middlewareMode:true}});let raw=null;
 global.localStorage={getItem:()=>raw};
 try{const{load,challengeDone}=await server.ssrLoadModule('/src/lib.js');let failed=0;
 const restore=value=>{raw=JSON.stringify(value);return load();};
 const report={secs:[{name:'인트로',state:'good'}],trans:{},score:80,chordAcc:80,beatAcc:80,tempo:40};
 const transition={bars:Array(8).fill('ok'),tempo:80};
 const check=(name,fn)=>{try{fn();console.log('PASS stored result '+name);}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}};
 check('bounded best',()=>{for(const best of [-1,101,250,'90',null,{}])assert.equal(restore({songPractice:{best}}).songPractice.best,0);});
 check('integer count',()=>{for(const count of [-1,1.5,Number.MAX_SAFE_INTEGER+1,'2',null,{}])assert.equal(restore({songPractice:{count}}).songPractice.count,0);});
 check('challenge literal true',()=>{for(const done of ['false','true',1,{},[]])assert.equal(challengeDone(restore({challenge:{done}})),false);assert.equal(challengeDone(restore({challenge:{done:true}})),true);});
 check('practice flags literal true',()=>{for(const flag of ['false','true',1,{},[],undefined]){const last=restore({songPractice:{last:{...report,complete:flag,fromLesson:flag,firstComplete:flag,challengeFirst:flag}}}).songPractice.last;for(const key of ['complete','fromLesson','firstComplete','challengeFirst'])assert.equal(last[key],false,key);}});
 check('transition flags literal true',()=>{for(const challengeFirst of ['false',1,{},undefined]){const s=restore({song:{last:{...transition,challengeFirst},prev:{...transition,challengeFirst}}});assert.equal(s.song.last.challengeFirst,false);assert.equal(s.song.prev.challengeFirst,false);}});
 check('valid records survive roundtrip',()=>{for(const best of [0,42,100]){const s=restore({songPractice:{best,count:3,last:{...report,complete:true,fromLesson:true,firstComplete:true,challengeFirst:true}},song:{last:{...transition,challengeFirst:true}},challenge:{done:true},history:{'2026-11-14':180},done:{em:[true,false,false]},resume:{lesson:'g',part:1,step:2}});assert.equal(s.songPractice.best,best);assert.equal(s.songPractice.count,3);assert.equal(s.songPractice.last.score,80);for(const key of ['complete','fromLesson','firstComplete','challengeFirst'])assert.equal(s.songPractice.last[key],true);assert.equal(s.song.last.challengeFirst,true);assert.equal(s.history['2026-11-14'],180);assert.equal(s.done.em[0],true);assert.deepEqual(s.resume,{lesson:'g',part:1,step:2});assert.equal(challengeDone(s),true);}});
 check('legacy missing fields',()=>{const s=restore({songPractice:{last:report},song:{last:transition}});assert.equal(s.songPractice.count,0);assert.equal(s.songPractice.best,0);assert.equal(s.songPractice.last.fromLesson,false);assert.equal(s.songPractice.last.score,80);assert.equal(s.song.last.bars.length,8);});
 check('best survives latest unscored attempt',()=>{const s=restore({songPractice:{best:91,count:2,last:{...report,score:null,chordAcc:null,beatAcc:null,complete:false,judge:'allok'}}});assert.equal(s.songPractice.best,91);assert.equal(s.songPractice.count,2);assert.equal(s.songPractice.last.score,null);assert.equal(s.songPractice.last.complete,false);assert.equal(s.songPractice.last.judge,'allok');});
 if(failed)process.exitCode=1;
 }finally{delete global.localStorage;await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
