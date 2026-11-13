const assert=require('node:assert/strict');const{chromium}=require('playwright');
const cases=[
 {id:'short-em',previous:[],next:[52,55,59],gain:.12,duration:.12,decay:0,expected:'Em',required:false},
 {id:'decaying-c',previous:[],next:[60,64,67],gain:.2,duration:.7,decay:.5,expected:'C',required:true},
 {id:'g-to-short-c',previous:[55,59,62],next:[60,64,67],gain:.06,duration:.1,decay:0,expected:'C',required:false},
 {id:'c-to-short-g',previous:[60,64,67],next:[55,59,62],gain:.06,duration:.1,decay:0,expected:'G',required:false},
 {id:'em-to-short-c',previous:[52,55,59],next:[60,64,67],gain:.06,duration:.1,decay:0,expected:'C',required:false},
];
(async()=>{
 const{createServer}=await import('vite');const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
 try{const browser=await chromium.launch({channel:process.env.QA_BROWSER_CHANNEL,args:['--autoplay-policy=no-user-gesture-required']});
 try{const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.httpServer.address().port);let failures=0;
 for(const sampleRate of [44100,48000])for(const fixture of cases){
  const result=await page.evaluate(async({fixture,sampleRate})=>{
   const Native=window.AudioContext;const original=navigator.mediaDevices.getUserMedia;
   window.AudioContext=class extends Native{constructor(){super({sampleRate});}};
   const context=new Native({sampleRate});const destination=context.createMediaStreamDestination();const oscillators=[];
   const group=(notes,gain)=>notes.map(note=>{const osc=context.createOscillator();const volume=context.createGain();osc.frequency.value=440*2**((note-69)/12);volume.gain.value=gain;osc.connect(volume).connect(destination);osc.start();oscillators.push(osc);return{osc,volume};});
   const previous=group(fixture.previous,.15);navigator.mediaDevices.getUserMedia=async()=>destination.stream;
   const{mic,content}=await import('/src/lib.js');const{analyzeChord}=await import('/src/chordRecognition.js');
   let createBarSpectrum;const response=await fetch('/src/barSpectrum.js');if(response.ok&&/javascript/.test(response.headers.get('content-type')||'')){({createBarSpectrum}=await import('/src/barSpectrum.js'));}
   try{await context.resume();await mic.start();
    for(let i=0;i<15;i++){await new Promise(r=>setTimeout(r,40));mic.chroma();}
    previous.forEach(({osc})=>osc.stop());const tones=group(fixture.next,fixture.gain);const start=performance.now();
    tones.forEach(({osc,volume})=>{if(fixture.decay)volume.gain.setTargetAtTime(0,context.currentTime,fixture.decay);osc.stop(context.currentTime+fixture.duration);});
    const total=new Array(12).fill(0);const collector=createBarSpectrum?.();let frames=0;
    while(performance.now()-start<750){await new Promise(r=>setTimeout(r,40));const at=performance.now()-start;const level=mic.level();
     if(collector){collector.sample({bar:1,at:1000+at,barStart:1000,firstOnset:1000,settleMs:mic.spectrumWindowMs(),level,threshold:.03,chroma:()=>mic.chroma()});}
     else if(level>.03){const values=mic.chroma();for(let k=0;k<12;k++)total[k]+=values[k];frames++;}
    }
    const captured=collector?.take(1)||{chroma:total,samples:frames};return{...analyzeChord(captured.chroma,content.chordNotes),samples:captured.samples,policy:collector?'fresh-window':'current-app'};
   }finally{mic.stop();oscillators.forEach(osc=>{try{osc.stop();}catch{}});destination.stream.getTracks().forEach(track=>track.stop());await context.close();navigator.mediaDevices.getUserMedia=original;window.AudioContext=Native;}
  },{fixture,sampleRate});
  const pass=fixture.required?result.chord===fixture.expected:result.chord===fixture.expected||result.chord===null;
  console.log(`${pass?'PASS':'FAIL'} ${sampleRate}Hz ${fixture.id}: ${result.chord}, ${result.reason}, samples=${result.samples}, ${result.policy}`);if(!pass)failures++;
 }
 assert.equal(failures,0,'transient inputs must not inherit the previous chord; short evidence may abstain');await page.close();
 }finally{await browser.close();}}finally{await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
