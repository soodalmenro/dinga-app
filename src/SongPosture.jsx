import React, { useEffect, useRef, useState } from 'react';
import { content, sfx } from './lib.js';
import wristFix from './img/posture-wrist.svg';

export function PostureCoach({ stream, cam, kind }) {
  const v = useRef(null);
  useEffect(() => { if (v.current && stream.current) { v.current.srcObject = stream.current; v.current.play().catch(() => {}); } }, [cam]);
  // 피그마에 그려진 교정 그림은 손목 한 가지다(209:59, 캡션 포함). 다른 부위는 문구만 보여 준다.
  const drawn = kind === 'wrist' || kind === 'all';
  return (
    <div className="pip coach" aria-hidden="true">
      <div className="pip-cam">{cam === 'on' ? <video ref={v} playsInline muted /> : null}<span>내 모습</span></div>
      <div className="pip-fix">{drawn ? <img src={wristFix} alt={content.liveFixes.wrist} /> : <b>{content.liveFixes[kind]}</b>}</div>
    </div>
  );
}

export function SongPosture({ active }) {
  const remaining = useRef(5000);
  const fired = useRef(false);
  const stream = useRef(null);
  const [visible, setVisible] = useState(false);
  const [cam, setCam] = useState('off');
  useEffect(() => {
    if (!active || fired.current) return;
    const start = performance.now();
    const timer = setTimeout(() => {
      fired.current = true;
      setVisible(true);
      sfx.alert();
    }, remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (performance.now() - start));
    };
  }, [active]);
  useEffect(() => {
    if (!active) setVisible(false);
    if (!visible || !active) return;
    let closed = false;
    const stop = media => media?.getTracks().forEach(track => track.stop());
    const timer = setTimeout(() => setVisible(false), 3000);
    navigator.mediaDevices?.getUserMedia({video:{facingMode:'user'},audio:false}).then(media => {
      if (closed) return stop(media);
      stream.current = media;
      setCam('on');
    }).catch(() => {});
    return () => {
      closed = true;
      clearTimeout(timer);
      stop(stream.current);
      stream.current = null;
    };
  }, [active, visible]);
  if (!active || !visible) return null;
  return <><div className="palert" role="status">손목을 편하게 펴 보세요</div>
    {cam === 'on' && <PostureCoach stream={stream} cam={cam} kind="wrist" />}</>;
}
