# Phase 5 手直し：歩道の上の電線・広い車道とたくさんの速い車 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**本人の感想（2026-10-04）**
1. 電線が道路の真上にあるのはおかしい → 歩道の上に置く
2. 電線に当たってもプレゼントを落とさないので障害にならない → 当たったら落とす
3. 車はジャンプすれば当たらないし、車道も狭く、車道を長く歩くこともないので、基本ぶつからない → 車を速く、車道を広く、台数を増やす

**変更**
- 車道を 8m → **16m**（x = -8〜8）。歩道は x = ±8〜10。通行止めの柵も 16m 幅に
- 車線は 4 本（x = -5.5, -2, 2, 5.5）。各区画に 4 台、計 12 台、秒速 11〜12.5m（走る速さの約 2 倍）。走り出す位置をずらして、同じ車線の車は 1 台だけにする
- 電線の束は**両側の歩道の真上**（x = ±9、高さ 11m）。電柱は歩道の上（両端）に立つ。当たったら**プレゼントを落とす**
- 道路が広がるぶん、商店街の店を x = ±12 → ±15 へずらす。道路上に止めてあった車 2 台は外す。街灯は歩道の外へ
- スタートとそりを道路の外（歩道の東）へ移す。始めた瞬間に車道を渡らずにそりへ行ける

---

### Task 1: 数値と車の走り出す位置

**Files:** Modify `src/10-config.js`, `src/18-hazards.js`, `src/verify-tests.js`

- [ ] **Step 1: `src/10-config.js`** — `COURSE` の 3 行

```js
  start: { x: 0, z: 45 },
  sleigh: { x: 9, z: 44 },               // プレゼントの受け取り地点（そり）
  respawn: { x: 7, z: 44 },              // 1 軒目を届けるまでに落ちたら戻る場所（そりの横）
```

を

```js
  start: { x: 12, z: 50 },               // 歩道の東の雪の上（車道を渡らずにそりへ行ける）
  sleigh: { x: 13, z: 44 },              // プレゼントの受け取り地点（そり）
  respawn: { x: 11, z: 44 },             // 1 軒目を届けるまでに落ちたら戻る場所（そりの横）
```

に置き換える。`wires: [ ... ],` と `cars: [ ... ],` を丸ごと次に置き換える

```js
  wires: [   // 電線の束（3 本）。ax 方向に a0〜a1、もう一方の座標 c を中心に横 ±0.6m、高さ y。両側の歩道の真上（x = ±9）
              // 当たるとプレゼントを落とす。歩道や車道の端で跳ぶと当たる。車道の真ん中寄りから跳べば当たらない
    { ax: 'z', c: 9, a0: 21, a1: 40, y: 11 },  { ax: 'z', c: -9, a0: 21, a1: 40, y: 11 },     // 1 住宅街
    { ax: 'z', c: 9, a0: -10, a1: -42, y: 11 }, { ax: 'z', c: -9, a0: -10, a1: -42, y: 11 },  // 2 商店街
    { ax: 'z', c: 9, a0: -120, a1: -138, y: 11 }, { ax: 'z', c: -9, a0: -120, a1: -138, y: 11 },  // 4 高架下
  ],
  cars: [    // 走る車。x は固定。at から走り出し、まず z1 の向きへ進み、z0〜z1 を行き来する。車線は x = -5.5, -2, 2, 5.5（1 車線に 1 台）
    { x: -5.5, z0: 58, z1: 12, at: 58, speed: 12, color: 0xf1c40f },      // 1 住宅街
    { x: -2, z0: 58, z1: 12, at: 25, speed: 11, color: 0x3498db },
    { x: 2, z0: 12, z1: 58, at: 40, speed: 12.5, color: 0xe74c3c },
    { x: 5.5, z0: 12, z1: 58, at: 15, speed: 11.5, color: 0xecf0f1 },
    { x: -5.5, z0: -10, z1: -44, at: -10, speed: 12, color: 0xe67e22 },   // 2 商店街
    { x: -2, z0: -10, z1: -44, at: -30, speed: 11, color: 0x1abc9c },
    { x: 2, z0: -44, z1: -10, at: -40, speed: 12.5, color: 0x9b59b6 },
    { x: 5.5, z0: -44, z1: -10, at: -20, speed: 11.5, color: 0xf1c40f },
    { x: -5.5, z0: -120, z1: -157, at: -120, speed: 12, color: 0x8e44ad }, // 4 高架下
    { x: -2, z0: -120, z1: -157, at: -140, speed: 11, color: 0xe74c3c },
    { x: 2, z0: -157, z1: -120, at: -150, speed: 12.5, color: 0x3498db },
    { x: 5.5, z0: -157, z1: -120, at: -125, speed: 11.5, color: 0xecf0f1 },
  ],
```

- [ ] **Step 2: `src/18-hazards.js`** — `newCar` を次に置き換える

```js
// 走る車。x は固定。at（省略なら z0）から走り出し、まず z1 の向きへ進み、z0〜z1 を行き来する。
// boxes は当たり判定（[0] 車体、[1] 屋根）。PHYS.boxes にも入れて動かすので、サンタが屋根に着地できる
function newCar(x, z0, z1, speed, at) {
  const z = at === undefined ? z0 : at;
  return {
    x, z, z0, z1, speed, dir: z1 > z0 ? 1 : -1,
    boxes: [makeBox(x, 0.35, z, 1.9, 0.9, 4.2), makeBox(x, 1.25, z, 1.7, 0.75, 2.3)],
  };
}
```

