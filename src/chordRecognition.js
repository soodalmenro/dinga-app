// Feature-vector guardrails, pending real-guitar calibration. These are not probabilities.
export const CHORD_CLASSIFIER_VERSION = 'chroma-guard-v1';
export const CHORD_LIMITS = Object.freeze({ support: 0.85, margin: 0.12, tone: 0.08 });

export function analyzeChord(chroma, chordNotes) {
  const abstain = (reason, support = 0, margin = 0) => ({ chord: null, reason, support, margin, version: CHORD_CLASSIFIER_VERSION });
  if ((!Array.isArray(chroma) && !(chroma instanceof Float32Array) && !(chroma instanceof Float64Array))
    || chroma.length !== 12 || !Array.from(chroma).every((v) => Number.isFinite(v) && v >= 0)) return abstain('invalid');
  // Normalize by the maximum first to avoid overflow with finite, large magnitudes.
  const peak = Math.max(...chroma);
  if (!peak) return abstain('silence');
  const normalized = Array.from(chroma, (v) => v / peak);
  const total = normalized.reduce((sum, v) => sum + v, 0);
  const energy = normalized.map((v) => v / total);
  const ranked = Object.entries(chordNotes).map(([chord, tones]) => ({
    chord, tones, support: tones.reduce((sum, tone) => sum + energy[tone], 0),
  })).sort((a, b) => b.support - a.support);
  if (!ranked.length) return abstain('invalid');
  const best = ranked[0]; const margin = best.support - (ranked[1]?.support || 0);
  if (best.support < CHORD_LIMITS.support) return abstain('off-chord', best.support, margin);
  if (margin < CHORD_LIMITS.margin) return abstain('ambiguous', best.support, margin);
  if (best.tones.some((tone) => energy[tone] < CHORD_LIMITS.tone)) return abstain('missing-tones', best.support, margin);
  return { chord: best.chord, reason: 'recognized', support: best.support, margin, version: CHORD_CLASSIFIER_VERSION };
}
