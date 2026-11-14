// 여러 화면에서 같이 쓰는 작은 부품들
import React, { useEffect, useRef } from 'react';
import motion from './motion.json';
import { content } from './lib.js';
import { useReducedMotion } from './useReducedMotion.js';

const imgs = import.meta.glob('./img/*.webp', { eager: true, import: 'default' });
export const imgSrc = (name) => imgs[`./img/${name}.webp`];

// motion.json의 키프레임을 브라우저 애니메이션으로 바꾼다
const EASE = { in: 'ease-in', out: 'ease-out', inOut: 'ease-in-out' };
function toKeyframes(frames, k) {
  const total = frames[frames.length - 1].t || 1;
  return {
    duration: total,
    keyframes: frames.map((f, i) => ({
      offset: f.t / total,
      transform: `translateY(${(f.y || 0) * k}px) rotate(${f.r || 0}deg) scale(${f.sx ?? 1}, ${f.sy ?? 1})`,
      opacity: f.o ?? 1,
      easing: EASE[(frames[i + 1] || {}).ease] || 'linear',
    })),
  };
}
const IDLE_FOR = { happy: 'happy', sulky: 'sulky', stare: 'stare', exhausted: 'exhausted', melted: 'melted', yay: 'happy', clap: 'happy', main: 'stare', play: 'sulky', hi: 'sulky', listen: 'exhausted', zzz: 'exhausted' };

// 캐릭터 피키. name은 이미지 이름, 누르면 반응한다
export function Piki({ name, size = 200, still = false, onTap }) {
  const ref = useRef(null);
  const reducedMotion = useReducedMotion();
  const mood = IDLE_FOR[name] || 'sulky';
  const k = size / 280;
  useEffect(() => {
    const el = ref.current;
    if (!el || !el.animate || still || reducedMotion) return undefined;
    let active = true;
    const sIn = toKeyframes(motion.swapIn, k);
    const a = el.animate(sIn.keyframes, { duration: sIn.duration, fill: 'both' });
    const idle = toKeyframes(motion.idle[mood], k);
    a.onfinish = () => { if (active) el.animate(idle.keyframes, { duration: idle.duration, iterations: Infinity }); };
    return () => { active = false; a.onfinish = null; el.getAnimations().forEach((animation) => animation.cancel()); };
  }, [name, mood, k, still, reducedMotion]);
  const tap = () => {
    const el = ref.current;
    if (el && el.animate && !still && !reducedMotion) {
      const t = toKeyframes(motion.tap[motion.tapType[mood] || 'small'], k);
      el.animate(t.keyframes, { duration: t.duration });
    }
    if (onTap) onTap();
  };
  return <img ref={ref} className="piki" src={imgSrc(name)} alt="" draggable={false} onClick={tap} style={{ height: size, transformOrigin: '50% 100%' }} />;
}

export function Sparkles() {
  return (
    <svg className="spark" viewBox="0 0 335 300" preserveAspectRatio="xMidYMid meet">
      <path d="M40 50L46 68L64 74L46 80L40 98L34 80L16 74L34 68Z" fill="#FF9A3D" />
      <path d="M296 30L300 42L312 46L300 50L296 62L292 50L280 46L292 42Z" fill="#FEC745" />
      <path d="M306 220L311 234L325 239L311 244L306 258L301 244L287 239L301 234Z" fill="#FF9A3D" />
      <path d="M30 230L33 239L42 242L33 245L30 254L27 245L18 242L27 239Z" fill="#FEC745" />
    </svg>
  );
}

