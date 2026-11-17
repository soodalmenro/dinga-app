// Local Chordino observations. Failure/unsupported input always remains unknown.
const BASE = `${import.meta.env.BASE_URL}chordino/`;
const FRESH_MS = 700, MAX_SOURCE_LAG_MS = 1600, READY_TIMEOUT_MS = 15000;
let generation = 0, resources = null;
const listeners = new Set();
const state = { status: 'off', chord: '', since: 0, sourceAt: 0, receivedAt: 0, floor: 0, level: 0, candidate:'',gate:0,sustained:0,currentSustained:0 };
const now = () => performance.now();
function notify() { for (const listener of listeners) { try { listener(ear.chord(), ear.snapshot()); } catch {} } }
function clear(status = state.status) { Object.assign(state, { status, chord: '', since: 0, sourceAt: 0, receivedAt: 0, floor: 0, level: 0,candidate:'',gate:0,sustained:0,currentSustained:0 }); notify(); }
function fresh() { return state.status === 'ready' && resources?.context.state === 'running' && !resources?.doc?.hidden && state.receivedAt > 0 && now() - state.receivedAt <= FRESH_MS && now() - state.sourceAt <= MAX_SOURCE_LAG_MS; }
// Exact named major/minor triads only. Extensions, inversions and missing thirds abstain.
export function parseChord(label) { const match = /^([A-G](?:#|b)?)(m?)$/.exec(typeof label === 'string' ? label : ''); return match ? { root: match[1], minor: match[2] === 'm' } : null; }
export function sameChord(label, target) { const heard = parseChord(label), wanted = parseChord(target); return !!heard && !!wanted && heard.root === wanted.root && heard.minor === wanted.minor; }
export const ear = {
  status() { return state.status === 'ready' && !fresh() && state.receivedAt > 0 ? 'stale' : state.status; },
  usable: () => fresh(),
  chord: () => fresh() ? state.chord : '',
  stableMs: () => fresh() && state.chord ? Math.max(0, state.sourceAt - state.since) : 0,
  hearing(target = null, minStableMs = 350) { return fresh() && !!state.chord && ear.stableMs() >= minStableMs && (target === null || sameChord(state.chord, target)); },
  noiseFloor: () => fresh() ? state.floor : 0,
  snapshot() { const usable = fresh(); return { status: ear.status(), usable, chord: usable ? state.chord : '', at: usable ? state.sourceAt : 0, sourceAt: usable ? state.sourceAt : 0, since: usable && state.chord ? state.since : 0, time: now(), stableMs: ear.stableMs(), floor: usable ? state.floor : 0, level: usable ? state.level : 0,candidate:usable?state.candidate:'',gate:usable?state.gate:0,sustained:usable?state.sustained:0,currentSustained:usable?state.currentSustained:0, generation }; },
  subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  async attach(context, src) {
    ear.detach();
    const mine = ++generation;
    const doc = typeof document !== 'undefined' ? document : null;
    if (!context?.audioWorklet || typeof Worker === 'undefined' || typeof AudioWorkletNode === 'undefined' || typeof MessageChannel === 'undefined') { clear('unsupported'); return false; }
    let resolveReady;
    const ready = new Promise(resolve => { resolveReady = resolve; });
    const r = { context, src, doc, worker: null, node: null, channels: null, timer: null, heartbeat: null, resolveReady, offset: now() - context.currentTime * 1000, lastSourceMs: -Infinity, afterMs: -Infinity, ready: false };
    resources = r;
    clear('loading');
    const fail = status => { if (mine !== generation) return; ear.detach(); clear(status); };
    r.boundary = () => {
      if (mine !== generation) return;
      r.afterMs = Math.max(r.afterMs, context.currentTime * 1000, r.lastSourceMs);
      r.offset = now() - context.currentTime * 1000;
      clear(doc?.hidden || context.state !== 'running' ? 'paused' : r.ready ? 'ready' : 'loading');
    };
    doc?.addEventListener?.('visibilitychange', r.boundary);
    context.addEventListener?.('statechange', r.boundary);
    r.timer = setTimeout(() => fail('failed'), READY_TIMEOUT_MS);
    try {
      const base = new URL(BASE, typeof window !== 'undefined' ? window.location.href : import.meta.url);
      r.worker = new Worker(new URL('dinga-chord-worker.mjs', base), { type: 'module' });
      r.worker.onerror = () => fail('failed');
      r.worker.onmessageerror = () => fail('failed');
      r.worker.onmessage = ({ data }) => {
        if (mine !== generation || resources !== r) return;
        if (data?.type === 'error') { fail('failed'); return; }
        if (data?.type === 'ready') { r.ready = true; clearTimeout(r.timer); r.timer = null; state.status = doc?.hidden || context.state !== 'running' ? 'paused' : 'ready'; r.resolveReady(true); notify(); return; }
        if (data?.type !== 'state' || !r.ready) return;
        if (doc?.hidden || context.state !== 'running') { r.boundary(); return; }
        const atMs = data.atMs, nowMs = data.nowMs, received = now(), sourceAt = r.offset + atMs;
        const audioNow=context.currentTime*1000;
        // Some desktop sleep paths freeze AudioContext time without a state event.
        // Rebase only on a current audio block, never on a delayed queued message;
        // discard this boundary observation and require new post-boundary evidence.
        if(Number.isFinite(atMs)&&Number.isFinite(nowMs)&&Math.abs(nowMs-audioNow)<=300&&Math.abs(r.offset+audioNow-received)>MAX_SOURCE_LAG_MS){r.boundary();return;}
        if (!Number.isFinite(atMs) || !Number.isFinite(nowMs) || nowMs < atMs || sourceAt > received + 100 || received - sourceAt > MAX_SOURCE_LAG_MS || received - (r.offset + nowMs) > MAX_SOURCE_LAG_MS || atMs <= r.afterMs || atMs < r.lastSourceMs) { clear('stale'); return; }
        if (atMs === r.lastSourceMs) return;
        const interrupted = !fresh() || received - state.receivedAt > FRESH_MS || sourceAt - state.sourceAt > FRESH_MS;
        r.lastSourceMs = atMs;
        const chord = typeof data.chord === 'string' && /^[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add|[0-9]|[:/+º#b-]){0,20}$/.test(data.chord) ? data.chord : '';
        if (chord !== state.chord || interrupted) state.since = chord ? sourceAt : 0;
        Object.assign(state, { status: 'ready', chord, sourceAt, receivedAt: received, floor: Number.isFinite(data.floor) ? data.floor : 0, level: Number.isFinite(data.level) ? data.level : 0 });
        state.candidate=typeof data.candidate==='string'&&/^[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add|[0-9]|[:/+º#b-]){0,20}$/.test(data.candidate)?data.candidate:'';
        for(const key of['gate','sustained','currentSustained'])state[key]=Number.isFinite(data[key])&&data[key]>=0?data[key]:0;
        notify();
      };
      await Promise.race([context.audioWorklet.addModule(new URL('chord-processor.mjs', base)), ready.then(ok => { if (!ok) throw Error('attachment_cancelled'); })]);
      if (mine !== generation || resources !== r) return false;
      // Downmix microphone channels; discrete mono would discard the right input.
      r.node = new AudioWorkletNode(context, 'chord-processor', { channelCount: 1, channelCountMode: 'explicit', channelInterpretation: 'speakers' });
      r.node.onprocessorerror = () => fail('failed');
      const { port1, port2 } = new MessageChannel(); r.channels = [port1, port2];
      // Stability is enforced on source observations; extra decoding lookback
      // prevented 0.8s chords at 60BPM from ever reaching that same threshold.
      r.worker.postMessage({ type: 'start', sampleRate: context.sampleRate, delayMs: 0, port: port1 }, [port1]);
      r.node.port.postMessage({ type: 'port', port: port2 }, [port2]);
      src.connect(r.node); r.node.connect(context.destination);
      r.heartbeat = setInterval(() => { if (mine === generation && state.status === 'ready' && state.receivedAt > 0 && !fresh()) clear('stale'); }, 100);
      return await ready;
    } catch { fail('failed'); return false; }
  },
  detach() {
    generation++;
    const r = resources; resources = null;
    if (r) {
      clearTimeout(r.timer); clearInterval(r.heartbeat); r.resolveReady(false);
      r.doc?.removeEventListener?.('visibilitychange', r.boundary); r.context.removeEventListener?.('statechange', r.boundary);
      try { r.node?.port.postMessage({ type: 'stop' }); } catch {}
      try { if (r.node) r.src.disconnect(r.node); } catch {}
      try { r.node?.disconnect(); r.node?.port.close(); } catch {}
      try { r.worker?.terminate(); } catch {}
      for (const port of r.channels || []) { try { port.close(); } catch {} }
    }
    clear('off');
  },
};
if (typeof window !== 'undefined') window.dingaEar = ear;
