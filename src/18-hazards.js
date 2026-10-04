// ===== 障害：電線と走る車（three.js に依存しない） =====

// 電線の束 w に体が当たっているか。w は ax 方向（'x' か 'z'）に a0〜a1、もう一方の座標 c を中心に横 ±0.6m（3 本）、高さ y
function wireHit(s, w) {
  const r = CFG.santaHalf, o = w.ax === 'x' ? 'z' : 'x';
  if (s.pos[w.ax] + r < Math.min(w.a0, w.a1) || s.pos[w.ax] - r > Math.max(w.a0, w.a1)) return false;
  if (Math.abs(s.pos[o] - w.c) > r + 0.6) return false;
  return s.pos.y < w.y + 0.1 && s.pos.y + CFG.santaHeight > w.y - 0.1;
}

// 毎フレーム呼ぶ。空中で電線に当たったら、前へ進む勢いが逆向きに 1/4 になり、真下へ落ち始める。
// 引っかかったら true。引っかかってから snagTime 秒は二度当たらない（落ちる途中でまた当たらないように）
function checkWires(s, wires, dt) {
  if (s.snag > 0) { s.snag -= dt; return false; }
  if (s.onGround) return false;
  for (const w of wires) {
    if (!wireHit(s, w)) continue;
    s.vel.x *= -0.25;
    s.vel.z *= -0.25;
    s.vel.y = Math.min(s.vel.y, 0) - 3;
    s.snag = CFG.snagTime;
    w.shake = 1;   // 見た目で電線を揺らす
    return true;
  }
  return false;
}

// 走る車。x は固定で、z0 から走り出して z0〜z1 を行き来する。
// boxes は当たり判定（[0] 車体、[1] 屋根）。PHYS.boxes にも入れて動かすので、サンタが屋根に着地できる
function newCar(x, z0, z1, speed) {
  return {
    x, z: z0, z0, z1, speed, dir: z1 > z0 ? 1 : -1,
    boxes: [makeBox(x, 0.35, z0, 1.9, 0.9, 4.2), makeBox(x, 1.25, z0, 1.7, 0.75, 2.3)],
  };
}

function setBoxZ(b, z) {
  const h = (b.maxZ - b.minZ) / 2;
  b.minZ = z - h;
  b.maxZ = z + h;
}

// 車を dt 秒動かし、動いた距離を返す。端で折り返す
function moveCar(c, dt) {
  const lo = Math.min(c.z0, c.z1), hi = Math.max(c.z0, c.z1);
  let z = c.z + c.dir * c.speed * dt;
  if (z > hi) { z = hi; c.dir = -1; }
  else if (z < lo) { z = lo; c.dir = 1; }
  const dz = z - c.z;
  c.z = z;
  for (const b of c.boxes) setBoxZ(b, z);
  return dz;
}

// 車を動かし、サンタとの関わりを返す。'ride'（屋根の上にいて、いっしょに動いた）／'hit'（はねられた）／null
function updateCar(c, s, dt) {
  const roof = c.boxes[1], me0 = bodyBox(s.pos);
  const riding = s.onGround && Math.abs(s.pos.y - roof.maxY) < 0.05 &&
    me0.maxX > roof.minX && me0.minX < roof.maxX && me0.maxZ > roof.minZ && me0.minZ < roof.maxZ;
  const dz = moveCar(c, dt);
  if (riding) { s.pos.z += dz; return 'ride'; }
  const me = bodyBox(s.pos);
  if (!c.boxes.some(b => overlaps(me, b))) return null;
  // ほぼ屋根の高さから来たなら、屋根に乗せるだけ
  if (s.pos.y >= roof.maxY - 0.5) {
    s.pos.y = roof.maxY;
    if (s.vel.y < 0) s.vel.y = 0;
    return null;
  }
  // はねられる：車から離れる横向きと、車の進む向きへ飛ばされる
  const side = s.pos.x >= c.x ? 1 : -1, body = c.boxes[0];
  s.pos.x = side > 0 ? Math.max(s.pos.x, body.maxX + CFG.santaHalf + EPS) : Math.min(s.pos.x, body.minX - CFG.santaHalf - EPS);
  s.vel.x = side * 5;
  s.vel.z = c.dir * 9;
  s.vel.y = 9;
  s.onGround = false;
  return 'hit';
}
