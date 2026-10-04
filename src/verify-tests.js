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

// ===== プレゼント =====
const PICK = { x: 0, z: 0 }, RESP = { x: 1, z: 0 };
function carryingRun() { const r = newRun(); r.carrying = true; return r; }

test('tryPickup: そりから離れていると受け取れない', () => {
  const r = newRun(), s = newSanta(5, 0);
  eq(tryPickup(r, s, PICK), false);
  eq(r.carrying, false);
});

test('tryPickup: 近ければ受け取れる。二度目は false', () => {
  const r = newRun(), s = newSanta(1.5, 1);
  eq(tryPickup(r, s, PICK), true);
  eq(r.carrying, true);
  eq(tryPickup(r, s, PICK), false);
});

test('tryPickup: 真上の高い所（屋根の上など）からは受け取れない', () => {
  const r = newRun(), s = newSanta(0, 0);
  s.pos.y = 5;
  eq(tryPickup(r, s, PICK), false);
});

test('stepRun: 落ちていなければ何も起きない', () => {
  const r = carryingRun(), s = newSanta(3, 3);
  eq(stepRun(r, s, 1 / 60, RESP), null);
  eq(r.carrying, true);
});

test('stepRun: 持ったまま川に落ちると dropped。プレゼントは手を離れる', () => {
  const r = carryingRun(), s = newSanta(3, 3);
  s.pos.y = -1.5;
  eq(stepRun(r, s, 1 / 60, RESP), 'dropped');
  eq(r.carrying, false);
  eq(r.state, 'dropped');
  eq(r.drops, 1);
});

test('stepRun: 落としてから dropDelay 秒で受け取り地点へ戻り、プレゼントを持った状態から', () => {
  const r = carryingRun(), s = newSanta(3, 3);
  s.pos.y = -1.5;
  stepRun(r, s, 1 / 60, RESP);
  let res = null, t = 0;
  while (!res && t < 5) { res = stepRun(r, s, 1 / 60, RESP); t += 1 / 60; }
  eq(res, 'respawn');
  near(t, CFG.dropDelay, 0.05);
  eq(r.carrying, true);
  eq(r.state, 'play');
  eq(r.drops, 1, '落ちている間に何度呼んでも 1 回');
  eq([s.pos.x, s.pos.y, s.pos.z], [1, 0, 0]);
  eq([s.vel.x, s.vel.y, s.vel.z], [0, 0, 0]);
});

test('stepRun: 持たずに落ちたら、すぐ受け取り地点へ戻る（fell）', () => {
  const r = newRun(), s = newSanta(3, 3);
  s.pos.y = -1.5;
  eq(stepRun(r, s, 1 / 60, RESP), 'fell');
  eq([s.pos.x, s.pos.y, s.pos.z], [1, 0, 0]);
  eq(r.state, 'play');
  eq(r.drops, 0);
});

test('dropPresent: 持っていれば落とす。持っていなければ何もしない', () => {
  const r = carryingRun();
  eq(dropPresent(r), true);
  eq(r.state, 'dropped');
  eq(dropPresent(r), false, '落とした後はもう落とせない');
  eq(dropPresent(newRun()), false);
});

// ===== 配達 =====
function chim(x, y, z) { return { x, y, z, base: y - 4, front: { x, z: z + 5 } }; }   // base: 軒の高さ
function standOn(ch) { const s = newSanta(ch.x, ch.z); s.pos.y = ch.y; s.onGround = true; return s; }

test('nearChimney: 煙突の上・横 3m 以内の屋根の上・真上の空中なら true', () => {
  const ch = chim(0, 8, 0);
  eq(nearChimney(standOn(ch), ch), true, '煙突の上');
  const roof = standOn(ch); roof.pos.x = 2.5; roof.pos.y = 5.5; eq(nearChimney(roof, ch), true, '横 2.5m の屋根の上');
  const air = standOn(ch); air.pos.y = 20; air.onGround = false; eq(nearChimney(air, ch), true, '真上 12m の空中');
});

test('nearChimney: 横に 3m より離れている、または軒より低いと false', () => {
  const ch = chim(0, 8, 0);
  const far = standOn(ch); far.pos.x = 3.2; eq(nearChimney(far, ch), false, '横 3.2m');
  const low = standOn(ch); low.pos.y = 3; eq(nearChimney(low, ch), false, '軒（4m）より下＝地面や壁ぎわ');
});

