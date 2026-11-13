// 레슨 실행 화면: 설명 → 코드 → 연주 → 박자 → 안 보고 치기 → 전환
// 자세: 화면 구성이 '아이디어 반영'이면 연주 단계 동안 작은 카메라로 보고 알림(P1),
//       'PRD 원본'이면 파트 첫 단계에서 한 번 찍는다(14 · 15)
import { Song } from './Song.jsx';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { content, mic, makeOnsetDetector, today, streak, sfx, logEvent , lessonsFor } from './lib.js';
import { Piki, Chord, Modal, Progress, Sparkles, Confetti } from './ui.jsx';
import { initPose, watchPosture } from './pose.js';
import { useMicrophone } from './useMicrophone.js';
import { usePracticePause } from './usePracticePause.js';
import { MicrophoneRecovery } from './MicrophoneRecovery.jsx';
import { observeMediaStream, mediaStreamIsLive } from './mediaLifecycle.js';

const PART_SECONDS = 180; // 파트 하나 약 3분
const TRANSITION_SECONDS = 120; // 전환 연습 약 2분

// 소리가 난 횟수를 센다
function useHits(active, micOn) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active || !micOn || mic.state !== 'on') return undefined;
    return makeOnsetDetector(() => setN((v) => v + 1));
  }, [active, micOn]);
  return n;
}
// 박자 타이머: 4박 카운트(음수) 뒤 0부터 beat가 올라간다
function useBeat(bpm, speed, running) {
  const [beat, setBeat] = useState(-4);
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => { if (!document.hidden) setBeat((b) => b + 1); }, 60000 / (bpm * speed));
    return () => clearInterval(id);
  }, [bpm, speed, running]);
  return [beat, setBeat];
}

