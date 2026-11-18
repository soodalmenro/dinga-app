// 레슨 실행 화면: 설명 → 코드 → 연주 → 박자 → 안 보고 치기 → 전환
// 자세(피그마 Flow 11/16): '아이디어 반영'은 레슨 첫 파트에서만 한 번 촬영(S7)하고 결과는 흉내 낸 값이다.
//       연주 중에는 카메라 창을 계속 띄우지 않는다. 연주 단계 5초 뒤 알림이 뜰 때만
//       문구 + 진동 1번 + 카메라 창과 교정 그림을 3초 보여 주고 닫는다(P1, 파트당 1번).
//       'PRD 원본'은 파트마다 첫 단계에서 찍는다(14 · 15)
import { Song } from './Song.jsx';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { content, mic, makeOnsetDetector, today, streak, sfx, logEvent , lessonsFor, partSteps } from './lib.js';
import { PostureCoach } from './SongPosture.jsx';
import { postureCopy } from './PostureReminder.jsx';
import { checkPosture, loadPostureCheck, POSTURE_ITEMS } from './postureCheck.js';
import { Piki, Chord, Modal, Progress, Sparkles, Confetti } from './ui.jsx';
import { initPose, watchPosture, clearBaseline } from './pose.js';
import { PoseDebug, readPoseDebugFlag } from './PoseDebug.jsx';
import { useMicrophone } from './useMicrophone.js';
import { usePracticePause } from './usePracticePause.js';
import { MicrophoneRecovery } from './MicrophoneRecovery.jsx';
import { observeMediaStream, mediaStreamIsLive } from './mediaLifecycle.js';
import { useBeforeUnload } from './useBeforeUnload.js';
import { GuitarInputStatus } from './GuitarInputStatus.jsx';

const PART_SECONDS = 180; // 파트 하나 약 3분
const TRANSITION_SECONDS = 120; // 전환 연습 약 2분

// 소리가 난 횟수를 센다
function useHits(active, micOn, target=null,simulated=false) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active || !micOn || mic.state !== 'on') return undefined;
    return makeOnsetDetector(() => setN((v) => v + 1),{target,simulated});
  }, [active, micOn,target,simulated]);
  return n;
}
// 박자 타이머: 4박 카운트(음수) 뒤 0부터 beat가 올라간다
function useBeat(bpm, speed, running, limit=Infinity) {
  const [beat, setBeat] = useState(-4);
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => { if (!document.hidden) setBeat((b) => Math.min(b+1,limit)); }, 60000 / (bpm * speed));
    return () => clearInterval(id);
  }, [bpm, speed, running,limit]);
  return [beat, setBeat];
}

const usableCaptureFrame = (video) => video?.readyState >= 2
  && Number.isFinite(video.videoWidth) && video.videoWidth > 0
  && Number.isFinite(video.videoHeight) && video.videoHeight > 0;

// 자세 가이드 선(피그마 14 · S7 · 15): 카메라 화면 위에 상체·기타 윤곽을 흐린 점선으로 깔고
// 어깨선과 코드 잡는 팔 선을 그린다. 틀에 맞춰 앉게 돕는 그림이며 실제 관절을 찾아 그린 선은 아니다.
// 윤곽은 바른 자세 참고 사진을 보고 따라 그린 선이다(GUIDE_OUTLINE).
// mode: 'pre' 촬영 전(라벨 있음) | 'count' 3초 카운트(더 흐리게) | 'result' 결과(부위별 초록/주황)
const GUIDE_OUTLINE = [
  'M450,15 Q470,112 560,125 Q645,115 662,25',
  'M450,15 Q330,35 270,62 Q150,110 72,168 L98,208 L165,232',
  'M662,25 Q760,70 800,140 Q830,210 842,300',
  'M748,372 L812,352 M842,300 L850,335',
  'M40,200 Q110,250 190,318 M35,255 Q110,330 185,425',
  'M190,318 Q250,300 300,345 Q335,365 325,380 Q290,400 300,430 Q250,460 195,440 Z',
  'M160,228 Q250,270 330,240 Q420,180 478,228 Q540,330 548,440 Q545,540 480,592 Q380,560 300,572 Q180,640 120,690 Q40,680 20,620 Q10,470 70,315 Q110,260 160,228',
  'M320,395 m-56,0 a56,56 0 1,0 112,0 a56,56 0 1,0 -112,0',
  'M372,345 L1025,185 L1025,265 L376,415 Z',
  'M878,205 Q905,170 935,195 Q990,215 1000,250 Q1030,275 1012,305 Q960,330 930,350 Q870,370 842,335 Q815,280 830,240 Z',
  'M812,352 Q830,340 845,338 M905,385 Q915,365 925,352',
  'M215,769 Q240,640 300,590 Q420,575 520,600'
];

