// ===== 検証ハーネス =====
const __results = [];
function test(name, fn) {
  try { fn(); __results.push({ name, ok: true }); }
  catch (e) { __results.push({ name, ok: false, why: e.message }); }
}
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error((label ? label + ': ' : '') + 'expected ' + b + ' but got ' + a);
}
function near(actual, expected, tol, label) {
  if (!(Math.abs(actual - expected) <= tol)) throw new Error((label ? label + ': ' : '') + 'expected ' + expected + ' ±' + tol + ' but got ' + actual);
}
const ground = () => makeBox(0, -1, 0, 100, 1, 100);   // 上面が y=0 の地面

// ===== 当たり判定 =====
test('makeBox: 中心・下端・寸法から箱を作る', () => {
  eq(makeBox(1, 2, 3, 4, 5, 6), { minX: -1, maxX: 3, minY: 2, maxY: 7, minZ: 0, maxZ: 6 });
});

test('addBox / removeBox: PHYS.boxes に出し入れできる', () => {
  const n = PHYS.boxes.length;
  const b = addBox(0, 0, 0, 1, 1, 1);
  eq(PHYS.boxes.length, n + 1);
  removeBox(b);
  eq(PHYS.boxes.length, n);
});

test('overlaps: 面が接しているだけなら重ならない', () => {
  eq(overlaps(makeBox(0, 0, 0, 2, 2, 2), makeBox(2, 0, 0, 2, 2, 2)), false);
  eq(overlaps(makeBox(0, 0, 0, 2, 2, 2), makeBox(1.9, 0, 0, 2, 2, 2)), true);
});

test('moveBody: 地面に立っていると沈まず、接地している', () => {
  const b = { pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, onGround: false };
  for (let i = 0; i < 120; i++) moveBody(b, 1 / 60, [ground()]);
  near(b.pos.y, 0, 0.001);
  eq(b.onGround, true);
});

test('moveBody: 高いところから落ちると箱の上に着地する', () => {
  const b = { pos: { x: 0, y: 8, z: 0 }, vel: { x: 0, y: 0, z: 0 }, onGround: false };
  for (let i = 0; i < 120; i++) moveBody(b, 1 / 60, [ground(), makeBox(0, 0, 0, 4, 2, 4)]);
  near(b.pos.y, 2, 0.001);
  eq(b.onGround, true);
});

test('moveBody: 足場がなければ落ち続ける', () => {
  const b = { pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, onGround: false };
  for (let i = 0; i < 60; i++) moveBody(b, 1 / 60, []);
  eq(b.pos.y < -10, true, '落ちている');
  eq(b.onGround, false);
});

test('moveBody: 速く落ちても薄い板（0.1m）をすり抜けない', () => {
  const b = { pos: { x: 0, y: 40, z: 0 }, vel: { x: 0, y: -CFG.maxFall, z: 0 }, onGround: false };
  for (let i = 0; i < 60; i++) moveBody(b, 1 / 30, [ground(), makeBox(0, 10, 0, 4, 0.1, 4)]);
  near(b.pos.y, 10.1, 0.001);
});

test('moveBody: 上昇中に天井にぶつかると頭で止まる', () => {
  const b = { pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 15, z: 0 }, onGround: true };
  let top = 0;
  for (let i = 0; i < 30; i++) { moveBody(b, 1 / 60, [ground(), makeBox(0, 3, 0, 4, 1, 4)]); top = Math.max(top, b.pos.y); }
  eq(top <= 3 - CFG.santaHeight, true, '頭が天井（y=3）を越えない。最高点 ' + top);
});

test('moveBody: 横に動いて壁に当たると、壁の手前で止まる', () => {
  const b = { pos: { x: 0, y: 0, z: 0 }, vel: { x: 6, y: 0, z: 0 }, onGround: true };
  for (let i = 0; i < 60; i++) { b.vel.x = 6; moveBody(b, 1 / 60, [ground(), makeBox(4, 0, 0, 2, 3, 10)]); }
  near(b.pos.x, 3 - CFG.santaHalf, 0.01);
  eq(b.vel.x, 0);
});

test('moveBody: 低い段差（0.15m）は上がる', () => {
  const b = { pos: { x: 0, y: 0, z: 0 }, vel: { x: 6, y: 0, z: 0 }, onGround: true };
  for (let i = 0; i < 60; i++) { b.vel.x = 6; moveBody(b, 1 / 60, [ground(), makeBox(13, 0, 0, 20, 0.15, 10)]); }
  near(b.pos.y, 0.15, 0.01);
  eq(b.pos.x > 4, true, '段差の上を進んでいる');
});

test('moveBody: 高い段差（0.5m）は上がれない', () => {
  const b = { pos: { x: 0, y: 0, z: 0 }, vel: { x: 6, y: 0, z: 0 }, onGround: true };
  for (let i = 0; i < 60; i++) { b.vel.x = 6; moveBody(b, 1 / 60, [ground(), makeBox(13, 0, 0, 20, 0.5, 10)]); }
  near(b.pos.x, 3 - CFG.santaHalf, 0.01);
  near(b.pos.y, 0, 0.001);
});

