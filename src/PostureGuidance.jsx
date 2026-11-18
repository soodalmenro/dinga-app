// 카메라 인식 안내 한 줄. 문제가 없으면 아무것도 그리지 않고, 있으면 제목·해결 방법과 폰 위치 팁을 보여 준다.
import React from 'react';
import { PLACEMENT_TIPS } from './poseGuidance.js';

export default function PostureGuidance({ guidance }) {
  if (!guidance || guidance.level === 'ok') return null;
  const fix = guidance.level === 'fix';
  return (
    <div role="status" className="sub" style={{ fontSize: 12, textAlign: 'left', margin: '6px 0' }}>
      <b style={{ color: fix ? '#C44A1B' : 'inherit' }}>{guidance.title}</b>
      <div>{guidance.instruction}</div>
      {fix && (
        <details style={{ marginTop: 4 }}>
          <summary>폰 위치 팁</summary>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{PLACEMENT_TIPS.map((tip) => <li key={tip}>{tip}</li>)}</ul>
        </details>
      )}
    </div>
  );
}
