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

export function SongPosture({ active }) {
  const remaining = useRef(5000);
  const fired = useRef(false);
  const stream = useRef(null);
  const cameraTimeout = useRef(null);
  const [visible, setVisible] = useState(false);
  const [cam, setCam] = useState('off');
  const [previewReady, setPreviewReady] = useState(false);
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
    setCam('loading');
    setPreviewReady(false);
    const timer = setTimeout(() => {
      closed = true;
      stop(stream.current);
      stream.current = null;
      setCam('failed');
    }, 15000);
    cameraTimeout.current = timer;
    Promise.resolve().then(() => navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false})).then(media => {
      if (closed) return stop(media);
      stream.current = media;
      setCam('on');
    }).catch(() => { if (!closed) { clearTimeout(timer); setCam('failed'); } });
    return () => {
      closed = true;
      clearTimeout(timer);
      stop(stream.current);
      stream.current = null;
    };
  }, [active, visible]);
  useEffect(() => {
    if (!visible || !active || (!previewReady && cam !== 'failed')) return;
    const timer = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(timer);
  }, [visible, active, previewReady, cam]);
  if (!active || !visible) return null;
  return <><div className="palert" role="status"><i>?</i><div><b>{postureCopy('wrist', 'timed').title}</b><small>{cam === 'failed' ? '카메라 없이 문구로만 알려요' : previewReady ? postureCopy('wrist', 'timed').text : '카메라를 준비하고 있어요'}</small></div></div>
    {cam === 'on' && <PostureCoach place="center" stream={stream} cam={cam} kind="wrist" onReady={() => { clearTimeout(cameraTimeout.current); setPreviewReady(true); }} />}</>;
}
