// ===== サンタとカメラの操作（three.js に依存しない） =====
function newSanta(x, z) {
  return { pos: { x, y: 0, z }, vel: { x: 0, y: 0, z: 0 }, onGround: false, facing: 0 };
}

// カメラの向き yaw（0 で -Z を向く）から見た「前」と「右」
function camAxes(yaw) {
  return { fx: -Math.sin(yaw), fz: -Math.cos(yaw), rx: Math.cos(yaw), rz: -Math.sin(yaw) };
}

// 速度 (vx, vz) を目標 (tx, tz) へ、最大 k だけ近づける
function approachVec(vx, vz, tx, tz, k) {
  const ex = tx - vx, ez = tz - vz, e = Math.hypot(ex, ez);
  if (e <= k) return [tx, tz];
  return [vx + ex / e * k, vz + ez / e * k];
}

// 入力 {x: 右が+, z: 前が+}（各 -1〜1）とカメラの向き yaw で、サンタを dt 秒動かす
function santaStep(s, input, yaw, dt, boxes) {
  const a = camAxes(yaw);
  let dx = a.rx * input.x + a.fx * input.z;
  let dz = a.rz * input.x + a.fz * input.z;
  const len = Math.hypot(dx, dz);
  if (len > 1) { dx /= len; dz /= len; }
  [s.vel.x, s.vel.z] = approachVec(s.vel.x, s.vel.z, dx * CFG.walkSpeed, dz * CFG.walkSpeed, CFG.groundAccel * dt);
  if (len > 0.1) s.facing = Math.atan2(-dx, -dz);   // 見た目の正面は -Z
  moveBody(s, dt, boxes);
}

// カメラを置く場所。target から yaw の後ろ・pitch の高さへ camDist 離す。
// 間に箱があれば、その 0.3m 手前まで寄せる（ただし camMinDist より近づけない）。
function cameraPlace(target, yaw, pitch, boxes) {
  const cp = Math.cos(pitch);
  const dir = { x: Math.sin(yaw) * cp, y: Math.sin(pitch), z: Math.cos(yaw) * cp };
  let dist = CFG.camDist;
  for (const b of boxes) {
    if (b.noCam) continue;
    const t = rayBox(target, dir, b);
    if (t - 0.3 < dist) dist = t - 0.3;
  }
  dist = Math.max(CFG.camMinDist, dist);
  return { x: target.x + dir.x * dist, y: target.y + dir.y * dist, z: target.z + dir.z * dist, dist, dir };
}
