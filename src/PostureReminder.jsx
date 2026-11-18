// 자세 안내(판정 없음): 연주를 시작하고 5초 뒤, 알림 한 줄 · 진동 1번과 함께
// "바른 자세 사진 + 내 모습"을 같은 고정 선과 함께 3초 보여 준다. 각도를 재지 않고, 연주자가 스스로 비교해 고친다.
// 레슨 연주 단계(Lesson.jsx)와 곡 연습(SongPosture.jsx)이 같이 쓴다. 비교 창은 캐릭터 자리에 뜬다(곡 연습은 화면 가운데).
import React from 'react';
import { content } from './lib.js';
import wristFix from './img/posture-wrist.svg';
import thumbFix from './img/posture-thumb.svg';
import shoulderFix from './img/posture-shoulder.svg';
import refFront from './img/posture-ref-front.jpg';

const FIX = { wrist: wristFix, all: wristFix, thumb: thumbFix, shoulder: shoulderFix };

// 바른 자세 그림. 그림이 없는 부위는 문구만 보여 준다
export function PostureFix({ kind }) {
  const src = FIX[kind];
  return src ? <img src={src} alt={content.liveFixes[kind] || ''} /> : <b>{content.liveFixes[kind]}</b>;
}

// 바른 자세 참고 사진: 어쿠스틱 체이서 「통기타를 연주하는 바른 자세」(acousticchaser.tistory.com/151, 사용 허락 받음)의
// "왼손을 앞으로 내밀어 준다" 사진. 내 카메라가 거울처럼 보이므로 사진도 좌우를 뒤집어 잘라 두었다(876×392).
export const REF = { w: 876, h: 392, src: refFront };
// 사진 위 고정 선(사진 픽셀 좌표). 내 카메라 위에도 같은 선을 같은 자리에 얹는다. 관절을 찾아 그리는 선이 아니다
export const REF_LINES = {
  shoulder: [[241, 135], [806, 120]],
  wrist: [[241, 135], [146, 470], [146, 355], [81, 245]],
  thumb: [[131, 245], [121, 185]],
};
export const REF_HOLE_Y = 335; // 사운드홀 높이: 왼손은 이 선보다 위

const pts = (a) => a.map((p) => p.join(',')).join(' ');
// 고정 선 묶음. kind 부위는 노란색으로 강조, tone을 주면 부위별 색(결과 화면)
export function RefLines({ kind = 'all', tone, sw = 7, hole = true }) {
  const focus = kind === 'all' ? 'wrist' : kind;
  const col = (k) => (tone ? tone(k) : k === focus ? '#FFC53D' : '#fff');
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {hole && <path d={`M0 ${REF_HOLE_Y}H${REF.w}`} stroke="#FFC53D" strokeWidth={sw * 0.6} strokeDasharray={`${sw * 2.2} ${sw * 1.6}`} />}
      {['shoulder', 'wrist', 'thumb'].map((k) => (
        <g key={k}>
          <polyline points={pts(REF_LINES[k])} stroke="rgba(0,0,0,0.35)" strokeWidth={(k === focus ? sw * 1.5 : sw) + sw * 0.6} />
          <polyline points={pts(REF_LINES[k])} stroke={col(k)} strokeWidth={k === focus ? sw * 1.5 : sw} />
          {REF_LINES[k].map(([x, y]) => <circle key={`${x},${y}`} cx={x} cy={y} r={sw * 1.4} fill={col(k)} stroke="none" />)}
        </g>
      ))}
    </g>
  );
}

// 바른 자세 사진 + 고정 선 (한 칸)
export function RefPhoto({ kind = 'all', label = '바른 자세', className = '' }) {
  return (
    <div className={`cmp-pane ${className}`}>
      <img src={REF.src} alt={content.liveFixes[kind] || content.liveFixes.all || ''} />
      <svg viewBox={`0 0 ${REF.w} ${REF.h}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true"><RefLines kind={kind} /></svg>
      <span>{label}</span>
    </div>
  );
}

// 알림과 함께 3초 뜨는 비교 창: 위는 바른 자세 사진, 아래는 내 모습. 둘 다 같은 자리에 같은 선
export function PostureCompare({ video, kind = 'all', cam = 'on', place = 'stage', onReady }) {
  return (
    <div className={`coach coach-card cmp ${place}`} aria-hidden="true">
      <RefPhoto kind={kind} />
      <div className="cmp-pane me">
        {cam === 'on' ? <video ref={video} playsInline muted onLoadedData={onReady} /> : null}
        <svg viewBox={`0 0 ${REF.w} ${REF.h}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true"><RefLines kind={kind} /></svg>
        <span>내 모습</span>
      </div>
    </div>
  );
}

// 알림 문구. 실제 판정으로 뜬 알림만 "꺾였어요"처럼 단정하고, 나머지는 스스로 확인하게 묻는다
export function postureCopy(kind, how) {
  const table = how === 'real' ? content.liveAlerts : (content.liveGuides || content.liveAlerts);
  return table[kind] || table.all;
}
