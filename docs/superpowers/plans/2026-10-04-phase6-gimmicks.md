# Phase 6 理不尽ギミック（動き出す列車・逃げる家） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**本人の選択（2026-10-04）:** 「家が逃げる」と「列車が動き出す」。ほかの候補（魚・スケートリンク・巨大な目・月・巨大化・壁と穴）は見送り。

**列車が動き出す（2 商店街の線路）**
- 屋根に乗って trainDelay（0.5 秒）たつと、汽笛を鳴らして +X へ走り出す（trainAccel 5 m/s² で trainSpeed 9 m/s まで）
- 乗っていればサンタもいっしょに運ぶ。降りると止まる（同じ加速度で減速）
- 乗ったままだと街の端（x=40）の見えない壁でサンタが止まり、下を列車が抜けていって線路に落ちる（＝プレゼントを落とす）。対処はすぐ向こう岸へ跳ぶこと
- 車両は 8 両（中心 x = -78〜58.5、19.5m おき）。x が 78 を越えた車両は -78 側へ回る（一周 156m）。止まっている間は道路の真ん中（x=0）に車両がある

**家が逃げる（3 公園の 3 軒目）**
- その家がいまの配達先のとき、**地上の**サンタが家の中心から fleeRange（12m）以内に来ると、サンタから離れる向きに fleeSpeed（4.5 m/s）で逃げる。公園の中（中心 x=-34〜34、z=-108〜-76）だけ
- サンタが空中にいる間は止まる（家は上を見ていない）。屋根に乗ると「つかまえた！」で、それ以上逃げない。そのまま煙突の近くで届けられる
- 逃げている間は家が持ち上がって脚が 4 本生え、トコトコ跳ねる（見た目だけ。当たり判定は地面のまま）
- 煙突・光の柱・「その家の前」（やり直し地点）も家といっしょに動く
- 「もう一度」で元の場所に戻る

**Architecture:** 動きの計算は `18-hazards.js` に足す（three.js 非依存、verify で試す）。列車の見た目は `30-world.js` の `train()` を削除して `34-hazards-view.js` の `buildTrain()` に移す（車両ごとに Group にして動かす）。逃げる家は `buildWorld()` から外し、`buildRunaway()` で `house()` を呼んで、そのとき増えたメッシュと当たり判定の箱を捕まえて動かす。

**前提:** verify 70/70。

---

### Task 1: 動きの計算（three.js 非依存）

**Files:** Modify `src/10-config.js`, `src/18-hazards.js`, `src/verify-tests.js`

- [ ] **Step 1: `src/10-config.js`** — `CFG` の `snagTime` の行の次に足す

```js

  // 理不尽ギミック
  trainDelay: 0.5,      // 列車の屋根に乗ってから走り出すまでの秒数
  trainSpeed: 9,        // 列車の最高速度 m/s
  trainAccel: 5,        // 列車の加速・減速 m/s²
  fleeRange: 12,        // 逃げる家：地上のサンタが家の中心からこの距離以内に来ると逃げる
  fleeSpeed: 4.5,       // 逃げる家の速さ m/s（歩き 6 m/s より少し遅い）
```

`COURSE` の `cars: [ ... ],` の次に足す

```js
  runaway: { x: -24, z: -88, target: 2, bounds: { x0: -34, x1: 34, z0: -108, z1: -76 } },   // 逃げる家（3 軒目）。中心がこの範囲で動く
```

- [ ] **Step 2: `src/18-hazards.js`** — 末尾に足す

```js

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
  return { cars: xs.map(x => ({ x, box: makeBox(x, y0, zc, len, h, w) })), span, speed: 0, ride: 0 };
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
// 乗っていればサンタもいっしょに運ぶ。返り値: 'start'（走り出した瞬間）／'ride'（乗っている）／null
function updateTrain(tr, s, dt) {
  const riding = standingOn(s, tr.cars.map(c => c.box));
  tr.ride = riding ? tr.ride + dt : 0;
  const want = riding && tr.ride >= CFG.trainDelay ? CFG.trainSpeed : 0;
  const was = tr.speed;
  tr.speed = want > tr.speed ? Math.min(want, tr.speed + CFG.trainAccel * dt)
                             : Math.max(want, tr.speed - CFG.trainAccel * dt);
  const dx = tr.speed * dt;
  if (dx) shiftTrain(tr, dx);
  if (riding) s.pos.x += dx;
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

// 家を逃がす。active（その家がいまの配達先）で、地上のサンタが fleeRange 以内なら、離れる向きに fleeSpeed で逃げる。
// 空中のサンタからは逃げない（上は見ていない）。屋根に乗られたら caught。返り値: 'flee'／'caught'（つかまった瞬間）／null
function stepRunaway(h, s, dt, active) {
  h.fleeing = false;
  if (h.caught || !active) return null;
  if (standingOn(s, h.boxes)) { h.caught = true; return 'caught'; }
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
```

