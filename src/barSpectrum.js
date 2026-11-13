// Allocate evidence to one bar only and exclude the analyser's pre-onset window.
export function createBarSpectrum() {
  const bars = new Map();
  return {
    sample({ bar, at, barStart, firstOnset, settleMs, level, threshold, chroma }) {
      if (!Number.isInteger(bar) || bar < 0 || ![at, barStart, firstOnset, settleMs, level, threshold].every(Number.isFinite)
        || settleMs < 0 || at < Math.max(barStart, firstOnset) + settleMs) return false;
      const previous = bars.get(bar);
      if (previous && (at <= previous.lastAt || level <= threshold)) return false;
      const values = chroma();
      if (!values || values.length !== 12 || !Array.from(values).every((v) => Number.isFinite(v) && v >= 0)) return false;
      const entry = previous || { chroma: new Array(12).fill(0), samples: 0, lastAt: -Infinity };
      for (let i = 0; i < 12; i += 1) entry.chroma[i] += values[i];
      entry.samples += 1; entry.lastAt = at; bars.set(bar, entry); return true;
    },
    take(bar) {
      const entry = bars.get(bar); bars.delete(bar);
      return entry ? { chroma: entry.chroma, samples: entry.samples } : { chroma: new Array(12).fill(0), samples: 0 };
    },
    clear() { bars.clear(); },
  };
}
