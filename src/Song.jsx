// 곡 연주와 곡 리포트
import React, { useEffect, useRef, useState } from 'react';
import { content, mic, makeOnsetDetector, today, sfx, logEvent } from './lib.js';
import { Piki, Modal, Confetti } from './ui.jsx';
import { useMicrophone } from './useMicrophone.js';
import { usePracticePause } from './usePracticePause.js';
import { MicrophoneRecovery } from './MicrophoneRecovery.jsx';
import { useBeforeUnload } from './useBeforeUnload.js';
import {GuitarInputStatus} from './GuitarInputStatus.jsx';
import {guitarBarIndex,finalizedGuitarBars} from './guitarTimeline.js';
import { canonicalChord } from './chordMatch.js';

const SONG = content.songChart.bars;
const pairBars = (p) => [p[0], p[0], p[1], p[1], p[0], p[0], p[1], p[1]];
const MARK = { ok: '✓', late: '늦음', none: '–', wrong: '다른 코드' };
const chordLabel = (c) => canonicalChord(c).replace(/5$/, '') || c;

export function Song({ s, update, go, params, microphone, paused = false, restartCurrentBar = false, coach = null }) {
  const pair = params && params.pair; const BARS = pair ? pairBars(pair) : SONG; const emb = params && params.onDone; // emb = 레슨 안 전환 단계
  const [tempo, setTempo] = useState(80);
  const [phase, setPhase] = useState('wait'); // wait | play
  useBeforeUnload(!emb && phase === 'play');
  const background = usePracticePause(!emb && phase === 'play');
  const [bar, setBar] = useState(0);
  const [beat, setBeat] = useState(0);
  const [res, setRes] = useState([]);
  const onProgress = params && params.onProgress;
  useEffect(() => { if (onProgress) onProgress(res.length); }, [onProgress, res.length]);
  const [exit, setExit] = useState(false);
  const ownMicrophone = useMicrophone(!microphone);
  const input = microphone || ownMicrophone;
  const { micOn, skipMic, inputLost } = input;
  const interrupted = useRef(false);
  const suspended = paused || background.paused || inputLost || (interrupted.current && micOn === false);
  const [quiet, setQuiet] = useState(false);
  const configuredJudge = s.panel.judge;
  const [activeJudge, setActiveJudge] = useState(null);
  const judgeMode = activeJudge || (micOn === false && configuredJudge === 'mic' ? 'random' : configuredJudge);
  const hits = useRef([]);
  // 다른 코드로 친 소리(11/19 QA): 마디 판정은 '다른 코드', 캐릭터가 바로 알려 준다
  const misses = useRef([]); const wrongChords = useRef({});
  const [miss, setMiss] = useState(null);
  const [retry, setRetry] = useState(false);
  useEffect(() => { if (!miss) return undefined; const id = setTimeout(() => setMiss(null), 2500); return () => clearTimeout(id); }, [miss]);
  const elapsed = useRef(0);
  const results = useRef([]);
  const startLogged = useRef(false);
  const speed = s.panel.speed;
  const comparisonSpeed = useRef(speed);
  const beatMs = 60000 / ((content.songChart.bpm * tempo) / 100) / speed;
  const previousBeatMs = useRef(beatMs);
  useEffect(() => {
    if (previousBeatMs.current === beatMs) return;
    previousBeatMs.current = beatMs;
    comparisonSpeed.current = phase === 'play' ? null : speed;
    elapsed.current = results.current.length * 4 * beatMs; hits.current = [];
    setBar(Math.min(results.current.length, 7)); setBeat(0);
  }, [beatMs]);
  useEffect(() => {
    if (inputLost && !interrupted.current) {
      interrupted.current = true; elapsed.current = results.current.length * 4 * beatMs; hits.current = [];
      setBar(Math.min(results.current.length, 7)); setBeat(0);
    } else if (!inputLost && interrupted.current) {
      interrupted.current = false;
      if (micOn === false) {
        results.current = []; hits.current = []; elapsed.current = 0; startLogged.current = false;
        comparisonSpeed.current = speed;
        setRes([]); setBar(0); setBeat(0); setPhase('wait'); setActiveJudge(null); setQuiet(false);
      }
    }
  }, [inputLost, micOn]);
  useEffect(() => {
    if (!background.paused && !restartCurrentBar) return;
    elapsed.current = results.current.length * 4 * beatMs; hits.current = [];
    setBar(Math.min(results.current.length, 7)); setBeat(0);
  }, [background.paused, restartCurrentBar]);

  // 레슨 안 전환 연습(emb): 첫 소리를 기다리지 않고 메트로놈 '준비… 3, 2, 1'을 센 뒤 바로 시작한다(11/18 18:40 QA: 템포 감이 안 잡힘)
  const [count, setCount] = useState(null);
  useEffect(() => {
    if (!emb || phase !== 'wait' || exit || suspended || micOn === null) { setCount(null); return undefined; }
    let n = 3; setCount(n); sfx.tick();
    const id = setInterval(() => {
      n -= 1;
      if (n > 0) { setCount(n); sfx.tick(); return; }
      clearInterval(id); setCount(null); elapsed.current = 0; hits.current = []; setActiveJudge(configuredJudge); setPhase('play');
    }, beatMs);
    return () => clearInterval(id);
  }, [emb, phase, exit, suspended, micOn, beatMs]);
  // 대기: 첫 소리가 나면 시작(연습 탭 전환 연습)
  useEffect(() => {
    if (emb || phase !== 'wait' || exit || suspended) return undefined;
    const q = setTimeout(() => setQuiet(true), 30000);
    if (!micOn) return () => clearTimeout(q);
    const stop = makeOnsetDetector((at) => { elapsed.current=performance.now()-at;hits.current = [0]; setActiveJudge(configuredJudge); setPhase('play'); },{target:BARS[0],simulated:judgeMode!=='mic'});
    return () => { stop(); clearTimeout(q); };
  }, [phase, micOn, configuredJudge, exit, suspended]);
  // 연주: 박자를 세고 마디가 끝날 때마다 판정
  useEffect(() => {
    if (phase !== 'play' || exit || suspended || retry) return undefined;
    const onMiss = (_at, _level, originalElapsed, heard) => { misses.current.push({ t: originalElapsed, chord: chordLabel(heard.chord) }); setMiss({ chord: chordLabel(heard.chord), target: heard.target }); };
    const stop = micOn ? makeOnsetDetector((_at,_level,originalElapsed) => hits.current.push(originalElapsed),{onMiss,target:()=>BARS[Math.min(7,guitarBarIndex(elapsed.current,beatMs))],snapshot:()=>elapsed.current,simulated:judgeMode!=='mic'}) : () => {};
    const out = results.current;
    if (!startLogged.current) { startLogged.current = true; logEvent('song_start', { tempo, mic: !!micOn, judge: judgeMode }); }
    let lastTick = performance.now(); let lastBeat = -1;
    const judge = (i) => {
      const mode = judgeMode;
      if (mode === 'allok') return 'ok';
      if (mode === 'hard') return i > 0 && BARS[i] !== BARS[i - 1] ? 'late' : 'ok';
      if (mode === 'random') { const r = Math.random(); return r < 0.7 ? 'ok' : r < 0.9 ? 'late' : 'none'; }
      const a = i * 4 * beatMs; const b = a + 4 * beatMs;
      const inBar = hits.current.filter((t) => t >= a - beatMs * 0.25 && t < b - beatMs * 0.25);
      const wrong = misses.current.find((m) => m.t >= a - beatMs * 0.25 && m.t < b - beatMs * 0.25);
      if (wrong) { wrongChords.current[i] = wrong.chord; return 'wrong'; } // 늦음·빠름과 상관없이 다른 코드를 한 번이라도 치면 틀림
      if (!inBar.length) return 'none';
      return inBar[0] - a > beatMs * 0.6 ? 'late' : 'ok'; // 마디 첫 소리가 반 박 넘게 늦으면 '전환 늦음'
    };
    const id = setInterval(() => {
      const now = performance.now();
      const delta = now - lastTick;
      lastTick = now;
      if (background.pauseRef.current || document.hidden || delta > 250 || (micOn && mic.state !== 'on')) return;
      elapsed.current += delta;
      const b = Math.floor(elapsed.current / beatMs);
      if (emb && b !== lastBeat && b < 32) { lastBeat = b; sfx.tick(); } // 레슨 안 전환 연습은 박마다 메트로놈
      const curBar = Math.floor(b / 4);
      const finalized=judgeMode==='mic'?finalizedGuitarBars(elapsed.current,beatMs,8):Math.min(curBar,8);
      while (out.length < finalized) out.push(judge(out.length));
      setRes([...out]); setBar(Math.min(curBar, 7)); setBeat(b % 4);
      if (out.length >= 8) {
        clearInterval(id); stop();
        if (emb) {
          const wrong = out.includes('wrong');
          logEvent('transition_end', { pair: pair.join('-'), judge: judgeMode, bars: out.join(','), retry: wrong });
          if (wrong) { setRetry(true); return; } // 한 번이라도 다른 코드로 치면 다시 연습(11/19 QA)
          sfx.ok(); params.onDone(); return;
        }
        update((d) => {
          const t = today(d); const firstCh = false; // 같은 곡 완료 표시는 곡 연습(SongPlay)에서 한다
          d.song.prev = d.song.last; d.song.last = { judge: judgeMode, bars: out, chart: BARS, pair: pair || null, back: (params && params.back) || null, tempo, speed: comparisonSpeed.current, date: t, challengeFirst: firstCh }; d.history[t] = (d.history[t] || 0) + (params && params.fromLesson ? 180 : 120);
          if (params && params.fromLesson) { d.done.song[2] = true; d.resume = null; }
        });
        logEvent('song_end', { tempo, judge: judgeMode, bars: out.join(',') });
        sfx.done(); go('report');
      }
    }, 40);
    return () => { clearInterval(id); stop(); };
  }, [phase, exit, suspended, beatMs, retry]);

  const again = () => {
    results.current = []; hits.current = []; misses.current = []; wrongChords.current = {}; elapsed.current = 0;
    setRes([]); setBar(0); setBeat(0); setMiss(null); setRetry(false); setPhase('wait');
  };
  const startManual = () => { setActiveJudge(judgeMode); setPhase('play'); };
  // 레슨 안에서는 안내를 캐릭터 말풍선으로(11/18 QA)
  const wrongBars = res.filter((r) => r === 'wrong').length;
  const embSay = retry ? `다른 코드로 친 마디가 ${wrongBars}개 있어요. 처음부터 다시 해 볼까요?` : miss ? `지금은 ${miss.chord} 코드예요. ${miss.target} 코드를 쳐 주세요` : micOn === null ? '마이크를 준비하고 있어요' : count ? `딱 소리에 맞춰요. 준비… ${count}` : phase === 'play' ? `${BARS[bar]} 코드를 딱 소리에 맞춰 쳐요` : '곧 시작해요';
  return (
    <div className={emb ? 'embed' : 'screen'}>
      {emb ? <div><div className="cap">코드 전환 연습</div><div className="big">{pair[0]} ↔ {pair[1]}</div></div>
        : <div className="row"><button className="iconbtn" aria-label="전환 연습 나가기" onClick={() => setExit(true)}>✕</button><h1 style={{ fontSize: 20 }}>{pair ? `${pair[0]} ↔ ${pair[1]} 전환 연습` : content.songChart.title}</h1></div>}
      {!emb && <div className="card soft tc" style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--od)', fontSize: 14 }}>
        {phase === 'wait' ? (micOn === null ? '마이크를 준비하고 있어요…' : micOn && quiet ? '소리가 안 들려요. 한 번 튕겨 볼까요?' : micOn ? '기타 소리가 나면 시작해요' : '마이크 없이 진행해요') : `연주 중 · ${bar + 1}번째 마디`}
        {micOn !== null && judgeMode !== 'mic' && <div className="sub">모의 판정으로 진행해요</div>}
      </div>}
      {micOn&&judgeMode==='mic'&&<GuitarInputStatus target={BARS[bar]} retry={input.retryMic}/>}
      <div className="bars">
        {BARS.map((c, i) => {
          const r = res[i]; const now = phase === 'play' && i === bar && !r;
          return <div key={i} className={`bar ${r || ''}${now ? ' now' : ''}`}><b>{c}</b><small>{r === 'wrong' ? (wrongChords.current[i] || '다른 코드') : r ? MARK[r] : now ? '●○○○'.split('').map((_, k) => (k === beat ? '●' : '○')).join('') : ''}</small></div>;
        })}
      </div>
      {emb
        ? <div className="grow stage-say"><div className="bubble say" role="status" key={embSay}>{embSay}</div>{coach || <Piki name="play" size={110} />}</div>
        : <div className="grow stage-say">{miss && <div className="bubble say" role="status" key={miss.chord + res.length}>지금은 {miss.chord} 코드예요. {miss.target} 코드를 쳐 주세요</div>}{coach || <Piki name="play" size={170} />}</div>}
      {retry && <button className="btn" onClick={again}>다시 연습하기</button>}
      {phase === 'wait' && micOn === false && !emb && <button className="btn" onClick={startManual}>시작하기</button>}
      {phase === 'wait' && micOn === null && !inputLost && !emb && <button className="btn line" onClick={skipMic}>마이크 없이 계속하기</button>}
      <div className="card">
        <div className="row between"><b style={{ fontSize: 13 }}>템포</b><b style={{ fontSize: 13, color: 'var(--od)' }}>{tempo}% ({Math.round((content.songChart.bpm * tempo) / 100)} BPM)</b></div>
        <input className="tempo-slider" aria-label="연주 템포" type="range" min="40" max="125" step="5" value={tempo} style={{ '--tempo-fill': `${((tempo - 40) / 85) * 100}%` }} disabled={phase !== 'wait'} onChange={(e) => setTempo(Number(e.target.value))} />
        <div className="row between sub" style={{ fontSize: 11 }}><span>40%</span><span>{phase === 'wait' ? '시작 전에만 바꿀 수 있어요' : ''}</span><span>125%</span></div>
      </div>
      {exit && (
        <Modal onClose={() => setExit(false)}>
          <h1 style={{ fontSize: 20 }} className="tc">연주를 그만할까요?</h1>
          <div className="sub tc">지금 나가면 이번 결과는 저장되지 않아요.</div>
          <div className="two"><button className="btn line" onClick={() => go((params && params.back) || 'learn')}>나가기</button><button className="btn" onClick={() => setExit(false)}>계속하기</button></div>
        </Modal>
      )}
      {background.paused && !inputLost && <Modal onClose={background.resume}><h1>연습을 잠시 멈췄어요</h1><div className="sub">준비되면 멈춘 마디부터 이어서 연주해요.</div><button className="btn" onClick={background.resume}>계속 연주하기</button></Modal>}
      {!emb && !exit && <MicrophoneRecovery microphone={input} onExit={() => setExit(true)} onResume={background.resume} withoutMicHint="마이크 없이 진행하면 이번 8마디는 모의 판정으로 처음부터 다시 시작해요." />}
    </div>
  );
}