- [ ] **Step 3: テスト** — `// ===== 結果表示 =====` の直前に足す

```js
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

test('逃げる家: 屋根に乗るとつかまえて、それ以上逃げない', () => {
  const h = runawayFor(), s = newSanta(0, 0);
  s.pos.y = 5.5; s.onGround = true;
  eq(stepRunaway(h, s, 1 / 60, true), 'caught');
  eq(stepRunaway(h, groundAt(-6, 0), 0.5, true), null);
  eq(h.x, 0);
});

test('逃げる家: 配達先でなければ（active でない）逃げない。resetRunaway で元の場所へ', () => {
  const h = runawayFor();
  eq(stepRunaway(h, groundAt(-6, 0), 0.5, false), null);
  stepRunaway(h, groundAt(-6, 0), 0.5, true);
  resetRunaway(h);
  eq([h.x, h.z, h.chimney.x, h.caught], [0, 0, 2, false]);
});
```

- [ ] **Step 4:** `sh build.sh` → verify `PASS 80/80`

- [ ] **Step 5: Commit** — `git add -A && git commit -m "動き出す列車と逃げる家の動き（計算）"`

---

### Task 2: 見た目・音・つなぎ込み

**Files:** Modify `src/30-world.js`, `src/34-hazards-view.js`, `src/20-sound.js`, `src/90-boot.js`

- [ ] **Step 1: `src/30-world.js`**
  - `train(zc)` 関数（上のコメント 1 行「掘割の底に止まっている列車。…」を含む）を丸ごと削除
  - `buildWorld()` の `train(railZ);` の行を削除し、その上のコメント `// 線路（見た目だけ）と、真ん中に止まっている列車` を `// 線路（見た目だけ）。止まっている列車は buildTrain()（34-hazards-view.js）で置く` に
  - 3 公園の `house(-24, -88, 9, 8, 4.5, 0xa9c3a0);          // ★ 3 軒目（公園のそばの家）` の行を `// ★ 3 軒目は逃げる家。buildRunaway()（34-hazards-view.js）で置く` に置き換える

- [ ] **Step 2: `src/34-hazards-view.js`**
  - 先頭の `const HZ = { wires: [], cars: [] };` を `const HZ = { wires: [], cars: [], train: null, runaway: null };` に
  - `buildCars()` の後に足す

```js

// 掘割の底に止まっている列車（8 両、19.5m おき。車両ごとに Group にして動かす。屋根に乗れる）
function buildTrain() {
  const RL = COURSE.rail, TR = COURSE.train, zc = (RL.z0 + RL.z1) / 2, top = -2.5 + TR.h;
  const xs = [];
  for (let k = -4; k <= 3; k++) xs.push(k * 19.5);   // 止まっている間は x=0（道路の真ん中）に車両がある
  const tr = newTrain(xs, zc, 18, TR.w, -2.5, TR.h, 8 * 19.5);
  for (const c of tr.cars) {
    PHYS.boxes.push(c.box);
    const g = new THREE.Group();
    const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
    add(new THREE.BoxGeometry(18, TR.h, TR.w), mat(0x2f6f4f), 0, -2.5 + TR.h / 2, zc);
    add(new THREE.BoxGeometry(18, 0.12, TR.w - 0.2), mat(COL.snow), 0, top + 0.06, zc);           // 屋根の雪
    for (const sd of [1, -1]) {
      add(new THREE.BoxGeometry(18.02, 0.35, 0.05), mat(0xd8322c), 0, top - 2.6, zc + sd * (TR.w / 2 + 0.01));   // 赤い帯
      for (let wx = -7.5; wx <= 7.5; wx += 2.5) {                                                    // 明かりのついた窓
        const win = add(new THREE.PlaneGeometry(1.6, 1.0), mat(0x000000, COL.glass), wx, top - 1.4, zc + sd * (TR.w / 2 + 0.02));
        if (sd < 0) win.rotation.y = Math.PI;
      }
    }
    g.position.x = c.x;
    W.scene.add(g);
    c.group = g;
  }
  HZ.train = tr;
}

// 逃げる家（3 軒目）。house() を呼んで、そのとき増えたメッシュと当たり判定の箱を捕まえ、いっしょに動かす
function buildRunaway() {
  const RA = COURSE.runaway;
  const nBox = PHYS.boxes.length, nObj = W.scene.children.length;
  house(RA.x, RA.z, 9, 8, 4.5, 0xa9c3a0);
  const boxes = PHYS.boxes.slice(nBox), meshes = W.scene.children.slice(nObj);
  for (const m of meshes) m.userData.base = m.position.clone();
  const ra = newRunaway(RA.x, RA.z, boxes, W.houses[W.houses.length - 1].chimney, RA.bounds);
  ra.meshes = meshes;
  ra.target = RA.target;
  ra.lift = 0;
  ra.noticed = false;
  // 脚（逃げている間だけ見える）
  ra.legs = [];
  for (const lx of [-2.5, 2.5]) for (const lz of [-2, 2]) {
    const leg = deco(new THREE.CylinderGeometry(0.25, 0.2, 1.2, 8), mat(0x8a5a3a), RA.x + lx, 0.6, RA.z + lz);
    leg.visible = false;
    leg.userData.base = leg.position.clone();
    ra.legs.push(leg);
  }
  HZ.runaway = ra;
}
```

  - `updateHazardViews()` の最後（関数の閉じ `}` の直前）に足す

