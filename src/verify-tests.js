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

// ===== 真下の地面・屋根 =====
test('groundBelow: 真下で一番高い面。上にある箱は数えない。何も無ければ -Infinity', () => {
  const boxes = [ground(), makeBox(0, 0, 0, 4, 2, 4), makeBox(0, 10, 0, 4, 1, 4)];
  eq(groundBelow({ x: 0, y: 5, z: 0 }, boxes), 2);
  eq(groundBelow({ x: 5, y: 5, z: 0 }, boxes), 0);
  eq(groundBelow({ x: 0, y: 20, z: 0 }, boxes), 11);
  eq(groundBelow({ x: 0, y: 5, z: 0 }, []), -Infinity);
});

test('roofSteps: 8 段。一番下は屋根の幅いっぱい、段の高さは歩いて上がれる', () => {
  const r = roofSteps(0, 5, 0, 10, 2.4, 4.4);
  eq(r.length, 8);
  near(r[0].maxZ - r[0].minZ, 8.8, 1e-9, '一番下の奥行');
  near(r[0].maxX - r[0].minX, 10, 1e-9, '棟の方向の長さ');
  for (let i = 1; i < 8; i++) eq(r[i].maxY - r[i - 1].maxY <= CFG.stepHeight, true, i + '段目の高さ');
});

test('roofSteps: 屋根に落ちると斜面の少し上に乗る（体の幅のぶん棟側の段に乗る）', () => {
  const boxes = [ground(), ...roofSteps(0, 5, 0, 10, 2.4, 4.4)];
  for (const z of [3.5, 2, 0.8]) {
    const b = { pos: { x: 0, y: 12, z }, vel: { x: 0, y: 0, z: 0 }, onGround: false };
    for (let i = 0; i < 120; i++) moveBody(b, 1 / 60, boxes);
    const slope = 5 + 2.4 * (1 - z / 4.4);
    eq(b.onGround, true, 'z=' + z + ' で着地');
    eq(b.pos.y >= slope - 0.01 && b.pos.y <= slope + 0.45, true, 'z=' + z + ' 斜面 ' + slope.toFixed(2) + ' に対して ' + b.pos.y.toFixed(2));
  }
});

// ===== ジャンプ =====
const JUMP = { x: 0, z: 0, jump: true };
function inAir(vx) {
  const s = newSanta(0, 0);
  s.pos.y = 50; s.vel.x = vx;
  return s;
}

test('ジャンプ: 最高点は約 jumpHeight（13.2〜14.05m）', () => {
  const s = newSanta(0, 0);
  walk(s, STOP, 0, 0.2, [ground()]);
  santaStep(s, JUMP, 0, 1 / 60, [ground()]);
  let top = 0;
  for (let i = 0; i < 180; i++) { santaStep(s, STOP, 0, 1 / 60, [ground()]); top = Math.max(top, s.pos.y); }
  eq(top >= 13.2 && top <= 14.05, true, '最高点 ' + top.toFixed(2));
  eq(s.onGround, true, '最後は着地している');
});

test('ジャンプ: 跳んだ瞬間に jumped が立つ', () => {
  const s = newSanta(0, 0);
  walk(s, STOP, 0, 0.2, [ground()]);
  santaStep(s, JUMP, 0, 1 / 60, [ground()]);
  eq(s.jumped, true);
});

test('ジャンプ: 空中ではもう一度跳べない', () => {
  const s = newSanta(0, 0);
  walk(s, STOP, 0, 0.2, [ground()]);
  santaStep(s, JUMP, 0, 1 / 60, [ground()]);
  walk(s, STOP, 0, 0.5, [ground()]);
  santaStep(s, JUMP, 0, 1 / 60, [ground()]);
  eq(s.vel.y < 20, true, '上向きの速さ ' + s.vel.y.toFixed(1));
});

