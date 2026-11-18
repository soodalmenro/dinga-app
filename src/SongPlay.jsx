// 곡 연습(가사 위에 코드가 흐르는 화면)과 곡 연습 리포트
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { content, mic, makeOnsetDetector, today, sfx, logEvent } from './lib.js';
import { SongPosture } from './SongPosture.jsx';
import { ear } from './guitarEar.js';
import { createChordBarEvidence } from './chordBarEvidence.js';
import { sameChord } from './chordMatch.js';
import { GuitarInputStatus } from './GuitarInputStatus.jsx';
import {finalizedGuitarBars} from './guitarTimeline.js';
import { songDiagnostics } from './evaluationExport.js';
import { Piki, Modal, Confetti } from './ui.jsx';
import { useMicrophone } from './useMicrophone.js';
import { usePracticePause } from './usePracticePause.js';
import { MicrophoneRecovery } from './MicrophoneRecovery.jsx';
import { useBeforeUnload } from './useBeforeUnload.js';

const SP = content.songPractice;
const COURSE_PART_SECONDS = 180;
// 코드 하나 = 한 마디(4박). 화면 순서대로 편 목록
const BARS = SP.sections.flatMap((sec, si) => sec.lines.flatMap((line, li) => line.map(([chord, lyric]) => ({ chord, lyric, si, li }))));
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const PAIR = (a, b) => (['Em', 'G', 'C'].indexOf(a) < ['Em', 'G', 'C'].indexOf(b) ? [a, b] : [b, a]);

export function summarizeSong(list) {
  const played = list.length;
  const measured = played > 0 && list.every((result) => result.t !== 'unmeasured');
  const isUncertain = (result) => result.t !== 'unmeasured' && result.t !== 'none' && result.c === null;
  const uncertain = list.filter(isUncertain).length;
  const coverage = { played, total: BARS.length, evaluated: list.filter((result) => result.t !== 'unmeasured' && result.c !== null).length, uncertain };
  const okBeat = list.filter((r) => r.t === 'ok').length; const okChord = list.filter((r) => r.c).length;
  const beatAcc = measured ? pct(okBeat, played) : null;
  const chordAcc = measured && !uncertain ? pct(okChord, played) : null;
  const secs = SP.sections.map((sec, si) => {
    const results = list.filter((_, i) => BARS[i].si === si);
    const good = results.filter((result) => result.t === 'ok' && result.c).length;
    let state = 'retry';
    if (!results.length) state = 'skip';
    else if (results.some((result) => result.t === 'unmeasured')) state = 'unmeasured';
    else if (results.some(isUncertain)) state = 'uncertain';
    else if (good / results.length >= 0.75) state = 'good';
    else if (results.some((result) => result.t === 'late')) state = 'late';
    else if (results.some((result) => result.t !== 'none' && !result.c)) state = 'check';
    return { name: sec.name, state, played: results.length, total: BARS.filter((bar) => bar.si === si).length };
  });
  const trans = {};
  list.forEach((result, i) => {
    if (!measured || i === 0 || BARS[i].chord === BARS[i - 1].chord) return;
    const key = `${BARS[i - 1].chord} → ${BARS[i].chord}`;
    const pair = trans[key] || { ok: 0, n: 0, late: 0, missed: 0, chord: 0, uncertain: 0 };
    pair.n += 1;
    trans[key] = pair;
    if (isUncertain(result)) { pair.uncertain += 1; return; }
    if (result.t === 'ok' && result.c) pair.ok += 1;
    if (result.t === 'late') pair.late += 1;
    if (result.t === 'none') pair.missed += 1;
    if (result.t !== 'none' && !result.c) pair.chord += 1;
  });
  const score = beatAcc !== null && chordAcc !== null ? Math.round((beatAcc + chordAcc) / 2) : null;
  return { played, scored: score !== null, score, beatAcc, chordAcc, secs, trans, coverage };
}