test('rayBox: 正面の箱までの距離。外れたら Infinity', () => {
  near(rayBox({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, makeBox(5, -1, 0, 2, 2, 2)), 4, 1e-9);
  eq(rayBox({ x: 0, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, makeBox(5, -1, 0, 2, 2, 2)), Infinity);
  eq(rayBox({ x: 0, y: 5, z: 0 }, { x: 1, y: 0, z: 0 }, makeBox(5, -1, 0, 2, 2, 2)), Infinity);
});

// ===== 操作 =====
const STOP = { x: 0, z: 0 }, FWD = { x: 0, z: 1 };
const EAST = -Math.PI / 2;   // この向きで前に歩くと +X へ進む
function walk(s, input, yaw, sec, boxes) {
  for (let i = 0; i < sec * 60; i++) santaStep(s, input, yaw, 1 / 60, boxes);
}

test('santaStep: yaw=0 で前に歩くと -Z へ進み、速さは walkSpeed に達する', () => {
  const s = newSanta(0, 0);
  walk(s, FWD, 0, 1, [ground()]);
  near(s.vel.z, -CFG.walkSpeed, 0.01);
  near(s.vel.x, 0, 0.001);
  eq(s.pos.z < -4, true);
});

test('santaStep: yaw=-π/2 で前に歩くと +X へ進む', () => {
  const s = newSanta(0, 0);
  walk(s, FWD, EAST, 1, [ground()]);
  near(s.vel.x, CFG.walkSpeed, 0.01);
  near(s.vel.z, 0, 0.01);
});

test('santaStep: 右入力は yaw=0 で +X', () => {
  const s = newSanta(0, 0);
  walk(s, { x: 1, z: 0 }, 0, 1, [ground()]);
  near(s.vel.x, CFG.walkSpeed, 0.01);
});

test('santaStep: 斜め入力でも walkSpeed を超えない', () => {
  const s = newSanta(0, 0);
  walk(s, { x: 1, z: 1 }, 0, 1, [ground()]);
  near(Math.hypot(s.vel.x, s.vel.z), CFG.walkSpeed, 0.01);
});

test('santaStep: 入力をやめると止まる', () => {
  const s = newSanta(0, 0);
  walk(s, FWD, 0, 1, [ground()]);
  walk(s, STOP, 0, 1, [ground()]);
  eq(Math.hypot(s.vel.x, s.vel.z) < 0.001, true);
});

test('santaStep: 歩いた向きを facing に覚える（-Z へ歩けば 0、+X へ歩けば -π/2）', () => {
  const s = newSanta(0, 0);
  walk(s, FWD, 0, 0.5, [ground()]);
  near(s.facing, 0, 1e-6);
  walk(s, FWD, EAST, 0.5, [ground()]);
  near(s.facing, -Math.PI / 2, 1e-6);
});

test('santaStep: 縁石を歩いて上がり、壁では止まる', () => {
  const s = newSanta(0, 0);
  // 縁石は x=3〜9、壁は x=8〜10（壁の手前まで縁石が続く）
  walk(s, FWD, EAST, 3, [ground(), makeBox(6, 0, 0, 6, 0.15, 10), makeBox(9, 0, 0, 2, 3, 10)]);
  near(s.pos.y, 0.15, 0.01, '縁石の上');
  near(s.pos.x, 8 - CFG.santaHalf, 0.01, '壁の手前');
});

test('cameraPlace: 遮るものがなければ camDist 離れた後ろ（yaw=0 なら +Z 側）', () => {
  const p = cameraPlace({ x: 0, y: 1.4, z: 0 }, 0, 0, []);
  near(p.dist, CFG.camDist, 1e-9);
  near(p.z, CFG.camDist, 1e-9);
  near(p.x, 0, 1e-9);
});

test('cameraPlace: 後ろに壁があれば、壁の 0.3m 手前に寄る', () => {
  const p = cameraPlace({ x: 0, y: 1.4, z: 0 }, 0, 0, [makeBox(0, 0, 4.5, 10, 5, 1)]);
  near(p.dist, 4 - 0.3, 1e-6);
});

test('cameraPlace: noCam の箱（街の端の見えない壁）は無視する', () => {
  const b = makeBox(0, 0, 4.5, 10, 5, 1); b.noCam = true;
  const p = cameraPlace({ x: 0, y: 1.4, z: 0 }, 0, 0, [b]);
  near(p.dist, CFG.camDist, 1e-9);
});

test('cameraPlace: 壁が近すぎても camMinDist より寄らない', () => {
  const p = cameraPlace({ x: 0, y: 1.4, z: 0 }, 0, 0, [makeBox(0, 0, 0.8, 10, 5, 0.2)]);
  near(p.dist, CFG.camMinDist, 1e-9);
});

// ===== 結果表示 =====
(function () {
  const out = document.getElementById('out');
  let pass = 0;
  for (const r of __results) {
    const d = document.createElement('div');
    d.className = 'r ' + (r.ok ? 'ok' : 'ng');
    d.textContent = r.name;
    out.appendChild(d);
    if (r.ok) pass++;
    else { const w = document.createElement('div'); w.className = 'why'; w.textContent = r.why; out.appendChild(w); }
  }
  const sum = pass + '/' + __results.length;
  document.getElementById('sum').textContent = (pass === __results.length ? 'すべて通過 ' : '失敗あり ') + sum;
  document.title = (pass === __results.length ? 'PASS ' : 'FAIL ') + sum;
})();
