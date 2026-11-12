// 곡 연습(가사 위에 코드가 흐르는 화면)과 곡 연습 리포트
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { content, mic, makeOnsetDetector, guessChord, threshold, today, sfx, logEvent } from './lib.js';
import { Piki, Modal, Confetti } from './ui.jsx';

const SP = content.songPractice;
// 코드 하나 = 한 마디(4박). 화면 순서대로 편 목록
const BARS = SP.sections.flatMap((sec, si) => sec.lines.flatMap((line, li) => line.map(([chord, lyric]) => ({ chord, lyric, si, li }))));
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const PAIR = (a, b) => (['Em', 'G', 'C'].indexOf(a) < ['Em', 'G', 'C'].indexOf(b) ? [a, b] : [b, a]);

export function SongPlay({ s, update, go, params }) {
  const [tempo, setTempo] = useState(40);
  const [phase, setPhase] = useState('wait'); // wait | play | pause
  const [bar, setBar] = useState(0);
  const [beat, setBeat] = useState(0);
  const [res, setRes] = useState([]); // [{t:'ok'|'late'|'none', c:true|false}]
  const [exit, setExit] = useState(false);
  const [metro, setMetro] = useState(true);
  const [micOn, setMicOn] = useState(mic.state === 'on' ? true : null);
  const [quiet, setQuiet] = useState(false);
  const el = useRef(0); const hits = useRef([]); const out = useRef([]); const chroma = useRef(new Array(12).fill(0)); const metroRef = useRef(true); metroRef.current = metro;
  const back = (params && params.back) || 'learn';
  const beatMs = 60000 / ((SP.bpm * tempo) / 100) / s.panel.speed;

  useEffect(() => { mic.start().then(setMicOn); }, []);
  useEffect(() => {
    if (phase !== 'wait' || exit) return undefined;
    const q = setTimeout(() => setQuiet(true), 30000);
    if (!micOn) return () => clearTimeout(q);
    const stop = makeOnsetDetector(() => { hits.current = [0]; setPhase('play'); });
    return () => { stop(); clearTimeout(q); };
  }, [phase, micOn, exit]);

  const finish = (list) => {
    const played = list.length;
    const scored = list.every((result) => result.t !== 'unmeasured');
    const okBeat = list.filter((r) => r.t === 'ok').length; const okChord = list.filter((r) => r.c).length;
    const beatAcc = scored ? pct(okBeat, played) : null;
    const chordAcc = scored ? pct(okChord, played) : null;
    const secs = SP.sections.map((sec, si) => { const rs = list.filter((_, i) => BARS[i].si === si); const good = rs.filter((r) => r.t === 'ok').length; return { name: sec.name, state: !rs.length ? 'skip' : !scored ? 'unmeasured' : good / rs.length >= 0.75 ? 'good' : rs.some((r) => r.t !== 'none') ? 'late' : 'retry' }; });
    const trans = {};
    list.forEach((r, i) => { if (scored && i > 0 && BARS[i].chord !== BARS[i - 1].chord) { const k = `${BARS[i - 1].chord} → ${BARS[i].chord}`; trans[k] = trans[k] || { ok: 0, n: 0 }; trans[k].n += 1; if (r.t === 'ok' && r.c) trans[k].ok += 1; } });
    const score = scored ? Math.round((beatAcc + chordAcc) / 2) : null;
    update((d) => {
      const t = today(d); const first = !(d.challenge && d.challenge.done); const complete = played === BARS.length;
      if (complete && d.panel.variant === 'idea') { d.challenge = { done: true }; if (first) logEvent('challenge_done', {}); }
      d.songPractice = { last: { score, beatAcc, chordAcc, tempo, secs, trans, complete, firstComplete: complete && !d.songPractice.count, challengeFirst: complete && first, date: t, back }, count: d.songPractice.count + (complete ? 1 : 0), best: scored ? Math.max(d.songPractice.best, score) : d.songPractice.best };
      if (complete && params && params.fromLesson) { d.done.song[2] = true; d.resume = null; }
      d.history[t] = (d.history[t] || 0) + Math.round((played * 4 * 60) / ((SP.bpm * tempo) / 100));
    });
    logEvent('songplay_end', { tempo, played, score, beatAcc, chordAcc });
    sfx.done(); go('songreport', { back });
  };

  useEffect(() => {
    if (phase !== 'play' || exit) return undefined;
    const stop = micOn ? makeOnsetDetector(() => hits.current.push(el.current)) : () => {};
    if (!out.current.length && el.current === 0) logEvent('songplay_start', { tempo, mic: !!micOn, judge: s.panel.judge });
    let last = performance.now(); let lastBeat = Math.floor(el.current / beatMs);
    const judge = (i) => {
      const mode = s.panel.judge; const prevDiff = i > 0 && BARS[i].chord !== BARS[i - 1].chord;
      if (mode === 'allok') return { t: 'ok', c: true };
      if (mode === 'hard') return prevDiff && BARS[i].chord === 'C' ? { t: 'late', c: true } : { t: 'ok', c: true };
      if (mode === 'random') { const r = Math.random(); return { t: r < 0.7 ? 'ok' : r < 0.9 ? 'late' : 'none', c: r < 0.8 }; }
      if (!micOn) return { t: 'unmeasured', c: null };
      const a = i * 4 * beatMs; const b = a + 4 * beatMs;
      const inBar = hits.current.filter((t) => t >= a - beatMs * 0.25 && t < b - beatMs * 0.25);
      const g = guessChord(chroma.current); chroma.current = new Array(12).fill(0);
      if (!inBar.length) return { t: 'none', c: false };
      return { t: inBar[0] - a > beatMs * 0.6 ? 'late' : 'ok', c: g === BARS[i].chord };
    };
    const id = setInterval(() => {
      const now = performance.now(); el.current += now - last; last = now;
      if (micOn && mic.level() > threshold() * 0.6) { const c = mic.chroma(); for (let k = 0; k < 12; k += 1) chroma.current[k] += c[k]; }
      const b = Math.floor(el.current / beatMs); const cur = Math.floor(b / 4);
      if (b !== lastBeat) { lastBeat = b; if (metroRef.current) sfx.tick(); }
      while (out.current.length < Math.min(cur, BARS.length)) out.current.push(judge(out.current.length));
      setRes([...out.current]); setBar(Math.min(cur, BARS.length - 1)); setBeat(b % 4);
      if (cur >= BARS.length) { clearInterval(id); stop(); finish(out.current); }
    }, 40);
    return () => { clearInterval(id); stop(); };
  }, [phase, exit]);

  const end = () => { if (!out.current.length) { setExit(true); return; } setPhase('pause'); finish(out.current); };
  const lastRes = res.length ? res[res.length - 1] : null; const lastBar = res.length ? BARS[res.length - 1] : null;
  const fb = phase === 'wait'
    ? [micOn === null ? '마이크를 준비하고 있어요…' : micOn && quiet ? '소리가 안 들려요. 한 번 튕겨 볼까요?' : micOn ? '기타 소리가 나면 시작해요' : '마이크 없이 진행해요', '코드 하나에 4박씩 쳐요']
    : !micOn && s.panel.judge === 'mic' ? ['마이크 없이 연습 중이에요', '가사 위의 코드를 따라 쳐요']
    : !lastRes ? ['잘 따라오고 있어요', '가사 위의 코드를 쳐요']
      : lastRes.t === 'none' ? ['소리가 안 들렸어요', '조금 더 세게 쳐 볼까요?']
        : lastRes.t === 'late' ? [`${lastBar.chord} 코드가 조금 늦었어요`, '한 박 먼저 손을 옮겨 봐요']
          : lastRes.c ? [`${lastBar.chord} 코드 정확해요!`, '박자도 딱 맞았어요'] : ['박자가 딱 맞았어요', `${lastBar.chord} 소리가 조금 달라요`];
  const fbOk = lastRes && lastRes.t === 'ok';
  let n = -1;
  return (
    <div className="screen sp">
      <div className="row"><Piki name="main" size={38} still /><h1 style={{ fontSize: 17, flex: 1 }}>{SP.title}{params && params.fromLesson ? ' · 완주' : ''}</h1><button className="iconbtn" onClick={() => setExit(true)}>✕</button></div>
      <div className="sp-body">
        <div className="sp-lines">
          {SP.sections.map((sec, si) => (
            <div key={sec.name} className="sp-sec">
              <span className="sp-tag">{sec.name}</span>
              {sec.lines.map((line, li) => (
                <div key={li} className="sp-line">
                  {line.map(([chord, lyric]) => { n += 1; const i = n; const r = res[i]; const now = phase !== 'wait' && i === bar && !r; return (
                    <div key={i} className={`sp-bar${now ? ' now' : ''}${r ? ` ${r.t}` : ''}${phase !== 'wait' && i > bar ? ' later' : ''}`}>
                      <b>{chord}{r && r.t === 'ok' ? ' ✓' : ''}{r && r.t === 'late' ? <small>늦음</small> : null}</b>
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
        <input type="range" min="40" max="125" step="5" value={tempo} disabled={phase !== 'wait'} onChange={(e) => setTempo(Number(e.target.value))} />
        <div className="row between" style={{ fontSize: 12, fontWeight: 700 }}><span style={{ color: 'var(--od)' }}>{tempo}% 템포</span><span style={{ opacity: 0.6 }}>{phase === 'wait' ? '시작 전에만 바꿀 수 있어요' : `${Math.round((SP.bpm * tempo) / 100)} BPM`}</span><span style={{ opacity: 0.6 }}>125%</span></div>
      </div>
      <div className="sp-ctl">
        <button onClick={() => setMetro((v) => !v)}><i className={metro ? 'on' : ''}>♩</i>메트로놈 {metro ? '켬' : '끔'}</button>
        {phase === 'wait'
          ? <button onClick={() => { if (micOn !== null) { hits.current = []; setPhase('play'); } }}><i className="big">▶</i>바로 시작</button>
          : <button onClick={() => setPhase(phase === 'play' ? 'pause' : 'play')}><i className="big">{phase === 'play' ? 'Ⅱ' : '▶'}</i>{phase === 'play' ? '일시정지' : '이어서'}</button>}
        <button onClick={end}><i>■</i>끝내기</button>
      </div>
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

const SEC = { unmeasured: ['측정 안 됨', ''], good: ['잘 쳤어요', 'ok'], late: ['조금 늦어요', 'late'], retry: ['다시 해봐요', 'none'], skip: ['안 쳤어요', 'none'] };
export function SongReport({ s, go, params }) {
  const last = s.songPractice.last;
  if (!last) return <div className="screen center"><div className="grow sub">아직 곡 연습 기록이 없어요</div><button className="btn" onClick={() => go('learn')}>학습으로</button></div>;
  const back = (params && params.back) || last.back || 'learn';
  const scored = last.score != null;
  const stars = [60, 75, 90].filter((v) => last.score >= v).length;
  const tr = Object.entries(last.trans);
  const weak = tr.filter(([, v]) => v.ok < v.n).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n)[0];
  const practice = () => { const [a, b] = weak[0].split(' → '); go('song', { pair: PAIR(a, b), back: 'songreport', key: Date.now() }); };
  return (
    <div className="screen">
      {last.firstComplete && <Confetti />}
      <div className="row between"><div><h1 style={{ fontSize: 20 }}>곡 연습 리포트</h1><div className="sub" style={{ fontSize: 12 }}>{SP.title} · {last.tempo}% 템포</div></div><button className="iconbtn" onClick={() => go(back)}>✕</button></div>
      <div className="card row" style={{ background: 'var(--y)', boxShadow: 'none', gap: 12 }}>
        <Piki name="clap" size={64} still />
        <div style={{ flex: 1 }}><h2 style={{ fontSize: 18 }}>{!last.complete ? '여기까지 쳤어요' : last.firstComplete ? '첫 곡 완주!' : '완주!'}</h2>{scored && <div style={{ fontSize: 18, letterSpacing: 2 }}>{[0, 1, 2].map((i) => (i < stars ? '★' : '☆')).join('')}</div>}</div>
        <div className="tc"><b style={{ fontSize: scored ? 34 : 16, lineHeight: 1 }}>{scored ? last.score : '측정 안 됨'}</b><div style={{ fontSize: 12, fontWeight: 700 }}>종합 점수</div></div>
      </div>
      <div className="row">{[['코드 정확도', scored ? `${last.chordAcc}%` : '측정 안 됨'], ['박자 정확도', scored ? `${last.beatAcc}%` : '측정 안 됨'], ['연주 템포', `${last.tempo}%`]].map(([k, v]) => <div key={k} className="card stat" style={{ padding: 12 }}><small>{k}</small><b style={{ fontSize: v === '측정 안 됨' ? 13 : 22 }}>{v}</b></div>)}</div>
      <div className="card col" style={{ gap: 8 }}><b style={{ fontSize: 14 }}>구간별 결과</b><div className="row">{last.secs.map((x) => <div key={x.name} className={`bar ${SEC[x.state][1]}`} style={{ flex: 1, height: 56 }}><b style={{ fontSize: 14 }}>{x.name}</b><small>{SEC[x.state][0]}</small></div>)}</div></div>
      {tr.length > 0 && <div className="card col" style={{ gap: 8 }}><b style={{ fontSize: 14 }}>코드 전환</b>{tr.map(([k, v]) => <div key={k} className="row" style={{ gap: 10 }}><b style={{ fontSize: 14, width: 64 }}>{k}</b><div className="sp-meter"><i style={{ width: `${pct(v.ok, v.n)}%`, background: v.ok / v.n >= 0.75 ? 'var(--ok)' : 'var(--o)' }} /></div><b style={{ fontSize: 12, color: v.ok / v.n >= 0.75 ? 'var(--ok)' : 'var(--od)' }}>{v.ok}/{v.n}</b></div>)}</div>}
      {weak && <div className="card soft row" style={{ gap: 10 }}><Piki name="hi" size={40} still /><div><b style={{ fontSize: 13 }}>{weak[0].replace(' → ', '에서 ')}로 바꿀 때 조금 늦었어요. 전환 연습을 한 번 더 해볼까요?</b><button className="cap" style={{ display: 'block', marginTop: 6, fontSize: 13 }} onClick={practice}>전환 연습하러 가기 ›</button></div></div>}
      {last.challengeFirst && (
        <div className="card row between fadeup" style={{ background: 'var(--okbg)', boxShadow: 'none', padding: '12px 16px' }}>
          <div><b style={{ fontSize: 14, color: 'var(--ok)' }}>✓ 친구와 같은 곡 연습 완료!</b><div className="sub" style={{ fontSize: 12 }}>친구 3명 중 2명도 끝냈어요</div></div>
          <button className="pill w" style={{ color: 'var(--ok)' }} onClick={() => go('my')}>친구들 보기</button>
        </div>
      )}
      <div className="grow" style={{ minHeight: 0 }} />
      <div className="two"><button className="btn soft" onClick={() => go('songplay', { key: Date.now(), back })}>다시 연주</button><button className="btn" onClick={() => go(back)}>완료</button></div>
    </div>
  );
}
