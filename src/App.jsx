import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ear } from './guitarEar.js';
import { GuitarInputStatus } from './GuitarInputStatus.jsx';
import { content, loadAtStartup, save, resetAll, KEEP_ON_RESET, today, addDays, dayDiff, attendedOn, lastAttendance, streak, mood, moodGauge, homeLine, totalMinutes, weekStart, daysToSunday, challengeDone, lessonsFor, courseDone, mic, threshold, sfx, logEvent, getLog, clearLog, setPid, keepAwake } from './lib.js';
import { Piki, TabBar, Modal, Sparkles, Confetti, imgSrc } from './ui.jsx';
import Lesson from './Lesson.jsx';
import { Song, Report } from './Song.jsx';
import { SongPlay, SongReport } from './SongPlay.jsx';
import guitarOn from './img/guitar-on.svg';
import guitarOff from './img/guitar-off.svg';
import courseClose from './img/course-close.svg';
import courseCheck from './img/course-check.svg';
import courseChevron from './img/course-chevron.svg';
import { useMicrophone } from './useMicrophone.js';
import PracticeSetup from './PracticeSetup.jsx';
import { buildEvaluationExport, copyEvaluationText, downloadEvaluation, currentEvaluationBundle, LOG_LIMIT } from './evaluationExport.js';
import { getLogStorageMode, remapResumeVariant } from './lib.js';
import { MicrophoneRecovery } from './MicrophoneRecovery.jsx';
import { useBeforeUnload } from './useBeforeUnload.js';

const TABS = ['home', 'learn', 'practice', 'my'];

// 폰 홈 화면 흉내 (W1 · W2). 웹앱은 진짜 위젯을 만들 수 없어서 앱의 첫 화면으로 보여 준다
const APPS = ['#F7C6C6', '#BFD9F2', '#CDE8C5', '#F6E3A8', '#D9C9F0', '#F3C9A5', '#BEE3E0'];
// 평가용 알림(피그마 N1 배너 5단계 · N2 홈 화면 위 · E1): 진행자가 패널에서 예약하면 폰 홈 화면 위에 배너가 내려온다.
// 웹앱이라 진짜 OS 푸시가 아니라 앱 안에서 흉내 낸 것이다. 누르면 위젯과 같이 앱이 열린다.
let notifyRequest = null; // { due: 뜰 시각(ms) }
function Phone({ s, open }) {
  const first = !s.attendances.length;
  const m = mood(s);
  const [note, setNote] = useState(false);
  const shownAt = useRef(0);
  useEffect(() => {
    let timer;
    const arm = () => {
      clearTimeout(timer); setNote(false);
      if (!notifyRequest) return;
      const kind = notifyRequest.kind;
      timer = setTimeout(() => { notifyRequest = null; shownAt.current = Date.now(); setNote(kind); sfx.alert(); logEvent('notify_shown', { mood: m }); }, Math.max(0, notifyRequest.due - Date.now()));
    };
    arm(); window.addEventListener('dinga-notify', arm);
    return () => { clearTimeout(timer); notifyRequest = null; window.removeEventListener('dinga-notify', arm); };
  }, []);
  const last = lastAttendance(s);
  const diff = last ? Math.max(0, dayDiff(last.date, today(s))) : 0;
  const line = first ? content.widgetLines.first : content.widgetLines[m].replace('{n}', diff);
  const sub = first ? '기타 한 번 튕겨볼까요?' : m === 'happy' ? `연속 ${streak(s)}일째` : `${diff}일째 못 만났어요`;
  return (
    <div className="phone">
      <div className="statusbar"><b>9:41</b><b>●●● ▮</b></div>
      {note && <button className="notice" onClick={() => { logEvent('notify_open', { seconds: Math.round((Date.now() - shownAt.current) / 100) / 10 }); open(note === 'friend' ? 'friend' : 'notification'); }}>
        <img src={imgSrc('appicon')} alt="" /><span><small>딩가 · 지금</small><b>{note === 'friend' ? '민지가 첫 곡을 끝냈어요' : line}</b><small>{note === 'friend' ? '4명 중 2명이 끝냈어요' : content.notifyLines[first ? 'first' : m].replace('{n}', diff).replace('{streak}', streak(s))}</small></span><Piki name={note === 'friend' ? 'hi' : first ? 'main' : m} size={44} still />
      </button>}
      <button className="widget" onClick={() => open('widget')} aria-label="딩가 위젯">
        <span className="wimg"><Piki name={first ? 'main' : m} size={m === 'melted' && !first ? 62 : 108} still /></span>
        <span className="wtext"><b>{line}</b><small>{sub}</small><span className="gauge">{[0, 1, 2, 3].map((i) => <i key={i} className={i < moodGauge[m] ? 'on' : ''} />)}</span></span>
      </button>
      <div className="wlabel">딩가</div>
      <div className="apps">
        <button onClick={() => open('icon')} aria-label="딩가 앱"><img src={imgSrc('appicon')} alt="" /><small>딩가</small></button>
        {APPS.map((c, i) => <div key={i}><i style={{ background: c }} /><small>앱</small></div>)}
      </div>
      <div className="grow" />
      <div className="dock">{APPS.slice(2, 6).map((c) => <i key={c} style={{ background: c }} />)}</div>
    </div>
  );
}

// 이번 주 같은 곡 챌린지 카드 (C1 · C3). 친구와 마감은 샘플이다
function Challenge({ s, go, toast }) {
  const done = challengeDone(s);
  const people = [{ name: '나', img: 'main', done }, ...content.friendSamples.map((f) => ({ name: f.name, img: f.img, done: f.practicedToday }))];
  const n = people.filter((p) => p.done).length;
  return (
    <div className="card challenge">
      <div className="row between"><span className="cap">친구와 같은 곡 연습</span><span className="pill w" style={{ color: 'var(--od)' }}>코스 1 곡</span></div>
      <h2 style={{ fontSize: 18 }}>{content.challenge.title}</h2>
      <div className="people">
        {people.map((p) => (
          <div key={p.name}>
            <span className={`avatar${p.done ? ' done' : ''}`} style={{ width: 52, height: 52 }}><Piki name={p.img} size={38} still /></span>
            <b>{p.name}</b>
            {p.done ? <small className="okc">✓ 완료</small> : p.name === '나' ? <small>아직</small> : <button className="pill" style={{ background: 'var(--sy)', color: 'var(--od)', padding: '4px 8px', fontSize: 11 }} onClick={() => toast('샘플 화면이라 실제 알림은 가지 않아요')}>콕 찌르기</button>}
          </div>
        ))}
      </div>
      <div className="col" style={{ gap: 6 }}><b style={{ fontSize: 12 }}>{people.length}명 중 {n}명 완료</b><div className="gauge" style={{ gap: 4 }}>{people.map((p, i) => <i key={p.name} className={i < n ? 'on' : ''} style={{ height: 8 }} />)}</div></div>
      <button className={`btn${done ? ' soft' : ''}`} style={{ minHeight: 52 }} onClick={() => go('songplay', { key: Date.now(), back: 'my' })}>{done ? '한 번 더 연주하기' : '곡 연습하러 가기'}</button>
    </div>
  );
}