function Posture({ lesson, s, update, next, speed, running }) {
  const [phase, setPhase] = useState('pre'); // pre | count | result | denied
  const [count, setCount] = useState(3);
  const [shot, setShot] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [res, setRes] = useState(null);
  const video = useRef(null);
  const stream = useRef(null);
  const openRequest = useRef(0);
  const stopWatch = useRef(null);
  const focus = lesson ? lesson.postureFocus : 'all';
  const tip = content.postureTips[focus];
  const stop = () => { openRequest.current += 1; if (stopWatch.current) stopWatch.current(); stopWatch.current = null; if (stream.current) stream.current.getTracks().forEach((t) => t.stop()); stream.current = null; };
  const open = async () => {
    stop();
    setPhase('pre');
    setCameraReady(false);
    const request = openRequest.current;
    try {
      const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      if (request !== openRequest.current) { st.getTracks().forEach((track) => track.stop()); return; }
      stream.current = st;
      stopWatch.current = observeMediaStream(st, () => { stop(); setCameraReady(false); setPhase('denied'); });
      setCameraReady(true);
      setPhase('pre');
    } catch (e) { if (request === openRequest.current) { logEvent('camera_denied'); setPhase('denied'); } }
  };
  useEffect(() => { open(); return stop; }, []);
  useEffect(() => {
    if (phase === 'pre' && cameraReady && video.current && stream.current) {
      video.current.srcObject = stream.current;
      video.current.play().catch(() => {});
    }
  }, [phase, cameraReady]);
  useEffect(() => {
    if (phase !== 'count' || !running) return undefined;
    if (count === 0) {
      if (!mediaStreamIsLive(stream.current)) { stop(); setCameraReady(false); setPhase('denied'); return undefined; }
      const v = video.current; let url = null;
      try { const c = document.createElement('canvas'); c.width = v.videoWidth || 480; c.height = v.videoHeight || 640; c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); url = c.toDataURL('image/jpeg', 0.7); } catch (e) {}
      stop(); setShot(url); // 사진은 이 화면에서만 쓰고 저장하지 않는다
      const sim = s.panel.posture === 'sim';
      const pick = (key) => (sim ? (Math.random() < (key === focus ? 0.4 : 0.15) ? 'warn' : 'ok') : null);
      const r = { wrist: pick('wrist'), thumb: pick('thumb'), shoulder: pick('shoulder') };
      setRes(r);
      if (sim) update((d) => { d.posture = { date: today(d), ...r }; });
      logEvent('posture', { mode: s.panel.posture, ...r });
      setPhase('result');
      return undefined;
    }
    const id = setTimeout(() => setCount((c) => c - 1), 1000 / speed);
    return () => clearTimeout(id);
  }, [phase, count, running]);
  const setItem = (k, v) => { const r = { ...res, [k]: v }; setRes(r); update((d) => { d.posture = { date: today(d), ...r }; }); };

  if (phase === 'denied') {
    return (<>
      <div className="cam"><div className="msg">카메라를 쓸 수 없어요</div></div>
      <div className="card soft"><div className="cap">자세 확인을 건너뛰고 연습할게요</div><div className="sub">카메라를 허용하면 다음부터 자세를 볼 수 있어요</div></div>
      <button className="btn line" onClick={open}>카메라 다시 켜기</button>
      <button className="btn" onClick={next}>다음 단계로</button>
    </>);
  }
  if (phase === 'result') {
    const keys = ['wrist', 'thumb', 'shoulder'].sort((a, b) => (a === focus ? -1 : b === focus ? 1 : 0));
    const warn = keys.find((k) => res[k] === 'warn');
    return (<>
      <div className="cam" style={{ flex: 'none', height: 220 }}>{shot ? <img src={shot} alt="" /> : <div className="msg">방금 찍은 모습</div>}</div>
      {s.panel.posture !== 'sim' && <div className="sub">가이드와 비교해서 직접 골라 주세요</div>}
      {keys.map((k) => (
        <div key={k} className={`card row between${k === focus ? ' sel' : ''}`} style={{ padding: '12px 16px' }}>
          <div className="row"><b>{content.postureTips[k].name}</b>{k === focus && <span className="cap">이번 레슨의 중심</span>}</div>
          {s.panel.posture === 'sim'
            ? <span className={`pill ${res[k] === 'ok' ? 'ok' : 'warn'}`}>{res[k] === 'ok' ? '괜찮음' : '주의'}</span>
            : <div className="row" style={{ gap: 6 }}>
              <button className={`pill ${res[k] === 'ok' ? 'ok' : 'none'}`} onClick={() => setItem(k, 'ok')}>괜찮음</button>
              <button className={`pill ${res[k] === 'warn' ? 'warn' : 'none'}`} onClick={() => setItem(k, 'warn')}>주의</button>
            </div>}
        </div>
      ))}
      {warn && <div className="card soft row fadeup"><Piki name="hi" size={44} still /><div style={{ fontSize: 13, fontWeight: 600 }}>{content.postureTips[warn].warn}</div></div>}
      <div className="grow" />
      <div className="two"><button className="btn soft" onClick={() => { setCount(3); setShot(null); open(); }}>다시 찍기</button><button className="btn" onClick={next}>연습 시작</button></div>
    </>);
  }
  return (<>
    <div><div className="cap">자세 확인</div><h2>{tip.title}</h2></div>
    <div className="cam">
      <video ref={video} playsInline muted />
      {!cameraReady && <div className="msg">카메라를 준비하고 있어요…</div>}
      <div className="guide" />
      {phase === 'count' && <div className="count">{count}</div>}
    </div>
    <div className="card soft"><div className="cap">이번 레슨에서 볼 곳: {tip.name}</div><div className="sub">사진은 저장하지 않아요</div></div>
    {phase === 'pre'
      ? <><button className="btn" disabled={!cameraReady} onClick={() => { setCount(3); setPhase('count'); }}>촬영 (3초 뒤)</button><button className="textbtn" onClick={() => { logEvent('posture_skip'); stop(); next(); }}>건너뛰기</button></>
      : <button className="btn line" onClick={() => setPhase('pre')}>취소</button>}
  </>);
}

function Card({ step, next }) {
  return (<>
    <div className="stage"><Piki name={step.img || 'hi'} size={200} /></div>
    <div><h1 style={{ fontSize: 22 }}>{step.title}</h1><div className="sub" style={{ marginTop: 6 }}>{step.text}</div></div>
    <button className="btn" onClick={next}>다음</button>
  </>);
}