function PostureGuide({ mode, res }) {
  const result = mode === 'result';
  const tone = (key) => (!result || !res || !res[key] ? '#fff' : res[key] === 'ok' ? '#3FBF6F' : '#FF9A3D');
  const word = (key) => (res && res[key] === 'warn' ? '주의' : '괜찮음');
  const tag = (x, y, text, key) => {
    const w = text.length * 11.5 + 18; const color = result ? tone(key) : '#302F46';
    return <g key={text}><rect x={x - w / 2} y={y - 11} width={w} height={22} rx={11} fill={result ? (res && res[key] === 'warn' ? '#FFF1D6' : '#E3F6EA') : '#fff'} /><text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill={result && res && res[key] === 'warn' ? '#C2620F' : result ? '#1E8A4A' : color}>{text}</text></g>;
  };
  const faint = { stroke: '#fff', strokeOpacity: mode === 'count' ? 0.3 : 0.45, strokeWidth: 1.6, strokeDasharray: '6 5', fill: 'none' };
  return (
    <svg className="poseguide" viewBox={result ? '0 20 335 300' : '0 0 335 449'} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {!result && <rect x="30" y="30" width="275" height="412" rx="120" fill="none" stroke="#fff" strokeOpacity="0.9" strokeWidth="2" strokeDasharray="8 6" />}
      <circle cx="178" cy="100" r="34" {...faint} />
      {/* 바른 자세 윤곽: 참고 사진(acousticchaser.tistory.com/151, "왼손을 앞으로 내밀어 준다")을 보고 따라 그린 선.
          화면이 거울처럼 좌우가 뒤집혀 보이므로 선도 뒤집어서 깐다 */}
      <g transform="translate(316.4 159.5) scale(-0.269 0.269)" fill="none" stroke="#fff" strokeOpacity={mode === 'count' ? 0.3 : 0.55} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
        {GUIDE_OUTLINE.map((d) => <path key={d} d={d} />)}
      </g>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" opacity={mode === 'count' ? 0.55 : 1}>
        <path d="M112 177H244" stroke={tone('shoulder')} />
        <path d="M112 177L98 262L80 250" stroke={tone('wrist')} />
        <path d="M80 250L72 214" stroke={tone('thumb')} />
        <circle cx="112" cy="177" r="6" fill={tone('shoulder')} stroke="none" /><circle cx="244" cy="177" r="6" fill={tone('shoulder')} stroke="none" />
        <circle cx="98" cy="262" r="5" fill={tone('wrist')} stroke="none" /><circle cx="80" cy="250" r="7" fill={tone('wrist')} stroke="none" />
        <circle cx="72" cy="214" r="5.5" fill={tone('thumb')} stroke="none" />
      </g>
      {mode === 'pre' && <>
        <path d="M30 268H250" stroke="#FFC53D" strokeWidth="2" strokeDasharray="5 4" />
        {tag(196, 150, '어깨: 힘 빼고 양쪽 높이 같게')}{tag(106, 196, '엄지: 넥 뒤, 검지 맞은편')}{tag(250, 232, '손목: 꺾지 않고 곧게')}
        <g><rect x="30" y="276" width="150" height="22" rx="11" fill="#FFC53D" /><text x="105" y="291" textAnchor="middle" fontSize="11" fontWeight="800" fill="#302F46">왼손은 이 선(사운드홀)보다 위</text></g>
        <text x="167" y="430" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">선에 맞춰 상체와 기타를 넣어요</text>
      </>}
      {result && res && <>{res.shoulder && tag(190, 160, `어깨 ${word('shoulder')}`, 'shoulder')}{res.thumb && tag(62, 196, `엄지 ${word('thumb')}`, 'thumb')}{res.wrist && tag(48, 280, `손목 ${word('wrist')}`, 'wrist')}</>}
    </svg>
  );
}

