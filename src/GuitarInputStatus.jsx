import React,{useEffect,useState} from 'react';
import {ear} from './guitarEar.js';
export function GuitarInputStatus({target,retry}){
 const[state,setState]=useState(()=>ear.snapshot());
 useEffect(()=>{const refresh=()=>setState(ear.snapshot());const unwatch=ear.subscribe(refresh);const timer=setInterval(refresh,250);return()=>{unwatch();clearInterval(timer);};},[]);
 const failed=['failed','unsupported','stale','paused'].includes(state.status);
 const label=failed?(state.status==='stale'||state.status==='paused'?'새 오디오 입력을 기다리고 있어요. 계속 멈춰 있으면 다시 시도해 주세요.':'코드 인식기를 준비하지 못했어요. 소리 크기만으로 성공 처리하지 않아요.'):state.status==='loading'?'코드 인식 준비 중이에요…':state.chord?`들리는 코드: ${state.chord}${target&&state.chord!==target?` · 목표 ${target}`:''}`:'기타 코드를 기다려요. 코드가 확인된 입력만 세어요.';
 return <div className="sub tc" role="status">{label}{failed&&retry&&<button className="textbtn" onClick={retry}>코드 인식 다시 시도</button>}</div>;
}