// 늦은 마디가 가장 많은 코드 전환을 찾는다
function weakTransition(bars, BARS) {
  const count = {};
  bars.forEach((r, i) => { if (i > 0 && BARS[i] !== BARS[i - 1] && r === 'late') { const k = `${BARS[i - 1]} → ${BARS[i]}`; count[k] = (count[k] || 0) + 1; } });
  const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
  if (top) return top[0];
  const late = bars.findIndex((r, i) => i > 0 && r !== 'ok' && BARS[i] !== BARS[i - 1]);
  return late > 0 ? `${BARS[late - 1]} → ${BARS[late]}` : null;
}
const PAIRS = { Em: { G: ['Em', 'G'], C: ['Em', 'C'] }, G: { Em: ['Em', 'G'], C: ['G', 'C'] }, C: { G: ['G', 'C'], Em: ['Em', 'C'] } };

export function comparableTransitionResults(last, prev) {
  const modes = ['mic', 'random', 'allok', 'hard'];
  const valid = (result) => result && modes.includes(result.judge)
    && Number.isFinite(result.tempo) && result.tempo >= 40 && result.tempo <= 125
    && Number.isFinite(result.speed) && result.speed > 0
    && Array.isArray(result.bars) && result.bars.length === 8 && result.bars.every((bar) => ['ok', 'late', 'none', 'wrong'].includes(bar));
  if (!valid(last) || !valid(prev) || last.judge !== prev.judge || last.tempo !== prev.tempo || last.speed !== prev.speed) return false;
  if ((last.pair == null) !== (prev.pair == null)) return false;
  if (last.pair != null && (!Array.isArray(last.pair) || !Array.isArray(prev.pair) || last.pair.length !== 2 || prev.pair.length !== 2 || !last.pair.every((chord, i) => Object.hasOwn(content.chordNotes, chord) && chord === prev.pair[i]))) return false;
  const chart = (result) => result.chart ?? (result.pair == null ? SONG : null);
  const a = chart(last); const b = chart(prev);
  return Array.isArray(a) && Array.isArray(b) && a.length === 8 && b.length === 8
    && a.every((chord, i) => Object.hasOwn(content.chordNotes, chord) && chord === b[i]);
}

