import React, { useEffect, useRef, useState } from 'react';
import { content, sfx } from './lib.js';
import { PostureCompare, postureCopy } from './PostureReminder.jsx';

// 자세 알림 3초 동안 뜨는 비교 창: 위는 바른 자세 사진, 아래는 내 모습(같은 고정 선).
// place: 'stage' = 캐릭터 자리(레슨 연주 단계), 'center' = 화면 가운데(곡 연습)
export function PostureCoach({ stream, cam, kind, onReady, place = 'stage' }) {
  const v = useRef(null);
  useEffect(() => { if (v.current && stream.current) { v.current.srcObject = stream.current; v.current.play().catch(() => {}); } }, [cam]);
  return <PostureCompare video={v} kind={kind} cam={cam} place={place} onReady={onReady} />;
}

// 곡 연습 중 자세 알림: 연주 5초 뒤 한 번, 문구 + 진동 1번을 3초(미니카메라 삭제, 11/18). 일시정지 시간은 빼고 센다
export function SongPosture({ active }) {
  const remaining = useRef(5000);
  const fired = useRef(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!active || fired.current) return undefined;
    const start = performance.now();
    const timer = setTimeout(() => { fired.current = true; setVisible(true); sfx.alert(); }, remaining.current);
    return () => { clearTimeout(timer); remaining.current = Math.max(0, remaining.current - (performance.now() - start)); };
  }, [active]);
  useEffect(() => {
    if (!active) { setVisible(false); return undefined; }
    if (!visible) return undefined;
    const timer = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(timer);
  }, [visible, active]);
  if (!active || !visible) return null;
  const copy = postureCopy('wrist', 'timed');
  return <div className="palert" role="status"><i>?</i><div><b>{copy.title}</b><small>{copy.text}</small></div></div>;
}
