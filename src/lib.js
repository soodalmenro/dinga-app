// 저장(localStorage), 날짜, 마이크 소리 감지를 모아 둔 파일
import content from './content.json';
import { analyzeChord } from './chordRecognition.js';
import { ear } from './guitarEar.js';
import { createGuitarHitGate } from './guitarHitGate.js';
export { ear } from './guitarEar.js';
import { createInputProfiles, inputDeviceKey } from './inputCalibration.js';
import { LOG_LIMIT, currentEvaluationBundle } from './evaluationExport.js';
import { observeMediaStream, mediaStreamIsLive, createWakeLockController } from './mediaLifecycle.js';
const inputProfiles = createInputProfiles();
let activeDeviceId = null;

const KEY = 'dinga-v1';
const empty = () => ({
  attendances: [], // [{date:'2026-11-11', method:'sound'|'manual'}]
  history: {}, // {'2026-11-11': 초}
  done: { em: [false, false, false], g: [false, false, false], c: [false, false, false], song: [false, false, false] },
  resume: null, // {lesson, part, step}
  posture: null, // {date, wrist, thumb, shoulder}
  song: { last: null, prev: null },
  challenge: null, // {done:true} 친구와 같은 곡 연습을 끝낸 적이 있는지
  songPractice: { last: null, count: 0, best: 0 }, // 곡 연습(가사·코드 화면) 결과
  ptab: 'review', // 연습 탭에서 마지막에 본 구분: review | transition | song
  // variant: 'idea' = 아이디어 반영(위젯·연주 중 자세 알림·같은 곡 챌린지), 'prd' = PRD 원본(연습 전 자세 촬영·친구 목록)
  panel: { mood: 'auto', speed: 1, judge: 'mic', posture: 'real', dayShift: 0, pid: '', variant: 'idea', alert: 'auto', fresh: true }, // fresh: 나갔다 다시 들어오면(새로고침) 처음부터(11/18). 평가 패널에서 끌 수 있다
});

const isRecord = (value) => value != null && typeof value === 'object' && !Array.isArray(value);
const isDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && dateStr(new Date(value + 'T12:00:00')) === value;
const nonnegativeInteger = (value) => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const reportBack = (value) => ['home', 'learn', 'practice', 'my', 'report', 'songreport'].includes(value) ? value : null;
const reportTempo = (value) => Number.isFinite(value) && value >= 40 && value <= 125 ? value : 80;
const percentage = (value) => Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;

function transitionResult(value) {
  if (!isRecord(value) || !Array.isArray(value.bars) || value.bars.length !== 8) return null;
  if (!value.bars.every((bar) => ['ok', 'late', 'none'].includes(bar))) return null;
  const validChord = (chord) => typeof chord === 'string' && Object.hasOwn(content.chordNotes, chord);
  return {
    ...value,
    challengeFirst: value.challengeFirst === true,
    chart: Array.isArray(value.chart) && value.chart.length === 8 && value.chart.every(validChord) ? value.chart : undefined,
    pair: Array.isArray(value.pair) && value.pair.length === 2 && value.pair.every(validChord) ? value.pair : null,
    back: reportBack(value.back),
    tempo: reportTempo(value.tempo),
  };
}

