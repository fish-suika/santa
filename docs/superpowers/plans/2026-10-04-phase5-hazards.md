# Phase 5 現実寄りの障害（電線・走る車） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**本人の選択:** 電線・走る車（工事中の穴・つららは見送り）

**Goal:**
- **電線**: 電柱の間、高さ 8〜10m（上の線 y と下の線 y-0.4）。空中で引っかかると「ビヨーン」と鳴る。前へ進む勢いが逆向きに 1/4 になり、真下へ落ち始める（下向き 3 m/s）。プレゼントは落とさない。地上（屋根の上を含む）では引っかからない。避け方は「電線の無い所から跳ぶ／上を越える」
- **走る車**: 道路の片側の車線を秒速 7m で行き来する。前や横にいるとはねられ（クラクション）、持っていればプレゼントを落とす。屋根に乗っていればいっしょに運ばれる。避け方は「歩道を通る／屋根に飛び乗る」

**Architecture:** 当たり判定と動きは three.js 非依存の `18-hazards.js`（verify で試す）。見た目は `34-hazards-view.js`。車の当たり判定の箱は `PHYS.boxes` に入れて毎フレーム動かす（サンタが屋根に着地できる）。

**前提:** verify 60/60。

---

### Task 1: 当たり判定と動き（three.js 非依存）

**Files:** Modify `src/10-config.js`, `build.sh`, `src/verify-tests.js`; Create `src/18-hazards.js`

- [ ] **Step 1: `src/10-config.js`** — `CFG` の `beaconMinY` の行の次に足す

```js

  // 障害
  snagTime: 0.4,        // 電線に引っかかってから、また引っかかるようになるまでの秒数
```

`COURSE` の `targets: [...]` の閉じ `],` の次に足す

```js
  wires: [   // 電線。ax 方向に a0〜a1、もう一方の座標が c、上の線の高さ y（下の線は y-0.4）。両端に電柱
    { ax: 'z', c: 6.5, a0: 12, a1: 40, y: 9 },       // 1 住宅街：右の歩道の外側に沿って
    { ax: 'x', c: -20, a0: -6.5, a1: 6.5, y: 9 },    // 2 商店街：道路をまたぐ
    { ax: 'z', c: -6.5, a0: -10, a1: -40, y: 9 },    // 2 商店街：左の歩道の外側に沿って（2 軒目の手前）
    { ax: 'x', c: -100, a0: 8, a1: 28, y: 10 },      // 3 公園：展望台の手前
    { ax: 'x', c: -135, a0: -6.5, a1: 6.5, y: 8 },   // 4 高架下：道路をまたぐ
  ],
  cars: [    // 走る車。x は固定で、z0 から走り出して z0〜z1 を行き来する
    { x: -2, z0: 58, z1: 12, speed: 7, color: 0xf1c40f },     // 1 住宅街
    { x: 2, z0: -10, z1: -44, speed: 7, color: 0xe67e22 },    // 2 商店街
    { x: 2, z0: -120, z1: -157, speed: 7, color: 0x8e44ad },  // 4 高架下
  ],
```

- [ ] **Step 2: `build.sh`** — 本体と検証ページの両方で `src/16-run.js \` の次の行に `src/18-hazards.js \`。本体だけ `src/30-world.js \` の次の行に `src/34-hazards-view.js \`（Task 2 で作る。それまでは空ファイル）

- [ ] **Step 3: テスト** — `// ===== 結果表示 =====` の直前に足す

```js
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
  eq(wireHit(airAt(0, 6, 0), WIRE), false, '頭が下の線（8.6）より下');
  eq(wireHit(airAt(6, 8, 0), WIRE), false, '端より外');
  eq(wireHit(airAt(0, 8, 1), WIRE), false, '横に 1m');
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
```

- [ ] **Step 4: `src/18-hazards.js`**

```js
// ===== 障害：電線と走る車（three.js に依存しない） =====

// 電線 w に体が当たっているか。w は ax 方向（'x' か 'z'）に a0〜a1、もう一方の座標が c、上の線の高さ y（下の線は y-0.4）
function wireHit(s, w) {
  const r = CFG.santaHalf, o = w.ax === 'x' ? 'z' : 'x';
  if (s.pos[w.ax] + r < Math.min(w.a0, w.a1) || s.pos[w.ax] - r > Math.max(w.a0, w.a1)) return false;
  if (Math.abs(s.pos[o] - w.c) > r + 0.1) return false;
  return s.pos.y < w.y + 0.1 && s.pos.y + CFG.santaHeight > w.y - 0.4;
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
```

- [ ] **Step 5:** `src/34-hazards-view.js` を空ファイルで作り、`sh build.sh` → verify `PASS 68/68`

- [ ] **Step 6: Commit** — `git add -A && git commit -m "電線と走る車の当たり判定と動き"`

---

### Task 2: 見た目・音・つなぎ込み

**Files:** Write `src/34-hazards-view.js`; Modify `src/20-sound.js`, `src/90-boot.js`

- [ ] **Step 1: `src/34-hazards-view.js`**

