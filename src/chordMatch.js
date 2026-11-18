// 코드 이름 비교. Chordino는 같은 코드를 Em7, Em/B, E5처럼 변형 이름으로 읽기도 한다.
// 근음이 같고 3음(장조/단조)이 반대가 아니면 같은 코드로 인정한다.
//   Em 목표: Em, Em7, Em6, Em9, Emadd9, Em/B, Em/G, E5(3음 없음), Esus2/Esus4(3음 없음) 인정 · E, E7(장조)은 다른 코드
//   G 목표: G, G6, G7, Gmaj7, Gadd9, G/B, G5, Gsus 인정 · Gm(단조)은 다른 코드
// dim·aug·m7b5처럼 성격이 다른 코드는 어떤 목표에도 인정하지 않는다.
const LABEL = /^([A-G](?:#|b)?)([^/]*)(?:\/[A-G](?:#|b)?)?$/;
export function canonicalChord(label) {
  const match = LABEL.exec(typeof label === 'string' ? label.trim() : '');
  if (!match) return '';
  const [, root, quality] = match;
  if (/dim|aug|º|b5|\+/.test(quality)) return '';
  if (/^(?:m(?!aj)|min)/.test(quality)) return root + 'm';
  if (/^(?:5|sus)/.test(quality)) return root + '5';
  return root;
}
export function sameChord(label, target) {
  const heard = canonicalChord(label); const wanted = canonicalChord(target);
  if (!heard || !wanted) return false;
  if (heard === wanted) return true;
  return heard.endsWith('5') && heard.slice(0, -1) === wanted.replace(/m$/, '');
}
