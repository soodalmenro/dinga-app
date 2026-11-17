// Dinga modification of chordino.js 0.6.0 live worker, GPL-2.0-or-later.
// Emits every current observation, including silence, rather than chord changes only.
import createChordino from './chordino.mjs';
const BLOCK = 4096, SLICE = 512, WINDOW_MS = 10000, FLOOR_RISE_PER_BLOCK = 1.0005;
let session = null, modulePromise = null;
onmessage = async ({ data }) => {
  if (data?.type === 'start') await start(data);
  else if (data?.type === 'stop') { close(); postMessage({ type: 'stopped' }); }
};
function close() {
  const current = session; session = null;
  if (!current) return;
  current.port.onmessage = null; current.port.close();
  if (current.module) { if (current.instance) current.module.releasePlugin(current.instance); if (current.pointer) current.module._free(current.pointer); }
}
async function start({ port, sampleRate, delayMs = 0 }) {
  close();
  if (!port?.postMessage || !Number.isFinite(sampleRate) || sampleRate < 8000 || !Number.isFinite(delayMs) || delayMs < 0) { postMessage({ type: 'error', message: 'invalid_start' }); return; }
  const current = { port, sampleRate, delayMs, module: null, instance: 0, pointer: 0, slices: [], lastEnd: -Infinity, quiet: null };
  session = current;
  try {
    modulePromise ??= createChordino().catch(error => { modulePromise = null; throw error; });
    const module = await modulePromise;
    if (session !== current) return;
    current.module = module;
    current.pointer = module._malloc(BLOCK * Float32Array.BYTES_PER_ELEMENT);
    current.instance = module.initializePlugin(sampleRate, BLOCK, true);
    if (!current.instance || !current.pointer) throw Error('model_initialization');
    port.onmessage = ({ data }) => {
      if (session !== current) return;
      try { receive(current, data?.blocks); }
      catch (error) { close(); postMessage({ type: 'error', message: String(error?.message ?? error) }); return; }
      if (session === current) port.postMessage({ type: 'idle' });
    };
    postMessage({ type: 'ready' });
  } catch (error) { if (session !== current) return; close(); postMessage({ type: 'error', message: String(error?.message ?? error) }); }
}
function quantile(values, q) { if (!values.length) return 0; const sorted = [...values].sort((a,b) => a-b); return sorted[Math.floor(q * (sorted.length - 1))]; }
function receive(current, blocks) {
  if (!Array.isArray(blocks) || !blocks.length || blocks.length > 128) throw Error('invalid_blocks');
  const { module, instance, pointer, sampleRate, slices } = current;
  let level = 0;
  for (const { samples, startMs, nowMs } of blocks) {
    if (!(samples instanceof Float32Array) || samples.length !== BLOCK || !Number.isFinite(startMs) || !Number.isFinite(nowMs) || startMs < current.lastEnd - 2 || nowMs < startMs - 10) throw Error('invalid_source');
    let total = 0;
    for (let offset = 0; offset < samples.length; offset += SLICE) {
      const end = Math.min(offset + SLICE, samples.length); let sum = 0;
      for (let i = offset; i < end; i++) { if (!Number.isFinite(samples[i])) throw Error('invalid_pcm'); sum += samples[i] * samples[i]; }
      total += sum;
      slices.push({ startMs: startMs + offset / sampleRate * 1000, rms: Math.sqrt(sum / (end-offset)) });
    }
    level = Math.sqrt(total / samples.length);
    current.lastEnd = startMs + samples.length / sampleRate * 1000;
    module.HEAPF32.set(samples, pointer >> 2);
    module.processBuffer(instance, pointer, Math.trunc(startMs));
  }
  const nowMs = Math.max(blocks.at(-1).nowMs, current.lastEnd);
  while (slices.length && slices[0].startMs < nowMs - WINDOW_MS) slices.shift();
  module.forgetBefore(instance, nowMs - WINDOW_MS);
  const chords = module.getPartialResult(instance);
  const atMs = Math.max(0, (chords.at(-1)?.time ?? 0) * 1000 - current.delayMs);
  const found = chords.slice(0,-1).findLast(entry => entry.time * 1000 <= atMs);
  // Room-noise floor. The 10 s window alone is not enough: after a few seconds of
  // continuous strumming it contains only guitar, so its low quantile becomes the
  // decaying chord itself and 3x that "floor" muted every quiet-but-real chord.
  // Keep the quietest level heard so far and let it rise only slowly (about x2 per
  // two minutes) so sustained playing is never mistaken for background noise.
  const windowFloor = quantile(slices.map(s => s.rms), .1);
  current.quiet = current.quiet === null ? windowFloor : Math.min(windowFloor, Math.max(.0005 / 3, current.quiet) * FLOOR_RISE_PER_BLOCK ** blocks.length);
  const floor = current.quiet;
  const gate = Math.min(.008, Math.max(.0005, floor * 3));
  const sustained = quantile(slices.filter(s => Math.abs(s.startMs - atMs) <= 200).map(s => s.rms), .25);
  const currentSustained = quantile(slices.filter(s => s.startMs >= nowMs - 200).map(s => s.rms), .25);
  const ringing = sustained >= gate && currentSustained >= gate;
  const chord = found && found.chord !== 'N' && ringing ? found.chord : '';
  postMessage({ type: 'state', chord, chordStartMs: chord ? found.time * 1000 : 0, atMs, nowMs, level, floor, sustained, currentSustained, gate, candidate: found?.chord || '' });
}