function Diagram({ chord, next }) {
  const dots = content.chords[chord].dots;
  const [f, setF] = useState(0);
  const d = dots[f];
  return (<>
    <div><div className="cap">손가락 {f + 1}/{dots.length}</div><div className="big">{chord}</div></div>
    <div className="chordbox grow"><Chord name={chord} highlight={f} upTo={f} /></div>
    <div className="card soft row"><Piki name="yay" size={52} still /><b style={{ fontSize: 15 }}>{d.finger}번({d.name}) 손가락을 {d.string}번 줄 {d.fret}프렛에</b></div>
    <button className="btn" onClick={() => (f + 1 < dots.length ? setF(f + 1) : next())}>{f + 1 < dots.length ? '올렸어요' : '다 올렸어요'}</button>
  </>);
}

// 성공하면 아래에서 올라오는 초록 띠. 다음 행동은 버튼 하나뿐이다
function NextBar({ ok, micOn, next, okText = '좋아요! 소리가 잘 들렸어요' }) {
  useEffect(() => { if (ok && micOn) sfx.ok(); }, [ok]);
  if (ok && micOn) return <div className="feedback"><b>✓ {okText}</b><button className="btn green" onClick={next}>다음</button></div>;
  return <button className="btn" disabled={!ok} onClick={next}>다음</button>;
}

function HitDots({ n, need = 4 }) {
  return <div className="dots">{Array.from({ length: need }, (_, i) => <i key={i} className={i < n ? 'on' : ''}>{i < n ? '✓' : ''}</i>)}</div>;
}

function Play({ step, chord, next, micOn, running }) {
  const n = useHits(running, micOn);
  const ok = micOn === false || n >= 4;
  return (<>
    <div><div className="cap">소리 내기</div><div className="big">{step.showChord ? chord : '튕겨 보기'}</div></div>
    {step.showChord && <div className="chordbox"><Chord name={chord} scale={0.62} /></div>}
    <h2>{step.text}</h2>
    <HitDots n={n} />
    {micOn === null && <div className="sub tc">마이크를 준비하고 있어요…</div>}
    {micOn === false && <div className="sub tc">마이크 없이 진행 중이에요. 쳐 본 뒤 다음을 눌러요.</div>}
    <div className="grow"><Piki name={n > 0 ? 'yay' : 'listen'} size={150} /></div>
    <NextBar ok={ok} micOn={micOn} next={next} />
  </>);
}

function Beat({ chord, next, micOn, speed, running }) {
  const [bpm, setBpm] = useState(50);
  const [fin, setFin] = useState(false);
  const [beat, setBeat] = useBeat(bpm, speed, running && micOn !== null && !fin);
  const [hits, setHits] = useState({});
  const beatRef = useRef(beat); beatRef.current = beat;
  useEffect(() => {
    if (!running || !micOn || mic.state !== 'on') return undefined;
    return makeOnsetDetector(() => { if (beatRef.current >= 0) setHits((h) => ({ ...h, [beatRef.current]: true })); });
  }, [running, micOn]);
  useEffect(() => {
    if (beat >= 8 && bpm === 50) { setBpm(60); setBeat(-4); setHits({}); }
    if (beat >= 8 && bpm === 60) setFin(true);
  }, [beat]);
  const bar = Math.floor(Math.max(beat, 0) / 4);
  return (<>
    <div><div className="cap">박자에 맞춰 쳐요</div><div className="big">{chord}</div></div>
    <div className="row" style={{ justifyContent: 'center' }}><span className={`pill ${bpm === 50 ? 'y' : 'none'}`}>50 BPM</span><b style={{ color: 'var(--gray)' }}>→</b><span className={`pill ${bpm === 60 ? 'y' : 'none'}`}>60 BPM</span></div>
    <div className="dots beat">{[0, 1, 2, 3].map((i) => { const b = bar * 4 + i; const now = !fin && beat >= 0 && beat % 4 === i; return <i key={i} className={hits[b] && beat >= 0 ? 'hit' : now ? 'now' : ''}>{i + 1}</i>; })}</div>
    <div className="sub tc">{fin ? '잘했어요! 두 템포를 모두 마쳤어요' : beat < 0 ? `준비… ${-beat}` : `${bar + 1} / 2 마디`}</div>
    <div className="grow"><Piki name="yay" size={170} /></div>
    <NextBar ok={fin} micOn={micOn} next={next} okText="두 템포를 모두 마쳤어요" />
    {!fin && <div className="sub tc" style={{ fontSize: 12 }}>두 템포를 마치면 넘어갈 수 있어요</div>}
  </>);
}