test('tryDeliver: 配達先と別の家の煙突が両方近いときは、配達先に届ける', () => {
  const A = chim(0, 8, 0), B = chim(2, 8, 0), r = newRun([A, B]);
  r.carrying = true;
  const s = standOn(B); s.pos.x = 1;
  eq(tryDeliver(r, s, [B, A]), 'delivered');
  eq(r.target, 1);
});

test('tryDeliver: プレゼントを持っていなければ何も起きない', () => {
  const A = chim(0, 8, 0), r = newRun([A]);
  eq(tryDeliver(r, standOn(A), [A]), null);
});

test('tryDeliver: 目的の煙突で届けると次の目的へ。持ったまま、戻る場所はその家の前', () => {
  const A = chim(0, 8, 0), B = chim(30, 8, 0), r = newRun([A, B]);
  r.carrying = true;
  eq(tryDeliver(r, standOn(A), [A, B]), 'delivered');
  eq(r.target, 1);
  eq(r.carrying, true);
  eq(r.respawn, A.front);
});

test('tryDeliver: 違う家の煙突は wrong で、何も変わらない', () => {
  const A = chim(0, 8, 0), B = chim(30, 8, 0), r = newRun([A, B]);
  r.carrying = true;
  eq(tryDeliver(r, standOn(B), [A, B]), 'wrong');
  eq(r.target, 0);
  eq(r.carrying, true);
});

test('tryDeliver: 最後の 1 軒で cleared。プレゼントはもう持っていない', () => {
  const A = chim(0, 8, 0), r = newRun([A]);
  r.carrying = true;
  eq(tryDeliver(r, standOn(A), [A]), 'cleared');
  eq(r.cleared, true);
  eq(r.carrying, false);
  eq(tryDeliver(r, standOn(A), [A]), null, 'クリア後は何も起きない');
  eq(tryPickup(r, standOn(A), { x: 0, z: 0, y: 8 }), false, 'クリア後はそりでも受け取れない');
});

test('stepRun: 1 軒届けた後に落とすと、その家の前からやり直す', () => {
  const A = chim(0, 8, 0), B = chim(30, 8, 0), r = newRun([A, B]);
  r.carrying = true;
  const s = standOn(A);
  tryDeliver(r, s, [A, B]);
  s.pos.y = -1.5;
  eq(stepRun(r, s, 1 / 60, RESP), 'dropped');
  let res = null;
  for (let i = 0; i < 200 && !res; i++) res = stepRun(r, s, 1 / 60, RESP);
  eq(res, 'respawn');
  eq([s.pos.x, s.pos.z], [0, 5]);
  eq(r.carrying, true);
});

// ===== 塀（高さで越える） =====
// 塀の手前の地面に、塀から 4m 離して高さ h の台を置き、台の上を塀へ向かって走って縁で跳ぶ。塀の上か向こうに立てたら true
function tryOver(h) {
  const Wl = COURSE.wall, front = Wl.z + Wl.t / 2;   // 公園側の面
  const boxes = [makeBox(0, -4, Wl.z, 60, 4, 120), makeBox(0, 0, Wl.z, 60, Wl.h, Wl.t)];
  if (h > 0) boxes.push(makeBox(0, 0, front + 7, 6, h, 6));   // 台は z = front+4〜front+10
  const s = newSanta(0, front + 9);
  s.pos.y = h;
  walk(s, STOP, 0, 0.2, boxes);
  let jumped = false;
  for (let i = 0; i < 600; i++) {
    const jump = !jumped && s.pos.z < front + 4.2;
    if (jump) jumped = true;
    santaStep(s, { x: 0, z: 1, jump }, 0, 1 / 60, boxes);
    if (jumped && s.onGround) break;
  }
  return s.onGround && s.pos.z < front;
}

test('塀: 地面から跳んでも越えられない', () => {
  eq(tryOver(0), false);
});

test('塀: 11m の展望台の縁から跳べば越えられる', () => {
  eq(tryOver(11), true);
});

