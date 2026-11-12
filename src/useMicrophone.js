import { useCallback, useEffect, useRef, useState } from 'react';
import { mic } from './lib.js';

// 건너뛰거나 화면을 나간 뒤 도착한 권한 응답은 현재 선택을 덮어쓰지 않는다.
export function useMicrophone(enabled = true) {
  const [micOn, setMicOn] = useState(mic.state === 'on' ? true : null);
  const generation = useRef(0);
  useEffect(() => {
    if (!enabled) return undefined;
    const request = ++generation.current;
    mic.start().then((ok) => {
      if (generation.current === request) setMicOn(ok);
    });
    return () => { generation.current += 1; };
  }, [enabled]);
  const skipMic = useCallback(() => {
    generation.current += 1;
    mic.stop();
    setMicOn(false);
  }, []);
  return { micOn, skipMic };
}
