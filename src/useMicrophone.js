import { useCallback, useEffect, useRef, useState } from 'react';
import { mic } from './lib.js';

// 건너뛰거나 화면을 나간 뒤 도착한 권한 응답은 현재 선택을 덮어쓰지 않는다.
export function useMicrophone(enabled = true) {
  const [micOn, setMicOn] = useState(mic.state === 'on' ? true : null);
  const generation = useRef(0);
  const [attempt, setAttempt] = useState(0);
  const [inputLost, setInputLost] = useState(false);
  const [requesting, setRequesting] = useState(false);
  useEffect(() => {
    if (!enabled) return undefined;
    const request = ++generation.current;
    setRequesting(true);
    const unsubscribe = mic.subscribe((state) => {
      if (generation.current !== request) return;
      if (state === 'interrupted') { setMicOn(null); setInputLost(true); setRequesting(false); }
    });
    mic.start().then((ok) => {
      if (generation.current !== request) return;
      setRequesting(false);
      if (mic.state === 'interrupted') { setMicOn(null); setInputLost(true); }
      else setMicOn(ok);
    });
    return () => { generation.current += 1; unsubscribe(); };
  }, [enabled, attempt]);
  const skipMic = useCallback(() => {
    generation.current += 1;
    mic.stop();
    setMicOn(false);
    setInputLost(false); setRequesting(false);
  }, []);
  const retryMic = useCallback(() => {
    generation.current += 1; mic.stop(); mic.prime();
    setMicOn(null); setRequesting(true); setAttempt((value) => value + 1);
  }, []);
  const acknowledgeMic = useCallback(() => { if (mic.state !== 'on') return false; setInputLost(false); return true; }, []);
  return { micOn, skipMic, inputLost, requesting, retryMic, acknowledgeMic };
}
