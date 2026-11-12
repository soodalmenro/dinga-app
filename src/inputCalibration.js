const valid = (values) => Array.isArray(values) && values.every((v) => Number.isFinite(v) && v >= 0 && v <= 1);
export function inputDeviceKey(settings = {}) {
  if (!settings.deviceId || (['default', 'communications'].includes(settings.deviceId) && !settings.groupId)) return null;
  return `${settings.deviceId}:${settings.groupId || ''}`;
}
export function deriveInputCalibration(noise, signal, base = 0.05) {
  if (!valid(noise) || !valid(signal)) return { ok: false, reason: 'invalid' };
  if (noise.length < 30 || signal.length < 30) return { ok: false, reason: 'samples' };
  const sorted = [...noise].sort((a, b) => a - b);
  const floor = sorted[Math.ceil(sorted.length * 0.95) - 1];
  const peak = Math.max(...signal);
  const threshold = Math.max(base, floor * 2.5 + 0.01);
  if (peak >= 0.95) return { ok: false, reason: 'clipping' };
  if (threshold > 0.15) return { ok: false, reason: 'noise' };
  if (peak < threshold * 1.8 || signal.filter((v) => v > threshold).length < 2) return { ok: false, reason: 'signal' };
  return { ok: true, threshold, floor, peak };
}

// Memory-only, bounded session profiles. Identity-less streams never share profiles across captures.
export function createInputProfiles() {
  let profile = null;
  return {
    apply(result, identity, now = Date.now()) {
      if (!result.ok || !Number.isFinite(result.threshold) || result.threshold < 0.05 || result.threshold > 0.15) return false;
      profile = { threshold: result.threshold, deviceId: identity.deviceId || null, generation: identity.generation, expires: now + 600000 };
      return true;
    },
    threshold(base, identity, now = Date.now()) {
      if (!profile) return base;
      if (now >= profile.expires) { profile = null; return base; }
      const matches = profile.deviceId ? profile.deviceId === identity.deviceId : !identity.deviceId && profile.generation === identity.generation;
      return matches ? Math.max(base, profile.threshold) : base;
    },
    clear() { profile = null; },
  };
}