function Home({ s, go }) {
  const m = mood(s);
  const first = !s.attendances.length;
  const attended = !!attendedOn(s, today(s));
  const start = () => {
    if (!attended) return go('attend');
    if (s.resume) return go('lesson', { ...s.resume, key: Date.now() });
    return go('learn');
  };
  return (
    <div className="screen center">
      <span className="pill streak">{s.panel.variant === 'idea' ? <Guitar on={streak(s) > 0} /> : <i />}연속 {streak(s)}일</span>
      <div className="bubble fadeup" key={homeLine(s)}>{homeLine(s)}</div>
      <div className="stage"><Piki name={first ? 'main' : m} size={m === 'melted' && !first ? 150 : 300} /></div>
      <div className="gauge w100" aria-label={`기분 ${content.moodNames[m]}`}>{[0, 1, 2, 3].map((i) => <i key={i} className={i < moodGauge[m] ? 'on' : ''} />)}</div>
      {s.panel.variant === 'idea'
        ? <button className="btn" disabled={attended} onClick={start}>{attended ? '출석완료' : '출석하기'}</button>
        : <button className="btn" onClick={start}>{attended ? '이어서 연습하기' : '오늘 연습 시작'}</button>}
      {s.panel.variant === 'idea' && attended && (
        <button className="cap" style={{ minHeight: 44, fontSize: 14 }} onClick={start}>이어서 연습하기 ›</button>
      )}
      <button className="textbtn" onClick={() => go('setup')}>연습 환경 확인</button>
    </div>
  );
}

function Attend({ s, update, go, paused = false }) {
  const pauseRef = useRef(paused); pauseRef.current = paused;
  const microphone = useMicrophone();
  const { micOn, skipMic, inputLost } = microphone;
  const [phase, setPhase] = useState('ask'); // ask | listen | fail | denied | done
  const [acc, setAcc] = useState(0); // 소리가 난 시간(초)
  const [round, setRound] = useState(0);
  const retryInput=()=>{setAcc(0);setRound(r=>r+1);setPhase('listen');microphone.retryMic();};
  const finished = useRef(false);
  const finish = useCallback((method) => {
    if (finished.current) return;
    finished.current = true;
    skipMic();
    update((d) => { const t = today(d); if (!attendedOn(d, t)) d.attendances.push({ date: t, method }); });
    logEvent('attend', { method });
    setPhase('done'); sfx.done();
  }, [update, skipMic]);
  useEffect(() => {
    if (phase !== 'ask' || micOn === null) return;
    if (!micOn) logEvent('mic_denied', { where: 'attend' });
    setPhase(micOn ? 'listen' : 'denied');
  }, [micOn, phase]);
  useEffect(() => {
    if (phase !== 'listen' || inputLost || !micOn) return undefined;
    let raf = 0; let last = performance.now(); let sum = 0; let observedMs = 0;
    const loop = (now) => {
      const delta = now - last; last = now;
      if (pauseRef.current || document.hidden || delta > 250 || mic.state !== 'on') { raf = requestAnimationFrame(loop); return; }
      if (['loading','failed','unsupported'].includes(ear.status())) {raf=requestAnimationFrame(loop);return;}
      observedMs += delta;
      const dt = delta / 1000;
      if (ear.hearing(null,350)) { sum += dt; setAcc(sum); }
      if (sum >= 2) { finish('sound'); return; }
      if (observedMs > 10000) { logEvent('attend_fail', { heard: Number(sum.toFixed(1)) }); setPhase('fail'); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, round, inputLost, micOn]);
  useEffect(() => { if (inputLost) setAcc(0); }, [inputLost]);
  useEffect(() => {
    if (phase !== 'done' || paused) return undefined;
    const id = setTimeout(() => (s.resume ? go('lesson', { ...s.resume, key: Date.now() }) : go('learn')), 2000 / s.panel.speed);
    return () => clearTimeout(id);
  }, [phase, paused]);

  if (phase === 'done') {
    return (
      <div className="screen center">
        <Confetti />
        <div className="grow rel w100"><Sparkles /><div className="avatar pop" style={{ width: 290, height: 290 }}><Piki name="happy" size={230} /></div></div>
        <h1 style={{ fontSize: 30, color: 'var(--ot)' }}>출석 완료!</h1>
        <span className="pill streak">{s.panel.variant === 'idea' ? <Guitar on={streak(s) > 0} /> : <i />}연속 {streak(s)}일</span>
        <div className="sub" style={{ marginBottom: 48 }}>곧 레슨으로 넘어가요</div>
      </div>
    );
  }
  const p = Math.min(1, acc / 2); const R = 58; const C = 2 * Math.PI * R;
  return (
    <div className="screen center">
      <div className="row w100"><button className="iconbtn" aria-label="출석 화면 닫기" onClick={() => go('home')}>✕</button></div>
      <div className="tc">
        <h1>{phase === 'denied' ? '마이크를 쓸 수 없어요' : phase === 'fail' ? '소리가 잘 안 들려요' : '아는 코드를 쳐 주세요!'}</h1>
        <div className="sub" style={{ marginTop: 6 }}>{phase === 'denied' ? '버튼으로 출석할 수 있어요' : phase === 'fail' ? '폰 가까이에서 코드를 한 번 더 연주해 볼까요?' : 'Em·G·C처럼 익숙한 코드면 돼요. 코드 소리가 2초 들리면 출석이에요.'}</div>
      </div>
      <div className="grow"><Piki name={acc > 0.3 && phase === 'listen' ? 'yay' : 'listen'} size={220} /></div>
      {phase === 'listen' && (<>
        <svg width="132" height="132" viewBox="0 0 132 132" fill="none">
          <circle cx="66" cy="66" r={R} stroke="#FFE7B3" strokeWidth="10" />
          <circle cx="66" cy="66" r={R} stroke="#FF9A3D" strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - p)} transform="rotate(-90 66 66)" />
          <rect x="56" y="40" width="20" height="34" rx="10" fill="#FF9A3D" /><path d="M46 64C46 76 54 84 66 84C78 84 86 76 86 64M66 84V96" stroke="#FF9A3D" strokeWidth="5" strokeLinecap="round" />
        </svg>
        <b style={{ fontSize: 14, color: 'var(--od)' }}>{acc > 0 ? `듣고 있어요 · ${acc.toFixed(1)}초 / 2초` : '듣고 있어요'}</b>
        <button className="btn line" onClick={() => finish('manual')}>마이크 없이 출석하기</button>
      </>)}
      {phase === 'ask' && <><div className="sub">마이크를 준비하고 있어요…</div><button className="btn line" onClick={() => finish('manual')}>마이크 없이 출석하기</button></>}
      {phase === 'fail' && (<>
        <button className="btn" onClick={retryInput}>다시 하기</button>
        <button className="btn line" onClick={() => finish('manual')}>건너뛰기</button>
      </>)}
      {phase === 'denied' && <button className="btn" onClick={() => finish('manual')}>마이크 없이 출석하기</button>}
      {micOn&&['listen','fail'].includes(phase)&&<GuitarInputStatus retry={retryInput}/>}
      <MicrophoneRecovery microphone={microphone} onSkip={() => finish('manual')} onExit={() => go('home')} />
    </div>
  );
}

