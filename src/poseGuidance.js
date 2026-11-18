// 카메라 인식 안내: 지금 화면에서 뭐가 안 맞는지 한 줄로 알려 주고 어떻게 고치면 되는지 말해 준다.
// cameraFraming.js(어깨·귀·팔이 보이는가)를 먼저 쓰고, 그 위에 가림·치우침·너무 가까움·느림·손 인식 상태를 더한다.
// "부위가 보인다/인식이 안정적이다"는 안내일 뿐 올바른 자세를 뜻하지 않는다. 문구는 이 파일에서만 고치면 된다.
import { cameraFraming } from './cameraFraming.js';
import { validLandmark } from './landmarkValidity.js';

// 폰 위치 안내(초안, 실제 폰·기타로 검증 전). 화면의 "폰 위치 팁"에 그대로 보여 준다
export const PLACEMENT_TIPS = [
  '폰을 세로로 세워 책상이나 보면대에 고정해 주세요. 손으로 들면 화면이 흔들려요.',
  '폰 높이는 가슴~어깨 높이가 좋아요. 머리부터 기타를 잡은 손까지 한 화면에 들어와야 해요.',
  '양쪽 어깨와 코드 잡는 팔이 함께 보이도록 팔 길이 정도 떨어져 앉아 주세요.',
  '얼굴과 손 쪽으로 빛이 오게 하고, 뒤에서 오는 강한 빛(창문)은 피해 주세요.',
  '코드 잡는 손이 기타 넥에 완전히 가리지 않게 폰을 몸 가운데에서 조금 옆으로 옮겨 보세요.',
];

const EDGE = 0.06; // 이 값보다 화면 끝에 가까우면 잘릴 수 있다고 본다
const finite = Number.isFinite;
const result = (level, code, title, instruction) => ({ level, code, title, instruction, ready: level === 'ok' });

// landmarks: Pose 관절 33개(0~1). handTracking/handFound: 손 모델을 켰는지, 코드 잡는 손을 찾았는지
// 돌려주는 값: { level: 'fix' | 'tip' | 'ok', code, title, instruction }
//   fix = 지금 고쳐야 판정이 의미 있음 / tip = 판정은 되지만 더 좋아질 수 있음 / ok = 문제 없음
export function trackingGuidance({ landmarks, hand = 'left', focus = 'all', fps, inferenceMs, handTracking = false, handFound = false } = {}) {
  const base = cameraFraming(landmarks, hand, focus);
  if (!base.ready) return result('fix', base.reason, base.title, base.instruction);

  const L = landmarks[11]; const R = landmarks[12];
  const span = Math.abs(L.x - R.x);
  const centerX = (L.x + R.x) / 2;
  const arm = hand === 'right' ? [12, 14, 16, 18, 20] : [11, 13, 15, 17, 19];

  if (span > 0.75) return result('fix', 'close', '너무 가까워요', '폰을 조금 뒤로 옮겨 상체와 팔이 여유 있게 보이게 해 주세요.');
  if (focus !== 'shoulder' && arm.some((i) => !validLandmark(landmarks[i], EDGE))) {
    return result('fix', 'edge', '팔이 화면 끝에 걸려요', '폰을 조금 뒤로 옮기거나 코드 잡는 쪽으로 돌려서 팔꿈치와 손이 화면 안쪽에 들어오게 해 주세요.');
  }
  if (centerX < 0.25 || centerX > 0.75) return result('fix', 'center', '몸이 한쪽으로 치우쳤어요', '화면 가운데에 상체가 오도록 폰이나 몸을 옮겨 주세요.');
  if (handTracking && focus !== 'shoulder' && !handFound) {
    return result('fix', 'hand', '손이 잘 안 잡혀요', '손 전체가 화면에 보이게 하고, 손이 기타 넥에 완전히 가리지 않도록 폰 각도를 바꿔 주세요.');
  }

  const keyIds = focus === 'shoulder' ? [11, 12, 7, 8] : [...arm, 7, 8]; // 어깨 연습은 팔이 안 보여도 된다
  const keys = keyIds.map((i) => landmarks[i]).filter((p) => p && finite(p.visibility));
  const confidence = keys.length ? keys.reduce((sum, p) => sum + p.visibility, 0) / keys.length : 1;
  if (confidence < 0.7) return result('tip', 'light', '인식이 흔들려요', '얼굴과 손 쪽으로 빛이 오게 하고, 손이 기타에 가리지 않게 해 주세요.');
  if ((finite(fps) && fps > 0 && fps < 1.5) || (finite(inferenceMs) && inferenceMs > 800)) {
    return result('tip', 'slow', '인식이 느려요', '다른 앱을 닫고 폰을 잠시 쉬게 한 뒤 다시 해 보세요. 자세 알림이 늦게 뜰 수 있어요.');
  }
  return result('ok', 'ready', '잘 보여요', '지금 위치에 폰을 고정해 주세요. 부위가 보인다는 안내이며 올바른 자세를 뜻하지는 않아요.');
}
