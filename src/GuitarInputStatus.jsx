import React,{useEffect,useState} from 'react';
import {ear,sameChord} from './guitarEar.js';
import {mic} from './lib.js';
import {currentEvaluationBundle} from './evaluationExport.js';
export function GuitarInputStatus({target,retry}){
 const[state,setState]=useState(()=>ear.snapshot());
 const[input,setInput]=useState(0);
 useEffect(()=>{const refresh=()=>setState(ear.snapshot());const unwatch=ear.subscribe(refresh);const timer=setInterval(()=>{setInput(mic.level());refresh();},250);return()=>{unwatch();clearInterval(timer);};},[]);
 const failed=['failed','unsupported','stale','paused'].includes(state.status);
 const label=failed?(state.status==='stale'||state.status==='paused'?'소리를 다시 듣고 있어요. 계속 멈춰 있으면 다시 시도해 주세요.':'코드를 들을 준비가 안 됐어요. 다시 시도해 주세요.'):state.status==='loading'?'코드를 들을 준비를 하고 있어요…':state.chord?(target?(sameChord(state.chord,target)?`${target} 코드가 들려요`:`지금은 ${state.chord} 코드가 들려요 · ${target} 코드를 쳐 주세요`):`${state.chord} 코드가 들려요`):(target?`${target} 코드를 쳐 주세요`:'아는 코드를 쳐 주세요!');
 return <div className="sub tc">
  <p role="status" style={{margin:'0 0 4px'}}>{label}</p>
  <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontSize:12}}><span>마이크 입력</span><meter aria-label="마이크 입력 크기" min="0" max="0.1" value={Math.min(.1,input)} style={{width:100}}/><span>{input>=.0001?'입력 신호 있음':'입력이 거의 없음'}</span></div>
  <details style={{fontSize:12,textAlign:'left',marginTop:4}}><summary>입력 진단 정보</summary><div>입력 점검 2 · {currentEvaluationBundle()?.split('/').pop()||'개발 화면'}</div><div>마이크 RMS: {input.toFixed(6)} · 분석기 RMS: {state.level.toFixed(6)}</div><div>인식기: {state.status} · 분석 후보: {state.candidate||'없음'} · 코드 유지: {Math.round(state.stableMs)}ms</div><div>울림: {state.sustained.toFixed(6)} · 기준: {state.gate.toFixed(6)}</div><p>입력이 거의 없으면 Chrome 주소창의 사이트 설정에서 마이크 장치를 확인해 주세요. 소리가 들어오는데 코드가 없으면 위 값을 테스트 결과로 알려주세요.</p></details>
  {retry&&<button className="textbtn" onClick={retry}>코드 인식 다시 시도</button>}
 </div>;
}