```js
  if (HZ.train) for (const c of HZ.train.cars) c.group.position.x = c.x;
  const ra = HZ.runaway;
  if (ra) {
    // 逃げている間は家が持ち上がって脚が生え、トコトコ跳ねる（見た目だけ。当たり判定は地面のまま）
    const running = ra.fleeing && !ra.caught;
    ra.lift += ((running ? 1.2 : 0) - ra.lift) * Math.min(1, dt * 8);
    const bob = running ? Math.abs(Math.sin(t * 12)) * 0.35 : 0;
    const ox = ra.x - ra.x0, oz = ra.z - ra.z0, up = ra.lift + bob;
    for (const m of ra.meshes) m.position.set(m.userData.base.x + ox, m.userData.base.y + up, m.userData.base.z + oz);
    ra.legs.forEach((L, i) => {
      L.visible = ra.lift > 0.1;
      L.position.set(L.userData.base.x + ox, up / 2, L.userData.base.z + oz);
      L.scale.y = Math.max(0.01, up / 1.2);
      L.rotation.x = running ? Math.sin(t * 12 + i * Math.PI) * 0.5 : 0;
    });
  }
```

- [ ] **Step 3: `src/20-sound.js`** — 末尾に足す

```js

// 汽笛「ポーッ」（3 つの音を重ねる）
function sndWhistle() {
  const c = SND.ctx;
  if (!c) return;
  const t = c.currentTime;
  for (const f of [587, 740, 880]) sndTone(f, t, 0.9, 'triangle', 0.07);
}

// 家が逃げる足音「トコトコトコ」
function sndScurry() {
  const c = SND.ctx;
  if (!c) return;
  const t = c.currentTime;
  for (let i = 0; i < 8; i++) sndTone(i % 2 ? 660 : 520, t + i * 0.07, 0.06, 'square', 0.06);
}
```

- [ ] **Step 4: `src/90-boot.js`**
  - `buildCars();` の次の行に

```js
  buildTrain();
  buildRunaway();
```

  - 「もう一度」の click の中、`clearThrown(sm);` の次の行に

```js
    resetRunaway(HZ.runaway);
    HZ.runaway.noticed = false;
```

  - `for (const c of HZ.cars) {` で始まる車の処理ブロック（閉じ `}` まで）の**直後**に足す

```js
      // 理不尽ギミック：動き出す列車・逃げる家
      if (updateTrain(HZ.train, santa, dt) === 'start') {
        sndWhistle();
        showToast('列車が動き出した！？', 1.6);
      }
      const ra = HZ.runaway, raRes = stepRunaway(ra, santa, dt, run.state === 'play' && run.target === ra.target);
      if (raRes === 'flee' && !ra.noticed) {
        ra.noticed = true;
        sndScurry();
        showToast('家が逃げた！？', 1.6);
      } else if (raRes === 'caught') {
        showToast('つかまえた！', 1.2);
      }
```

- [ ] **Step 5:** `sh build.sh` → verify `PASS 80/80`。`grep -n "function train\|train(railZ)\|house(-24, -88" src/30-world.js` で何も出ないこと

- [ ] **Step 6: Commit** — `git add -A && git commit -m "動き出す列車と逃げる家の見た目・音・つなぎ込み"`

### Task 3: 確かめる（コントローラ担当）