const Lock = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#857E8C" strokeWidth="2" strokeLinecap="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;
// 아이디어 반영 구성의 학습: 코스 목록 → 코스 상세(레슨 4개 + 곡 연습) → 파트 선택 팝업
function Course({ s, go, params }) {
  const [view, setView] = useState(params && params.course ? 'course' : 'list');
  const [open, setOpen] = useState(null);
  const lessonButtons = useRef({});
  const previousOpen = useRef(null);
  useEffect(() => {
    // The list's Continue button is replaced by course detail when it opens a part dialog.
    if (!open && previousOpen.current) lessonButtons.current[previousOpen.current]?.focus();
    previousOpen.current = open;
  }, [open]);
  const C = content.course; const LS = lessonsFor(s);
  const doneCount = Object.values(s.done).flat().filter(Boolean).length;
  const codesDone = ['em', 'g', 'c'].every((k) => s.done[k].every(Boolean));
  const allDone = courseDone(s);
  const locked = (l) => l.id === 'song' && !codesDone;
  const L = open && LS.find((l) => l.id === open);
  const continueCourse = () => {
    if (allDone) return go('songplay', { back: 'learn', key: Date.now() });
    const resumeLesson = s.resume && LS.find((l) => l.id === s.resume.lesson && !locked(l));
    const nextLesson = resumeLesson || LS.find((l) => !locked(l) && !s.done[l.id].every(Boolean));
    setView('course');
    setOpen(nextLesson ? nextLesson.id : null);
  };
  const top = (
    <div className="top"><Piki name="play" size={view === 'list' ? 72 : 56} still />
      <div style={{ flex: 1 }}>{view === 'course' && <b style={{ display: 'block', fontSize: 16, marginBottom: 4 }}>{C.title}</b>}<div className="row" style={{ gap: 6 }}>{C.chords.map((c) => <span key={c} className="pill w">{c}</span>)}</div></div>
      <span className="pill w" style={{ color: 'var(--od)' }}>{doneCount}/12</span></div>
  );
  if (view === 'list') {
    return (
      <div className="screen">
        <h1>학습</h1>
        <div className="chapter">
          {top}
          <div className="bot col" style={{ gap: 10 }}>
            <div><div className="cap">코스 1 · {allDone ? '완료' : '진행 중'}</div><h2>{C.title}</h2><div className="sub" style={{ fontSize: 13 }}>{C.sub}</div></div>
            <div className="prog12">{LS.map((l) => <div key={l.id}><span>{s.done[l.id].map((v, k) => <i key={k} className={v ? 'on' : ''} />)}</span>{l.id === 'song' ? '완주' : l.chord}</div>)}</div>
            <button className="btn" onClick={continueCourse}>{allDone ? '곡 다시 치기' : '코스 이어하기'}</button>
            {allDone && <button className="cap" style={{ minHeight: 44, fontSize: 14 }} onClick={() => setView('course')}>코스 살펴보기 ›</button>}
          </div>
        </div>
        <b style={{ fontSize: 15 }}>다음 코스</b>
        {C.next.map((n) => <div key={n.title} className="card lesson"><span className="avatar" style={{ width: 44, height: 44 }}><Piki name="zzz" size={34} still /></span><span style={{ flex: 1 }}><b style={{ display: 'block', fontSize: 15 }}>{n.title}</b><span className="sub" style={{ fontSize: 12 }}>{n.sub}</span></span><Lock /></div>)}
      </div>
    );
  }
  return (
    <div className="screen">
      <div className="row"><button className="iconbtn" aria-label="코스 목록으로" onClick={() => setView('list')}>‹</button><h1 style={{ fontSize: 20 }}>코스 1</h1></div>
      <div className="chapter">{top}</div>
      {LS.map((l, i) => {
        const d = s.done[l.id]; const resume = s.resume && s.resume.lesson === l.id; const lk = locked(l);
        return (<React.Fragment key={l.id}>
          {l.id === 'song' && <div className="divider">코드 3개를 한 번에</div>}
          <button ref={node => { lessonButtons.current[l.id] = node; }} className={`card lesson tap${resume ? ' sel' : ''}${lk ? ' locked' : ''}`} disabled={lk} onClick={() => setOpen(l.id)} style={{ textAlign: 'left' }}>
            <span className={`num${d.every(Boolean) ? ' done' : ''}`}>{d.every(Boolean) ? '✓' : i + 1}</span>
            <span style={{ flex: 1 }}><b style={{ display: 'block', fontSize: 15 }}>{l.weekLabel}</b><span className="sub" style={{ fontSize: 12 }}>{resume ? '이어서 하기' : l.sub}{lk ? <><br />레슨 1~3을 마치면 열려요</> : null}</span></span>
            {lk ? <Lock /> : <span className="pdots">{d.map((v, k) => <i key={k} className={v ? 'on' : ''} />)}</span>}
          </button>
        </React.Fragment>);
      })}
      {allDone && <div className="card soft tc" style={{ fontSize: 13, fontWeight: 700 }}>코스 완료! 곡은 연습 탭 [곡 연습]에서 다시 칠 수 있어요</div>}
      {L && (
        <Modal onClose={() => setOpen(null)} className={`course-parts${L.id === 'song' ? ' course-parts-song' : ''}`}
          decoration={<div className="course-part-mascot" aria-hidden="true"><Piki name={L.id === 'song' ? 'yay' : 'hi'} size={L.id === 'song' ? 80 : 66} still /></div>}>
          <div className="course-part-heading">
            <div className="row between"><h1>{L.weekLabel}</h1><button className="course-part-close" aria-label="레슨 선택 닫기" onClick={() => setOpen(null)}><img src={courseClose} alt="" /></button></div>
            <div className="course-part-chords">{L.id === 'song' && C.chords.map(chord => <span className="pill" key={chord}>{chord}</span>)}<span className="sub">하고 싶은 파트를 골라요</span></div>
          </div>
          {L.parts.map((p, i) => {
            const done = s.done[L.id][i]; const resume = s.resume && s.resume.lesson === L.id && s.resume.part === i;
            return (
              <button key={i} className={`card lesson tap${resume ? ' sel' : ''}`} onClick={() => go('lesson', { lesson: L.id, part: i, step: resume ? s.resume.step : 0, key: Date.now() })}>
                <span className={`num${done ? ' done' : ''}`}>{done ? <img src={courseCheck} alt="완료" /> : i + 1}</span>
                <span className="course-part-copy"><b className="course-part-title">파트 {i + 1} · {L.id !== 'song' && i === 1 ? '코드 잡기' : p.title}</b><span className="sub">{p.sub ? <>{p.sub}<br /></> : null}{resume ? '약 3분 · 이어서 하기' : done ? '완료 · 다시 해볼 수 있어요' : '약 3분'}</span></span>
                <img className="course-part-chevron" src={courseChevron} alt="" />
              </button>
            );
          })}
        </Modal>
      )}
    </div>
  );
}