const ICON = {
  home: <path d="M4 11L12 4L20 11V20H14V14H10V20H4Z" />,
  learn: <><path d="M4 5H10C11 5 12 6 12 7V20C12 19 11 18 10 18H4Z" /><path d="M20 5H14C13 5 12 6 12 7V20C12 19 13 18 14 18H20Z" /></>,
  practice: <><circle cx="12" cy="12" r="8.5" /><path d="M10 8.5L15.5 12L10 15.5Z" /></>,
  my: <><circle cx="12" cy="8" r="4" /><path d="M4 20C4 16 8 14 12 14C16 14 20 16 20 20" /></>,
};
export function TabBar({ route, go }) {
  const tabs = [['home', '홈'], ['learn', '학습'], ['practice', '연습'], ['my', 'MY']];
  return (
    <nav className="tabbar">
      {tabs.map(([id, label]) => (
        <button key={id} className={route === id ? 'on' : ''} onClick={() => go(id)} aria-label={label}>
          <svg viewBox="0 0 24 24">{ICON[id]}</svg><span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

// 코드 다이어그램. highlight는 지금 누를 손가락 순서(0부터), 없으면 전부 진하게
export function Chord({ name, highlight = -1, upTo = 99, scale = 1 }) {
  const c = content.chords[name];
  const x = (s) => 20 + (6 - s) * 40;
  const y = (f) => 30 + (f - 0.5) * 52;
  return (
    <svg width={240 * scale} height={250 * scale} viewBox="0 0 240 250" fill="none">
      <rect x="18" y="26" width="204" height="8" rx="4" fill="#302F46" />
      {[6, 5, 4, 3, 2, 1].map((s, i) => <line key={s} x1={x(s)} y1="30" x2={x(s)} y2="240" stroke="#CFC6B8" strokeWidth={3 - i * 0.3} />)}
      {[1, 2, 3, 4].map((f) => <line key={f} x1="20" y1={30 + f * 52} x2="220" y2={30 + f * 52} stroke="#F1E7D6" strokeWidth="2" />)}
      {c.open.map((s) => <circle key={s} cx={x(s)} cy="12" r="6" stroke="#857E8C" strokeWidth="2" />)}
      {c.mute.map((s) => <path key={s} d={`M${x(s) - 6} 6L${x(s) + 6} 18M${x(s) + 6} 6L${x(s) - 6} 18`} stroke="#857E8C" strokeWidth="2.5" strokeLinecap="round" />)}
      {c.dots.map((d, i) => (i > upTo ? null : (
        <g key={i}>
          {i === highlight && <circle cx={x(d.string)} cy={y(d.fret)} r="25" stroke="#FF9A3D" strokeOpacity="0.35" strokeWidth="5" />}
          <circle cx={x(d.string)} cy={y(d.fret)} r="18" fill={highlight === -1 || i === highlight ? '#FF9A3D' : '#FFE0A3'} />
          <text x={x(d.string)} y={y(d.fret) + 6} textAnchor="middle" fontSize="17" fontWeight="800" fill={highlight === -1 || i === highlight ? '#fff' : '#C2620F'}>{d.finger}</text>
        </g>
      )))}
    </svg>
  );
}

export function Modal({ children, bottom, onClose }) {
  const dialog = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  const titleId = React.useId();
  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement;
    const heading = node.querySelector('h1, h2');
    if (heading) {
      heading.id = heading.id || titleId;
      node.setAttribute('aria-labelledby', heading.id);
    } else node.setAttribute('aria-label', '안내');
    node.focus({ preventScroll: true });
    const onKey = (event) => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (dialogs[dialogs.length - 1] !== node) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (close.current) close.current();
      }
      if (event.key !== 'Tab') return;
      const controls = [...node.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter((control) => control.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); node.focus(); }
      else if (document.activeElement === node) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (previous && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, [titleId]);
  return (
    <div className={`modal${bottom ? ' bottom' : ''}`} onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" tabIndex={-1} ref={dialog} onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

export function Progress({ n, total, label = '학습 진행', unit = '단계' }) {
  return <div className="prog" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={n} aria-valuetext={`${total}${unit} 중 ${n}${unit}`}>
    {Array.from({ length: total }, (_, i) => <i key={i} className={i < n ? 'on' : ''} />)}
  </div>;
}

// 완료 순간의 색종이
export function Confetti() {
  const ref = useRef(null);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    const c = ref.current; if (!c) return undefined;
    if (reducedMotion) return undefined;
    const w = (c.width = c.offsetWidth); const h = (c.height = c.offsetHeight); const g = c.getContext('2d');
    const colors = ['#FEC745', '#FF9A3D', '#F2617A', '#2FA8E8', '#3DBE6E'];
    const ps = Array.from({ length: 90 }, () => ({ x: w / 2 + (Math.random() - 0.5) * 80, y: h * 0.35, vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 11 - 3, r: Math.random() * 5 + 4, c: colors[Math.floor(Math.random() * colors.length)], a: Math.random() * 6 }));
    let raf = 0; const t0 = performance.now();
    const loop = (now) => {
      const life = (now - t0) / 2200; g.clearRect(0, 0, w, h);
      if (life > 1) return;
      ps.forEach((p) => { p.vy += 0.32; p.x += p.vx; p.y += p.vy; p.a += 0.2; g.save(); g.globalAlpha = Math.max(0, 1 - life * life); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.c; g.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6); g.restore(); });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); g.clearRect(0, 0, w, h); };
  }, [reducedMotion]);
  return <canvas ref={ref} className="confetti" />;
}
