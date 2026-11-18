// 자세 안내 그림과 문구(판정 없음). 연주를 시작하고 5초 뒤, 알림 한 줄 · 진동 1번과 함께
// "내 모습 + 바른 자세 그림"을 3초 보여 줄 때 쓴다. 각도를 재지 않고, 연주자가 스스로 비교해 고친다.
// 레슨 연주 단계(Lesson.jsx)와 곡 연습(SongPosture.jsx)이 같이 쓴다.
import React from 'react';
import { content } from './lib.js';
import wristFix from './img/posture-wrist.svg';
import thumbFix from './img/posture-thumb.svg';
import shoulderFix from './img/posture-shoulder.svg';

const FIX = { wrist: wristFix, all: wristFix, thumb: thumbFix, shoulder: shoulderFix };

// 바른 자세 그림(어쿠스틱 체이서 사진을 보고 따라 그린 선). 그림이 없는 부위는 문구만 보여 준다
export function PostureFix({ kind }) {
  const src = FIX[kind];
  return src ? <img src={src} alt={content.liveFixes[kind] || ''} /> : <b>{content.liveFixes[kind]}</b>;
}

// 알림 문구. 실제 판정으로 뜬 알림만 "꺾였어요"처럼 단정하고, 나머지는 스스로 확인하게 묻는다
export function postureCopy(kind, how) {
  const table = how === 'real' ? content.liveAlerts : (content.liveGuides || content.liveAlerts);
  return table[kind] || table.all;
}