export function Report({ s, go }) {
  const { last, prev } = s.song; const BARS = (last && last.chart) || SONG; const pair = last && last.pair;
  if (!last) return <div className="screen center"><div className="grow sub">아직 연주 기록이 없어요</div><button className="btn" onClick={() => go('home')}>홈으로</button></div>;
  const sound = last.bars.filter((r) => r !== 'none').length;
  const onbeat = last.bars.filter((r) => r === 'ok').length;
  const comparable = comparableTransitionResults(last, prev);
  const weak = pair ? null : weakTransition(last.bars, BARS);
  const allOk = onbeat === 8;
  const nextTempo = Math.min(125, last.tempo + 10);
  const goal = allOk ? (last.tempo >= 125 ? '같은 템포로 한 번 더' : `템포 ${nextTempo}%로 한 번 더`) : `박자 맞음 ${Math.min(8, onbeat + 1)}/8 해 보기`;
  const practice = () => { const [a, b] = weak.split(' → '); go('lesson', { custom: { title: `${a} ↔ ${b} 전환 연습`, steps: [{ type: 'transition', pair: PAIRS[a][b] }] }, back: 'report', key: Date.now() }); };
  return (
    <div className="screen">
      {allOk && <Confetti />}
      <h1>{pair ? '전환 연습 결과' : '곡 리포트'}</h1>
      {last.judge && last.judge !== 'mic' && <div className="sub">모의 판정 결과예요. 마디별 결과는 연습용 예시예요.</div>}
      <div className="card soft row" style={{ gap: 12 }}>
        <Piki name="clap" size={84} />
        <div><h2 style={{ fontSize: 20 }}>{allOk ? '완벽하게 끝냈어요!' : '끝까지 쳤어요!'}</h2><div className="sub" style={{ fontSize: 13 }}>8마디 중 {onbeat}마디가 박자에 맞았어요</div></div>
      </div>
      {last.challengeFirst && s.panel.variant === 'idea' && (
        <div className="card row between fadeup" style={{ background: 'var(--okbg)', boxShadow: 'none', padding: '12px 16px' }}>
          <div><b style={{ fontSize: 15, color: 'var(--ok)' }}>✓ 이번 주 같은 곡 완료!</b><div className="sub" style={{ fontSize: 12 }}>친구 3명 중 2명도 끝냈어요</div></div>
          <button className="pill w" style={{ color: 'var(--ok)' }} onClick={() => go('my')}>친구들 보기</button>
        </div>
      )}
      <div className="row">
        <div className="chip" style={{ background: 'var(--o)' }}><span>템포</span><b style={{ color: 'var(--ot)' }}>{last.tempo}%</b></div>
        <div className="chip" style={{ background: '#2FA8E8' }}><span>소리 들림</span><b style={{ color: '#2FA8E8' }}>{sound}/8</b></div>
        <div className="chip" style={{ background: 'var(--ok)' }}><span>박자 맞음</span><b style={{ color: 'var(--ok)' }}>{onbeat}/8</b></div>
      </div>
      <div className="col" style={{ gap: 8 }}>
        <b style={{ fontSize: 13 }}>마디별 결과</b>
        <div className="minibars">{last.bars.map((r, i) => <div key={i} className={`bar ${r}`}><b>{BARS[i]}</b><small>{MARK[r]}</small></div>)}</div>
        <div className="row sub" style={{ fontSize: 11, gap: 12 }}><span>✓ 박자 맞음</span><span>늦음 = 전환 늦음</span>{last.bars.includes('wrong') && <span>다른 코드 = 다른 코드로 침</span>}<span>{last.judge === 'mic' ? '– 코드 확인 안 됨' : '– 소리 안 들림'}</span></div>
      </div>
      {weak ? (
        <div className="card row between sel">
          <div><div className="cap">더 연습하면 좋은 전환</div><h2 style={{ fontSize: 20 }}>{weak}</h2></div>
          <button className="btn sm soft" onClick={practice}>연습하기</button>
        </div>
      ) : (
        <div className="card sel"><div className="cap">{allOk ? '모두 맞았어요!' : '전환은 잘 따라왔어요'}</div><h2>{allOk ? '템포를 올려 볼까요?' : last.judge === 'mic' ? '표시된 코드를 또렷하게 쳐 볼까요?' : '소리를 조금 더 크게 내 볼까요?'}</h2></div>
      )}
      <div className="card">
        {comparable ? <b style={{ fontSize: 14 }}>지난번보다 박자 맞음 {prev.bars.filter((r) => r === 'ok').length}/8 → {onbeat}/8{last.judge !== 'mic' ? ' (모의 판정끼리 비교)' : ''}</b> : prev ? <><b style={{ fontSize: 14 }}>비교할 수 있는 직전 기록이 없어요.</b><div className="sub" style={{ fontSize: 12 }}>코드 구성·템포·판정 방식·실행 속도가 같은 기록만 비교해요.</div></> : <b style={{ fontSize: 14 }}>첫 연주예요. 같은 조건의 다음 연습부터 비교해 드려요</b>}
        <div className="sub" style={{ fontSize: 13 }}>다음 목표: {goal}</div>
      </div>
      <div className="grow" style={{ minHeight: 0 }} />
      <div className="two"><button className="btn soft" onClick={() => go('song', { key: Date.now(), pair, back: last.back })}>한 번 더</button>{pair ? <button className="btn" onClick={() => go(last.back || 'practice')}>완료</button> : <button className="btn" onClick={() => go('home')}>홈으로</button>}</div>
    </div>
  );
}