function Learn({ s, go, params }) {
  const [open, setOpen] = useState(null);
  if (s.panel.variant === 'idea') return <Course s={s} go={go} params={params} />;
  const doneCount = Object.values(s.done).flat().filter(Boolean).length;
  const L = open && content.lessons.find((l) => l.id === open);
  // 아이디어 반영: 연습 내용을 "이번 주 곡 하나를 일요일까지 완주하기"로 보여 준다. PRD 원본: 챕터 · 레슨
  const week = false;
  const left = 0;
  const name = (l, i) => (week ? l.weekLabel : `레슨 ${i + 1} · ${l.title}`) // 번호는 왼쪽 동그라미에 이미 있다;
  return (
    <div className="screen">
      <h1>학습</h1>
      <div className="chapter">
        <div className="top"><Piki name="hi" size={56} still /><div className="row" style={{ flex: 1, gap: 6 }}>{['Em', 'G', 'C'].map((c) => <span key={c} className="pill w">{c}</span>)}</div><span className="pill w" style={{ color: 'var(--od)' }}>{doneCount}/12</span></div>
        <div className="bot"><div className="cap">{week ? '이번 주 곡' : '챕터 1'}</div><h2>{week ? `${content.songChart.title} · 일요일까지 ${left === 0 ? '오늘 마감' : `D-${left}`}` : '필수 코드: Em, G, C'}</h2></div>
      </div>
      {content.lessons.map((l, i) => {
        const d = s.done[l.id]; const resume = s.resume && s.resume.lesson === l.id;
        return (
          <button key={l.id} className={`card lesson tap${resume ? ' sel' : ''}`} onClick={() => setOpen(l.id)} style={{ textAlign: 'left' }}>
            <span className={`num${d.every(Boolean) ? ' done' : ''}`}>{d.every(Boolean) ? '✓' : i + 1}</span>
            <span style={{ flex: 1 }}><b style={{ display: 'block', fontSize: 15 }}>{name(l, i)}</b><span className="sub" style={{ fontSize: 12 }}>{resume ? '이어서 하기' : l.sub}</span></span>
            <span className="pdots">{d.map((v, k) => <i key={k} className={v ? 'on' : ''} />)}</span>
          </button>
        );
      })}
      <div className="card tc" style={{ background: 'var(--none)', boxShadow: 'none', color: 'var(--gray)', fontWeight: 800, fontSize: 14 }}>{week ? '다음 주 곡 · 월요일에 열려요' : '챕터 2 · 곧 열려요'}</div>
      {L && (
        <Modal onClose={() => setOpen(null)}>
          <div className="row between"><h1 style={{ fontSize: 20 }}>{name(L, content.lessons.indexOf(L))}</h1><button className="iconbtn" aria-label="레슨 선택 닫기" onClick={() => setOpen(null)}>✕</button></div>
          <div className="sub" style={{ fontSize: 13 }}>하고 싶은 파트를 골라요</div>
          {L.parts.map((p, i) => {
            const done = s.done[L.id][i]; const resume = s.resume && s.resume.lesson === L.id && s.resume.part === i;
            return (
              <button key={i} className={`card lesson tap${resume ? ' sel' : ''}`} style={{ textAlign: 'left', background: resume ? 'var(--sb)' : '#fff' }} onClick={() => go('lesson', { lesson: L.id, part: i, step: resume ? s.resume.step : 0, key: Date.now() })}>
                <span className={`num${done ? ' done' : ''}`}>{done ? '✓' : i + 1}</span>
                <span style={{ flex: 1 }}><b style={{ display: 'block', fontSize: 15 }}>파트 {i + 1} · {p.title}</b><span className="sub" style={{ fontSize: 12 }}>{resume ? '약 3분 · 이어서 하기' : done ? '완료 · 다시 해볼 수 있어요' : '약 3분'}</span></span>
                <b style={{ color: 'var(--gray)', fontSize: 20 }}>›</b>
              </button>
            );
          })}
        </Modal>
      )}
    </div>
  );
}

