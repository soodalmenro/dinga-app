export function validLandmark(point, margin = 0) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  const confidence = point.visibility === undefined ? 1 : point.visibility;
  return Number.isFinite(confidence) && confidence >= 0 && confidence <= 1
    && point.x >= margin && point.x <= 1 - margin && point.y >= margin && point.y <= 1 - margin;
}
