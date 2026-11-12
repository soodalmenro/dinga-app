// Framing suggestions, not posture verdicts or calibrated device accuracy.
export function cameraFraming(landmarks, hand = 'left', focus = 'all') {
  const result = (reason, title, instruction, ready = false) => ({ reason, title, instruction, ready });
  const visible = (i) => {
    const p = landmarks?.[i];
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0.03 && p.x <= 0.97 && p.y >= 0.03 && p.y <= 0.97 && (p.visibility ?? 1) > 0.5;
  };
  if (!Array.isArray(landmarks) || !landmarks.some((_, i) => visible(i))) return result('nobody', '상체가 잘 보이지 않아요', '폰을 고정하고 상체를 화면 안으로 옮겨 주세요. 얼굴 쪽으로 빛이 오도록 해 보세요.');
  if (!visible(11) || !visible(12)) return result('shoulders', '양쪽 어깨를 보여 주세요', '폰을 조금 뒤로 옮겨 두 어깨가 화면 안에 들어오게 해 주세요.');
  const span = Math.abs(landmarks[11].x - landmarks[12].x);
  if (span < 0.12) return result('distance', '상체를 조금 더 크게 보여 주세요', '폰을 가까이 옮기되 양쪽 어깨와 코드 잡는 팔이 함께 보이게 해 주세요.');
  if ((focus === 'shoulder' || focus === 'all') && (!visible(7) || !visible(8))) return result('ears', '귀와 어깨를 함께 보여 주세요', '화면 위쪽에 머리까지 들어오도록 폰 높이를 맞춰 주세요.');
  const joints = hand === 'right' ? [14, 16, 18, 20] : [13, 15, 17, 19];
  if (focus !== 'shoulder' && !joints.every(visible)) return result('hand', '코드 잡는 팔과 손을 보여 주세요', '팔꿈치·손목·손끝이 기타에 가리지 않도록 폰 각도를 조금 바꿔 주세요.');
  return result('ready', '확인할 부위가 보여요', '폰을 이 위치에 고정해 주세요. 부위가 보인다는 안내이며 올바른 자세를 뜻하지는 않아요.', true);
}