function practiceResult(value) {
  if (!isRecord(value) || !Array.isArray(value.secs) || !isRecord(value.trans)) return null;
  if (!value.secs.every((section) => isRecord(section) && typeof section.name === 'string' && ['good', 'late', 'check', 'retry', 'skip', 'unmeasured', 'uncertain'].includes(section.state))) return null;
  if (value.coverage !== undefined) {
    const coverage = value.coverage;
    const total = content.songPractice.sections.reduce((sum, section) => sum + section.lines.flat().length, 0);
    if (!isRecord(coverage) || !['played', 'total', 'evaluated', 'uncertain'].every((key) => Number.isInteger(coverage[key]) && coverage[key] >= 0)
      || coverage.total !== total || coverage.played > total || coverage.evaluated + coverage.uncertain > coverage.played) return null;
  }
  const validTransitions = Object.entries(value.trans).every(([key, pair]) => {
    const chords = key.split(' → ');
    const knownChords = chords.length === 2 && chords.every((chord) => Object.hasOwn(content.chordNotes, chord));
    return knownChords && isRecord(pair)
      && Number.isFinite(pair.n) && pair.n > 0
      && Number.isFinite(pair.ok) && pair.ok >= 0 && pair.ok <= pair.n
      && (pair.uncertain === undefined || (Number.isInteger(pair.uncertain) && pair.uncertain >= 0 && pair.ok + pair.uncertain <= pair.n));
  });
  if (!validTransitions) return null;
  return {
    ...value,
    complete: value.complete === true, fromLesson: value.fromLesson === true,
    firstComplete: value.firstComplete === true, challengeFirst: value.challengeFirst === true,
    score: percentage(value.score), chordAcc: percentage(value.chordAcc), beatAcc: percentage(value.beatAcc),
    tempo: reportTempo(value.tempo), back: reportBack(value.back),
  };
}

export function load() {
  const base = empty();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (!isRecord(raw)) return base;
    const state = { ...base, ...raw };
    state.attendances = Array.isArray(raw.attendances) ? raw.attendances.filter((item) => isRecord(item) && isDate(item.date)) : [];
    state.history = Object.fromEntries(Object.entries(isRecord(raw.history) ? raw.history : {}).filter(([date, seconds]) => isDate(date) && Number.isFinite(seconds) && seconds >= 0));
    state.done = Object.fromEntries(Object.keys(base.done).map((lesson) => [
      lesson, base.done[lesson].map((_, part) => !!(raw.done && Array.isArray(raw.done[lesson]) && raw.done[lesson][part] === true)),
    ]));
    const resume = raw.resume;
    state.resume = isRecord(resume) && Object.hasOwn(base.done, resume.lesson) && Number.isInteger(resume.part) && resume.part >= 0 && resume.part < 3 && Number.isInteger(resume.step) && resume.step >= 0 ? resume : null;
    state.song = { last: transitionResult(raw.song && raw.song.last), prev: transitionResult(raw.song && raw.song.prev) };
    const practice = isRecord(raw.songPractice) ? raw.songPractice : {};
    state.songPractice = { last: practiceResult(practice.last), count: nonnegativeInteger(practice.count), best: percentage(practice.best) ?? 0 };
    state.challenge = isRecord(raw.challenge) ? { done: raw.challenge.done === true } : null;
    state.ptab = ['review', 'transition', 'song'].includes(raw.ptab) ? raw.ptab : base.ptab;
    state.panel = { ...base.panel, ...(isRecord(raw.panel) ? raw.panel : {}) };
    for (const [key, options] of Object.entries({
      variant: ['idea', 'prd'], alert: ['auto', 'real', 'manual', 'off'],
      judge: ['mic', 'random', 'allok', 'hard'], posture: ['real', 'self', 'sim'],
      mood: ['auto', ...Object.keys(content.moodNames)],
    })) {
      if (!options.includes(state.panel[key])) state.panel[key] = base.panel[key];
    }
    if (!Number.isFinite(state.panel.speed) || state.panel.speed <= 0) state.panel.speed = base.panel.speed;
    if (!Number.isInteger(state.panel.dayShift)) state.panel.dayShift = base.panel.dayShift;
    if (typeof state.panel.pid !== 'string') state.panel.pid = base.panel.pid;
    // 기록이 이미 있는 기기는 저장된 값만 따른다(키가 없으면 끔). 처음 여는 기기는 기본값(켬)으로 시작한다
    state.panel.fresh = isRecord(raw.panel) && raw.panel.fresh === true;
    return state;
  } catch (e) {}
  return base;
}
export function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch (e) { return false; }
}
export function resetAll() {
  inputProfiles.clear();
  try { localStorage.removeItem(KEY); } catch (e) {}
  return empty();
}
// 참가자 사이 초기화: 기록은 지우고 평가 설정(참가자 번호·화면 구성·자세 알림 방식)은 남긴다
export const KEEP_ON_RESET = ['pid', 'variant', 'alert', 'judge', 'fresh'];
// 평가 패널에서 '새로고침하면 처음부터'를 켜 두면, 페이지를 새로 열 때마다 상태 초기화 버튼과 같은 일을 한다.
// 평가 설정과 행동 기록(dinga-log)은 남는다. 기본은 꺼짐: 켜지 않으면 기록은 지금처럼 유지된다.
export function loadAtStartup() {
  const state = load();
  // 주소 끝에 ?fresh=1 을 붙여 한 번 열면 이 설정이 켜지고(?fresh=0 은 끔), 그 뒤로는 주소 없이도 유지된다.
  try { const asked = new URLSearchParams(window.location.search).get('fresh'); if (asked === '1' || asked === '0') { state.panel.fresh = asked === '1'; save(state); } } catch (e) {}
  if (state.panel.fresh !== true) return state;
  const next = empty();
  KEEP_ON_RESET.forEach((key) => { next.panel[key] = state.panel[key]; });
  save(next); logEvent('reset', { how: 'reload' });
  return next;
}