function Blind({ chord, next, micOn, running }) {
  const n = useHits(running, micOn);
  const [hint, setHint] = useState(false);
  useEffect(() => { if (!hint) return undefined; const id = setTimeout(() => setHint(false), 3000); return () => clearTimeout(id); }, [hint]);
  return (<>
    <div><div className="cap">안 보고 치기</div><div className="big">{chord}</div></div>
    {hint ? <div className="chordbox"><Chord name={chord} scale={0.62} /></div>
      : <div className="hidden-chord"><div className="big" style={{ color: 'var(--o)' }}>?</div><div className="sub">코드 모양은 숨겼어요</div></div>}
    <h2>화면을 보지 않고 {chord} 코드를 잡고 쳐 보세요</h2>
    <HitDots n={n} />
    <div className="grow"><Piki name="listen" size={130} /></div>
    {!(micOn && n >= 4) && <button className="btn line" onClick={() => setHint(true)}>힌트 보기 (3초)</button>}
    {micOn === null && <div className="sub tc">마이크를 준비하고 있어요…</div>}
    <NextBar ok={micOn === false || n >= 4} micOn={micOn} next={next} okText="안 보고도 쳤어요!" />
  </>);
}

export function Transition({ pair, next, speed, setBarProgress, running }) {
  const [beat] = useBeat(50, speed, running);
  const bar = Math.floor(Math.max(beat, 0) / 4);
  const cur = Math.floor(bar / 2) % 2;
  useEffect(() => { if (setBarProgress) setBarProgress(Math.min(bar, 8)); if (bar >= 8) next(); }, [bar]);
  const key = `${pair[0]}-${pair[1]}`;
  return (<>
    <div><div className="cap">코드 전환 · {Math.min(bar + 1, 8)} / 8 마디</div><div className="big" style={{ fontSize: 36 }}>{pair[0]} ↔ {pair[1]}</div></div>
    <div className="row">
      <div className={`nowcard${cur === 0 ? ' on' : ''}`}><b>{pair[0]}</b><small>{cur === 0 ? '지금' : '다음'}</small></div>
      <b style={{ color: 'var(--gray)', fontSize: 22 }}>{cur === 0 ? '→' : '←'}</b>
      <div className={`nowcard${cur === 1 ? ' on' : ''}`}><b>{pair[1]}</b><small>{cur === 1 ? '지금' : '다음'}</small></div>
    </div>
    <div className="dots beat">{[0, 1, 2, 3].map((i) => <i key={i} className={beat >= 0 && beat % 4 === i ? 'hit' : ''}>{i + 1}</i>)}</div>
    <div className="row" style={{ justifyContent: 'center' }}><span className="pill none">{beat < 0 ? `준비… ${-beat}` : '50 BPM · 2마디마다 바꾸기'}</span></div>
    <div className="grow"><Piki name="yay" size={140} /></div>
    <div className="card soft row"><Piki name="hi" size={44} still /><div style={{ fontSize: 13, fontWeight: 600 }}>{content.transitionTips[key] || content.stuckTips.transition}</div></div>
  </>);
}

const LIVE = ['play', 'beat', 'blind', 'transition']; // 자세를 보는 연주 단계