// ===== 線路（止まっている列車の屋根を中継にする） =====
// 手前の岸を -Z へ走って縁で跳び、列車の屋根に乗れたら屋根の向こう端で跳ぶ。向こう岸に立てたら true
function tryRail(useTrain) {
  const RL = COURSE.rail, TR = COURSE.train, zc = (RL.z0 + RL.z1) / 2;
  const boxes = [makeBox(0, -4, RL.z0 + 20, 60, 4, 40), makeBox(0, -4, RL.z1 - 20, 60, 4, 40)];
  if (useTrain) boxes.push(makeBox(0, -2.5, zc, 60, TR.h, TR.w));
  const roofY = TR.h - 2.5;
  const s = newSanta(0, RL.z0 + 6);
  walk(s, STOP, 0, 0.2, boxes);
  let jumps = 0;
  for (let i = 0; i < 900; i++) {
    const onTrain = s.onGround && Math.abs(s.pos.y - roofY) < 0.05;
    const jump = (jumps === 0 && s.pos.z < RL.z0 + 0.2) || (jumps === 1 && onTrain && s.pos.z < zc - TR.w / 2 + 0.3);
    if (jump) jumps++;
    santaStep(s, { x: 0, z: 1, jump }, 0, 1 / 60, boxes);
    if (s.pos.y < CFG.fallY) return false;
    if (s.onGround && s.pos.z < RL.z1) return true;
  }
  return false;
}

test('線路: 地面から跳んでも向こう岸には届かない', () => {
  eq(tryRail(false), false);
});

test('線路: 止まっている列車の屋根を中継すれば渡れる', () => {
  eq(tryRail(true), true);
});

// ===== 電線 =====
const WIRE = { ax: 'x', c: 0, a0: -5, a1: 5, y: 9 };
function airAt(x, y, z, vx, vz) {
  const s = newSanta(x, z);
  s.pos.y = y; s.vel = { x: vx || 0, y: 0, z: vz || 0 }; s.onGround = false;
  return s;
}

test('wireHit: 空中で、体が電線の高さにあると当たる', () => {
  eq(wireHit(airAt(0, 8, 0), WIRE), true);
});

test('wireHit: 電線より上・下の線より下・端より外・横にずれていると当たらない', () => {
  eq(wireHit(airAt(0, 9.2, 0), WIRE), false, '足元が上の線より上');
  eq(wireHit(airAt(0, 6, 0), WIRE), false, '頭が電線（8.9）より下');
  eq(wireHit(airAt(6, 8, 0), WIRE), false, '端より外');
  eq(wireHit(airAt(0, 8, 0.9), WIRE), true, '横に 0.9m（束の端の線に当たる）');
  eq(wireHit(airAt(0, 8, 1.2), WIRE), false, '横に 1.2m');
});

test('電線: 真下で跳ぶと頭をぶつけて落ちてくる（跳びすぎ）。横に 1.5m ずれて跳べば当たらない', () => {
  const W11 = { ax: 'z', c: 0, a0: -20, a1: 20, y: 11 };
  function jumpUnder(x) {
    const s = newSanta(x, 0);
    walk(s, STOP, 0, 0.2, [ground()]);
    santaStep(s, JUMP, 0, 1 / 60, [ground()]);
    let top = 0, hit = false;
    for (let i = 0; i < 150; i++) {
      santaStep(s, STOP, 0, 1 / 60, [ground()]);
      if (checkWires(s, [W11], 1 / 60)) hit = true;
      top = Math.max(top, s.pos.y);
    }
    return { hit, top };
  }
  const under = jumpUnder(0);
  eq(under.hit, true, '真下');
  eq(under.top < 11, true, '足元は電線より上に行かない。最高 ' + under.top.toFixed(1));
  eq(jumpUnder(1.5).hit, false, '横に 1.5m');
});

test('checkWires: 引っかかると、前へ進む勢いが逆向きに 1/4 になり、下へ落ち始める', () => {
  const s = airAt(0, 8, 0.3, 0, -6);
  eq(checkWires(s, [WIRE], 1 / 60), true);
  near(s.vel.z, 1.5, 1e-9);
  eq(s.vel.y, -3);
});

test('checkWires: 地上では引っかからない。引っかかっている間は二度当たらない', () => {
  const g = airAt(0, 8, 0); g.onGround = true;
  eq(checkWires(g, [WIRE], 1 / 60), false);
  const s = airAt(0, 8, 0);
  checkWires(s, [WIRE], 1 / 60);
  eq(checkWires(s, [WIRE], 1 / 60), false);
});

