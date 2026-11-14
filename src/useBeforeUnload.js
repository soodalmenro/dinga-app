import { useEffect, useRef } from 'react';

// Secondary protection only: OS termination may skip this event entirely.
export function useBeforeUnload(enabled, onInterrupt) {
  const active = useRef(enabled); active.current = enabled;
  const interrupt = useRef(onInterrupt); interrupt.current = onInterrupt;
  useEffect(() => {
    if (!enabled) return undefined;
    const pending = new Set();
    const warn = (event) => {
      if (!active.current) return;
      const resume = interrupt.current?.();
      if (resume) {
        const timer = setTimeout(() => { pending.delete(timer); resume(); }, 0);
        pending.add(timer);
      }
      event.preventDefault();
      event.returnValue = true;
    };
    window.addEventListener('beforeunload', warn);
    return () => { window.removeEventListener('beforeunload', warn); pending.forEach(clearTimeout); };
  }, [enabled]);
}