// 오른쪽 위 작은 카메라. 누르면 접힌다
function LiveCam({ stream, cam, note, retry }) {
  const v = useRef(null);
  const [hide, setHide] = useState(false);
  useEffect(() => { if (v.current && stream.current) { v.current.srcObject = stream.current; v.current.play().catch(() => {}); } }, [cam, hide]);
  if (cam === 'denied') return <button className="pip mini" onClick={retry}>카메라 다시 켜기</button>;
  if (hide) return <button className="pip mini" onClick={() => setHide(false)}>내 모습 보기</button>;
  return (
    <button className="pip" onClick={retry || (() => setHide(true))} aria-label={retry ? '자세 판정 다시 시도' : '내 모습 숨기기'}>
      {cam === 'on' ? <video ref={v} playsInline muted /> : null}
      <span>{cam === 'on' ? note : '카메라 준비 중'}</span>
    </button>
  );
}

export default function Lesson({ s, update, target, go }) {
  const lesson = lessonsFor(s).find((l) => l.id === target.lesson);
  const def = target.custom || lesson.parts[target.part];
  const idea = s.panel.variant === 'idea';
  const steps = useMemo(() => def.steps.filter((st) => !((target.review || idea) && st.type === 'posture')), []);
  const [idx, setIdx] = useState(Math.min(target.step || 0, steps.length - 1));
  const [exit, setExit] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [done, setDone] = useState(false);
  const background = usePracticePause(!done);
  const microphone = useMicrophone();
  const { micOn, skipMic, inputLost } = microphone;
  const [tbar, setTbar] = useState(0);
  const start = useRef(Date.now());
  const pausedTime = useRef(0);
  const pausedAt = useRef(null);
  const suspended = exit || stuck || background.paused || inputLost;
  const speed = s.panel.speed;
  const elapsed = () => Math.floor((((pausedAt.current ?? Date.now()) - start.current - pausedTime.current) / 1000) * speed);
  useEffect(() => {
    if (suspended) pausedAt.current = background.pausedAt.current ?? Date.now();
    else if (pausedAt.current != null) {
      pausedTime.current += Date.now() - pausedAt.current;
      pausedAt.current = null;
    }
  }, [suspended]);
  const step = steps[idx];
  const chord = step.chord || (lesson ? lesson.chord : null);
  const back = target.back || 'learn';

  // 파트가 곡 연주로 바로 시작하면(레슨 4 · 파트 3, 자세 촬영이 없는 구성) 곧장 곡 화면으로 간다
  useEffect(() => { if (steps[idx].type === 'song') go(idea ? 'songplay' : 'song', { fromLesson: true, back: 'learn', key: Date.now() }); }, []);

  // ---------- 연주 중 자세 알림 (P1) ----------
  const live = idea && !done && !background.paused && LIVE.includes(step.type);
  const focus = lesson ? lesson.postureFocus : 'all';
  const camStream = useRef(null);
  const eye = useRef(null); // 판정용 영상(화면에는 안 보임)
  const [cam, setCam] = useState('off'); // off | on | denied
  const [poseState, setPoseState] = useState('off'); // off | loading | ready | fail
  const [poseNote, setPoseNote] = useState('몸이 안 보여요');
  const [framing, setFraming] = useState(null);
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const [poseAttempt, setPoseAttempt] = useState(0);
  const [alertKind, setAlertKind] = useState(null);
  const alerts = useRef({ n: 0, last: 0, timed: false });
  const alertTimer = useRef(null);
  const liveRef = useRef(live); liveRef.current = live && !suspended;
  const mode = s.panel.alert; // auto 정해진 시점(기본, 11/11 팀 결정) | real 실제 판정 | manual 진행자가 띄움 | off
  const fire = (kind, how, value) => {
    if (!liveRef.current) return;
    alerts.current.n += 1; alerts.current.last = performance.now();
    setAlertKind(kind); sfx.alert();
    logEvent('posture_alert', { how, kind, value: value == null ? undefined : Math.round(value) });
    clearTimeout(alertTimer.current);
    alertTimer.current = setTimeout(() => setAlertKind(null), 3000);
  };
  const fireRef = useRef(fire); fireRef.current = fire;
  useEffect(() => {
    if (!live) { clearTimeout(alertTimer.current); setAlertKind(null); }
    return () => clearTimeout(alertTimer.current);
  }, [live]);
  // 연주 단계를 벗어나거나 파트를 끝내면 해당 스트림을 해제한다.
  useEffect(() => {
    if (!live) { setCam('off'); return undefined; }
    let dead = false; let acquired = null; let stopCameraWatch;
    setCam('off');
    (async () => {
      try {
        const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        if (dead) { st.getTracks().forEach((t) => t.stop()); return; }
        acquired = st;
        camStream.current = st;
        stopCameraWatch = observeMediaStream(st, () => {
          if (dead || camStream.current !== st) return;
          if (stopCameraWatch) stopCameraWatch();
          st.getTracks().forEach((track) => track.stop()); camStream.current = null;
          setCam('denied'); logEvent('camera_interrupted', { where: 'live' });
        });
        if (eye.current) { eye.current.srcObject = st; eye.current.play().catch(() => {}); }
        setCam('on');
      } catch (e) { if (!dead) { logEvent('camera_denied', { where: 'live' }); setCam('denied'); } }
    })();
    return () => {
      dead = true;
      if (stopCameraWatch) stopCameraWatch();
      if (acquired) acquired.getTracks().forEach((track) => track.stop());
      if (camStream.current === acquired) camStream.current = null;
    };
  }, [live, cameraAttempt]);
  // 실제 판정: 자세가 기준을 넘은 채 이어지면 알림
  useEffect(() => {
    if (!live || suspended || cam !== 'on' || mode !== 'real') return undefined;
    let stop = null; let dead = false;
    setPoseState('loading');
    initPose().then((ok) => {
      if (dead) return;
      logEvent(ok ? 'pose_ready' : 'pose_fail');
      setPoseState(ok ? 'ready' : 'fail');
      if (!ok) return;
      const th = content.poseThresholds;
      let previousStatus;
      stop = watchPosture(eye.current, {
        focus: ['wrist', 'shoulder'].includes(focus) ? focus : 'all',
        onStatus: (st, measured, guidance) => {
          if (st === 'error') {
            setPoseState('fail');
            logEvent('pose_fail', { where: 'tracking' });
            return;
          }
          const wristVisible = measured && measured.wrist != null;
          const shoulderVisible = measured && measured.tilt != null;
          const note = st === 'nobody' ? '몸이 안 보여요'
            : focus === 'wrist' && !wristVisible ? '손목이 안 보여요'
              : focus === 'shoulder' && !shoulderVisible ? '어깨가 안 보여요'
                : '자세 보는 중';
          setPoseNote(note);
          setFraming(guidance);
          if (note !== previousStatus) {
            logEvent('pose_status', { status: note, wristVisible: !!wristVisible, shoulderVisible: !!shoulderVisible });
            previousStatus = note;
          }
        },
        onIssue: (kind, m) => {
          const a = alerts.current;
          if (!liveRef.current || a.n >= th.maxPerPart || (a.last && performance.now() - a.last < th.cooldownMs)) return;
          fireRef.current(kind, 'real', kind === 'wrist' ? m.wrist : m.tilt);
        },
      });
    });
    return () => { dead = true; if (stop) stop(); };
  }, [cam, mode, live, poseAttempt, suspended]);
  // 정해진 시점: 연주 단계에 들어가고 5초 뒤 한 번 (파트당 1번)
  useEffect(() => {
    if (!live || suspended || cam !== 'on' || mode !== 'auto' || alerts.current.timed) return undefined;
    const id = setTimeout(() => { alerts.current.timed = true; fireRef.current(focus === 'all' ? 'wrist' : focus, 'timed'); }, 5000 / speed);
    return () => clearTimeout(id);
  }, [live, cam, mode, idx, suspended]);
  // 진행자가 띄움: 평가 패널의 [지금 띄우기]
  useEffect(() => {
    let timer;
    const h = () => { clearTimeout(timer); timer = setTimeout(() => fireRef.current(focus === 'all' ? 'wrist' : focus, 'manual'), 1200); };
    window.addEventListener('dinga-alert', h);
    return () => { clearTimeout(timer); window.removeEventListener('dinga-alert', h); };
  }, []);
  const camNote = mode !== 'real' ? '내 모습' : poseState === 'ready' ? poseNote : poseState === 'fail' ? '판정 꺼짐 · 다시 시도' : '준비 중';
  const retryCamera = () => setCameraAttempt((value) => value + 1);
  const retryPose = cam === 'on' && mode === 'real' && poseState === 'fail' ? () => setPoseAttempt((value) => value + 1) : undefined;
  useEffect(() => { logEvent('step', { lesson: target.lesson || 'transition', part: target.part, step: idx, kind: steps[idx].type }); }, [idx]);

  const finish = () => {
    update((d) => {
      const t = today(d);
      d.history[t] = (d.history[t] || 0) + (target.custom ? TRANSITION_SECONDS : PART_SECONDS);
      if (!target.custom) d.done[target.lesson][target.part] = true;
      if (!target.custom && !target.review) d.resume = null;
    });
    logEvent('part_done', { lesson: target.lesson || 'transition', part: target.part, seconds: elapsed() });
    setDone(true); sfx.done();
  };
  const next = () => {
    const n = steps[idx + 1];
    if (!n) return finish();
    if (n.type === 'song') return go(idea ? 'songplay' : 'song', { fromLesson: true, back: 'learn', key: Date.now() });
    return setIdx(idx + 1);
  };
  const nextRef = useRef(next); nextRef.current = next;
  useEffect(() => { const h = () => nextRef.current(); window.addEventListener('dinga-skip', h); return () => window.removeEventListener('dinga-skip', h); }, []);

  const leave = () => {
    const e = elapsed();
    logEvent('exit', { lesson: target.lesson || 'transition', part: target.part, step: idx, seconds: e, saved: e >= 60 });
    update((d) => {
      const t = today(d);
      if (e >= 60) d.history[t] = (d.history[t] || 0) + e;
      if (!target.custom && !target.review) d.resume = { lesson: target.lesson, part: target.part, step: idx };
    });
    go(back);
  };

  if (done) {
    const mins = Math.floor((s.history[today(s)] || 0) / 60);
    const hasNext = !target.custom && !target.review && target.part < 2;
    return (
      <div className="screen center">
        <Confetti />
        <div className="grow rel w100"><Sparkles /><div className="avatar pop" style={{ width: 280, height: 280 }}><Piki name="clap" size={220} /></div></div>
        <h1 style={{ fontSize: 30, color: 'var(--ot)' }}>{target.custom ? '전환 연습 완료!' : '파트 완료!'}</h1>
        <div className="sub">‘{def.title}’ 완료</div>
        <div className="row w100">
          <div className="chip" style={{ background: 'var(--o)' }}><span>이번 연습</span><b style={{ color: 'var(--ot)' }}>{target.custom ? 2 : 3}분</b></div>
          <div className="chip" style={{ background: '#F2617A' }}><span>오늘 연습</span><b style={{ color: '#F2617A' }}>{mins}분</b></div>
          <div className="chip" style={{ background: '#2FA8E8' }}><span>연속 출석</span><b style={{ color: '#2FA8E8' }}>{streak(s)}일</b></div>
        </div>
        {hasNext
          ? <><button className="btn" onClick={() => go('lesson', { lesson: target.lesson, part: target.part + 1, step: 0, key: Date.now() })}>다음 파트</button><button className="btn line" onClick={() => go('home')}>홈으로</button></>
          : <><button className="btn" onClick={() => go(back, back === 'learn' ? { course: true } : {})}>{back === 'report' || back === 'songreport' ? '리포트로 돌아가기' : back === 'practice' ? '연습 탭으로' : idea ? '코스로' : '학습으로'}</button><button className="btn line" onClick={() => go('home')}>홈으로</button></>}
      </div>
    );
  }

  if (step.type === 'song') return <div className="screen center"><div className="grow sub">곡을 준비하고 있어요…</div></div>;
  const total = step.type === 'transition' ? 8 : steps.length;
  const now = step.type === 'transition' ? tbar : idx + 1;
  const props = { step, lesson, chord, next, micOn, speed, s, update, running: !suspended };
  const al = alertKind && (content.liveAlerts[alertKind] || content.liveAlerts.all);
  return (<>
    {idea && <video ref={eye} className="eye" playsInline muted />}
    {live && <LiveCam stream={camStream} cam={cam} note={camNote} retry={cam === 'denied' ? retryCamera : retryPose} />}
    {al && <div className="palert" role="status"><i>!</i><div><b>{al.title}</b><small>{al.text}</small></div></div>}
    <div className="screen" key={idx}>
      <div className="row">
        <button className="iconbtn" onClick={() => setExit(true)} aria-label="나가기">✕</button>
        <Progress n={now} total={total} />
        {step.type !== 'posture' && <button className="textbtn" onClick={() => { logEvent('stuck', { kind: step.type }); setStuck(true); }}>막혔어요</button>}
      </div>
      {live && cam === 'denied' && <div className="sub" style={{ fontSize: 12 }}>카메라를 쓸 수 없어 자세 알림 없이 연습해요</div>}
      {live && mode === 'real' && poseState === 'ready' && framing && !framing.ready && <div className="sub" style={{ fontSize: 12 }} role="status">{framing.instruction}</div>}
      {step.type === 'posture' && <Posture {...props} />}
      {step.type === 'card' && <Card {...props} />}
      {step.type === 'diagram' && <Diagram {...props} />}
      {step.type === 'play' && <Play {...props} />}
      {step.type === 'beat' && <Beat key={idx} {...props} />}
      {step.type === 'blind' && <Blind {...props} />}
      {micOn === null && !inputLost && <button className="textbtn" onClick={skipMic}>마이크 없이 계속하기</button>}
      {step.type === 'transition' && idea && <Song key={idx} s={s} update={update} go={go} microphone={microphone} paused={suspended} restartCurrentBar={background.paused} params={{ pair: step.pair, onDone: next }} />}
      {step.type === 'transition' && !idea && <Transition pair={step.pair} next={next} speed={speed} setBarProgress={setTbar} running={!suspended} />}
      {exit && (
        <Modal onClose={() => setExit(false)}>
          <div className="col" style={{ alignItems: 'center', gap: 10 }}>
            <Piki name="sulky" size={90} still />
            <h1 style={{ fontSize: 20 }}>지금 나갈까요?</h1>
            <div className="sub tc">{elapsed() >= 60 ? `지금까지 ${Math.floor(elapsed() / 60)}분이 저장돼요.` : '1분이 안 돼서 시간은 저장되지 않아요.'}{!target.custom && !target.review && <><br />다음에 이 단계부터 이어서 할 수 있어요.</>}</div>
          </div>
          <div className="two"><button className="btn line" onClick={leave}>나가기</button><button className="btn" onClick={() => setExit(false)}>계속하기</button></div>
        </Modal>
      )}
      {stuck && (
        <Modal bottom onClose={() => setStuck(false)}>
          <h1 style={{ fontSize: 20 }}>막혔어요</h1>
          <div className="card soft row"><Piki name="hi" size={44} still /><div style={{ fontSize: 13, fontWeight: 600 }}>{content.stuckTips[step.type] || content.stuckTips.play}</div></div>
          <button className="btn" onClick={() => setStuck(false)}>다시 해볼게요</button>
          <button className="btn line" onClick={() => { logEvent('skip', { kind: step.type }); setStuck(false); next(); }}>이 단계 건너뛰기</button>
        </Modal>
      )}
      {background.paused && !inputLost && <Modal onClose={background.resume}><h1>연습을 잠시 멈췄어요</h1><div className="sub">준비되면 멈춘 단계부터 이어서 연습해요.</div><button className="btn" onClick={background.resume}>계속 연습하기</button></Modal>}
      {!exit && !stuck && <MicrophoneRecovery microphone={microphone} onExit={() => setExit(true)} onResume={background.resume} withoutMicHint={step.type === 'transition' ? '마이크 없이 진행하면 이번 전환 연습은 모의 판정으로 처음부터 다시 시작해요.' : undefined} />}
    </div>
  </>);
}