```js
// ===== 電線と走る車の見た目 =====
const HZ = { wires: [], cars: [] };

// 電線（2 本の線）と、両端の電柱（電柱は当たり判定あり）
function buildWires() {
  for (const w of COURSE.wires) {
    const len = Math.abs(w.a1 - w.a0), mid = (w.a0 + w.a1) / 2;
    const g = new THREE.Group();
    for (const dy of [0, -0.4]) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, len, 6), mat(0x15171c));
      if (w.ax === 'x') { m.rotation.z = Math.PI / 2; m.position.set(mid, w.y + dy, w.c); }
      else { m.rotation.x = Math.PI / 2; m.position.set(w.c, w.y + dy, mid); }
      g.add(m);
    }
    W.scene.add(g);
    for (const a of [w.a0, w.a1]) {
      const px = w.ax === 'x' ? a : w.c, pz = w.ax === 'x' ? w.c : a;
      solid(px, 0, pz, 0.3, w.y + 0.8, 0.3, mat(0x5a4a3a));
      deco(new THREE.BoxGeometry(w.ax === 'x' ? 0.15 : 1.4, 0.15, w.ax === 'x' ? 1.4 : 0.15), mat(0x5a4a3a), px, w.y + 0.3, pz);
    }
    w.shake = 0;
    HZ.wires.push({ w, g });
  }
}

// 走る車の見た目（Z 方向に長い。正面は -Z。ヘッドライトとテールランプ付き）
function carMesh(color) {
  const g = new THREE.Group();
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  add(new THREE.BoxGeometry(1.9, 0.9, 4.2), mat(color), 0, 0.8, 0);
  add(new THREE.BoxGeometry(1.7, 0.75, 2.3), mat(0x2a3140), 0, 1.625, 0);
  add(new THREE.BoxGeometry(1.6, 0.08, 2.2), mat(COL.snow), 0, 2.04, 0);
  for (const sx of [-0.6, 0.6]) {
    add(new THREE.BoxGeometry(0.4, 0.2, 0.05), mat(0x000000, 0xfff2c0), sx, 0.95, -2.12);   // ヘッドライト
    add(new THREE.BoxGeometry(0.4, 0.2, 0.05), mat(0x000000, 0xff3030), sx, 0.95, 2.12);    // テールランプ
  }
  const wg = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  for (const sx of [-0.85, 0.85]) for (const sz of [-1.35, 1.35]) {
    const wh = add(wg, mat(0x15171c), sx, 0.36, sz);
    wh.rotation.z = Math.PI / 2;
  }
  W.scene.add(g);
  return g;
}

function buildCars() {
  for (const cd of COURSE.cars) {
    const c = newCar(cd.x, cd.z0, cd.z1, cd.speed);
    for (const b of c.boxes) PHYS.boxes.push(b);
    c.mesh = carMesh(cd.color);
    HZ.cars.push(c);
  }
}

function updateHazardViews(dt, t) {
  for (const hw of HZ.wires) {
    hw.w.shake = Math.max(0, hw.w.shake - dt * 2);
    hw.g.position.y = Math.sin(t * 40) * 0.25 * hw.w.shake;   // 引っかかった電線がビヨンと揺れる
  }
  for (const c of HZ.cars) {
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.dir > 0 ? Math.PI : 0;   // 進む向きに正面（-Z）を向ける
  }
}
```

- [ ] **Step 2: `src/20-sound.js`** — 末尾に足す

```js

// 電線「ビヨーン」（音程が揺れながら下がる）
function sndBoing() {
  const c = SND.ctx;
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(260, t);
  o.frequency.exponentialRampToValueAtTime(120, t + 0.5);
  const lfo = c.createOscillator(); lfo.frequency.value = 18;
  const lg = c.createGain(); lg.gain.value = 60;
  lfo.connect(lg); lg.connect(o.frequency);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
  o.connect(g); g.connect(SND.out);
  o.start(t); lfo.start(t);
  o.stop(t + 0.6); lfo.stop(t + 0.6);
}

// クラクション「プップー」
function sndHonk() {
  const c = SND.ctx;
  if (!c) return;
  const t = c.currentTime;
  for (const f of [440, 554]) {
    sndTone(f, t, 0.12, 'square', 0.08);
    sndTone(f, t + 0.16, 0.3, 'square', 0.08);
  }
}
```

- [ ] **Step 3: `src/90-boot.js`**

(a) `buildWorld();` の次の行に

```js
  buildWires();
  buildCars();
```

(b) `santaStep(santa, mv, CAM.yaw, dt, PHYS.boxes);` の**直前**に足す（車を先に動かす。屋根に乗っていればいっしょに運ぶ）

```js
      for (const c of HZ.cars) {
        if (updateCar(c, santa, dt) !== 'hit') continue;
        sndHonk();
        if (dropPresent(run)) {
          throwPresent(sm);
          sndDrop();
          showToast('車にはねられて、プレゼントを落とした！', CFG.dropDelay);
        } else {
          showToast('車にはねられた！', 1.2);
        }
      }
```

(c) `santaStep(santa, mv, CAM.yaw, dt, PHYS.boxes);` の**直後**に足す

```js
      if (checkWires(santa, COURSE.wires, dt)) {
        sndBoing();
        showToast('電線に引っかかった！', 1.0);
      }
```

(d) `updateFx(dt);` の次の行に

```js
    updateHazardViews(dt, t);
```

- [ ] **Step 4:** `sh build.sh` → verify `PASS 68/68` のまま

- [ ] **Step 5: Commit** — `git add -A && git commit -m "電線と走る車の見た目・音・つなぎ込み"`

### Task 3: 確かめる（コントローラ担当）