// 결과 화면: 사진에서 실제로 찾은 관절 위에 선을 그린다(부위별 초록 괜찮음 / 주황 주의 / 회색 확인 어려움).
// 사진은 거울처럼 좌우를 뒤집어 보여 주므로 선도 같이 뒤집는다. 크기는 object-fit: cover와 같게 맞춘다.
function PostureMarks({ check, w, h }) {
  const p = check && check.points;
  if (!p || !(w > 0) || !(h > 0)) return null;
  const tone = (k) => (check[k].status === 'ok' ? '#3FBF6F' : check[k].status === 'warn' ? '#FF9A3D' : '#C9C3CF');
  const X = (pt) => (1 - pt.x) * w; const Y = (pt) => pt.y * h;
  const line = (pts, color, key) => <polyline key={key} points={pts.map((pt) => `${X(pt)},${Y(pt)}`).join(' ')} fill="none" stroke={color} strokeWidth={Math.max(w, h) / 90} strokeLinecap="round" strokeLinejoin="round" />;
  const dot = (pt, color, key) => <circle key={key} cx={X(pt)} cy={Y(pt)} r={Math.max(w, h) / 70} fill={color} />;
  return (
    <svg className="poseguide" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {p.shoulders && <>{line(p.shoulders, tone('shoulder'), 's')}{p.shoulders.map((pt, i) => dot(pt, tone('shoulder'), 's' + i))}</>}
      {p.arm && <>{line(p.arm, tone('wrist'), 'a')}{dot(p.arm[2], tone('hand'), 'aw')}</>}
      {p.hand && <>{line([p.hand[0], p.hand[2]], tone('wrist'), 'h')}{line([p.hand[1], p.hand[3]], tone('wrist'), 'hk')}</>}
      {p.other && <>{dot(p.other, '#FFFFFF', 'o')}<line x1={0} x2={w} y1={Y(p.other)} y2={Y(p.other)} stroke="#FFC53D" strokeWidth={Math.max(w, h) / 220} strokeDasharray={`${w / 40} ${w / 60}`} /></>}
    </svg>
  );
}

