// 브라우저 없이 인식 체인(Chordino 워커 → 코드 안정 → 타격 게이트)을 재생하는 검사.
// 줄을 뜯는 소리에 가까운 합성음(Karplus-Strong)으로 작은 소리·연속 연주·오답 코드·타자를 확인한다.
// 실제 기타 녹음이 아니므로 인식률 수치로 쓰지 않는다. 실행: node qa/guitar-quiet-replay.mjs
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
const app = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const RATE = 44100, BLOCK = 4096;
const messages = [];
globalThis.onmessage = null;
globalThis.postMessage = (m) => messages.push(m);
await import(pathToFileURL(path.join(app, 'public/chordino/dinga-chord-worker.mjs')).href);
const { createGuitarHitGate } = await import(pathToFileURL(path.join(app, 'src/guitarHitGate.js')).href);

const NOTES = { Em: [40, 47, 52, 55, 59, 64], G: [43, 47, 50, 55, 59, 67], C: [48, 52, 55, 60, 64], D: [50, 57, 62, 66], Am: [45, 52, 57, 60, 64] };
let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
// Karplus-Strong string, started at sample `at`, mixed into out
function pluck(out, at, midi, cents, gain) {
  const f = 440 * 2 ** ((midi - 69 + cents / 100) / 12); const n = Math.round(RATE / f);
  const line = Float32Array.from({ length: n }, () => rnd());
  let k = 0, prev = 0; const end = Math.min(out.length, at + RATE * 4);
  for (let i = at; i < end; i++) { const v = line[k]; const nv = 0.996 * 0.5 * (v + prev); prev = v; line[k] = nv; k = (k + 1) % n; out[i] += v * gain; }
}
// strums: [{t, chord|'tap'|'mute'}], total seconds
function render({ strums, seconds, cents = 0, rms = 0.03, noise = 0.0005 }) {
  const out = new Float32Array(Math.ceil(seconds * RATE));
  for (const s of strums) {
    const at = Math.round(s.t * RATE);
    if (s.chord === 'tap') { for (let i = at; i < Math.min(out.length, at + 800); i++) out[i] += rnd() * 3 * Math.exp(-(i - at) / 150); continue; }
    // a new strum damps the strings that are still ringing
    for (let i = at; i < out.length; i++) out[i] *= 0.35;
    NOTES[s.chord].forEach((m, j) => pluck(out, at + Math.round(j * 0.012 * RATE), m, cents + rnd() * 6, 0.5 + 0.5 * Math.abs(rnd())));
  }
  // normalise the played part to the requested RMS (measured on loud half), then add room noise
  const sq = Array.from(out, (v) => v * v).sort((a, b) => a - b); const ref = Math.sqrt(sq.slice(Math.floor(sq.length / 2)).reduce((a, b) => a + b, 0) / (sq.length / 2)) || 1;
  for (let i = 0; i < out.length; i++) out[i] = out[i] * (rms / ref) + rnd() * noise;
  return out;
}

async function run(pcm, { target = null } = {}) {
  messages.length = 0;
  let portHandler = null; const port = { postMessage() {}, close() {}, set onmessage(f) { portHandler = f; }, get onmessage() { return portHandler; } };
  await globalThis.onmessage({ data: { type: 'start', port, sampleRate: RATE, delayMs: 0 } });
  if (!portHandler) throw Error('worker not ready: ' + JSON.stringify(messages));
  const hits = []; const labels = new Map();
  const gate = createGuitarHitGate({ onHit: (at, level, slot, info) => hits.push({ at: Math.round(at), chord: info.chord }), target });
  let chord = '', since = 0, sourceAt = 0, usable = false, floor = 0;
  const frame = Math.round(RATE * 0.016);
  let nextBlock = BLOCK;
  for (let i = 1024; i < pcm.length; i += frame) {
    while (nextBlock <= i) {
      const startMs = (nextBlock - BLOCK) / RATE * 1000; const samples = pcm.slice(nextBlock - BLOCK, nextBlock);
      const before = messages.length;
      portHandler({ data: { blocks: [{ samples, startMs, nowMs: Math.trunc(nextBlock / RATE * 1000) }] } });
      for (const m of messages.slice(before)) {
        if (m.type === 'error') throw Error(m.message);
        if (m.type !== 'state') continue;
        const next = m.chord;
        if (m.chord) labels.set(m.chord, (labels.get(m.chord) || 0) + 1);
        if (next !== chord) since = next ? m.atMs : 0;
        chord = next; sourceAt = m.atMs; usable = true; floor = m.floor;
      }
      nextBlock += BLOCK;
    }
    let sum = 0; for (let k = i - 1024; k < i; k++) sum += pcm[k] * pcm[k];
    const level = Math.sqrt(sum / 1024), at = i / RATE * 1000;
    const threshold = Math.min(0.05, Math.max(0.001, Math.min(0.008, floor * 3)));
    gate.sample({ at, level, threshold, observation: { usable, chord, sourceAt, stableMs: chord ? Math.max(0, sourceAt - since) : 0 } });
  }
  await globalThis.onmessage({ data: { type: 'stop' } });
  return { hits, labels: Object.fromEntries([...labels].sort((a, b) => b[1] - a[1]).slice(0, 6)) };
}

const every = (chord, period, count, start = 0.6) => Array.from({ length: count }, (_, i) => ({ t: start + i * period, chord }));
const cases = [];
for (const chord of ['Em', 'G', 'C']) for (const rms of [0.03, 0.008, 0.003]) for (const cents of [0, -25]) for (const period of [1.5, 1.0])
  cases.push({ name: `${chord} x8 every ${period}s rms ${rms} tune ${cents}c`, target: chord, expect: 8, opts: { strums: every(chord, period, 8), seconds: 0.6 + 8 * period + 1.5, rms, cents } });
for (const [wrong, target] of [['G', 'Em'], ['C', 'G'], ['Em', 'C'], ['D', 'G'], ['Am', 'C']])
  cases.push({ name: `wrong ${wrong} while target ${target}`, target, expect: 0, opts: { strums: every(wrong, 1.2, 8), seconds: 12 } });
for (const rms of [0.03, 0.003]) cases.push({ name: `one held Em rms ${rms}`, target: 'Em', expect: 1, exact: true, opts: { strums: every('Em', 1, 1), seconds: 6, rms } });
for (const rms of [0.03, 0.005]) cases.push({ name: `60s continuous G rms ${rms}`, target: 'G', expect: 58, opts: { strums: every('G', 1, 58), seconds: 60, rms } });
cases.push({ name: 'taps only', target: 'Em', expect: 0, opts: { strums: every('tap', 0.4, 20), seconds: 10 } });
cases.push({ name: 'room noise only', target: 'G', expect: 0, opts: { strums: [], seconds: 8, noise: 0.01 } });

let bad = 0;
for (const c of cases) {
  seed = 7;
  const { hits, labels } = await run(render(c.opts), { target: c.target });
  const ok = c.exact ? hits.length === c.expect : c.expect === 0 ? hits.length === 0 : hits.length >= c.expect - 1 && hits.length <= c.expect;
  if (!ok) bad += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${c.name}: hits ${hits.length}/${c.expect} labels ${JSON.stringify(labels)}`);
}
console.log(bad ? `FAIL ${bad} case(s) outside expectation` : 'PASS quiet/continuous/held/wrong-chord/tap replay');
if (bad) process.exitCode = 1;