function Practice({ s, go, update }) {
  const reviews = content.lessons.filter((l) => l.id !== 'song' && s.done[l.id][2]);
  const idea = s.panel.variant === 'idea'; const tab = idea ? s.ptab : 'all';
  const show = (k) => tab === 'all' || tab === k;
  const Row = ({ title, sub, onClick }) => (
    <div className="card row between" style={{ padding: '12px 16px' }}>
      <div><b style={{ fontSize: 16 }}>{title}</b><div className="sub" style={{ fontSize: 12 }}>{sub}</div></div>
      <button className="btn sm soft" onClick={onClick}>연습하기</button>
    </div>
  );
  return (
    <div className="screen">
      <h1>연습</h1>
      {idea && <div className="seg">{[['review', '복습'], ['transition', '코드 전환'], ['song', '곡 연습']].map(([k, v]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => update((d) => { d.ptab = k; })}>{v}</button>)}</div>}
      {show('review') && <><div><b style={{ fontSize: 15 }}>복습</b><div className="sub" style={{ fontSize: 12 }}>끝낸 레슨의 소리 내기를 다시 해요</div></div>
      {reviews.length === 0 && (
        <div className="card soft col tc" style={{ alignItems: 'center', gap: 8 }}>
          <b>아직 끝낸 레슨이 없어요</b><div className="sub" style={{ fontSize: 13 }}>레슨을 끝내면 여기서 다시 연습할 수 있어요</div>
          <button className="btn sm soft" onClick={() => go('learn')}>학습으로 가기</button>
        </div>
      )}
      {reviews.map((l) => <Row key={l.id} title={l.title} sub="소리 내기 · 약 3분" onClick={() => go('lesson', { lesson: l.id, part: 2, step: 0, review: true, back: 'practice', key: Date.now() })} />)}</>}
      {show('transition') && <><div><b style={{ fontSize: 15 }}>코드 전환 연습</b><div className="sub" style={{ fontSize: 12 }}>박자에 맞춰 코드를 바꿔요</div></div>
      {[['Em', 'G'], ['G', 'C'], ['Em', 'C']].map((p) => <Row key={p.join()} title={`${p[0]} ↔ ${p[1]}`} sub="8마디 · 약 2분" onClick={() => (idea ? go('song', { pair: p, back: 'practice', key: Date.now() }) : go('lesson', { custom: { title: `${p[0]} ↔ ${p[1]} 전환 연습`, steps: [{ type: 'transition', pair: p }] }, back: 'practice', key: Date.now() }))} />)}</>}
      {tab === 'song' && <>
        <div><b style={{ fontSize: 15 }}>곡 연습</b><div className="sub" style={{ fontSize: 12 }}>끝낸 코스의 곡을 다시 연주해요</div></div>
        {courseDone(s)
          ? <div className="card row between" style={{ padding: '12px 16px' }}><div><b style={{ fontSize: 16 }}>{content.songPractice.title}</b><div className="sub" style={{ fontSize: 12 }}>코스 1{s.songPractice.best ? ` · 최고 ${s.songPractice.best}점` : ''}</div></div><button className="btn sm soft" onClick={() => go('songplay', { key: Date.now(), back: 'practice' })}>연주하기</button></div>
          : <div className="card locked" style={{ padding: '12px 16px' }}><b style={{ fontSize: 16 }}>{content.songPractice.title}</b><div className="sub" style={{ fontSize: 12 }}>코스 1의 완주하기를 마치면 열려요</div></div>}
        {content.course.next.map((n, i) => <div key={n.title} className="card locked" style={{ padding: '12px 16px' }}><b style={{ fontSize: 16 }}>코스 {i + 2} 곡</b><div className="sub" style={{ fontSize: 12 }}>코스 {i + 2}를 마치면 열려요</div></div>)}
      </>}
    </div>
  );
}

// 최근 7일 표시: 연습한 날은 노란 기타, 안 한 날은 부서진 기타
function Guitar({ on }) {
  return <span className={`guitar-icon${on ? '' : ' off'}`} role="img" aria-label={on ? '연습함' : '안 함'}><img src={on ? guitarOn : guitarOff} alt="" /></span>;
}
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const wd = (str) => { const [y, m, d] = str.split('-').map(Number); return WD[new Date(y, m - 1, d).getDay()]; };

function My({ s, go, toast }) {
  const t = today(s);
  const days = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6));
  const mine = Math.floor((s.history[t] || 0) / 60);
  return (
    <div className="screen">
      <div className="row" style={{ gap: 12 }}><div className="avatar" style={{ width: 64, height: 64 }}><Piki name="happy" size={52} still /></div><div><h1 style={{ fontSize: 22 }}>내 기록</h1><div className="sub" style={{ fontSize: 13 }}>연속 {streak(s)}일</div></div></div>
      <div className="row"><div className="card stat"><small>출석</small><b>{s.attendances.length}일</b></div><div className="card stat"><small>연습 시간</small><b>{totalMinutes(s)}분</b></div></div>
      <div className="col" style={{ gap: 8 }}><b style={{ fontSize: 13 }}>최근 7일</b><div className="week">{days.map((d) => <div key={d}><Guitar on={(s.history[d] || 0) >= 60} />{wd(d)}</div>)}</div></div>
      <button className="card row between tap" onClick={() => go('history')}><b style={{ fontSize: 15 }}>기록 보기</b><b style={{ color: 'var(--gray)', fontSize: 18 }}>›</b></button>
      {s.panel.variant === 'idea' ? <Challenge s={s} go={go} toast={toast} /> : (<>
      <div><b style={{ fontSize: 15 }}>친구와 같은 곡 연습</b><div className="sub" style={{ fontSize: 12 }}>샘플 데이터예요</div></div>
      {[{ name: '나', practicedToday: mine > 0, minutes: mine, img: 'main' }, ...content.friendSamples].map((f) => (
        <div key={f.name} className="card row" style={{ padding: '10px 12px' }}>
          <div className="avatar" style={{ width: 40, height: 40 }}><Piki name={f.img} size={32} still /></div>
          <div style={{ flex: 1 }}><b style={{ fontSize: 14 }}>{f.name}</b><div className="sub" style={{ fontSize: 12 }}>{f.practicedToday ? `오늘 연습했어요 · ${f.minutes}분` : '오늘은 아직이에요'}</div></div>
          {f.practicedToday ? <span className="pill ok">✓</span> : f.name !== '나' ? <button className="btn sm soft" onClick={() => toast('샘플 화면이라 실제 알림은 가지 않아요')}>콕 찌르기</button> : null}
        </div>
      ))}
      </>)}
    </div>
  );
}