// ===== 走る車 =====
test('moveCar: z0〜z1 を行き来し、端で折り返す。当たり判定の箱もいっしょに動く', () => {
  const c = newCar(0, 0, -10, 5);
  for (let i = 0; i < 150; i++) moveCar(c, 1 / 60);   // 2.5 秒で 12.5m → -10 で折り返して -7.5
  near(c.z, -7.5, 1e-6);
  eq(c.dir, 1);
  near(c.boxes[0].minZ, -7.5 - 2.1, 1e-6);
});

test('updateCar: 車の前に立っていると、はねられて車の進む向きへ飛ばされる', () => {
  const c = newCar(0, 3, -20, 7);
  const s = newSanta(0, 0); s.onGround = true;
  let res = null;
  for (let i = 0; i < 60 && res !== 'hit'; i++) res = updateCar(c, s, 1 / 60);
  eq(res, 'hit');
  eq(s.vel.y > 0, true);
  eq(s.vel.z < 0, true, '車の進む向き（-Z）へ');
  eq(s.onGround, false);
});

test('updateCar: 屋根の上に立っていると、いっしょに動く', () => {
  const c = newCar(0, 0, -20, 6);
  const s = newSanta(0, 0); s.pos.y = c.boxes[1].maxY; s.onGround = true;
  eq(updateCar(c, s, 0.5), 'ride');
  near(s.pos.z, -3, 1e-9);
  near(c.z, -3, 1e-9);
});

test('updateCar: 離れていれば何も起きない', () => {
  const c = newCar(0, 0, -20, 6);
  const s = newSanta(5, 0); s.onGround = true;
  eq(updateCar(c, s, 1 / 60), null);
});

test('newCar: at を渡すとその位置から、z1 の向きへ走り出す', () => {
  const c = newCar(0, 58, 12, 10, 30);
  eq(c.z, 30);
  near(c.boxes[0].minZ, 30 - 2.1, 1e-9);
  moveCar(c, 0.5);
  near(c.z, 25, 1e-9);
});

// ===== 動き出す列車 =====
function trainFor() { return newTrain([0, 19.5], 0, 18, 3.2, -2.5, 4.5, 39); }   // 屋根は y=2

test('列車: 屋根に乗っていなければ動かない', () => {
  const tr = trainFor(), s = newSanta(0, 10); s.onGround = true;
  for (let i = 0; i < 60; i++) updateTrain(tr, s, 1 / 60);
  eq(tr.speed, 0);
  eq(tr.cars[0].x, 0);
});

test('列車: 屋根に乗って trainDelay 秒たつと走り出し、サンタもいっしょに運ぶ', () => {
  const tr = trainFor(), s = newSanta(0, 0); s.pos.y = 2; s.onGround = true;
  let started = 0;
  for (let i = 0; i < 90; i++) if (updateTrain(tr, s, 1 / 60) === 'start') started++;
  eq(started, 1, '走り出した瞬間は 1 回');
  eq(tr.speed > 0, true);
  near(s.pos.x, tr.cars[0].x, 1e-9, 'サンタと車両が同じだけ動く');
});

test('列車: 降りると止まる', () => {
  const tr = trainFor(), s = newSanta(0, 0); s.pos.y = 2; s.onGround = true;
  for (let i = 0; i < 120; i++) updateTrain(tr, s, 1 / 60);
  s.onGround = false;
  for (let i = 0; i < 180; i++) updateTrain(tr, s, 1 / 60);
  eq(tr.speed, 0);
});

test('列車: 端を越えた車両は反対側へ回る', () => {
  const tr = newTrain([19], 0, 18, 3.2, -2.5, 4.5, 39);
  shiftTrain(tr, 1);   // 20 > 19.5 → 20 - 39 = -19
  eq(tr.cars[0].x, -19);
  near(tr.cars[0].box.minX, -28, 1e-9);
});

