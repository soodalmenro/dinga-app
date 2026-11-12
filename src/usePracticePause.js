import { useCallback, useEffect, useRef, useState } from 'react';

export function usePracticePause(active = true) {
  const [paused, setPaused] = useState(false);
  const pauseRef = useRef(false);
  const pausedAt = useRef(null);
  useEffect(() => {
    if (!active) return undefined;
    const onVisibility = () => {
      if (document.hidden) { pauseRef.current = true; pausedAt.current = Date.now(); setPaused(true); }
    };
    document.addEventListener('visibilitychange', onVisibility);
    onVisibility();
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [active]);
  const resume = useCallback(() => {
    if (document.hidden) return;
    pauseRef.current = false;
    pausedAt.current = null;
    setPaused(false);
  }, []);
  return { paused, pauseRef, pausedAt, resume };
}
