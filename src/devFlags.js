// 평가 패널에서 켜는 실험 기능 스위치. 서버·저장 상태(state)와 무관하게 이 폰의 브라우저에만 남는다.
// 기본은 꺼짐이다. 값이 바뀌면 같은 화면의 다른 곳이 알 수 있게 'dinga-devflag' 이벤트를 보낸다.
export const HAND_TRACKING = 'dinga-handtrack';

export const readFlag = (key) => { try { return localStorage.getItem(key) === '1'; } catch { return false; } };
export function writeFlag(key, on) {
  try { localStorage.setItem(key, on ? '1' : '0'); } catch { /* 저장이 안 되면 이번 화면에서만 */ }
  window.dispatchEvent(new Event('dinga-devflag'));
}
