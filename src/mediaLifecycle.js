export function mediaStreamIsLive(stream) {
  const tracks = stream?.getTracks?.() || [];
  return tracks.length > 0 && tracks.every((track) => track.readyState === 'live' && !track.muted);
}

export function observeMediaStream(stream, onLoss) {
  let active = true;
  const lost = () => { if (active) onLoss(); };
  const tracks = stream?.getTracks?.() || [];
  for (const track of tracks) { track.addEventListener?.('ended', lost); track.addEventListener?.('mute', lost); }
  stream?.addEventListener?.('inactive', lost);
  return () => {
    active = false;
    for (const track of tracks) { track.removeEventListener?.('ended', lost); track.removeEventListener?.('mute', lost); }
    stream?.removeEventListener?.('inactive', lost);
  };
}

export function createWakeLockController({ request, isVisible }) {
  let wanted = false; let current = null; let pending = null; let generation = 0;
  const release = async (lock) => { try { if (lock) await lock.release(); } catch {} };
  const refresh = () => {
    if (!wanted || !isVisible() || current || pending) return pending?.promise || Promise.resolve();
    const job = { generation }; pending = job;
    job.promise = (async () => {
      try {
        const lock = await request();
        if (!lock) return;
        if (job.generation !== generation || !wanted || !isVisible()) { await release(lock); return; }
        if (lock.released) return;
        current = lock;
        lock.addEventListener?.('release', () => { if (current === lock) current = null; }, { once: true });
      } catch {} finally { if (pending === job) pending = null; }
    })();
    return job.promise;
  };
  const suspend = async () => {
    generation += 1; pending = null;
    const old = current; current = null;
    await release(old);
  };
  return {
    refresh, suspend,
    setActive(value) {
      if (!value) { wanted = false; return suspend(); }
      if (!wanted) { wanted = true; generation += 1; }
      return refresh();
    },
  };
}