function History({ s, go }) {
  const t = today(s);
  const days = Array.from({ length: 7 }, (_, i) => addDays(t, -i));
  return (
    <div className="screen">
      <div className="row"><button className="iconbtn" aria-label="MY로 돌아가기" onClick={() => go('my')}>‹</button><h1 style={{ fontSize: 22 }}>기록</h1></div>
      <b style={{ fontSize: 13, color: 'var(--gray)' }}>최근 7일</b>
      {days.map((d) => {
        const a = attendedOn(s, d); const min = Math.floor((s.history[d] || 0) / 60);
        const active = !!a || min > 0;
        return (
          <div key={d} className="card row" style={active ? { padding: '14px 16px' } : { padding: '14px 16px', background: 'var(--none)', boxShadow: 'none' }}>
            {s.panel.variant === 'idea' ? <span className="week" style={{ display: 'block' }}><Guitar on={min > 0} /></span> : <i style={{ width: 12, height: 12, borderRadius: 6, background: active ? 'var(--o)' : '#CFC6B8' }} />}
            <b style={{ flex: 1, fontSize: 15, color: active ? 'var(--ink)' : 'var(--gray)' }}>{d.slice(5).replace('-', '/')} {wd(d)}</b>
            {active ? <>{a ? <span className={`pill ${a.method === 'sound' ? 'ok' : 'warn'}`}>{a.method === 'sound' ? '소리' : '수동'} 출석</span> : <span className="sub" style={{ fontSize: 12 }}>출석 안 함</span>}<b style={{ fontSize: 14 }}>{min}분</b></> : <span className="sub" style={{ fontSize: 13 }}>쉬었어요</span>}
          </div>
        );
      })}
    </div>
  );
}

