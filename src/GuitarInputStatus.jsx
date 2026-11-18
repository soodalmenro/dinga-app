import React,{useEffect,useRef,useState} from 'react';
import {ear,sameChord} from './guitarEar.js';
import {mic} from './lib.js';
import {currentEvaluationBundle} from './evaluationExport.js';
// 마이크 입력 막대와 입력 진단 정보는 평가 패널에서 켤 때만 보인다(참가자 화면이 아니다)
const DIAG_KEY='dinga-input-diagnostics';
export const readInputDiagnosticsFlag=()=>{try{return localStorage.getItem(DIAG_KEY)==='1';}catch{return false;}};
export const writeInputDiagnosticsFlag=(on)=>{try{localStorage.setItem(DIAG_KEY,on?'1':'0');}catch{}window.dispatchEvent(new Event('dinga-input-diagnostics'));};
// 지금 인식기 상태(코드 이름 등)를 주기적으로 읽는다. 말풍선 문구에 쓴다
export function useEarSnapshot(){
 const[state,setState]=useState(()=>ear.snapshot());
 useEffect(()=>{const refresh=()=>setState(ear.snapshot());const unwatch=ear.subscribe(refresh);const timer=setInterval(refresh,250);return()=>{unwatch();clearInterval(timer);};},[]);
 return state;
}
// 캐릭터 말풍선 문구: 시킬 말(코드를 쳐 주세요)과 들린 코드(… 코드 소리가 들려요)
export function earLine(state,target,ask){
 if(state.status==='loading')return '코드를 들을 준비를 하고 있어요';
 if(state.chord){
  if(!target)return `${state.chord} 코드 소리가 들려요!`;
  return sameChord(state.chord,target)?`${target} 코드 소리가 들려요!`:`지금은 ${state.chord} 코드예요. ${target} 코드를 쳐 주세요`;
 }
 return ask||(target?`${target} 코드를 쳐 주세요`:'아는 코드를 쳐 주세요!');
}
// 화면에는 아무 문장도 내지 않는다(평가 패널에서 진단 표시를 켰을 때만 입력 막대·진단 정보).
// 인식기가 실패하거나 멈추면 버튼 없이 자동으로 다시 연결한다(최대 3번, 3초 넘게 이어질 때).
export function GuitarInputStatus({retry}){
 const[diag,setDiag]=useState(readInputDiagnosticsFlag);
 useEffect(()=>{const sync=()=>setDiag(readInputDiagnosticsFlag());window.addEventListener('dinga-input-diagnostics',sync);return()=>window.removeEventListener('dinga-input-diagnostics',sync);},[]);
 const state=useEarSnapshot();
 const[input,setInput]=useState(0);
 useEffect(()=>{if(!diag)return undefined;const timer=setInterval(()=>setInput(mic.level()),250);return()=>clearInterval(timer);},[diag]);
 const badSince=useRef(null);const tries=useRef(0);
 useEffect(()=>{
  const bad=['failed','unsupported'].includes(state.status)&&!document.hidden;
  if(!bad){badSince.current=null;return;}
  if(badSince.current===null)badSince.current=performance.now();
  else if(retry&&tries.current<3&&performance.now()-badSince.current>3000){tries.current+=1;badSince.current=null;retry();}
 },[state,retry]);
 if(!diag)return null;
 return <div className="sub tc">
  <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontSize:12}}><span>마이크 입력</span><meter aria-label="마이크 입력 크기" min="0" max="0.1" value={Math.min(.1,input)} style={{width:100}}/><span>{input>=.0001?'입력 신호 있음':'입력이 거의 없음'}</span></div>
  <details style={{fontSize:12,textAlign:'left',marginTop:4}}><summary>입력 진단 정보</summary><div>입력 점검 2 · {currentEvaluationBundle()?.split('/').pop()||'개발 화면'}</div><div>마이크 RMS: {input.toFixed(6)} · 분석기 RMS: {state.level.toFixed(6)}</div><div>인식기: {state.status} · 분석 후보: {state.candidate||'없음'} · 코드 유지: {Math.round(state.stableMs)}ms</div><div>울림: {state.sustained.toFixed(6)} · 기준: {state.gate.toFixed(6)}</div><p>입력이 거의 없으면 Chrome 주소창의 사이트 설정에서 마이크 장치를 확인해 주세요. 소리가 들어오는데 코드가 없으면 위 값을 테스트 결과로 알려주세요.</p></details>
 </div>;
}
