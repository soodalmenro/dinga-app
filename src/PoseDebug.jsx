// 자세 판정 디버그 화면 (평가 패널에서 켤 때만 보인다. 참가자 화면이 아니다)
// 영상 위에 Pose가 찾은 관절점과 잰 값(손목·어깨·목), 기준선, 기준 자세 저장 버튼을 보여 준다.
// 판정이 실제로 맞는지 눈으로 확인하고 기준값을 맞추는 용도이며, 영상·값은 저장하거나 전송하지 않는다.
import React, { useEffect, useRef, useState } from 'react';

const FLAG_KEY = 'dinga-posedebug';
export const readPoseDebugFlag = () => { try { return localStorage.getItem(FLAG_KEY) === '1'; } catch { return false; } };
export const writePoseDebugFlag = (on) => {
  try { localStorage.setItem(FLAG_KEY, on ? '1' : '0'); } catch { /* 저장 불가면 이번 화면에서만 */ }
  window.dispatchEvent(new Event('dinga-posedebug'));
};

const fmt = (v, digits = 0) => (Number.isFinite(v) ? v.toFixed(digits) : '–');
const visible = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility === undefined ? 1 : p.visibility) > 0.5;

function Row({ label, value, limit, bad, note }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, color: bad ? '#FF8A8A' : '#fff' }}>
      <span>{label}</span>
      <span style={{ textAlign: 'right' }}>{value}{limit ? <small style={{ opacity: 0.75 }}> / {limit}</small> : null}{note ? <small style={{ opacity: 0.75 }}> {note}</small> : null}</span>
    </div>
  );
}

export function PoseDebug({ stream, data, onCalibrate, onClear }) {
  const video = useRef(null);
  const [ratio, setRatio] = useState(3 / 4);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const v = video.current;
    if (!v || !stream?.current) return undefined;
    v.srcObject = stream.current;
    const sync = () => { if (v.videoWidth > 0 && v.videoHeight > 0) setRatio(v.videoWidth / v.videoHeight); };
    v.addEventListener('loadedmetadata', sync);
    Promise.resolve(v.play()).catch(() => {});
    return () => { v.removeEventListener('loadedmetadata', sync); v.srcObject = null; };
  }, [stream]);

  const m = data?.measured || null;
  const th = data?.thresholds || {};
  const base = data?.baseline || null;
  const bad = data?.bad || [];
  const use3d = Number.isFinite(m?.wrist3d);
  const wrist = use3d ? m.wrist3d : m?.wrist;
  const wristBase = base ? (use3d ? base.wrist3d : base.wrist) : null;
  const lm = data?.landmarks;
  const arm = th.hand === 'right' ? [14, 16, 18, 20] : [13, 15, 17, 19];
  const lines = [[11, 12], [7, 11], [8, 12], [11, arm[0]], [arm[0], arm[1]], [arm[1], arm[2]], [arm[1], arm[3]]];
  const dots = [7, 8, 11, 12, ...arm];
  const color = (kind) => (bad.includes(kind) ? '#FF5C5C' : '#3FBF6F');
  const lineColor = (a, b) => (arm.includes(a) || arm.includes(b) ? color('wrist') : color('shoulder'));

  const save = async () => {
    if (busy || !onCalibrate) return;
    setBusy(true); setMessage('올바른 자세로 앉아 3초간 가만히 계세요…');
    let result = null;
    try { result = await onCalibrate(); } catch { result = null; }
    setBusy(false);
    setMessage(result ? `기준 자세를 저장했어요 (샘플 ${result.samples}개)` : '값이 부족해서 저장하지 못했어요. 어깨와 코드 잡는 팔이 보이게 하고 다시 해 주세요.');
  };

  return (
    <section aria-label="자세 판정 디버그" style={{ position: 'fixed', left: 8, bottom: 8, width: 228, zIndex: 80, background: 'rgba(30,29,46,.92)', color: '#fff', borderRadius: 14, padding: 8, fontSize: 11, lineHeight: 1.5, boxShadow: '0 8px 24px rgba(0,0,0,.35)' }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: String(ratio), borderRadius: 10, overflow: 'hidden', background: '#000', transform: 'scaleX(-1)' }}>
        <video ref={video} playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' }} />
        <svg viewBox="0 0 1 1" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true">
          {lm && lines.map(([a, b]) => (visible(lm[a]) && visible(lm[b])
            ? <line key={`${a}-${b}`} x1={lm[a].x} y1={lm[a].y} x2={lm[b].x} y2={lm[b].y} stroke={lineColor(a, b)} strokeWidth="0.008" strokeLinecap="round" /> : null))}
          {lm && dots.map((i) => (lm[i] ? <circle key={i} cx={lm[i].x} cy={lm[i].y} r="0.014" fill={visible(lm[i]) ? '#fff' : '#888'} stroke="#000" strokeWidth="0.003" /> : null))}
        </svg>
      </div>
      <div style={{ marginTop: 6 }}>
        <Row label="손목" value={`${fmt(wrist)}°`} limit={Number.isFinite(wristBase) ? `기준 ${fmt(wristBase)}+${th.wristDelta ?? 25}` : `${th.wristDeg}`} bad={bad.includes('wrist')} note={use3d ? '3D' : '2D'} />
        <Row label="손목 2D 참고" value={`${fmt(m?.wrist)}°`} />
        <Row label="어깨 기울기" value={`${fmt(m?.tilt, 1)}°`} limit={Number.isFinite(base?.tilt) ? `기준 ${fmt(base.tilt, 1)}±${th.tiltDelta ?? 8}` : `${th.tiltDeg}`} bad={bad.includes('shoulder')} />
        <Row label="귀–어깨 비" value={fmt(m?.neck, 2)} limit={Number.isFinite(base?.neck) ? `기준 ${fmt(base.neck, 2)}×${th.neckDrop ?? 0.75}` : `${th.neckRatio}`} bad={bad.includes('shoulder')} />
        <Row label="판정" value={bad.length ? bad.join(', ') : '괜찮음'} bad={bad.length > 0} />
        <Row label="속도" value={`${fmt(data?.fps, 1)}fps · ${fmt(data?.inferenceMs)}ms`} />
        <div style={{ opacity: 0.85 }}>{base ? `기준: 저장됨 (샘플 ${base.samples})` : '기준: 없음 (고정 수치로 판정)'}</div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <button type="button" disabled={busy} onClick={save} style={{ flex: 1, minHeight: 32, borderRadius: 8, border: 0, background: '#FEC745', color: '#302F46', fontWeight: 800 }}>{busy ? '측정 중…' : '기준 자세 저장'}</button>
        <button type="button" disabled={busy} onClick={() => { if (onClear) onClear(); setMessage('기준을 지웠어요'); }} style={{ minHeight: 32, borderRadius: 8, border: '1px solid #888', background: 'transparent', color: '#fff' }}>지우기</button>
      </div>
      {message && <div role="status" style={{ marginTop: 4 }}>{message}</div>}
    </section>
  );
}