// 평가 진행용 숨은 패널. 화면 오른쪽 위를 세 번 누르면 열린다
function Panel({ s, update, setS, close, go, editingLocked = false }) {
  const set = (k, v) => {
    if (editingLocked && ['pid', 'variant'].includes(k) && v !== s.panel[k]) return;
    update((d) => {
      if (k === 'variant' && d.panel.variant !== v) d.resume = remapResumeVariant(d.resume, d.panel.variant, v);
      d.panel[k] = v;
    });
  };
  const [logText, setLogText] = useState(null);
  const [exportScope, setExportScope] = useState('participant');
  const [notice, setNotice] = useState(null);
  const operation = useRef(0);
  useEffect(() => () => { operation.current += 1; }, []);
  useEffect(() => { operation.current += 1; setLogText(null); setNotice(null); }, [s.panel.pid]);
  const report = (scope) => {
    const events = getLog();
    let clipboard = false;
    try { clipboard = !!navigator.clipboard?.writeText; } catch {}
    return buildEvaluationExport(events, {
      scope, pid: s.panel.pid, settings: s.panel,
      logStorage: getLogStorageMode(),
      bundle: currentEvaluationBundle(),
      environment: { userAgent: navigator.userAgent, secureContext: window.isSecureContext,
        mediaDevices: !!navigator.mediaDevices?.getUserMedia, clipboard },
    });
  };
  const showLog = async () => {
    const current = ++operation.current;
    const txt = JSON.stringify(report('all').events, null, 1);
    setLogText(txt); setNotice('복사 결과를 확인하고 있어요…');
    let result;
    try { result = await copyEvaluationText(txt, navigator.clipboard); } catch { result = { ok: false }; }
    if (operation.current !== current) return;
    setNotice(result.ok ? '전체 행동 기록을 복사했어요.' : '자동 복사를 완료하지 못했어요. 아래 기록을 눌러 직접 복사하거나 JSON 저장을 이용해 주세요.');
  };
  const saveLog = () => {
    operation.current += 1;
    const data = report(exportScope);
    setLogText(JSON.stringify(data, null, 2));
    try {
      downloadEvaluation(data);
      setNotice(`${data.summary.eventCount}건의 파일 저장을 요청했어요. 브라우저의 다운로드를 확인해 주세요. 아래 내용도 직접 복사할 수 있어요.`);
    } catch {
      setLogText(JSON.stringify(data, null, 2));
      setNotice('파일 저장을 시작하지 못했어요. 아래 내용을 선택해 직접 복사해 주세요.');
    }
  };
  const fill = (ago, n = 1) => update((d) => { const t = today(d); d.attendances = Array.from({ length: n }, (_, i) => ({ date: addDays(t, -ago - i), method: 'sound' })); });
  return (
    <Modal onClose={close}>
      <div><h1 style={{ fontSize: 18 }}>평가 패널</h1><div className="sub" style={{ fontSize: 12 }}>참가자에게는 보여 주지 않아요</div></div>
      <div className="panel-row"><span>참가자 번호</span><input disabled={editingLocked} aria-describedby={editingLocked ? 'evaluation-locked-settings' : undefined} value={s.panel.pid} onChange={(e) => set('pid', e.target.value)} placeholder="예: P1" /></div>
      <div className="panel-row"><span>상태 초기화</span><button onClick={() => { logEvent('reset'); mic.stop(); const n = resetAll(); KEEP_ON_RESET.forEach((k) => { n.panel[k] = s.panel[k]; }); setS(n); close(); go(n.panel.variant === 'idea' ? 'phone' : 'home'); }}>지우기</button></div>
      <div className="panel-row"><span>새로고침하면 처음부터</span><select aria-label="새로고침하면 처음부터" value={s.panel.fresh ? 'on' : 'off'} onChange={(e) => set('fresh', e.target.value === 'on')}><option value="off">끔 (기록 유지)</option><option value="on">켬 (매번 초기화)</option></select></div>
      <div className="panel-row"><span>화면 구성</span><select disabled={editingLocked} aria-describedby={editingLocked ? 'evaluation-locked-settings' : undefined} value={s.panel.variant} onChange={(e) => set('variant', e.target.value)}><option value="idea">아이디어 반영</option><option value="prd">PRD 원본</option></select></div>
      {editingLocked ? <div id="evaluation-locked-settings" className="sub" style={{ fontSize: 11 }}>참가자 번호·화면 구성은 연습 화면을 나간 뒤 바꿀 수 있어요.</div> : <><div className="sub" style={{ fontSize: 11 }}>구성을 바꾸면 이어하기를 대응 단계로 옮겨요. 곡 구성이 다르면 같은 파트 처음부터 시작해요.</div><div className="sub" style={{ fontSize: 11 }}>참가자 번호만 바꿔도 기존 진도는 남아요. 새 참가자는 먼저 상태 초기화를 해 주세요.</div></>}
      <div className="panel-row"><span>폰 홈 화면 (위젯)</span><button onClick={() => { close(); go('phone'); }}>보기</button></div>
      <div className="panel-row"><span>딩가 알림 (폰 홈 화면에 뜸)</span><select aria-label="딩가 알림 예약" value="" onChange={(e) => { const v = e.target.value; if (v === '') return; const friend = v.startsWith('friend-'); const delay = Number(v.replace('friend-', '')); notifyRequest = v === 'cancel' ? null : { kind: friend ? 'friend' : 'mood', due: Date.now() + delay * 1000 }; logEvent(v === 'cancel' ? 'notify_cancel' : 'notify_armed', v === 'cancel' ? {} : { delay }); close(); go('phone'); setTimeout(() => window.dispatchEvent(new Event('dinga-notify')), 0); }}><option value="">고르기</option><option value="0">지금</option><option value="60">1분 뒤</option><option value="180">3분 뒤</option><option value="friend-0">친구 완료 · 지금</option><option value="friend-60">친구 완료 · 1분 뒤</option><option value="cancel">예약 취소</option></select></div>
      <div className="panel-row"><span>자세 알림</span><span><select value={s.panel.alert} onChange={(e) => set('alert', e.target.value)}><option value="auto">정해진 시점</option><option value="real">실제 판정</option><option value="manual">진행자가 띄움</option><option value="off">끔</option></select></span></div>
      <div className="panel-row"><span>자세 알림 한 번 띄우기</span><button onClick={() => { window.dispatchEvent(new Event('dinga-alert')); close(); }}>지금 띄우기</button></div>
      <div className="panel-row"><span>전체 행동 기록 ({getLog().length}건)</span><span><button onClick={showLog}>복사</button> <button onClick={() => { operation.current += 1; clearLog(); setLogText(null); setNotice(null); set('pid', s.panel.pid); }}>비우기</button></span></div>
      <div className="panel-row evaluation-file-row"><label htmlFor="evaluation-scope">파일 저장 범위</label><select id="evaluation-scope" aria-label="파일 저장 범위" value={exportScope} onChange={(e) => { operation.current += 1; setExportScope(e.target.value); setLogText(null); setNotice(null); }}><option value="participant">현재 참가자 {s.panel.pid || '(미지정)'}</option><option value="all">전체 참가자</option></select><button onClick={saveLog}>JSON 저장</button></div>
      <div className="sub" style={{ fontSize: 11 }}>파일에는 선택한 행동 기록·판정 결과와 브라우저 정보·현재 설정을 담아요. 영상·원음·입력 보정 수치는 포함하지 않아요.</div>
      {getLog().length >= LOG_LIMIT && <div className="sub" role="status">최근 {LOG_LIMIT}건까지 보관해 이전 기록이 일부 없을 수 있어요. 참가자마다 파일을 회수해 주세요.</div>}
      {getLogStorageMode() === 'memory' && <div className="sub" role="status">기록이 이 창에만 남아 있어요. 창을 닫기 전에 복사하거나 JSON 파일로 저장해 주세요.</div>}
      {getLogStorageMode() === 'unavailable' && <div className="sub" role="status">저장된 행동 기록을 읽을 수 없어요. 아래 기록은 비어 있거나 일부만 있을 수 있어요.</div>}
      {notice && <div className="sub" role="status">{notice}</div>}
      {logText !== null && <textarea className="logbox" aria-label="내보낼 행동 기록" readOnly value={logText} onFocus={(e) => e.target.select()} />}
      <div className="panel-row"><span>마지막 출석</span><select defaultValue="" onChange={(e) => { const v = e.target.value; if (v === 'streak') fill(0, 3); else if (v !== '') fill(Number(v)); }}><option value="">고르기</option><option value="streak">오늘까지 3일 연속</option><option value="1">1일 전</option><option value="2">2일 전</option><option value="4">4일 전</option><option value="7">7일 전</option></select></div>
      <div className="panel-row"><span>파트 3 카메라 테스트</span><button onClick={() => {
        mic.stop();
        update((d) => { d.panel.variant = 'idea'; d.panel.judge = 'allok'; d.panel.alert = 'auto'; d.panel.speed = 1; });
        close();
        go('lesson', { lesson: 'song', part: 2, step: 0, key: Date.now() });
      }}>파트 3 카메라 테스트 열기</button></div>
      <div className="sub" style={{ fontSize: 11 }}>아이디어 반영 · 모두 성공 · 정해진 시점 · ×1로 열어요. 완주하면 실제 테스트 기록이 남아요.</div>
      <div className="panel-row"><span>레슨 1~3 완료 처리</span><button onClick={() => update((d) => { ['em', 'g', 'c'].forEach((k) => { d.done[k] = [true, true, true]; }); })}>적용</button></div>
      <div className="panel-row"><span>코스 1 전부 완료 처리 (곡 연습 열기)</span><button onClick={() => update((d) => { ['em', 'g', 'c', 'song'].forEach((k) => { d.done[k] = [true, true, true]; }); d.resume = null; })}>적용</button></div>
      <div className="panel-row"><span>단계 건너뛰기</span><button onClick={() => { window.dispatchEvent(new Event('dinga-skip')); close(); }}>다음</button></div>
      <div className="panel-row"><span>표정 고정</span><select value={s.panel.mood} onChange={(e) => set('mood', e.target.value)}><option value="auto">자동</option>{Object.entries(content.moodNames).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div className="panel-row"><span>속도</span><select value={s.panel.speed} onChange={(e) => set('speed', Number(e.target.value))}><option value="1">×1</option><option value="3">×3</option></select></div>
      <div className="sub" style={{ fontSize: 11 }}>곡·전환 연습 중 속도를 바꾸면 완료한 마디는 유지하고 현재 마디부터 다시 시작해요.</div>
      <div className="panel-row"><span>곡 판정</span><select value={s.panel.judge} onChange={(e) => set('judge', e.target.value)}><option value="mic">마이크 소리</option><option value="random">랜덤</option><option value="allok">모두 성공</option><option value="hard">전환 어려움</option></select></div>
      <div className="panel-row"><span>자세 촬영 결과</span><select value={s.panel.posture} onChange={(e) => set('posture', e.target.value)}><option value="real">사진으로 실제 판정</option><option value="sim">시뮬레이션</option><option value="self">참가자가 직접 선택</option></select></div>
      <div className="sub" style={{ fontSize: 11 }}>오늘 {today(s)} · 소리 기준값 {threshold()} · 코드 인식기 {ear.status()} · {ear.chord()||'코드 없음'}</div>
      <a href="/licenses/" target="_blank" rel="noreferrer">오픈소스 라이선스·해당 버전 소스</a>
      <button className="btn" onClick={close}>닫기</button>
    </Modal>
  );
}

// 앱을 열 때 한 번 보이는 첫 화면
function Splash({ leaving }) {
  return (
    <div className={`splash${leaving ? ' out' : ''}`}>
      <div className="grow"><Piki name="main" size={210} /></div>
      <img className="logo" src={imgSrc('logo')} alt="딩가" />
      <div className="tag">하루 한 번, 기타 튕기기</div>
      <div className="grow" />
    </div>
  );
}

export default function App() {
  const [s, setS] = useState(loadAtStartup);
  // 아이디어 반영: 폰 홈 화면(위젯)에서 시작하고, 위젯이나 아이콘을 누르면 스플래시 → 홈
  // PRD 원본: 앱을 열면 바로 스플래시 → 홈 (탭을 닫기 전까지 한 번)
  const startPhone = s.panel.variant === 'idea';
  const [splash, setSplash] = useState(() => { if (startPhone) return 'done'; try { return sessionStorage.getItem('dinga-splash') ? 'done' : 'show'; } catch (e) { return 'show'; } });
  useEffect(() => {
    if (splash !== 'show') return undefined;
    const a = setTimeout(() => setSplash('leave'), 1500);
    const b = setTimeout(() => { setSplash('done'); try { sessionStorage.setItem('dinga-splash', '1'); } catch (e) {} }, 1850);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  const [nav, setNav] = useState({ route: startPhone ? 'phone' : 'home', params: {} });
  const [panel, setPanel] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);
  const [storageError, setStorageError] = useState(false);
  useBeforeUnload(storageError);
  const appRef = useRef(null);
  const update = useCallback((fn) => setS((prev) => { const d = JSON.parse(JSON.stringify(prev)); fn(d); return d; }), []);
  useEffect(() => { setStorageError(!save(s)); }, [s]);
  const go = useCallback((route, params = {}) => { logEvent('screen', { route, lesson: params.lesson || (params.custom ? 'transition' : undefined), part: params.part }); setNav({ route, params }); }, []);
  useEffect(() => { setPid(s.panel.pid); }, [s.panel.pid]);
  useEffect(() => {
    const practicing = ['attend', 'lesson', 'song', 'songplay'].includes(nav.route);
    keepAwake(practicing);
    if (!practicing && nav.route !== 'setup') mic.stop();
  }, [nav.route]);
  useEffect(() => { logEvent('open'); }, []);
  const toast = (m) => { setToastMsg(m); setTimeout(() => setToastMsg(null), 3000); };
  // 오른쪽 위 세 번 누르기
  useEffect(() => {
    let taps = [];
    const h = (e) => {
      const r = appRef.current.getBoundingClientRect();
      if (e.clientX > r.right - 64 && e.clientY < r.top + 64) { const now = Date.now(); taps = [...taps.filter((t) => now - t < 1200), now]; if (taps.length >= 3) { taps = []; setPanel(true); } }
    };
    const tap = (e) => { mic.prime(); if (e.target.closest && e.target.closest('.btn, .tabbar button, .iconbtn')) sfx.tap(); };
    window.addEventListener('pointerdown', h, true); window.addEventListener('pointerdown', tap, true);
    return () => { window.removeEventListener('pointerdown', h, true); window.removeEventListener('pointerdown', tap, true); };
  }, []);
  const openApp = (from) => { logEvent('widget_open', { from, mood: mood(s) }); setSplash('show'); go(from === 'friend' ? 'my' : 'home'); setTimeout(() => setSplash('leave'), 1500); setTimeout(() => setSplash('done'), 1850); };
  const { route, params } = nav;
  const p = { s, update, go, paused: panel };
  return (
    <div className="app" ref={appRef}>
      {storageError && <div className="storage-notice" role="alert">이 브라우저에 기록을 저장할 수 없어요. 창을 닫기 전에 평가 패널에서 행동 기록을 복사해 주세요. <button style={{ textDecoration: 'underline', minHeight: 44 }} onClick={() => setStorageError(!save(s))}>저장 다시 시도</button></div>}
      {route === 'phone' && <Phone s={s} open={openApp} />}
      {route === 'home' && <Home {...p} />}
      {route === 'attend' && <Attend {...p} />}
      {route === 'setup' && <PracticeSetup go={go} paused={panel} />}
      {route === 'learn' && <Learn {...p} params={params} />}
      {route === 'lesson' && <Lesson key={params.key} {...p} target={params} />}
      {route === 'song' && <Song key={params.key} {...p} params={params} />}
      {route === 'report' && <Report {...p} />}
      {route === 'songplay' && <SongPlay key={params.key} {...p} params={params} />}
      {route === 'songreport' && <SongReport {...p} params={params} />}
      {route === 'practice' && <Practice {...p} />}
      {route === 'my' && <My {...p} toast={toast} />}
      {route === 'history' && <History {...p} />}
      {TABS.includes(route) && <TabBar route={route} go={go} />}
      {toastMsg && <div className="toast">{toastMsg}</div>}
      {splash !== 'done' && <Splash leaving={splash === 'leave'} />}
      {panel && <Panel s={s} update={update} setS={setS} close={() => setPanel(false)} go={go} editingLocked={['attend', 'lesson', 'song', 'songplay', 'setup'].includes(route)} />}
    </div>
  );
}
