import React from 'react';
import { Modal } from './ui.jsx';

export function MicrophoneRecovery({ microphone, onExit, onSkip, onResume, withoutMicHint }) {
  if (!microphone.inputLost) return null;
  const ready = microphone.micOn === true;
  return <Modal>
    <h1 style={{ fontSize: 21 }}>{ready ? '마이크를 다시 연결했어요' : '마이크 연결이 끊겼어요'}</h1>
    <div className="sub">{microphone.requesting ? '마이크 권한과 연결을 확인하고 있어요. 마이크 없이 진행하거나 나갈 수도 있어요.' : ready ? '준비되면 멈춘 연습을 이어가요.' : '연습을 멈췄어요. 마이크를 다시 연결하거나 마이크 없이 진행할 수 있어요.'}</div>
    {ready ? <button className="btn" onClick={() => { if (microphone.acknowledgeMic()) onResume?.(); }}>연습 계속하기</button>
      : <button className="btn" disabled={microphone.requesting} onClick={microphone.retryMic}>마이크 다시 연결</button>}
    {withoutMicHint && <div className="sub">{withoutMicHint}</div>}
    <button className="btn line" onClick={() => { (onSkip || microphone.skipMic)(); onResume?.(); }}>마이크 없이 계속하기</button>
    {onExit && <button className="textbtn" onClick={onExit}>연습 나가기</button>}
  </Modal>;
}
