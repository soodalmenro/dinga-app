const assert = require('node:assert/strict');
const fixtures = require('./fixtures/chord-vectors.json');
const notes = require('../src/content.json').chordNotes;

// Frozen legacy decision, for feature-vector comparison only; not a ground-truth recognizer.
function legacy(chroma) {
  const total = chroma.reduce((a, b) => a + b, 0);
  if (!total) return null;
  let winner = null; let top = -1;
  for (const [name, tones] of Object.entries(notes)) {
    const support = tones.reduce((sum, tone) => sum + chroma[tone], 0) / total;
    if (support > top) { top = support; winner = name; }
  }
  return winner;
}

(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { middlewareMode: true } });
  try {
    const { guessChord } = await server.ssrLoadModule('/src/lib.js');
    let failures = 0;
    for (const fixture of fixtures) {
      const chroma = Array.from({ length: 12 }, (_, i) => fixture.bins[i] || 0);
      const actual = guessChord(chroma);
      const pass = actual === fixture.expected;
      console.log(`${pass ? 'PASS' : 'FAIL'} ${fixture.id}: legacy=${legacy(chroma)} current=${actual} expected=${fixture.expected}`);
      if (!pass) failures += 1;
      if (fixture.expected) {
        for (const scale of [1e-12, 0.1, 10, 1e12]) assert.equal(guessChord(chroma.map((v) => v * scale)), fixture.expected, fixture.id + ' scale invariance');
      }
    }
    for (const invalid of [null, [], new Array(11).fill(1), new Array(12).fill(NaN), new Array(12).fill(Infinity), new Array(12).fill(-1)]) {
      let actual;
      try { actual = guessChord(invalid); } catch { actual = 'threw'; }
      if (actual !== null) { failures += 1; console.log('FAIL invalid input must abstain, got', actual); }
    }
    const em = Array.from({ length: 12 }, (_, i) => [4, 7, 11].includes(i) ? 1 : 0);
    assert.equal(guessChord(new Float32Array(em)), 'Em');
    assert.equal(guessChord(new Float64Array(em)), 'Em');
    assert.equal(guessChord(em.map((v) => v * Number.MAX_VALUE)), 'Em');
    assert.equal(failures, 0, 'synthetic replay contract failures');
    console.log(`PASS ${fixtures.length} synthetic vectors, invalid inputs and gain scaling. This is not measured guitar accuracy.`);
  } finally { await server.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
