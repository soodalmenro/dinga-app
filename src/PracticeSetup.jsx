import React, { useEffect, useRef, useState } from 'react';
import { mic, applyInputCalibration, clearInputCalibration, logEvent } from './lib.js';
import { deriveInputCalibration } from './inputCalibration.js';
import { initPose, watchPosture } from './pose.js';

const INPUT_MESSAGES = {
  noise: '주변 소음이 커요. 더 조용한 곳에서 다시 확인해 주세요.',
  signal: '시험 소리가 충분히 구분되지 않았어요. 폰을 조금 가까이 두고 다시 튕겨 주세요.',
  clipping: '입력 소리가 너무 커요. 폰을 조금 멀리 두고 다시 확인해 주세요.',
  samples: '확인할 소리가 충분히 모이지 않았어요. 다시 확인해 주세요.',
  invalid: '입력 소리를 확인할 수 없어요. 다시 확인해 주세요.',
};

function MicrophoneSetup() {
  const [phase, setPhase] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const request = useRef(0); const timer = useRef(null);
  const release = () => { request.current += 1; clearInterval(timer.current); mic.stop(); };
  const cancel = (next = 'idle') => { release(); setResult(null); setPhase(next); };
  useEffect(() => {
    const hidden = () => { if (document.hidden) cancel('paused'); };
    document.addEventListener('visibilitychange', hidden);
    return () => { document.removeEventListener('visibilitychange', hidden); release(); };
  }, []);
  const start = async () => {
    release(); clearInputCalibration();
    const current = request.current;
    setResult(null); setPhase('request'); setProgress(0);
    const ok = await mic.start();
    if (current !== request.current) return;
    if (!ok) { setPhase('denied'); return; }
    let stage = 'noise'; let observed = 0; let last = performance.now(); const noise = []; const signal = [];
    setPhase(stage);
    timer.current = setInterval(() => {
      const now = performance.now(); const delta = now - last; last = now;
      if (document.hidden || delta > 250 || mic.state !== 'on') { cancel('paused'); return; }
      (stage === 'noise' ? noise : signal).push(mic.level());
      observed += delta; setProgress(Math.min(1, observed / 2000));
      if (observed < 2000) return;
      if (stage === 'noise') { stage = 'signal'; observed = 0; setProgress(0); setPhase(stage); return; }
      clearInterval(timer.current);
      const derived = deriveInputCalibration(noise, signal);
      setResult(derived); setPhase('result');
      logEvent('input_check', { ok: derived.ok, reason: derived.reason || 'ready' });
    }, 40);
  };
  const busy = ['request', 'noise', 'signal'].includes(phase);
  const apply = () => {
    if (!applyInputCalibration(result)) { cancel('paused'); return; }
    setPhase('applied'); logEvent('input_calibration', { mode: 'session' });
  };
  return <section className="card col" style={{ gap: 12 }} aria-label="마이크 입력 준비">
    <h2>마이크 입력</h2>
    <div className="sub">주변 소음을 2초 확인한 뒤, 기타 줄을 한 번 튕겨 입력을 확인해요.</div>
    <div aria-live="polite">
      {phase === 'request' && <p className="sub">마이크 권한을 확인하고 있어요. 응답이 늦으면 중단해도 괜찮아요.</p>}
      {phase === 'noise' && <h3>잠시 조용히 있어 주세요</h3>}
      {phase === 'signal' && <h3>기타 줄을 한 번 튕겨 주세요</h3>}
      {['noise', 'signal'].includes(phase) && <progress aria-label="입력 확인 진행" max="1" value={progress} style={{ width: '100%' }} />}
      {phase === 'denied' && <p className="sub">마이크를 사용할 수 없어요. 사이트 권한을 확인하거나 기본 기준으로 계속할 수 있어요.</p>}
      {phase === 'paused' && <p className="sub">입력 확인을 멈췄어요. 준비되면 다시 확인해 주세요.</p>}
      {phase === 'result' && result && <><h3>{result.ok ? '입력 소리를 구분할 수 있어요' : '입력을 다시 확인해 주세요'}</h3><p className="sub">{result.ok ? '이 마이크에 최대 10분 동안 적용해요. 기기를 바꾸거나 화면을 새로 열면 다시 확인해 주세요.' : INPUT_MESSAGES[result.reason]}</p></>}
      {phase === 'applied' && <p className="sub">입력 기준을 준비했어요. 환경이 달라지면 다시 확인해 주세요.</p>}
      {phase === 'default' && <p className="sub">기본 입력 기준으로 연습해요.</p>}
    </div>
    {phase === 'result' && result?.ok && <button className="btn sm" onClick={apply}>이 기준으로 사용하기</button>}
    {!busy && <button className="btn sm line" onClick={start}>{phase === 'idle' ? '마이크 확인하기' : '마이크 다시 확인'}</button>}
    {busy && <button className="textbtn" onClick={() => cancel()}>마이크 확인 중단</button>}
    {!busy && phase !== 'idle' && phase !== 'default' && <button className="textbtn" onClick={() => { cancel('default'); clearInputCalibration(); }}>기본 기준으로 사용하기</button>}
  </section>;
}