function Posture({ lesson, s, update, next, speed, running }) {
  const [phase, setPhase] = useState('pre'); // pre | count | analyzing | result | denied
  const [check, setCheck] = useState(null); // 실제 판정 결과(사진 한 장)
  const [shotSize, setShotSize] = useState(null);
  const real = s.panel.posture === 'real';
  // 실제 판정을 쓰면 카메라를 여는 동안 모델을 미리 불러 둔다
  useEffect(() => { if (real) loadPostureCheck().catch(() => {}); }, [real]);
  const [count, setCount] = useState(3);
  const [shot, setShot] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraAttempt, setCameraAttempt] = useState(0);
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
      setCameraAttempt((value) => value + 1);
      setPhase('pre');
    } catch (e) { if (request === openRequest.current) { logEvent('camera_denied'); setPhase('denied'); } }
  };
  useEffect(() => { open(); return stop; }, []);
  useEffect(() => {
    if (!['pre', 'count'].includes(phase) || !video.current || !stream.current) return undefined;
    const v = video.current; const acquired = stream.current; const request = openRequest.current;
    let dead = false; let lastReady = performance.now();
    const current = () => !dead && request === openRequest.current;
    const fail = () => {
      if (!current()) return;
      stop(); setCameraReady(false); setPhase('failed'); logEvent('camera_failed', { stage: 'preview' });
    };
    const check = () => {
      if (!current()) return;
      if (!mediaStreamIsLive(acquired)) { fail(); return; }
      const ready = usableCaptureFrame(v);
      setCameraReady(ready);
      if (ready) lastReady = performance.now();
      else if (performance.now() - lastReady >= 10000) fail();
    };
    if (v.srcObject !== acquired) v.srcObject = acquired;
    v.addEventListener('error', fail);
    const timer = setInterval(check, 100);
    check();
    try { Promise.resolve(v.play()).catch(fail); } catch { fail(); }
    return () => { dead = true; clearInterval(timer); v.removeEventListener('error', fail); };
  }, [phase, cameraAttempt]);
  useEffect(() => {
    if (phase !== 'count' || !running) return undefined;
    if (count === 0) {
      if (!mediaStreamIsLive(stream.current) || !usableCaptureFrame(video.current)) { stop(); setCameraReady(false); setPhase('failed'); logEvent('camera_failed', { stage: 'capture' }); return undefined; }
      const v = video.current; let url = null;
      try { const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); url = c.toDataURL('image/jpeg', 0.7); } catch (e) {}
      if (!url || !/^data:image\/[^;]+;base64,.+/.test(url)) { stop(); setCameraReady(false); setPhase('failed'); logEvent('camera_failed', { stage: 'capture' }); return undefined; }
      stop(); setShot(url); // 사진은 이 화면에서만 쓰고 저장하지 않는다
      if (real) {
        const canvas = document.createElement('canvas'); canvas.width = v.videoWidth; canvas.height = v.videoHeight;
        const image = new Image();
        setShotSize({ w: canvas.width, h: canvas.height }); setPhase('analyzing');
        image.onload = () => {
          canvas.getContext('2d').drawImage(image, 0, 0);
          checkPosture(canvas).then((found) => {
            const r = Object.fromEntries(POSTURE_ITEMS.map((k) => [k, found[k].status]));
            setCheck(found); setRes(r);
            update((d) => { d.posture = { date: today(d), ...r }; });
            logEvent('posture', { mode: 'real', ...r, values: Object.fromEntries(POSTURE_ITEMS.map((k) => [k, found[k].value ?? null])) });
          }).catch(() => {
            const r = Object.fromEntries(POSTURE_ITEMS.map((k) => [k, 'unknown']));
            setCheck(null); setRes(r); logEvent('posture', { mode: 'real', failed: true });
          }).finally(() => setPhase('result'));
        };
        image.src = url;
        return undefined;
      }
      const sim = s.panel.posture === 'sim';
      const pick = (key) => (sim ? (Math.random() < (key === focus ? 0.4 : 0.15) ? 'warn' : 'ok') : null);
      const r = { wrist: pick('wrist'), hand: pick('hand'), thumb: pick('thumb'), shoulder: pick('shoulder') };
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

  if (phase === 'denied' || phase === 'failed') {
    return (<>
      <div className="cam"><div className="msg">{phase === 'failed' ? '카메라 영상을 확인할 수 없어요' : '카메라를 쓸 수 없어요'}</div></div>
      <div className="card soft"><div className="cap">자세 확인을 건너뛰고 연습할게요</div><div className="sub">{phase === 'failed' ? '카메라를 다시 켜거나 다음 단계로 넘어갈 수 있어요' : '카메라를 허용하면 다음부터 자세를 볼 수 있어요'}</div></div>
      <button className="btn line" onClick={open}>카메라 다시 켜기</button>
      <button className="btn" onClick={next}>다음 단계로</button>
    </>);
  }
  if (phase === 'analyzing') {
    return (<>
      <div className="cam" style={{ flex: 'none', height: 220 }}>{shot && <img src={shot} alt="" />}<div className="msg">자세를 살펴보고 있어요…</div></div>
      <div className="sub tc">처음에는 몇 초 걸릴 수 있어요</div>
    </>);
  }
  if (phase === 'result') {
    const keys = POSTURE_ITEMS.filter((k) => !(s.panel.posture !== 'real' && k === 'hand')).sort((a, b) => (a === focus ? -1 : b === focus ? 1 : 0));
    const warn = keys.find((k) => res[k] === 'warn');
    return (<>
      <div className="cam" style={{ flex: 'none', height: 220 }}>{shot ? <img src={shot} alt="" /> : <div className="msg">방금 찍은 모습</div>}{real ? <PostureMarks check={check} w={shotSize?.w} h={shotSize?.h} /> : <PostureGuide mode="result" res={res} />}</div>
      {real ? <div className="sub">{check ? '사진 한 장으로 본 참고 결과예요. 가려진 곳은 확인 어려움으로 보여요.' : '자세를 살펴보지 못했어요. 다시 찍거나 그대로 연습을 시작해도 돼요.'}</div> : s.panel.posture !== 'sim' ? <div className="sub">사진과 선을 비교해 보고 직접 골라 주세요</div> : <div className="sub">연습용 예시 결과예요. 실제 자세를 본 결과는 아니에요.</div>}
      {keys.map((k) => (
        <div key={k} className={`card row between${k === focus ? ' sel' : ''}`} style={{ padding: '12px 16px' }}>
          <div className="row"><b>{content.postureTips[k].name}</b>{k === focus && <span className="cap">이번 레슨의 중심</span>}</div>
          {s.panel.posture !== 'self'
            ? <span className={`pill ${res[k] === 'ok' ? 'ok' : res[k] === 'warn' ? 'warn' : 'none'}`} title={check?.[k]?.reason}>{res[k] === 'ok' ? '괜찮음' : res[k] === 'warn' ? '주의' : '확인 어려움'}</span>
            : <div className="row" style={{ gap: 6 }}>
              <button className={`pill ${res[k] === 'ok' ? 'ok' : 'none'}`} onClick={() => setItem(k, 'ok')}>괜찮음</button>
              <button className={`pill ${res[k] === 'warn' ? 'warn' : 'none'}`} onClick={() => setItem(k, 'warn')}>주의</button>
            </div>}
        </div>
      ))}
      {warn && <div className="card soft row fadeup"><Piki name="hi" size={44} still /><div style={{ fontSize: 13, fontWeight: 600 }}>{content.postureTips[warn].warn}</div></div>}
      {real && check && !warn && keys.every((k) => res[k] !== 'ok') && <div className="sub">{check[focus === 'all' ? 'wrist' : focus]?.reason}. 상체와 코드 잡는 팔이 화면에 다 들어오게 다시 찍어 보세요.</div>}
      <div className="grow" />
      <div className="two"><button className="btn soft" onClick={() => { setCount(3); setShot(null); setCheck(null); open(); }}>다시 찍기</button><button className="btn" onClick={next}>연습 시작</button></div>
    </>);
  }
  return (<>
    <div><div className="cap">자세 확인</div><h2>{tip.title}</h2></div>
    <div className="cam">
      <video ref={video} playsInline muted />
      {!cameraReady && <div className="msg">카메라를 준비하고 있어요…</div>}
      <PostureGuide mode={phase === 'count' ? 'count' : 'pre'} />
      {phase === 'count' && <div className="count">{count}</div>}
    </div>
    <div className="card soft"><div className="cap">이번 레슨에서 볼 곳: {tip.name}</div><div className="sub">사진은 저장하지 않아요</div></div>
    {phase === 'pre'
      ? <><button className="btn" disabled={!cameraReady} onClick={() => { setCount(3); setPhase('count'); }}>촬영 (3초 뒤)</button><button className="textbtn" onClick={() => { logEvent('posture_skip'); stop(); next(); }}>건너뛰기</button></>
      : <button className="btn line" onClick={() => setPhase('pre')}>취소</button>}
  </>);
}

const FINGERS = [[1, '검지'], [2, '중지'], [3, '약지'], [4, '새끼']];
function Card({ step, next, chord }) {
  // 손가락 번호 범례(피그마 20:4): 이 코드에서 쓰는 손가락만 노랗게
  const used = chord && /손가락/.test(step.title) ? content.chords[chord].dots.map((d) => d.finger) : null;
  return (<>
    <div className="stage"><Piki name={step.img || 'hi'} size={used ? 170 : 200} /></div>
    {used && <div className="row fingers" aria-label="손가락 번호">{FINGERS.map(([n, name]) => <span key={n} className={`pill ${used.includes(n) ? 'y' : 'w'}`}>{name} {n}</span>)}</div>}
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

function Play({ step, chord, next, micOn, running,s,retryEar,coach }) {
  const simulated=s.panel.judge!=='mic';
  const n = useHits(running, micOn,step.showChord?chord:null,simulated);
  const ok = micOn === false || n >= 4;
  return (<>
    <div><div className="cap">소리 내기</div><div className="big">{step.showChord ? chord : '튕겨 보기'}</div></div>
    {step.showChord && <div className="chordbox"><Chord name={chord} scale={0.62} /></div>}
    <h2>{step.text}</h2>
    <HitDots n={n} />
    {micOn&&!simulated&&<GuitarInputStatus target={step.showChord?chord:null} retry={retryEar}/>}
    {simulated&&<div className="sub tc">연습 모드예요. 어떤 코드를 쳤는지는 확인하지 않아요.</div>}
    {micOn === null && <div className="sub tc">마이크를 준비하고 있어요…</div>}
    {micOn === false && <div className="sub tc">마이크 없이 진행 중이에요. 쳐 본 뒤 다음을 눌러요.</div>}
    <div className="grow">{coach || <Piki name={n > 0 ? 'yay' : 'listen'} size={150} />}</div>
    <NextBar ok={ok} micOn={micOn} next={next} />
  </>);
}

function Beat({ chord, next, micOn, speed, running,s,retryEar,coach }) {
  const [bpm, setBpm] = useState(50);
  const [fin, setFin] = useState(false);
  const [hits, setHits] = useState({});
  const [retry,setRetry]=useState(false);
  const [beat, setBeat] = useBeat(bpm, speed, running && micOn !== null && !fin&&!retry,8);
  const simulated=s.panel.judge!=='mic'||micOn===false;
  const beatRef = useRef(beat); beatRef.current = beat;
  // 사람은 박보다 살짝 먼저 치는 일이 흔하다. 박 사이 마지막 1/4에 친 소리는 다음 박으로 센다
  // (8마디 화면의 guitarBarIndex와 같은 기준). 이게 없으면 조금만 빨리 쳐도 전부 앞 박으로 밀려 8박을 못 채운다.
  const beatAt = useRef(performance.now());
  useEffect(() => { beatAt.current = performance.now(); }, [beat]);
  const beatSlot = () => beatRef.current + (performance.now() - beatAt.current > (60000 / (bpm * speed)) * 0.75 ? 1 : 0);
  const slotRef = useRef(beatSlot); slotRef.current = beatSlot;
  useEffect(() => {
    if (!running || !micOn || mic.state !== 'on') return undefined;
    return makeOnsetDetector((_at,_level,originalBeat) => { if (originalBeat>=0&&originalBeat<8) setHits((h) => ({ ...h, [originalBeat]: true })); },{target:chord,simulated,snapshot:()=>slotRef.current()});
  }, [running, micOn,chord,simulated]);
  useEffect(() => {
    if(beat<8||retry||fin||!running)return undefined;
    const timer=setTimeout(()=>{
      if(!simulated&&Object.keys(hits).length<8){setRetry(true);return;}
      if(bpm===50){setBpm(60);setBeat(-4);setHits({});}else setFin(true);
    },simulated?0:1500);
    return()=>clearTimeout(timer);
  }, [beat,bpm,hits,retry,fin,running,simulated]);
  const bar = Math.min(1,Math.floor(Math.max(beat, 0) / 4));
  return (<>
    <div><div className="cap">박자에 맞춰 쳐요</div><div className="big">{chord}</div></div>
    <div className="row" style={{ justifyContent: 'center' }}><span className={`pill ${bpm === 50 ? 'y' : 'none'}`}>50 BPM</span><b style={{ color: 'var(--gray)' }}>→</b><span className={`pill ${bpm === 60 ? 'y' : 'none'}`}>60 BPM</span></div>
    <div className="dots beat">{[0, 1, 2, 3].map((i) => { const b = bar * 4 + i; const now = !fin && beat >= 0 && beat % 4 === i; return <i key={i} className={hits[b] && beat >= 0 ? 'hit' : now ? 'now' : ''}>{i + 1}</i>; })}</div>
    <div className="sub tc">{fin ? '두 템포를 모두 마쳤어요' : retry ? `8박 중 ${Object.keys(hits).length}박에서 ${chord} 코드가 들렸어요. 한 번 더 해 볼까요?` : beat < 0 ? `준비… ${-beat}` : `${bar + 1} / 2 마디`}</div>
    {micOn&&!simulated&&<GuitarInputStatus target={chord} retry={retryEar}/>}
    {retry&&<button className="btn line" onClick={()=>{setHits({});setBeat(-4);setRetry(false);}}>현재 템포 다시 연습</button>}
    {simulated&&<div className="sub tc">연습 모드예요. 어떤 코드를 쳤는지는 확인하지 않아요.</div>}
    <div className="grow">{coach || <Piki name="yay" size={170} />}</div>
    <NextBar ok={fin} micOn={micOn} next={next} okText="두 템포를 모두 마쳤어요" />
    {!fin && <div className="sub tc" style={{ fontSize: 12 }}>두 템포를 마치면 넘어갈 수 있어요</div>}
  </>);
}

function Blind({ chord, next, micOn, running,s,retryEar,coach }) {
  const simulated=s.panel.judge!=='mic';
  const n = useHits(running, micOn,chord,simulated);
  const [hint, setHint] = useState(false);
  useEffect(() => { if (!hint) return undefined; const id = setTimeout(() => setHint(false), 3000); return () => clearTimeout(id); }, [hint]);
  return (<>
    <div><div className="cap">안 보고 치기</div><div className="big">{chord}</div></div>
    {hint ? <div className="chordbox"><Chord name={chord} scale={0.62} /></div>
      : <div className="hidden-chord"><div className="big" style={{ color: 'var(--o)' }}>?</div><div className="sub">코드 모양은 숨겼어요</div></div>}
    <h2>화면을 보지 않고 {chord} 코드를 잡고 쳐 보세요</h2>
    {micOn&&!simulated&&<GuitarInputStatus target={chord} retry={retryEar}/>}
    <HitDots n={n} />
    <div className="grow">{coach || <Piki name="listen" size={130} />}</div>
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
// 자세 알림과 함께 3초만 뜨는 창: 위는 내 모습, 아래는 교정 그림(피그마 P1 209:4)
export default function Lesson({ s, update, target, go, paused = false }) {
  const lesson = lessonsFor(s).find((l) => l.id === target.lesson);
  const def = target.custom || lesson.parts[target.part];
  const idea = s.panel.variant === 'idea';
  // 아이디어 반영: 자세 촬영(S7)은 레슨 첫 파트에서만 한 번. 복습·단독 전환에서는 찍지 않는다
  const steps = useMemo(() => partSteps(def, s.panel.variant, target.part, !!(target.review || target.custom)), []);
  const [idx, setIdx] = useState(Math.min(target.step || 0, steps.length - 1));
  const [exit, setExit] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [done, setDone] = useState(false);
  const finished = useRef(false);
  const background = usePracticePause(!done);
  const microphone = useMicrophone();
  const { micOn, skipMic, inputLost } = microphone;
  const [tbar, setTbar] = useState(0);
  const start = useRef(Date.now());
  const pausedTime = useRef(0);
  const pausedAt = useRef(null);
  const nativePause = useRef(null);
  const suspended = paused || exit || stuck || background.paused || inputLost;
  const speed = s.panel.speed;
  const timeSegments = useRef({ rate: speed, active: 0, scaled: 0 });
  useBeforeUnload(!done, () => {
    if (pausedAt.current !== null || nativePause.current !== null) return undefined;
    const at = Date.now(); nativePause.current = at;
    return () => {
      pausedTime.current += Math.max(0, Math.min(Date.now(), pausedAt.current ?? Infinity) - at);
      nativePause.current = null;
    };
  });
  const activeMillis = () => Math.max(0, Math.min(pausedAt.current ?? Date.now(), nativePause.current ?? Infinity) - start.current - pausedTime.current);
  const elapsed = () => {
    const segment = timeSegments.current;
    return Math.floor((segment.scaled + (activeMillis() - segment.active) * segment.rate) / 1000);
  };
  useEffect(() => {
    if (suspended) pausedAt.current = background.pausedAt.current ?? Date.now();
    else if (pausedAt.current != null) {
      pausedTime.current += Date.now() - pausedAt.current;
      pausedAt.current = null;
    }
  }, [suspended]);
  useEffect(() => {
    const active = activeMillis();
    const segment = timeSegments.current;
    // Earlier active time keeps its original evaluation rate, including fractions.
    segment.scaled += (active - segment.active) * segment.rate;
    segment.active = active;
    segment.rate = speed;
  }, [speed]);
  const step = steps[idx];
  const chord = step.chord || (lesson ? lesson.chord : null);
  const back = target.back || 'learn';
  const checkpoint = useCallback((at) => {
    if (target.custom || target.review) return;
    update((d) => { d.resume = { lesson: target.lesson, part: target.part, step: at }; });
  }, [target.custom, target.review, target.lesson, target.part, update]);
  useEffect(() => { if (!done) checkpoint(idx); }, [idx, done, checkpoint]);

  // 파트가 곡 연주로 바로 시작하면(레슨 4 · 파트 3, 자세 촬영이 없는 구성) 곧장 곡 화면으로 간다
  useEffect(() => { if (steps[idx].type === 'song') go(idea ? 'songplay' : 'song', { fromLesson: true, back: 'learn', key: Date.now() }); }, []);

  // ---------- 연주 중 자세 알림 (P1) ----------
  // S7(피그마 Flow 11/16): 레슨 첫 파트에서 한 번, 설명 카드 뒤 · 첫 연주 단계 직전에 자세 촬영을 끼운다
  // 이어하기로 연주 단계에 바로 돌아온 경우에는 이미 지나온 자리라 다시 끼우지 않는다.
  const [s7, setS7] = useState(() => idea && !target.review && !target.custom && target.part === 0 && !LIVE.includes(steps[Math.min(target.step || 0, steps.length - 1)].type));
  const checking = s7 && !done && LIVE.includes(step.type);
  const checkingRef = useRef(checking); checkingRef.current = checking;
  const live = idea && !done && !background.paused && !checking && LIVE.includes(step.type);
  const focus = lesson ? lesson.postureFocus : 'all';
  const camStream = useRef(null);
  const eye = useRef(null); // 판정용 영상(화면에는 안 보임)
  const [cam, setCam] = useState('off'); // off | on | denied
  const [poseState, setPoseState] = useState('off'); // off | loading | ready | fail
  const [poseNote, setPoseNote] = useState('몸이 안 보여요');
  const [framing, setFraming] = useState(null);
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const [poseAttempt, setPoseAttempt] = useState(0);
  // 자세 판정 디버그 화면: 평가 패널에서 켠 경우에만 (기본 꺼짐, 참가자 화면 아님)
  const [debugOn, setDebugOn] = useState(readPoseDebugFlag);
  const [poseDebug, setPoseDebug] = useState(null);
  const debugOnRef = useRef(debugOn); debugOnRef.current = debugOn;
  const watcher = useRef(null);
  useEffect(() => {
    const sync = () => setDebugOn(readPoseDebugFlag());
    window.addEventListener('dinga-posedebug', sync);
    return () => window.removeEventListener('dinga-posedebug', sync);
  }, []);
  const [alertKind, setAlertKind] = useState(null);
  const [alertHow, setAlertHow] = useState('timed'); // timed | manual | real. 실제 판정일 때만 단정하는 문구를 쓴다
  const alerts = useRef({ n: 0, last: 0, timed: false });
  const alertTimer = useRef(null);
  const liveRef = useRef(live); liveRef.current = live && !suspended;
  const mode = s.panel.alert; // auto 정해진 시점(기본, 11/11 팀 결정) | real 실제 판정 | manual 진행자가 띄움 | off
  const fire = (kind, how, value) => {
    if (!liveRef.current) return;
    alerts.current.n += 1; alerts.current.last = performance.now();
    setAlertKind(kind); setAlertHow(how); sfx.alert();
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
        onStatus: (st, measured, guidance, debug) => {
          if (debugOnRef.current && debug) setPoseDebug(debug);
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
          fireRef.current(kind, 'real', kind === 'wrist' ? (Number.isFinite(m.wrist3d) ? m.wrist3d : m.wrist) : m.tilt);
        },
      });
      watcher.current = stop;
    });
    return () => { dead = true; if (stop) stop(); watcher.current = null; setPoseDebug(null); };
  }, [cam, mode, live, poseAttempt, suspended]);
  // 정해진 시점: 연주 단계에 들어가고 5초 뒤 한 번 (파트당 1번)
  useEffect(() => {
    if (!live || suspended || !['on', 'denied'].includes(cam) || mode !== 'auto' || alerts.current.timed) return undefined;
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
  const camNote = poseState === 'ready' ? poseNote : poseState === 'fail' ? '자세 판정 꺼짐' : '자세 판정 준비 중';
  const retryCamera = () => setCameraAttempt((value) => value + 1);
  const retryPose = cam === 'on' && mode === 'real' && poseState === 'fail' ? () => setPoseAttempt((value) => value + 1) : undefined;
  useEffect(() => { logEvent('step', { lesson: target.lesson || 'transition', part: target.part, step: idx, kind: steps[idx].type }); }, [idx]);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
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
    if (finished.current) return;
    if (checkingRef.current) { setS7(false); return; }
    const n = steps[idx + 1];
    if (!n) return finish();
    if (n.type === 'song') { checkpoint(idx + 1); return go(idea ? 'songplay' : 'song', { fromLesson: true, back: 'learn', key: Date.now() }); }
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
        <div className="sub">‘{idea && ['em', 'g', 'c'].includes(target.lesson) && target.part === 1 ? '코드 잡기' : def.title}’ 완료</div>
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
  // 자세 알림 3초 동안 캐릭터 자리에 카메라 창과 교정 그림을 크게 보여 준다(피그마 P1, 11/18 수정: 오른쪽 위 작은 창 → 캐릭터 자리)
  const coach = live && alertKind && cam === 'on' ? <PostureCoach stream={camStream} cam={cam} kind={alertKind} /> : null;
  const props = { step, lesson, chord, next, micOn, speed, s, update, running: !suspended, retryEar: microphone.retryMic, coach };
  const al = alertKind && postureCopy(alertKind, alertHow);
  return (<>
    {idea && <video ref={eye} className="eye" playsInline muted />}
    {al && <div className="palert" role="status"><i>{alertHow === 'real' ? '!' : '?'}</i><div><b>{al.title}</b><small>{al.text}</small></div></div>}
    {debugOn && live && cam === 'on' && mode === 'real' && <PoseDebug stream={camStream} data={poseDebug} onCalibrate={() => (watcher.current ? watcher.current.calibrate(3000) : Promise.resolve(null))} onClear={clearBaseline} />}
    <div className="screen" key={idx}>
      <div className="row">
        <button className="iconbtn" onClick={() => setExit(true)} aria-label="나가기">✕</button>
        <Progress n={now} total={total} label={step.type === 'transition' ? '코드 전환 진행' : '파트 진행'} unit={step.type === 'transition' ? '마디' : '단계'} />
        {step.type !== 'posture' && !checking && <button className="textbtn" onClick={() => { logEvent('stuck', { kind: step.type }); setStuck(true); }}>막혔어요</button>}
      </div>
      {live && cam === 'denied' && <div className="sub" style={{ fontSize: 12 }}>카메라를 쓸 수 없어 자세 알림은 문구로만 알려요 <button className="textbtn" onClick={retryCamera}>카메라 다시 켜기</button></div>}
      {live && cam === 'on' && mode === 'real' && <div className="sub" style={{ fontSize: 12 }} role="status">{camNote}{retryPose && <button className="textbtn" aria-label="자세 판정 다시 시도" onClick={retryPose}>다시 시도</button>}</div>}
      {live && mode === 'real' && poseState === 'ready' && framing && !framing.ready && <div className="sub" style={{ fontSize: 12 }} role="status">{framing.instruction}</div>}
      {(step.type === 'posture' || checking) && <Posture {...props} />}
      {step.type === 'card' && <Card {...props} />}
      {step.type === 'diagram' && <Diagram {...props} />}
      {step.type === 'play' && !checking && <Play {...props} />}
      {step.type === 'beat' && !checking && <Beat key={idx} {...props} />}
      {step.type === 'blind' && !checking && <Blind {...props} />}
      {micOn === null && !inputLost && <button className="textbtn" onClick={skipMic}>마이크 없이 계속하기</button>}
      {step.type === 'transition' && idea && !checking && <Song key={idx} coach={coach} s={s} update={update} go={go} microphone={microphone} paused={suspended} restartCurrentBar={background.paused} params={{ pair: step.pair, onDone: next, onProgress: setTbar }} />}
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