export function SongPlay({ s, update, go, params, paused = false }) {
  const [tempo, setTempo] = useState(40);
  const [phase, setPhase] = useState('wait'); // wait | play | pause
  useBeforeUnload(phase !== 'wait');
  const [bar, setBar] = useState(0);
  const [beat, setBeat] = useState(0);
  const [res, setRes] = useState([]); // [{t:'ok'|'late'|'none', c:true|false}]
  const [exit, setExit] = useState(false);
  const [metro, setMetro] = useState(false);
  const [melody, setMelody] = useState(true); // 곡 멜로디(Itsy Bitsy Spider). 인트로 4마디는 반주 없이 코드만
  const melodyRef = useRef(true); melodyRef.current = melody;
  const microphone = useMicrophone();
  const { micOn, skipMic, inputLost } = microphone;
  const [activeJudge, setActiveJudge] = useState(null);
  const judgeMode = activeJudge || s.panel.judge;
  const background = usePracticePause(phase === 'play');
  const suspended = paused || exit || background.paused || inputLost;
  const [quiet, setQuiet] = useState(false);
  const scoreView = useRef(null);
  const el = useRef(0); const hits = useRef([]); const out = useRef([]); const spectrum = useMemo(() => createChordBarEvidence(), []); const metroRef = useRef(false); metroRef.current = metro;
  const minimumSourceAt=useRef(performance.now());
  const back = (params && params.back) || 'learn';
  const startLogged = useRef(false);
  const finished = useRef(false);
  const beatMs = 60000 / ((SP.bpm * tempo) / 100) / s.panel.speed;
  const previousBeatMs = useRef(beatMs);
  useEffect(() => {
    if (previousBeatMs.current === beatMs) return;
    previousBeatMs.current = beatMs;
    el.current = out.current.length * 4 * beatMs; hits.current = []; spectrum.clear();
    setBar(Math.min(out.current.length, BARS.length - 1)); setBeat(0);
  }, [beatMs]);
  useEffect(() => {
    minimumSourceAt.current=performance.now();
    if (!inputLost && !background.paused&&!suspended&&phase!=='pause') return;
    el.current = out.current.length * 4 * beatMs; hits.current = []; spectrum.clear();
    setBar(Math.min(out.current.length, BARS.length - 1)); setBeat(0);
  }, [inputLost, background.paused,suspended,phase==='pause']);

  useEffect(() => {
    if (phase !== 'play') return;
    const viewport = scoreView.current;
    const current = viewport && viewport.querySelector('.sp-bar.now');
    if (!current || !viewport.clientHeight) return;
    const bounds = viewport.getBoundingClientRect();
    const active = current.getBoundingClientRect();
    if (active.top < bounds.top) viewport.scrollTop += active.top - bounds.top;
    else if (active.bottom > bounds.bottom) viewport.scrollTop += active.bottom - bounds.bottom;
  }, [bar, phase]);

  // 기타를 치기 전까지(시작 대기) 지금 템포로 메트로놈 '딱, 딱, 딱, 딱'을 계속 낸다
  useEffect(() => {
    if (phase !== 'wait' || suspended || micOn === null) return undefined;
    const id = setInterval(() => sfx.tick(), beatMs);
    return () => clearInterval(id);
  }, [phase, suspended, micOn, beatMs]);
  useEffect(() => {
    if (phase !== 'wait' || suspended) return undefined;
    const q = setTimeout(() => setQuiet(true), 30000);
    if (!micOn) return () => clearTimeout(q);
    const stop = makeOnsetDetector((at) => {
      if (document.hidden) return;
      el.current=performance.now()-at;hits.current = [0]; setActiveJudge(s.panel.judge); setPhase('play');
    },{simulated:s.panel.judge!=='mic'});
    return () => { stop(); clearTimeout(q); };
  }, [phase, micOn, suspended, s.panel.judge]);

  const finish = (list) => {
    if (finished.current) return;
    finished.current = true;
    const { played, scored, score, beatAcc, chordAcc, secs, trans, coverage } = summarizeSong(list);
    const complete = played === BARS.length; const fromLesson = !!params?.fromLesson;
    const creditedSeconds = complete && fromLesson ? COURSE_PART_SECONDS : Math.round((played * 4 * 60) / ((SP.bpm * tempo) / 100));
    update((d) => {
      const t = today(d); const first = !(d.challenge && d.challenge.done);
      if (complete && d.panel.variant === 'idea') { d.challenge = { done: true }; if (first) logEvent('challenge_done', {}); }
      d.songPractice = {
        last: { score, beatAcc, chordAcc, tempo, secs, trans, coverage, bars: list, complete, judge: judgeMode, fromLesson: !!(params && params.fromLesson), firstComplete: complete && !d.songPractice.count, challengeFirst: complete && first, date: t, back },
        count: d.songPractice.count + (complete ? 1 : 0),
        best: complete && scored && judgeMode === 'mic' ? Math.max(d.songPractice.best, score) : d.songPractice.best,
      };
      if (complete && params && params.fromLesson) { d.done.song[2] = true; d.resume = null; }
      d.history[t] = (d.history[t] || 0) + creditedSeconds;
    });
    logEvent('songplay_end', { tempo, played, score, beatAcc, chordAcc, coverage, judge: judgeMode, complete, fromLesson, creditedSeconds, diagnostics: songDiagnostics(list, BARS.map((bar) => bar.chord), judgeMode) });
    sfx.done(); go('songreport', { back });
  };

  useEffect(() => {
    if (phase !== 'play' || suspended) return undefined;
    const stop = micOn ? makeOnsetDetector((_at,_level,originalElapsed) => hits.current.push(originalElapsed),{snapshot:()=>el.current,simulated:judgeMode!=='mic'}) : () => {};
    if (!startLogged.current) { startLogged.current = true; logEvent('songplay_start', { tempo, mic: !!micOn, judge: judgeMode }); }
    let last = performance.now(); let lastBeat = Math.floor(el.current / beatMs);
    const judge = (i) => {
      const mode = judgeMode; const prevDiff = i > 0 && BARS[i].chord !== BARS[i - 1].chord;
      if (mode === 'allok') return { t: 'ok', c: true };
      if (mode === 'hard') return prevDiff && BARS[i].chord === 'C' ? { t: 'late', c: true } : { t: 'ok', c: true };
      if (mode === 'random') { const r = Math.random(); return { t: r < 0.7 ? 'ok' : r < 0.9 ? 'late' : 'none', c: r < 0.8 }; }
      if (!micOn) return { t: 'unmeasured', c: null };
      const a = i * 4 * beatMs; const b = a + 4 * beatMs;
      const inBar = hits.current.filter((t) => t >= a - beatMs * 0.25 && t < b - beatMs * 0.25);
      const decision = spectrum.take(i);
      if (!inBar.length) return { t: 'none', c: false };
      return { t: inBar[0] - a > beatMs * 0.6 ? 'late' : 'ok', c: decision.chord === null ? null : sameChord(decision.chord, BARS[i].chord), detectedChord: decision.chord, reason: decision.reason, classifier: decision.version };
    };
    const id = setInterval(() => {
      const now = performance.now();
      const delta = now - last;
      last = now;
      if (background.pauseRef.current || document.hidden || delta > 250 || (micOn && mic.state !== 'on')) return;
      const level = micOn ? mic.level() : 0;
      if (micOn && mic.state !== 'on') return;
      el.current += delta;
      const b = Math.floor(el.current / beatMs); const cur = Math.floor(b / 4);
      if (micOn) {
        spectrum.sample({observation:ear.snapshot(),now,elapsed:el.current,barMs:4*beatMs,minimumSourceAt:minimumSourceAt.current});
        if (mic.state !== 'on') return;
      }
      if (b !== lastBeat) {
        lastBeat = b; if (metroRef.current) sfx.tick();
        // 이번 박에서 시작하는 멜로디 음을 낸다(마디 안 시작 위치를 박 단위로 계산)
        const notes = melodyRef.current && SP.melody && SP.melody[Math.floor(b / 4)];
        if (notes) { let at = 0; const inBar = b % 4; for (const [midi, len] of notes) { if (at >= inBar && at < inBar + 1) sfx.note(midi, (len * beatMs) / 1000, ((at - inBar) * beatMs) / 1000); at += len; } }
      }
      const finalized=judgeMode==='mic'&&micOn?finalizedGuitarBars(el.current,beatMs,BARS.length):Math.min(cur,BARS.length);
      while (out.current.length < finalized) out.current.push(judge(out.current.length));
      setRes([...out.current]); setBar(Math.min(cur, BARS.length - 1)); setBeat(b % 4);
      if (out.current.length >= BARS.length) { clearInterval(id); stop(); finish(out.current); }
    }, 40);
    return () => { clearInterval(id); stop(); };
  }, [phase, suspended, beatMs]);

  const end = () => { if (!out.current.length) { setExit(true); return; } setPhase('pause'); finish(out.current); };
  const lastRes = res.length ? res[res.length - 1] : null; const lastBar = res.length ? BARS[res.length - 1] : null;
  const fb = phase === 'wait'
    ? [micOn === null ? '마이크를 준비하고 있어요…' : micOn && quiet ? '소리가 안 들려요. 한 번 튕겨 볼까요?' : micOn ? '기타 소리가 나면 시작해요' : '마이크 없이 진행해요', '코드 하나에 4박씩 쳐요']
    : !micOn && judgeMode === 'mic' ? ['마이크 없이 연습 중이에요', '가사 위의 코드를 따라 쳐요']
    : !lastRes ? ['잘 따라오고 있어요', '가사 위의 코드를 쳐요']
      : lastRes.t === 'none' ? ['소리가 안 들렸어요', '조금 더 세게 쳐 볼까요?']
        : lastRes.c === null ? ['코드를 판단하기 어려워요', '폰 위치와 주변 소음을 확인해요']
        : lastRes.t === 'late' ? [`${lastBar.chord} 코드가 조금 늦었어요`, '한 박 먼저 손을 옮겨 봐요']
          : lastRes.c ? [`${lastBar.chord} 코드 정확해요!`, '박자도 딱 맞았어요'] : ['박자가 딱 맞았어요', `${lastBar.chord} 소리가 조금 달라요`];
  const fbOk = lastRes && lastRes.t === 'ok' && lastRes.c === true;
  let n = -1;
  return (
    <div className="screen sp">
      {s.panel.variant === 'idea' && s.panel.alert === 'auto' && <SongPosture active={phase === 'play' && !suspended} />}
      <div className="row"><Piki name="main" size={38} still /><h1 style={{ fontSize: 17, flex: 1 }}>{SP.title}{params && params.fromLesson ? ' · 완주' : ''}</h1><button className="iconbtn" aria-label="곡 연습 나가기" onClick={() => setExit(true)}>✕</button></div>
      {micOn&&judgeMode==='mic'&&<GuitarInputStatus retry={microphone.retryMic}/>}
      <div className="sp-body" ref={scoreView}>
        <div className="sp-lines">
          {SP.sections.map((sec, si) => (
            <div key={sec.name} className="sp-sec">
              <span className="sp-tag">{sec.name}</span>
              {sec.lines.map((line, li) => (
                <div key={li} className="sp-line">
                  {line.map(([chord, lyric]) => { n += 1; const i = n; const r = res[i]; const now = phase !== 'wait' && i === bar && !r; return (
                    <div key={i} className={`sp-bar${now ? ' now' : ''}${r ? ` ${r.t !== 'unmeasured' && r.c === null ? 'uncertain' : r.t === 'ok' && !r.c ? 'check' : r.t}` : ''}${phase !== 'wait' && i > bar ? ' later' : ''}`}>
                      <b>{chord}{r && r.t === 'ok' && r.c === true ? ' ✓' : ''}{r && r.t !== 'unmeasured' && r.c === null ? <small>판정 어려움</small> : r && r.t === 'late' ? <small>늦음</small> : r && r.t === 'ok' && !r.c ? <small>코드 확인</small> : null}</b>
                      {lyric ? <span>{lyric}</span> : null}
                    </div>); })}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="sp-map">{SP.sections.map((sec, si) => <span key={sec.name} className={BARS[bar].si === si && phase !== 'wait' ? 'on' : ''}>{sec.name}<i /></span>)}</div>
      </div>
      <div className="sp-fb"><span className={`sp-ic${fbOk ? ' ok' : ''}`}>{fbOk ? '✓' : '♪'}</span><div style={{ flex: 1 }}><b>{fb[0]}</b><small>{fb[1]}</small></div><div className="sp-beat">{[0, 1, 2, 3].map((k) => <i key={k} className={phase === 'play' && k === beat ? 'on' : ''} />)}<small>{phase === 'wait' ? '' : `${beat + 1}박`}</small></div></div>
      <div>
        <input className="tempo-slider" aria-label="연주 템포" type="range" min="40" max="125" step="5" value={tempo} style={{ '--tempo-fill': `${((tempo - 40) / 85) * 100}%` }} disabled={phase !== 'wait'} onChange={(e) => setTempo(Number(e.target.value))} />
        <div className="row between" style={{ fontSize: 12, fontWeight: 700 }}><span style={{ color: 'var(--od)' }}>{tempo}% 템포</span><span style={{ opacity: 0.6 }}>{phase === 'wait' ? '시작 전에만 바꿀 수 있어요' : `${Math.round((SP.bpm * tempo) / 100)} BPM`}</span><span style={{ opacity: 0.6 }}>125%</span></div>
      </div>
      <div className="sp-ctl">
        <button onClick={() => setMetro((v) => !v)}><i className={metro ? 'on' : ''}>♩</i>메트로놈 {metro ? '켬' : '끔'}</button>
        <button onClick={() => setMelody((v) => !v)}><i className={melody ? 'on' : ''}>♪</i>멜로디 {melody ? '켬' : '끔'}</button>
        {phase === 'wait'
          ? <button disabled={micOn === null} onClick={() => { hits.current = []; setActiveJudge(s.panel.judge); setPhase('play'); }}><i className="big">▶</i>바로 시작</button>
          : <button onClick={() => setPhase(phase === 'play' ? 'pause' : 'play')}><i className="big">{phase === 'play' ? 'Ⅱ' : '▶'}</i>{phase === 'play' ? '일시정지' : '이어서'}</button>}
        <button onClick={end}><i>■</i>끝내기</button>
      </div>
      {phase === 'wait' && micOn === null && !inputLost && <button className="btn line" onClick={skipMic}>마이크 없이 계속하기</button>}
      {metro && micOn && <div className="sub" style={{ fontSize: 12 }}>스피커 박자 소리가 연주로 감지될 수 있어요. 이어폰으로 들어 주세요.</div>}
      {background.paused && !inputLost && <Modal onClose={background.resume}><h1>연습을 잠시 멈췄어요</h1><div className="sub">준비되면 멈춘 마디부터 이어서 연주해요.</div><button className="btn" onClick={background.resume}>계속 연주하기</button></Modal>}
      {!exit && <MicrophoneRecovery microphone={microphone} onExit={() => setExit(true)} onResume={background.resume} withoutMicHint="마이크 없이 이어가면 이후 마디는 측정 안 됨으로 기록해요." />}
      {exit && (
        <Modal onClose={() => setExit(false)}>
          <h1 style={{ fontSize: 20 }} className="tc">연주를 그만할까요?</h1>
          <div className="sub tc">지금 나가면 이번 결과는 저장되지 않아요.</div>
          <div className="two"><button className="btn line" onClick={() => go(back)}>나가기</button><button className="btn" onClick={() => setExit(false)}>계속하기</button></div>
        </Modal>
      )}
    </div>
  );
}

const SEC = { uncertain: ['판정 어려움', ''], unmeasured: ['측정 안 됨', ''], good: ['잘 쳤어요', 'ok'], late: ['조금 늦어요', 'late'], check: ['코드 확인', 'late'], retry: ['다시 해봐요', 'none'], skip: ['안 쳤어요', 'none'] };
export function SongReport({ s, go, params }) {
  const last = s.songPractice.last;
  if (!last) return <div className="screen center"><div className="grow sub">아직 곡 연습 기록이 없어요</div><button className="btn" onClick={() => go('learn')}>학습으로</button></div>;
  const back = (params && params.back) || last.back || 'learn';
  const scored = last.score != null;
  const stars = [60, 75, 90].filter((v) => last.score >= v).length;
  const tr = Object.entries(last.trans);
  const evaluated = (pair) => pair.n - (pair.uncertain || 0);
  const weak = tr.filter(([, v]) => evaluated(v) > 0 && v.ok < evaluated(v)).sort((a, b) => a[1].ok / evaluated(a[1]) - b[1].ok / evaluated(b[1]))[0];
  const uncertain = s.songPractice.last.coverage?.uncertain || 0;
  const simulated = last.judge && last.judge !== 'mic';
  const advice = weak && (weak[1].late > 0 ? '코드 전환이 조금 늦었어요.' : weak[1].missed > 0 ? '소리가 잘 들리지 않은 전환이에요.' : weak[1].chord > 0 ? '코드 소리를 한 번 더 확인해 볼까요?' : '한 번 더 연습해 볼까요?');
  const practice = () => { const [a, b] = weak[0].split(' → '); go('song', { pair: PAIR(a, b), back: 'songreport', key: Date.now() }); };
  return (
    <div className="screen">
      {last.firstComplete && <Confetti />}
      <div className="row between"><div><h1 style={{ fontSize: 20 }}>곡 연습 리포트</h1><div className="sub" style={{ fontSize: 12 }}>{SP.title} · {last.tempo}% 템포</div></div><button className="iconbtn" aria-label="리포트 닫기" onClick={() => go(back)}>✕</button></div>
      {simulated && <div className="card soft sub">모의 판정 결과예요. 최고 점수는 실제 마이크로 완주한 결과를 기록해요.</div>}
      {!simulated && (scored || uncertain > 0) && <div className="sub">코드 판정은 마이크로 추정한 참고 결과예요.</div>}
      {last.coverage && <div className="sub">연주 {last.coverage.played}/{last.coverage.total}마디 · 코드 평가 {last.coverage.evaluated}마디{uncertain > 0 ? ` · 판정 어려움 ${uncertain}마디` : ''}</div>}
      {uncertain > 0 && <div className="card soft sub">판정하기 어려운 마디가 있어 코드 정확도와 종합 점수는 보류했어요. 오답으로 계산하지 않으며 최고 기록도 바꾸지 않아요.</div>}
      <div className="card row" style={{ background: 'var(--y)', boxShadow: 'none', gap: 12 }}>
        <Piki name="clap" size={64} still />
        <div style={{ flex: 1 }}><h2 style={{ fontSize: 18 }}>{!last.complete ? '여기까지 쳤어요' : last.firstComplete ? '첫 곡 완주!' : '완주!'}</h2>{scored && <div style={{ fontSize: 18, letterSpacing: 2 }}>{[0, 1, 2].map((i) => (i < stars ? '★' : '☆')).join('')}</div>}</div>
        <div className="tc"><b style={{ fontSize: scored ? 34 : 16, lineHeight: 1 }}>{scored ? last.score : uncertain ? '판정 보류' : '측정 안 됨'}</b><div style={{ fontSize: 12, fontWeight: 700 }}>종합 점수</div></div>
      </div>
      <div className="row">{[['코드 정확도', last.chordAcc != null ? `${last.chordAcc}%` : uncertain ? '판정 보류' : '측정 안 됨'], ['박자 정확도', last.beatAcc != null ? `${last.beatAcc}%` : '측정 안 됨'], ['연주 템포', `${last.tempo}%`]].map(([k, v]) => <div key={k} className="card stat" style={{ padding: 12 }}><small>{k}</small><b style={{ fontSize: v.endsWith('%') ? 22 : 13 }}>{v}</b></div>)}</div>
      <div className="card col" style={{ gap: 8 }}><b style={{ fontSize: 14 }}>구간별 결과</b><div className="row">{last.secs.map((x) => <div key={x.name} className={`bar ${SEC[x.state][1]}`} style={{ flex: 1, height: 56 }}><b style={{ fontSize: 14 }}>{x.name}</b><small>{SEC[x.state][0]}</small></div>)}</div></div>
      {tr.length > 0 && <div className="card col" style={{ gap: 8 }}><b style={{ fontSize: 14 }}>코드 전환</b>{tr.map(([k, v]) => <div key={k} className="row" style={{ gap: 10 }}><b style={{ fontSize: 14, width: 64 }}>{k}</b><div className="sp-meter"><i style={{ width: `${pct(v.ok, evaluated(v))}%`, background: v.ok / evaluated(v) >= 0.75 ? 'var(--ok)' : 'var(--o)' }} /></div><b style={{ fontSize: 12, color: 'var(--od)' }}>{evaluated(v) ? `${v.ok}/${evaluated(v)}` : '판정 보류'}{v.uncertain > 0 && <small style={{ display: 'block' }}>보류 {v.uncertain}회</small>}</b></div>)}</div>}
      {weak && <div className="card soft row" style={{ gap: 10 }}><Piki name="hi" size={40} still /><div><b style={{ fontSize: 13 }}>{weak[0]} · {advice} 전환 연습을 한 번 더 해볼까요?</b><button className="cap" style={{ display: 'block', marginTop: 6, fontSize: 13 }} onClick={practice}>전환 연습하러 가기 ›</button></div></div>}
      {last.challengeFirst && (
        <div className="card row between fadeup" style={{ background: 'var(--okbg)', boxShadow: 'none', padding: '12px 16px' }}>
          <div><b style={{ fontSize: 14, color: 'var(--ok)' }}>✓ 친구와 같은 곡 연습 완료!</b><div className="sub" style={{ fontSize: 12 }}>친구 3명 중 2명도 끝냈어요</div></div>
          <button className="pill w" style={{ color: 'var(--ok)' }} onClick={() => go('my')}>친구들 보기</button>
        </div>
      )}
      <div className="grow" style={{ minHeight: 0 }} />
      <div className="two"><button className="btn soft" onClick={() => go('songplay', { key: Date.now(), back, fromLesson: !!last.fromLesson })}>다시 연주</button><button className="btn" onClick={() => go(back)}>완료</button></div>
    </div>
  );
}
