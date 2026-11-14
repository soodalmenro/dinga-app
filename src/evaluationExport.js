export const LOG_LIMIT = 4000;
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, max = 200) => typeof value === 'string' && value.length <= max && !/^\s*(data:|blob:)/i.test(value);
const chord = (value) => ['Em', 'G', 'C'].includes(value);
const reasons = ['recognized', 'off-chord', 'ambiguous', 'missing-tones', 'silence', 'invalid', 'insufficient-window', 'simulated', 'no-microphone', 'no-onset', 'unavailable'];
const validBundle = (value) => typeof value === 'string' && /^\/assets\/[a-zA-Z0-9_.-]+\.js$/.test(value);
export function currentEvaluationBundle() {
  try {
    const script = globalThis.document?.querySelector('script[type="module"][src]');
    const path = script ? new URL(script.src, globalThis.location?.href).pathname : null;
    return validBundle(path) ? path : null;
  } catch { return null; }
}
const scalarFields = ['route', 'lesson', 'part', 'step', 'kind', 'seconds', 'saved', 'where', 'mode', 'how', 'value', 'status', 'wristVisible', 'shoulderVisible', 'tempo', 'played', 'score', 'beatAcc', 'chordAcc', 'judge', 'pair', 'bars', 'mic', 'heard', 'method', 'from', 'mood', 'wrist', 'thumb', 'shoulder', 'ok', 'reason', 'complete'];

function diagnostics(values) {
  if (!Array.isArray(values)) return undefined;
  return values.slice(0, 12).filter((v) => record(v) && Number.isInteger(v.index) && v.index >= 1 && v.index <= 12
    && chord(v.expected) && ['ok', 'late', 'none', 'unmeasured'].includes(v.t) && [true, false, null].includes(v.c)).map((v) => ({
    index: v.index, expected: v.expected, t: v.t, c: v.c,
    detectedChord: chord(v.detectedChord) ? v.detectedChord : null,
    reason: reasons.includes(v.reason) ? v.reason : 'unavailable',
    classifier: typeof v.classifier === 'string' && /^[a-z0-9-]{1,60}$/.test(v.classifier) ? v.classifier : null,
  }));
}

export function songDiagnostics(results, expected, judge) {
  return diagnostics(results.map((r, i) => ({
    index: i + 1, expected: expected[i], t: r.t, c: r.c, detectedChord: r.detectedChord,
    reason: judge !== 'mic' ? 'simulated' : r.t === 'unmeasured' ? 'no-microphone' : r.t === 'none' ? 'no-onset' : r.reason,
    classifier: r.classifier,
  })));
}

function cleanEvent(event) {
  if (!record(event) || !text(event.type, 80) || !event.type || typeof event.t !== 'string' || !Number.isFinite(Date.parse(event.t))) return null;
  const result = { t: event.t, pid: typeof event.pid === 'string' ? event.pid : '', type: event.type };
  if (validBundle(event.bundle)) result.bundle = event.bundle;
  for (const key of scalarFields) {
    const value = event[key];
    if (value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)) || text(value)) result[key] = value;
  }
  if (event.type === 'songplay_end') {
    if (typeof event.fromLesson === 'boolean') result.fromLesson = event.fromLesson;
    if (Number.isSafeInteger(event.creditedSeconds) && event.creditedSeconds >= 0) result.creditedSeconds = event.creditedSeconds;
  }
  if (event.type === 'camera_failed' && ['preview', 'capture'].includes(event.stage)) result.stage = event.stage;
  if (record(event.coverage)) {
    const c = event.coverage;
    if (['played', 'total', 'evaluated', 'uncertain'].every((key) => Number.isInteger(c[key]) && c[key] >= 0)
      && c.played <= c.total && c.evaluated + c.uncertain <= c.played) {
      result.coverage = Object.fromEntries(['played', 'total', 'evaluated', 'uncertain'].map((key) => [key, c[key]]));
    }
  }
  if (Array.isArray(event.diagnostics)) result.diagnostics = diagnostics(event.diagnostics);
  return result;
}

