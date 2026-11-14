const assert=require('node:assert/strict');
(async()=>{const{createServer}=await import('vite');const server=await createServer({server:{middlewareMode:true}});
 try{const React=require('react');const{renderToStaticMarkup}=require('react-dom/server');const{Report,comparableTransitionResults:comparable}=await server.ssrLoadModule('/src/Song.jsx');const{load,content}=await server.ssrLoadModule('/src/lib.js');
 const pair=['Em','G'];const chart=['Em','Em','G','G','Em','Em','G','G'];const base={bars:Array(8).fill('ok'),chart,pair,tempo:80,judge:'mic',speed:1};
 let failures=0;for(const [name,patch,compare] of [['same',{},true],['different-pair',{pair:['G','C'],chart:['G','G','C','C','G','G','C','C']},false],['tempo',{tempo:90},false],['simulated-to-mic',{judge:'allok'},false],['unknown-mode',{judge:undefined},false],['different-chart',{chart:[...chart].reverse()},false],['song-vs-pair',{pair:null},false],['speed',{speed:3},false],['unknown-speed',{speed:undefined},false],['mixed-speed',{speed:null},false]]){
 try{const s=load();s.song={last:base,prev:{...base,...patch}};const html=renderToStaticMarkup(React.createElement(Report,{s,go:()=>{}}));assert.equal(html.includes('지난번보다 박자 맞음'),compare);if(!compare)assert.ok(html.includes('비교할 수 있는 직전 기록이 없어요'));console.log('PASS report comparison '+name);}catch(e){failures++;console.error('FAIL '+name+': '+e.message);}}
 for(const judge of ['random','allok','hard']){const s=load();s.song={last:{...base,judge},prev:{...base,judge}};assert.ok(renderToStaticMarkup(React.createElement(Report,{s,go:()=>{}})).includes('모의 판정끼리 비교'));}
 assert.equal(comparable({...base,pair:null,chart:undefined},{...base,pair:null,chart:content.songChart.bars}),true,'known legacy full-song chart fallback');
 assert.equal(comparable({...base,chart:undefined},base),false,'missing pair chart is not inferred');
 for(const result of [null,{}, {...base,bars:[]},{...base,judge:'unknown'},{...base,speed:0},{...base,tempo:0}])assert.equal(comparable(result,base),false);
 const s=load();s.song={last:base,prev:null};assert.ok(renderToStaticMarkup(React.createElement(Report,{s,go:()=>{}})).includes('첫 연주예요'));console.log('PASS simulated labels, first attempt and legacy/invalid comparison boundaries');
 if(failures)process.exitCode=1;
 }finally{await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
