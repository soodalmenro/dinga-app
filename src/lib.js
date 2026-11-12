// 저장(localStorage), 날짜, 마이크 소리 감지를 모아 둔 파일
import content from './content.json';

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
  panel: { mood: 'auto', speed: 1, judge: 'mic', posture: 'sim', dayShift: 0, pid: '', variant: 'idea', alert: 'auto' },
});

export function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw) return { ...empty(), ...raw, panel: { ...empty().panel, ...(raw.panel || {}) } };
  } catch (e) {}
  return empty();
}
export function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
}
export function resetAll() {
  try { localStorage.removeItem(KEY); } catch (e) {}
  return empty();
}
// 참가자 사이 초기화: 기록은 지우고 평가 설정(참가자 번호·화면 구성·자세 알림 방식)은 남긴다
export const KEEP_ON_RESET = ['pid', 'variant', 'alert', 'judge'];

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
export const challengeDone = (s) => !!(s.challenge && s.challenge.done);
// 아이디어 반영 구성에서는 4번째 레슨이 '완주하기'(전환 → 박자 → 완주)다
export const lessonsFor = (s) => (s.panel.variant === 'idea' ? content.lessons.map((l) => (l.id === 'song' ? content.courseSong : l)) : content.lessons);
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
export const mic = {
  state: 'idle', // idle | on | denied
  // 아이폰은 사용자가 화면을 누른 순간에만 소리 장치를 깨울 수 있다. 누를 때마다 불러 둔다
  prime() {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) {}
  },
  async start() {
    if (this.state === 'on') return true;
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
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        const src = ctx.createMediaStreamSource(stream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        buf = new Float32Array(analyser.fftSize);
        src.connect(analyser);
        wide = ctx.createAnalyser(); wide.fftSize = 8192; wide.smoothingTimeConstant = 0.5; fbuf = new Float32Array(wide.frequencyBinCount); src.connect(wide);
        this.state = 'on';
        return true;
      } catch (e) {
        if (generation !== micGeneration) return false;
        if (stream) stream.getTracks().forEach((track) => track.stop());
        stream = null;
        this.state = 'denied';
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
    if (this.state !== 'on' || !analyser) return 0;
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i += 1) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  },
  // 지금 소리의 음 구성(도~시 12칸). 80~1000Hz만 본다. 코드 구분용
  chroma() {
    const out = new Array(12).fill(0);
    if (this.state !== 'on' || !wide) return out;
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
    micGeneration += 1;
    micRequest = null;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (ctx) ctx.close().catch(() => {});
    stream = null; ctx = null; analyser = null; wide = null; this.state = 'idle';
  },
};
export const threshold = () => content.soundThreshold.mid;
// 음 구성이 Em · G · C 중 무엇에 가장 가까운지. 검증 전 기준이라 실제 기타로 맞춰야 한다
export function guessChord(ch) {
  const total = ch.reduce((a, b) => a + b, 0); if (!total) return null;
  let best = null; let top = -1;
  Object.entries(content.chordNotes).forEach(([name, notes]) => { const v = notes.reduce((a, n) => a + ch[n], 0) / total; if (v > top) { top = v; best = name; } });
  return best;
}

// 소리가 "시작된 순간"을 알려 주는 감지기. 조용했다가 기준값을 넘으면 onHit 호출
export function makeOnsetDetector(onHit) {
  let armed = true; let raf = 0; let stopped = false;
  const th = threshold();
  const loop = () => {
    if (stopped) return;
    const l = mic.level();
    if (armed && l > th) { armed = false; onHit(performance.now(), l); }
    if (!armed && l < th * 0.5) armed = true;
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => { stopped = true; cancelAnimationFrame(raf); };
}

// ---------- 평가용 기록 ----------
// 화면 이동, 단계, 막힘, 건너뛰기, 나가기, 권한, 결과를 시간과 함께 남긴다. 숨은 패널에서 복사한다
const LOG_KEY = 'dinga-log';
let pid = '';
export const setPid = (v) => { pid = v || ''; };
export function getLog() { try { return JSON.parse(localStorage.getItem(LOG_KEY)) || []; } catch (e) { return []; } }
export function logEvent(type, data = {}) {
  try {
    const log = getLog();
    log.push({ t: new Date().toISOString(), pid, type, ...data });
    localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(-4000)));
  } catch (e) {}
}
export function clearLog() { try { localStorage.removeItem(LOG_KEY); } catch (e) {} }

// 연습 중 화면이 꺼지지 않게 한다 (지원하지 않는 폰에서는 아무 일도 없다)
let wake = null;
export async function keepAwake(on) {
  try {
    if (on && !wake && navigator.wakeLock) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); }
    if (!on && wake) { await wake.release(); wake = null; }
  } catch (e) {}
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
const buzz = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };
export const sfx = {
  tap: () => buzz(8),
  ok: () => { tone([659, 988], 0.09); buzz(20); },
  done: () => { tone([523, 659, 784, 1047], 0.11); buzz([20, 40, 30]); },
  tick: () => tone([880], 0.04),
  alert: () => buzz(200), // 자세 알림: 진동 1번, 소리 없음
};

export { content };