export function buildEvaluationExport(events, options = {}) {
  options = record(options) ? options : {};
  const source = Array.isArray(events) ? events : [];
  const scope = options.scope === 'all' ? 'all' : 'participant';
  const pid = typeof options.pid === 'string' ? options.pid : '';
  const selected = source.filter((event) => scope === 'all' || (record(event) && (typeof event.pid === 'string' ? event.pid : '') === pid));
  const clean = selected.map(cleanEvent).filter(Boolean);
  const types = new Map(); clean.forEach((event) => types.set(event.type, (types.get(event.type) || 0) + 1));
  const settings = options.settings || {}; const environment = options.environment || {};
  const settingsAtExport = {};
  for (const [key, allowed] of Object.entries({ variant: ['idea', 'prd'], judge: ['mic', 'allok', 'hard', 'random'], posture: ['sim', 'self'], alert: ['auto', 'real', 'manual', 'off'] })) {
    if (allowed.includes(settings[key])) settingsAtExport[key] = settings[key];
  }
  if (Number.isFinite(settings.speed) && settings.speed > 0) settingsAtExport.speed = settings.speed;
  if (Number.isInteger(settings.dayShift)) settingsAtExport.dayShift = settings.dayShift;
  const safeEnvironment = {};
  if (text(environment.userAgent, 500)) safeEnvironment.userAgent = environment.userAgent;
  for (const key of ['secureContext', 'clipboard', 'mediaDevices']) if (typeof environment[key] === 'boolean') safeEnvironment[key] = environment[key];
  const date = new Date(typeof options.exportedAt === 'string' || typeof options.exportedAt === 'number' ? options.exportedAt : Date.now());
  return {
    schemaVersion: 1, exportedAt: Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString(),
    scope, participant: scope === 'participant' ? pid : null,
    app: { name: 'dinga', bundle: validBundle(options.bundle) ? options.bundle : null },
    environment: safeEnvironment, settingsAtExport,
    retention: { limit: LOG_LIMIT, mayBeTruncated: source.length >= LOG_LIMIT, storage: ['memory', 'local', 'unavailable'].includes(options.logStorage) ? options.logStorage : 'unknown' },
    summary: { eventCount: clean.length, invalidEvents: selected.length - clean.length, participantCount: new Set(clean.map((event) => event.pid)).size, unversionedEvents: clean.filter((event) => !event.bundle).length,
      firstEventAt: clean[0]?.t || null, lastEventAt: clean[clean.length - 1]?.t || null, types: Object.fromEntries(types) },
    events: clean,
  };
}

export function evaluationFilename(report) {
  const who = report.scope === 'all' ? 'all' : String(report.participant || 'unassigned').normalize('NFKC').replace(/[^\p{L}\p{N}_-]/gu, '_').slice(0, 40);
  const time = String(report.exportedAt).replace(/[^0-9TZ]/g, '').slice(0, 16);
  return `dinga-evaluation-${who}-${time}.json`;
}

export async function copyEvaluationText(value, clipboard, timeoutMs = 2000) {
  if (!clipboard || typeof clipboard.writeText !== 'function') return { ok: false, reason: 'unavailable' };
  let timer;
  try {
    return await Promise.race([
      Promise.resolve(clipboard.writeText(value)).then(() => ({ ok: true })),
      new Promise((resolve) => { timer = setTimeout(() => resolve({ ok: false, reason: 'timeout' }), timeoutMs); }),
    ]);
  } catch { return { ok: false, reason: 'denied' }; }
  finally { clearTimeout(timer); }
}

export function downloadEvaluation(report) {
  const filename = evaluationFilename(report);
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.hidden = true;
  try { document.body.appendChild(link); link.click(); }
  finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
  return filename;
}