function CameraSetup() {
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState('idle');
  const [guide, setGuide] = useState(null);
  const video = useRef(null);
  useEffect(() => {
    const hidden = () => { if (document.hidden) { setAttempt(0); setPhase('paused'); setGuide(null); } };
    document.addEventListener('visibilitychange', hidden);
    return () => document.removeEventListener('visibilitychange', hidden);
  }, []);
  useEffect(() => {
    if (!attempt) return undefined;
    let dead = false; let stream; let stop;
    const releaseStream = () => {
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (video.current && video.current.srcObject === stream) video.current.srcObject = null;
      stream = null;
    };
    setPhase('request'); setGuide(null);
    (async () => {
      try {
        const acquired = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        if (dead) { acquired.getTracks().forEach((track) => track.stop()); return; }
        stream = acquired;
        if (video.current) { video.current.srcObject = acquired; video.current.play().catch(() => {}); }
        setPhase('loading');
        const ok = await initPose();
        if (dead) return;
        if (!ok) { releaseStream(); setPhase('failed'); return; }
        setPhase('tracking');
        stop = watchPosture(video.current, {
          onIssue: () => {},
          onStatus: (status, measured, framing) => {
            if (status === 'error') { releaseStream(); setPhase('failed'); return; }
            setGuide(framing);
          },
        });
      } catch (error) { if (!dead) setPhase('denied'); }
    })();
    return () => {
      dead = true; if (stop) stop();
      releaseStream();
    };
  }, [attempt]);
  return <section className="card col" style={{ gap: 12 }} aria-label="카메라 위치 준비">
    <h2>카메라 위치</h2>
    <div className="sub">폰을 고정하고 양쪽 어깨와 코드 잡는 팔·손을 함께 보여 주세요. 영상은 저장하지 않아요.</div>
    <div className="setup-camera"><video ref={video} playsInline muted />{!attempt && <span>폰을 세워 두고 위치를 확인해요</span>}</div>
    <div aria-live="polite">
      {phase === 'request' && <p className="sub">카메라 권한을 확인하고 있어요.</p>}
      {phase === 'loading' && <p className="sub">촬영 위치를 확인할 준비를 하고 있어요.</p>}
      {phase === 'denied' && <p className="sub">카메라를 사용할 수 없어요. 사이트 권한을 확인하거나 확인을 마쳐도 괜찮아요.</p>}
      {phase === 'failed' && <p className="sub">촬영 위치 확인이 멈췄어요. 다시 확인하거나 확인을 마쳐 주세요.</p>}
      {phase === 'paused' && <p className="sub">카메라 확인을 멈췄어요. 준비되면 다시 확인해 주세요.</p>}
      {phase === 'tracking' && guide && <><h3>{guide.title}</h3><div className="sub">{guide.instruction}</div></>}
    </div>
    <button className="btn sm line" onClick={() => setAttempt((value) => value + 1)}>{phase === 'idle' ? '카메라 확인하기' : '카메라 다시 확인'}</button>
    {attempt > 0 && <button className="textbtn" onClick={() => { setAttempt(0); setGuide(null); setPhase('idle'); }}>카메라 확인 중단</button>}
  </section>;
}

export default function PracticeSetup({ go }) {
  return <div className="screen setup">
    <h1 style={{ fontSize: 23 }}>연습 환경 확인</h1>
    <div className="sub">필요한 항목만 확인해도 괜찮아요. 기타가 없다면 다음에 입력을 확인할 수 있어요.</div>
    <MicrophoneSetup />
    <CameraSetup />
    <button className="btn" onClick={() => go('home')}>확인 마치기</button>
  </div>;
}