// 날짜: 폰의 현지 날짜 기준. dayShift는 숨은 패널에서 날짜를 앞으로 미는 용도
export function dateStr(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function today(s) {
  const d = new Date();
  d.setDate(d.getDate() + ((s && s.panel.dayShift) || 0));
  return dateStr(d);
}
export function addDays(str, n) {
  const [y, m, d] = str.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return dateStr(dt);
}
export function dayDiff(a, b) {
  const f = (x) => { const [y, m, d] = x.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
  return Math.round((f(b) - f(a)) / 86400000);
}
// 이번 주 월요일 날짜와 일요일까지 남은 날
export function weekStart(str) {
  const [y, m, d] = str.split('-').map(Number);
  const wd = (new Date(y, m - 1, d).getDay() + 6) % 7; // 월=0
  return addDays(str, -wd);
}
export const daysToSunday = (str) => 6 - dayDiff(weekStart(str), str);
export const challengeDone = (s) => s.challenge?.done === true;
// 아이디어 반영 구성에서는 4번째 레슨이 '완주하기'(전환 → 박자 → 완주)다
export const lessonsFor = (s) => (s.panel.variant === 'idea' ? content.lessons.map((l) => (l.id === 'song' ? content.courseSong : l)) : content.lessons);
// 파트에서 번호를 매겨 밟는 단계 목록(이어하기의 step 번호 기준).
// PRD 원본은 파트마다 맨 앞에 자세 촬영이 있다. 아이디어 반영은 목록에 넣지 않는다:
// 자세 촬영(S7)은 레슨 첫 파트의 첫 연주 단계 직전에 한 번 끼워 보여 주며(Lesson.jsx) 번호를 차지하지 않는다.
// 그래서 이전 버전에서 저장된 이어하기 위치가 그대로 맞는다. 복습·단독 전환(practiceOnly)에서는 찍지 않는다.
export function partSteps(definition, variant, part, practiceOnly = false) {
  const rest = definition.steps.filter((step) => step.type !== 'posture');
  if (variant === 'idea' || practiceOnly) return rest;
  // PRD 원본은 파트 맨 앞에서 자세를 찍는다(content.json에서 posture 자리가 바뀌어도 맨 앞)
  const posture = definition.steps.find((step) => step.type === 'posture');
  return posture ? [posture, ...rest] : rest;
}
export function remapResumeVariant(resume, from, to) {
  if (!resume || typeof resume !== 'object' || Array.isArray(resume)
    || !['idea', 'prd'].includes(from) || !['idea', 'prd'].includes(to)
    || !Number.isInteger(resume.part) || resume.part < 0 || !Number.isInteger(resume.step) || resume.step < 0) return null;
  const part = (variant) => lessonsFor({ panel: { variant } }).find((lesson) => lesson.id === resume.lesson)?.parts[resume.part];
  const before = part(from); const after = part(to);
  if (!before?.steps?.length || !after?.steps?.length) return null;
  const visible = (definition, variant) => partSteps(definition, variant, resume.part);
  const oldSteps = visible(before, from); const newSteps = visible(after, to);
  if (!oldSteps.length || !newSteps.length) return null;
  // Song variants use different curricula; restart the same part rather than guess.
  const previous = oldSteps[Math.min(resume.step, oldSteps.length - 1)];
  const mapped = before === after ? newSteps.indexOf(previous) : -1;
  return { lesson: resume.lesson, part: resume.part, step: Math.max(0, mapped) };
}
export const courseDone = (s) => ['em', 'g', 'c', 'song'].every((k) => s.done[k].every(Boolean));
export const attendedOn = (s, date) => s.attendances.find((a) => a.date === date);
export function lastAttendance(s) {
  if (!s.attendances.length) return null;
  return [...s.attendances].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
}
export function streak(s) {
  const t = today(s);
  let d = attendedOn(s, t) ? t : addDays(t, -1);
  let n = 0;
  while (attendedOn(s, d)) { n += 1; d = addDays(d, -1); }
  return n;
}
// 홈 표정: 마지막 출석 후 지난 날짜
export function mood(s) {
  if (s.panel.mood !== 'auto') return s.panel.mood;
  const last = lastAttendance(s);
  if (!last) return 'happy';
  const diff = dayDiff(last.date, today(s));
  if (diff <= 0) return 'happy';
  if (diff === 1) return 'sulky';
  if (diff <= 3) return 'stare';
  if (diff <= 6) return 'exhausted';
  return 'melted';
}
export const moodGauge = { happy: 4, sulky: 3, stare: 2, exhausted: 1, melted: 0 };
export function homeLine(s) {
  const last = lastAttendance(s);
  if (!last) return content.homeLines.first;
  const m = mood(s);
  const t = today(s);
  if (!attendedOn(s, t) && !(s.history[last.date] > 0) && s.panel.mood === 'auto') return content.homeLines.attendedOnly;
  return content.homeLines[m];
}
export function totalMinutes(s) {
  return Math.floor(Object.values(s.history).reduce((a, b) => a + b, 0) / 60);
}
export function nextPart(s) {
  if (s.resume) return s.resume;
  return null;
}

// ---------- 마이크 ----------
let ctx = null; let analyser = null; let stream = null; let buf = null; let wide = null; let fbuf = null;
let micRequest = null;
let micGeneration = 0;
let stopInputWatch = null; let stopContextWatch = null;
const micListeners = new Set();
function setMicState(state) {
  mic.state = state;
  for (const listener of micListeners) { try { listener(state); } catch {} }
}
function disposeMicrophone() {
  ear.detach();
  micGeneration += 1; micRequest = null;
  if (stopInputWatch) stopInputWatch(); if (stopContextWatch) stopContextWatch();
  stopInputWatch = null; stopContextWatch = null;
  const oldStream = stream; const oldContext = ctx;
  stream = null; ctx = null; analyser = null; wide = null; activeDeviceId = null;
  if (oldStream) oldStream.getTracks().forEach((track) => track.stop());
  if (oldContext) oldContext.close().catch(() => {});
}
function interruptMicrophone(reason) {
  if (mic.state !== 'on') return;
  disposeMicrophone(); inputProfiles.clear();
  setMicState('interrupted'); logEvent('mic_interrupted', { reason });
}
function microphoneAlive() {
  if (mic.state !== 'on') return false;
  if (!mediaStreamIsLive(stream) || ctx?.state !== 'running') { interruptMicrophone('input'); return false; }
  return true;
}
export const mic = {
  state: 'idle', // idle | on | denied | interrupted
  subscribe(listener) { micListeners.add(listener); return () => micListeners.delete(listener); },
  // 아이폰은 사용자가 화면을 누른 순간에만 소리 장치를 깨울 수 있다. 누를 때마다 불러 둔다
  prime() {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch (e) {}
  },
  async start() {
    if (this.state === 'on' && microphoneAlive()) return true;
    if (micRequest) return micRequest;
    const generation = micGeneration;
    micRequest = (async () => {
      try {
        const acquired = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
        if (generation !== micGeneration) {
          acquired.getTracks().forEach((track) => track.stop());
          return false;
        }
        stream = acquired;
        activeDeviceId = inputDeviceKey(acquired.getAudioTracks?.()[0]?.getSettings?.());
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        const context = ctx;
        if (context.state !== 'running') await context.resume();
        if (generation !== micGeneration || stream !== acquired || ctx !== context) { acquired.getTracks().forEach((track) => track.stop()); return false; }
        if (context.state !== 'running' || acquired.getTracks().some((track) => track.readyState === 'ended')) throw new Error('input_unavailable');
        const src = context.createMediaStreamSource(stream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        buf = new Float32Array(analyser.fftSize);
        src.connect(analyser);
        // 48kHz에서도 반음 경계 밖으로 에너지가 흩어지는 양을 줄인다(약 2.93Hz/bin).
        wide = ctx.createAnalyser(); wide.fftSize = 16384; wide.smoothingTimeConstant = 0; fbuf = new Float32Array(wide.frequencyBinCount); src.connect(wide);
        stopInputWatch = observeMediaStream(acquired, () => { if (stream === acquired) interruptMicrophone('track'); });
        const onContext = () => { if (ctx === context && context.state !== 'running') interruptMicrophone('context'); };
        context.addEventListener('statechange', onContext);
        stopContextWatch = () => context.removeEventListener('statechange', onContext);
        setMicState('on');
        // Recognition readiness is separate from microphone permission/liveness.
        // Failure stays unknown; it never silently falls back to RMS success.
        ear.attach(context,src).catch(()=>{});
        return true;
      } catch (e) {
        if (generation !== micGeneration) return false;
        disposeMicrophone(); setMicState('denied');
        return false;
      }
    })();
    try {
      return await micRequest;
    } finally {
      if (generation === micGeneration) micRequest = null;
    }
  },
  // 소리 크기(RMS). 0~1, 보통 조용할 때 0.01 아래
  level() {
    if (!microphoneAlive() || !analyser) return 0;
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i += 1) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  },
  // 지금 소리의 음 구성(도~시 12칸). 80~1000Hz만 본다. 코드 구분용
  chroma() {
    const out = new Array(12).fill(0);
    if (!microphoneAlive() || !wide) return out;
    wide.getFloatFrequencyData(fbuf);
    const hz = ctx.sampleRate / wide.fftSize;
    for (let i = Math.ceil(80 / hz); i < fbuf.length && i * hz < 1000; i += 1) {
      const pw = 10 ** (fbuf[i] / 10); if (!Number.isFinite(pw)) continue;
      const midi = Math.round(69 + 12 * Math.log2((i * hz) / 440));
      out[((midi % 12) + 12) % 12] += pw;
    }
    return out;
  },
  stop() {
    disposeMicrophone(); setMicState('idle');
  },
  spectrumWindowMs() { return ctx && wide ? 1000 * wide.fftSize / ctx.sampleRate : 0; },
};
export const clearInputCalibration = () => inputProfiles.clear();
export const applyInputCalibration = (result) => mic.state === 'on' && inputProfiles.apply(result, { deviceId: activeDeviceId, generation: micGeneration });
export const threshold = () => mic.state === 'on'
  ? inputProfiles.threshold(content.soundThreshold.mid, { deviceId: activeDeviceId, generation: micGeneration })
  : content.soundThreshold.mid;
// 음 구성이 Em · G · C 중 무엇에 가장 가까운지. 검증 전 기준이라 실제 기타로 맞춰야 한다
export function guessChord(ch) {
  return analyzeChord(ch, content.chordNotes).chord;
}

// 소리가 "시작된 순간"을 알려 주는 감지기. 조용했다가 기준값을 넘으면 onHit 호출
export function makeOnsetDetector(onHit, {target=null,snapshot,simulated=false}={}) {
  let armed = true; let raf = 0; let stopped = false;
  const gate=createGuitarHitGate({onHit,target,snapshot});
  if(!simulated)gate.reset(); // A resumed/held sound needs a quiet interval before a new hit.
  const loop = () => {
    if (stopped) return;
    if (document.hidden || mic.state !== 'on') {gate.reset();armed=false; raf = requestAnimationFrame(loop); return; }
    const th = simulated ? threshold() : Math.min(threshold(),Math.max(.001,Math.min(.008,ear.noiseFloor()*3)));
    const l = mic.level();
    if(simulated){if (armed && l > th) { armed = false; onHit(performance.now(), l,snapshot?.()); }}
    else gate.sample({at:performance.now(),level:l,threshold:th,observation:ear.snapshot()});
    if (!armed && l < th * 0.5) armed = true;
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => { stopped = true;gate.reset(); cancelAnimationFrame(raf); };
}

// ---------- 평가용 기록 ----------
// 화면 이동, 단계, 막힘, 건너뛰기, 나가기, 권한, 결과를 시간과 함께 남긴다. 숨은 패널에서 복사한다
const LOG_KEY = 'dinga-log';
let pid = '';
let volatileLog = null;
let logReadFailed = false;
export const setPid = (v) => { pid = v || ''; };
export const getLogStorageMode = () => volatileLog !== null ? 'memory' : logReadFailed ? 'unavailable' : 'local';
export function getLog() {
  if (volatileLog) return volatileLog;
  try {
    const value = JSON.parse(localStorage.getItem(LOG_KEY));
    logReadFailed = false;
    return Array.isArray(value) ? value.filter(isRecord) : [];
  } catch (e) { logReadFailed = true; return []; }
}
export function logEvent(type, data = {}) {
  const log = getLog();
  log.push({ t: new Date().toISOString(), pid, type, ...data, bundle: currentEvaluationBundle() });
  const recent = log.slice(-LOG_LIMIT);
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(recent));
    volatileLog = null;
    logReadFailed = false;
  } catch (e) { volatileLog = recent; }
}
export function clearLog() {
  volatileLog = [];
  try { localStorage.removeItem(LOG_KEY); volatileLog = null; logReadFailed = false; } catch (e) { logReadFailed = true; }
}

// 연습 중 화면이 꺼지지 않게 한다 (지원하지 않는 폰에서는 아무 일도 없다)
let wakeController = null; let wakeListening = false;
const onWakeVisibility = () => { if (document.hidden) wakeController.suspend(); else wakeController.refresh(); };
const onWakeGesture = () => { wakeController.refresh(); };
export async function keepAwake(on) {
  if (typeof document === 'undefined') return;
  if (!wakeController) wakeController = createWakeLockController({ isVisible: () => !document.hidden, request: () => navigator.wakeLock?.request('screen') });
  if (on && !wakeListening) { document.addEventListener('visibilitychange', onWakeVisibility); document.addEventListener('pointerdown', onWakeGesture); wakeListening = true; }
  if (!on && wakeListening) { document.removeEventListener('visibilitychange', onWakeVisibility); document.removeEventListener('pointerdown', onWakeGesture); wakeListening = false; }
  await wakeController.setActive(on);
}

// ---------- 효과음과 진동 ----------
// 성공 순간에만 짧게 낸다. 박자 소리는 마이크가 다시 주워 들을 수 있어서 내지 않는다
let actx = null;
function tone(freqs, step = 0.1) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    freqs.forEach((f, i) => {
      const o = actx.createOscillator(); const g = actx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t0 = actx.currentTime + i * step;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + step * 1.8);
      o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(t0 + step * 2);
    });
  } catch (e) {}
}
// 곡 멜로디 한 음(작게, 부드러운 삼각파). delay·duration은 초
function note(midi, duration, delay = 0) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const o = actx.createOscillator(); const g = actx.createGain();
    o.type = 'triangle'; o.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    const t0 = actx.currentTime + Math.max(0, delay); const end = t0 + Math.max(0.08, duration * 0.92);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, end);
    o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(end + 0.02);
  } catch (e) {}
}
const buzz = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };
export const sfx = {
  tap: () => buzz(8),
  ok: () => { tone([659, 988], 0.09); buzz(20); },
  done: () => { tone([523, 659, 784, 1047], 0.11); buzz([20, 40, 30]); },
  tick: () => tone([880], 0.04),
  note,
  alert: () => buzz(200), // 자세 알림: 진동 1번, 소리 없음
};

export { content };