（その上にあった古いコメント 2 行「走る車。x は固定で…」「boxes は当たり判定…」は削除して、上のコメントにまとめる）

- [ ] **Step 3: テスト** — `// ===== 結果表示 =====` の直前に足す

```js
test('newCar: at を渡すとその位置から、z1 の向きへ走り出す', () => {
  const c = newCar(0, 58, 12, 10, 30);
  eq(c.z, 30);
  near(c.boxes[0].minZ, 30 - 2.1, 1e-9);
  moveCar(c, 0.5);
  near(c.z, 25, 1e-9);
});
```

- [ ] **Step 4:** `sh build.sh` → verify `PASS 70/70`

---

### Task 2: 広い車道・歩道の上の電線・電線で落とす

**Files:** Modify `src/30-world.js`, `src/34-hazards-view.js`, `src/90-boot.js`

- [ ] **Step 1: `src/30-world.js`** の `road()` と `barrier()` を次に置き換える

```js
// z0〜z1 の車道（x = -8〜8、4 車線）と両側の歩道（x = ±8〜10、高さ 0.15m）
function road(z0, z1) {
  const zc = (z0 + z1) / 2, d = Math.abs(z1 - z0);
  const r = deco(new THREE.PlaneGeometry(16, d), mat(COL.road), 0, 0.01, zc);
  r.rotation.x = -Math.PI / 2;
  for (const lx of [-3.75, 0, 3.75]) {   // 車線の白線（見た目だけ）
    const ln = deco(new THREE.PlaneGeometry(0.15, d), mat(0x9aa3b5), lx, 0.015, zc);
    ln.rotation.x = -Math.PI / 2;
  }
  solid(9, 0, zc, 2, 0.15, d, mat(COL.walk));
  solid(-9, 0, zc, 2, 0.15, d, mat(COL.walk));
}

// 通行止めの柵（車道の端。歩いては出られない。跳べば越えられる）
function barrier(z) {
  solid(0, 0, z, 16, 1.0, 0.3, mat(0xe0913a));
}
```

- [ ] **Step 2: `buildWorld()` の中**
  - 1 住宅街：`car(2, 30, false, 0xc0392b);` の行を削除。`lamp(7, 20, true); lamp(-7, 38);` を `lamp(10.5, 20, true); lamp(-10.5, 38);` に
  - 2 商店街：`shop(12, ` を 3 か所とも `shop(15, ` に、`shop(-12, ` を 2 か所とも `shop(-15, ` に。`car(-2, -24, false, 0x2e86c1);` の行を削除。`lamp(5, -20, true);` を `lamp(9.5, -20, true);` に
  - 4 高架下：`lamp(6, -125, true);` を `lamp(10.5, -125, true);` に

- [ ] **Step 3: `src/34-hazards-view.js`**
  - `buildWires()` の電柱の部分（`for (const a of [w.a0, w.a1]) { ... }` のブロック全体、腕木の `deco(...)` を含む）を次に置き換え、関数の上のコメントも差し替える

```js
    for (const a of [w.a0, w.a1]) {
      const px = w.ax === 'x' ? a : w.c, pz = w.ax === 'x' ? w.c : a;
      solid(px, 0, pz, 0.3, w.y + 0.4, 0.3, mat(0x5a4a3a));   // 電柱（歩道の上、電線の真下）
      deco(new THREE.BoxGeometry(w.ax === 'x' ? 0.15 : 1.6, 0.15, w.ax === 'x' ? 1.6 : 0.15), mat(0x5a4a3a), px, w.y, pz);   // 腕木
    }
```

```js
// 電線の束（3 本、横 0.6m おき）と、両端の電柱（電柱は電線の真下に立ち、当たり判定あり。腕木と電線は見た目だけ）
```

  - `buildCars()` の `newCar(cd.x, cd.z0, cd.z1, cd.speed)` を `newCar(cd.x, cd.z0, cd.z1, cd.speed, cd.at)` に

- [ ] **Step 4: `src/90-boot.js`** — 次の 4 行

```js
      if (checkWires(santa, COURSE.wires, dt)) {
        sndBoing();
        showToast('電線に引っかかった！', 1.0);
      }
```

を

```js
      if (checkWires(santa, COURSE.wires, dt)) {
        sndBoing();
        if (dropPresent(run)) {
          throwPresent(sm);
          sndDrop();
          showToast('電線に引っかかって、プレゼントを落とした！', CFG.dropDelay);
        } else {
          showToast('電線に引っかかった！', 1.0);
        }
      }
```

に置き換える。

- [ ] **Step 5:** `sh build.sh` → verify `PASS 70/70`

- [ ] **Step 6: Commit** — `git add -A && git commit -m "電線を歩道の上へ移し、当たったらプレゼントを落とす。車道を 16m・4 車線に広げ、車を 12 台・秒速 11〜12.5m に"`

### Task 3: 確かめる（コントローラ担当）