test('列車: 乗ったまま街の端まで運ばれると、トンネルの入口にぶつかって列車の横から落ちる（壁の上に持ち上げられない）', () => {
  const tr = newTrain([0], 0, 18, 3.2, -2.5, 4.5, 200);
  const wall = makeBox(6, -10, 0, 2, 220, 10);   // x = 5〜7 の高い壁（街の端の代わり）
  const s = newSanta(0, 0); s.pos.y = 2; s.onGround = true;
  let top = 0, scraped = 0;
  for (let i = 0; i < 600; i++) {
    const boxes = [tr.cars[0].box, wall];
    if (updateTrain(tr, s, 1 / 60, boxes) === 'scraped') scraped++;
    santaStep(s, STOP, 0, 1 / 60, boxes);
    top = Math.max(top, s.pos.y);
    if (s.pos.y < -5) break;
  }
  eq(scraped, 1, 'ぶつかったのは 1 回');
  eq(top < 3, true, '持ち上げられない。最高 ' + top.toFixed(1));
  eq(s.pos.z > 1.6, true, '列車の横へはじき出された');
  eq(s.pos.y < -5, true, '線路へ落ちた');
});

test('moveBody: 横から箱にめり込んでいても、その箱のてっぺんへ持ち上げられない', () => {
  const b = { pos: { x: 0, y: 2, z: 0 }, vel: { x: 0, y: 0, z: 0 }, onGround: false };
  moveBody(b, 1 / 60, [makeBox(0, -10, 0, 2, 220, 2)]);
  eq(b.pos.y < 3, true, 'y=' + b.pos.y.toFixed(1));
});

// ===== 逃げる家 =====
function runawayFor() {
  const boxes = [makeBox(0, 0, 0, 9, 4.5, 8), makeBox(0, 4.5, 0, 9.8, 1, 8.8)];   // 壁と屋根（屋根の上は y=5.5）
  const ch = { x: 2, y: 8, z: 1, base: 4.5, front: { x: 0, z: 6.5 } };
  return newRunaway(0, 0, boxes, ch, { x0: -20, x1: 20, z0: -20, z1: 20 });
}
function groundAt(x, z) { const s = newSanta(x, z); s.onGround = true; return s; }

test('逃げる家: 遠ければ動かない', () => {
  const h = runawayFor();
  eq(stepRunaway(h, groundAt(30, 0), 0.5, true), null);
  eq(h.x, 0);
});

test('逃げる家: 地上で近づくと離れる向きに逃げ、箱・煙突・家の前もいっしょに動く', () => {
  const h = runawayFor();
  eq(stepRunaway(h, groundAt(-8, 0), 0.5, true), 'flee');
  const m = CFG.fleeSpeed * 0.5;
  near(h.x, m, 1e-9);
  near(h.boxes[0].minX, -4.5 + m, 1e-9);
  near(h.chimney.x, 2 + m, 1e-9);
  near(h.chimney.front.x, m, 1e-9);
  eq(h.fleeing, true);
});

test('逃げる家: 範囲の端で止まる', () => {
  const h = runawayFor();
  moveRunaway(h, 19.9, 0);
  stepRunaway(h, groundAt(12, 0), 0.5, true);
  near(h.x, 20, 1e-9);
});

test('逃げる家: 空中のサンタからは逃げない', () => {
  const h = runawayFor(), s = newSanta(-6, 0);
  s.pos.y = 8; s.onGround = false;
  eq(stepRunaway(h, s, 0.5, true), null);
  eq(h.x, 0);
});

test('逃げる家: 屋根に乗っている間は止まり、降りるとまた逃げる', () => {
  const h = runawayFor(), s = newSanta(0, 0);
  s.pos.y = 5.5; s.onGround = true;
  eq(stepRunaway(h, s, 1 / 60, true), 'caught');
  eq(stepRunaway(h, s, 1 / 60, true), null, '乗っている間');
  eq(h.x, 0);
  eq(stepRunaway(h, groundAt(-6, 0), 0.5, true), 'flee', '降りた');
});

test('逃げる家: 配達先でなければ（active でない）逃げない。resetRunaway で元の場所へ', () => {
  const h = runawayFor();
  eq(stepRunaway(h, groundAt(-6, 0), 0.5, false), null);
  stepRunaway(h, groundAt(-6, 0), 0.5, true);
  resetRunaway(h);
  eq([h.x, h.z, h.chimney.x, h.caught], [0, 0, 2, false]);
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
