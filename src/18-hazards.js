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

// 走る車。x は固定。at（省略なら z0）から走り出し、まず z1 の向きへ進み、z0〜z1 を行き来する。
// boxes は当たり判定（[0] 車体、[1] 屋根）。PHYS.boxes にも入れて動かすので、サンタが屋根に着地できる
function newCar(x, z0, z1, speed, at) {
  const z = at === undefined ? z0 : at;
  return {
    x, z, z0, z1, speed, dir: z1 > z0 ? 1 : -1,
    boxes: [makeBox(x, 0.35, z, 1.9, 0.9, 4.2), makeBox(x, 1.25, z, 1.7, 0.75, 2.3)],
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
// boxes を渡すと、運ぶときに壁などで止まる（渡さなければ位置をそのままずらす）
function updateCar(c, s, dt, boxes) {
  const roof = c.boxes[1], me0 = bodyBox(s.pos);
  const riding = s.onGround && Math.abs(s.pos.y - roof.maxY) < 0.05 &&
    me0.maxX > roof.minX && me0.minX < roof.maxX && me0.maxZ > roof.minZ && me0.minZ < roof.maxZ;
  const dz = moveCar(c, dt);
  if (riding) { carry(s, 'z', dz, boxes); return 'ride'; }
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

// ===== 理不尽ギミック：動き出す列車・逃げる家 =====

// 足元のすぐ下が boxes のどれかに乗っているか
function standingOn(s, boxes) {
  if (!s.onGround) return false;
  const me = bodyBox({ x: s.pos.x, y: s.pos.y - 0.02, z: s.pos.z });
  return boxes.some(b => overlaps(me, b));
}

// 掘割の底に止まっている列車。xs は車両の中心、len は車両の長さ、y0 は底、h は高さ。
// span ごとに x が一周する（x が span/2 を越えた車両は反対側へ回る）
function newTrain(xs, zc, len, w, y0, h, span) {
  return { cars: xs.map(x => ({ x, box: makeBox(x, y0, zc, len, h, w) })), span, zc, w, speed: 0, ride: 0 };
}

function setBoxX(b, x) {
  const hw = (b.maxX - b.minX) / 2;
  b.minX = x - hw;
  b.maxX = x + hw;
}

// 列車全体を +X へ dx 動かす
function shiftTrain(tr, dx) {
  for (const c of tr.cars) {
    c.x += dx;
    if (c.x > tr.span / 2) c.x -= tr.span;
    setBoxX(c.box, c.x);
  }
}

// 列車を動かす。サンタが屋根に乗って trainDelay 秒たつと走り出し（trainSpeed まで加速）、降りると止まる。
// 乗っていればサンタもいっしょに運ぶ。返り値: 'start'（走り出した瞬間）／'ride'（乗っている）／'scraped'（トンネルの入口にぶつかって落ちた）／null
// boxes を渡すと、運ぶときに壁で止まる（街の端で止められたら、トンネルの入口にぶつかったことにして線路へはじき出す）
function updateTrain(tr, s, dt, boxes) {
  const riding = standingOn(s, tr.cars.map(c => c.box));
  tr.ride = riding ? tr.ride + dt : 0;
  const want = riding && tr.ride >= CFG.trainDelay ? CFG.trainSpeed : 0;
  const was = tr.speed;
  tr.speed = want > tr.speed ? Math.min(want, tr.speed + CFG.trainAccel * dt)
                             : Math.max(want, tr.speed - CFG.trainAccel * dt);
  const dx = tr.speed * dt;
  if (dx) shiftTrain(tr, dx);
  if (riding) {
    const x0 = s.pos.x;
    carry(s, 'x', dx, boxes);
    // 街の端（トンネルの入口）で止められた：入口にぶつかって、列車の横から線路へ落ちる
    if (dx > 0 && s.pos.x < x0 + dx - 1e-6) { knockOffTrain(s, tr); return 'scraped'; }
  }
  if (was === 0 && tr.speed > 0) return 'start';
  return riding ? 'ride' : null;
}

// 逃げる家。boxes はその家の当たり判定の箱すべて、chimney は W.houses の煙突（front も含めていっしょに動かす）
function newRunaway(x, z, boxes, chimney, bounds) {
  return { x, z, x0: x, z0: z, boxes, chimney, bounds, caught: false, fleeing: false };
}

function moveRunaway(h, mx, mz) {
  h.x += mx;
  h.z += mz;
  for (const b of h.boxes) { b.minX += mx; b.maxX += mx; b.minZ += mz; b.maxZ += mz; }
  h.chimney.x += mx;
  h.chimney.z += mz;
  h.chimney.front.x += mx;
  h.chimney.front.z += mz;
}

// 家を逃がす。active（まだ届けていない）で、地上のサンタが fleeRange 以内なら、離れる向きに fleeSpeed で逃げる。
// 空中のサンタからは逃げない（上は見ていない）。屋根に乗られている間は止まり、降りるとまた逃げる。
// 返り値: 'flee'／'caught'（屋根に乗られた瞬間）／null
function stepRunaway(h, s, dt, active) {
  h.fleeing = false;
  if (!active) return null;
  if (standingOn(s, h.boxes)) {
    const first = !h.caught;
    h.caught = true;
    return first ? 'caught' : null;
  }
  h.caught = false;
  if (!s.onGround) return null;
  const dx = h.x - s.pos.x, dz = h.z - s.pos.z, d = Math.hypot(dx, dz);
  if (d > CFG.fleeRange || d < 1e-6) return null;
  const B = h.bounds, step = CFG.fleeSpeed * dt;
  const nx = Math.min(B.x1, Math.max(B.x0, h.x + dx / d * step));
  const nz = Math.min(B.z1, Math.max(B.z0, h.z + dz / d * step));
  moveRunaway(h, nx - h.x, nz - h.z);
  h.fleeing = true;
  return 'flee';
}

// 「もう一度」のとき、元の場所に戻す
function resetRunaway(h) {
  moveRunaway(h, h.x0 - h.x, h.z0 - h.z);
  h.caught = false;
  h.fleeing = false;
}

// 乗り物がサンタを ax 方向に d 運ぶ。boxes があれば通常の横移動と同じく壁で止まる。
// 位置を直接ずらすと見えない壁などにめり込むため（めり込んだまま落ちる処理が走ると、壁のてっぺんに持ち上げられていた）
function carry(s, ax, d, boxes) {
  if (boxes) moveAxisH(s, ax, d, boxes);
  else s.pos[ax] += d;
}

// トンネルの入口にぶつかったサンタを、列車の横（線路の上）へはじき出す。そのまま線路に落ちる
function knockOffTrain(s, tr) {
  s.pos.z = tr.zc + tr.w / 2 + CFG.santaHalf + 0.2;
  s.vel = { x: -2, y: 4, z: 2 };
  s.onGround = false;
  tr.ride = 0;
}
