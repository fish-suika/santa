// ===== サンタとカメラの操作（three.js に依存しない） =====
function newSanta(x, z) {
  return {
    pos: { x, y: 0, z }, vel: { x: 0, y: 0, z: 0 }, onGround: false, facing: 0,
    jumpBuf: 0,      // 先に押されたジャンプの残り時間
    coyote: 0,       // 足場を離れてもまだ跳べる残り時間
    jumped: false,   // 跳んだ瞬間に立つ（音を鳴らしたら呼ぶ側が下ろす）
    landSpeed: 0,    // 着地した瞬間の落ちる速さ（使ったら呼ぶ側が 0 に戻す）
  };
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

// 最高点がちょうど jumpHeight になる初速
function jumpSpeed() {
  return Math.sqrt(2 * CFG.gravity * CFG.jumpHeight);
}

// 入力 {x: 右が+, z: 前が+（各 -1〜1）, jump: 押した瞬間だけ true} とカメラの向き yaw で、サンタを dt 秒動かす
function santaStep(s, input, yaw, dt, boxes) {
  const a = camAxes(yaw);
  let dx = a.rx * input.x + a.fx * input.z;
  let dz = a.rz * input.x + a.fz * input.z;
  const len = Math.hypot(dx, dz);
  if (len > 1) { dx /= len; dz /= len; }
  // 地上はすぐ思った速さになる。空中は弱くしか効かず、入力が無ければ勢いがそのまま残る
  if (s.onGround) {
    [s.vel.x, s.vel.z] = approachVec(s.vel.x, s.vel.z, dx * CFG.walkSpeed, dz * CFG.walkSpeed, CFG.groundAccel * dt);
  } else if (len > 0.1) {
    [s.vel.x, s.vel.z] = approachVec(s.vel.x, s.vel.z, dx * CFG.walkSpeed, dz * CFG.walkSpeed, CFG.airAccel * dt);
  }
  if (len > 0.1) s.facing = Math.atan2(-dx, -dz);   // 見た目の正面は -Z

  // ジャンプ。着地の少し前に押しても、足場から落ちた直後に押しても跳べる
  s.jumpBuf = input.jump ? CFG.jumpBuffer : Math.max(0, s.jumpBuf - dt);
  s.coyote = s.onGround ? CFG.coyoteTime : Math.max(0, s.coyote - dt);
  if (s.jumpBuf > 0 && s.coyote > 0) {
    s.vel.y = jumpSpeed();
    s.jumpBuf = 0;
    s.coyote = 0;
    s.onGround = false;
    s.jumped = true;
  }

  const wasGround = s.onGround, vy = s.vel.y;
  moveBody(s, dt, boxes);
  if (s.onGround && !wasGround) s.landSpeed = Math.max(0, -vy);
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