test('ジャンプ: 着地の少し前（0.1 秒前）に押しても、着地したら跳ぶ', () => {
  const s = newSanta(0, 0);
  s.pos.y = 0.15;
  santaStep(s, JUMP, 0, 1 / 60, [ground()]);
  let maxVy = -Infinity;
  for (let i = 0; i < 30; i++) { santaStep(s, STOP, 0, 1 / 60, [ground()]); maxVy = Math.max(maxVy, s.vel.y); }
  eq(maxVy > 20, true, '上向きの最大 ' + maxVy.toFixed(1));
});

test('ジャンプ: 着地のずっと前（0.45 秒前）に押したものは無効', () => {
  const s = newSanta(0, 0);
  s.pos.y = 3;
  santaStep(s, JUMP, 0, 1 / 60, [ground()]);
  let maxVy = -Infinity;
  for (let i = 0; i < 60; i++) { santaStep(s, STOP, 0, 1 / 60, [ground()]); maxVy = Math.max(maxVy, s.vel.y); }
  eq(maxVy < 1, true, '上向きの最大 ' + maxVy.toFixed(1));
});

test('ジャンプ: 足場から歩いて落ちた直後なら跳べる', () => {
  const boxes = [ground(), makeBox(0, 0, 0, 4, 2, 40)];
  const s = newSanta(1.5, 0);
  s.pos.y = 2;
  walk(s, STOP, 0, 0.2, boxes);
  for (let i = 0; i < 60 && s.onGround; i++) santaStep(s, FWD, EAST, 1 / 60, boxes);
  eq(s.onGround, false, '足場から落ちた');
  santaStep(s, { x: 0, z: 1, jump: true }, EAST, 1 / 60, boxes);
  eq(s.vel.y > 20, true, '上向きの速さ ' + s.vel.y.toFixed(1));
});

test('空中: 入力が無ければ横の勢いはそのまま', () => {
  const s = inAir(6);
  walk(s, STOP, 0, 0.5, []);
  near(s.vel.x, 6, 1e-9);
});

test('空中: 逆へ入れても airAccel でしか変わらない（0.25 秒で 6 → 4）', () => {
  const s = inAir(6);
  walk(s, { x: -1, z: 0 }, 0, 0.25, []);
  near(s.vel.x, 6 - CFG.airAccel * 0.25, 0.05);
});

test('着地: 着地した瞬間の落ちる速さを landSpeed に残す', () => {
  const s = newSanta(0, 0);
  s.pos.y = 5;
  let land = 0;
  for (let i = 0; i < 90; i++) { santaStep(s, STOP, 0, 1 / 60, [ground()]); if (s.landSpeed > 0) { land = s.landSpeed; s.landSpeed = 0; } }
  eq(land > 15 && land < 18, true, '落ちる速さ ' + land.toFixed(1) + '（5m 落下で約 17.3）');
});

// ===== 川（高さで届く距離が変わる） =====
// 手前の岸（z = R〜）の縁に高さ h の建物を置き、屋上を -Z へ走って縁で跳ぶ。向こう岸（z = 〜-R）に立てたら true
function tryCross(h) {
  const R = COURSE.riverHalf;
  const boxes = [makeBox(0, -4, R + 23, 40, 4, 46), makeBox(0, -4, -R - 23, 40, 4, 46)];
  if (h > 0) boxes.push(makeBox(0, 0, R + 5, 10, h, 10));
  const s = newSanta(0, R + 8);
  s.pos.y = h;
  walk(s, STOP, 0, 0.2, boxes);
  let jumped = false;
  for (let i = 0; i < 600; i++) {
    const jump = !jumped && s.pos.z < R - 0.2;   // 縁から体が少しはみ出したところで跳ぶ
    if (jump) jumped = true;
    santaStep(s, { x: 0, z: 1, jump }, 0, 1 / 60, boxes);
    if (jumped && s.onGround) break;
    if (s.pos.y < CFG.fallY) break;
  }
  return s.onGround && Math.abs(s.pos.y) < 0.01 && s.pos.z < 0;
}

test('川: 地面から走って跳んでも向こう岸に届かない', () => {
  eq(tryCross(0), false);
});

test('川: 28m の建物の屋上から走って跳べば届く', () => {
  eq(tryCross(28), true);
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
