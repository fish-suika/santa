# Phase 4b 5 区画の街 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 街を 5 区画に広げ、5 軒に届けたらクリアにする。区画の間の地上の道はつながっていない。

| 区画（z の範囲） | 配達先 | 次への仕切り | 越え方 |
|---|---|---|---|
| 1 住宅街（+62〜+7） | 家 (-17, 30) | 凍った川 z=+7〜-7（幅 14） | 家の屋根 → 17m → 28m の屋上から跳ぶ（今と同じ） |
| 2 商店街（-7〜-55） | 家 (-20, -30) | 線路の掘割 z=-55〜-69（幅 14） | 店の屋上 7m → 17m → 28m のデパート屋上から跳ぶ |
| 3 公園（-69〜-115） | 家 (-24, -88) | 高さ 22m・厚さ 2m の塀 z=-115〜-117 | 11m の展望台の縁から跳んで越える |
| 4 高架下（-117〜-160） | 家 (-20, -130) | 幅 40m の谷 z=-160〜-200 | 9m の建物 → 高さ 18m の高架道路 → 道路の上を渡る |
| 5 最後の家（-200〜-250） | 崖の上の家 (0, -232) | ― | 高架の端から 20m の崖へ跳び移る（下に落ちても段で登れる） |

**届く・越えるの計算（初速 約29 m/s、重力 30、走り 6 m/s）**

- 7m → 17m：着地まで 1.48 秒 → 8.9m 先まで。間は 6m
- 17m → 28m：1.42 秒 → 8.5m。間は 3m
- 塀：11m の展望台から跳ぶと、22m より上にいるのは跳んで 0.52〜1.42 秒（前へ 3.1〜8.5m）。厚さ 2m の塀を越えるには、塀の手前 3.5〜6.1m で踏み切ればよい。展望台の縁は塀の 4m 手前なので、縁から 2m 内側までの範囲（約 0.35 秒）で踏み切れば越えられる。地面からは最高 14m で越えられない
- 9m → 高架 18m：最高 23m。間は 3m

**Architecture:** 配置の数値（線路・塀・谷・高架・街の端・配達先）は `COURSE` に置く。`house()` に土台の高さ `y0` を足し、崖の上にも家を置けるようにする。新しい部品は `cut()`（地面の切れ目）、`road()`、`shop()`、`snowman()`。`buildWorld()` の中身は作り直す。点光源は重いので、明かりを付ける街灯は区画に 1 本ずつにする。

**前提:** Phase 4a 完了（verify 56/56）。

---

### Task 1: 配置の数値と、塀を越えるテスト

**Files:** Modify `src/10-config.js`, `src/verify-tests.js`（`// ===== 結果表示 =====` の直前）

- [ ] **Step 1: `src/10-config.js`** — `COURSE` を次に置き換える（`// ===== 試しコースの寸法 =====` のコメントも `// ===== 街の配置 =====` に）

```js
// ===== 街の配置 =====
// 5 区画が -Z へ並ぶ。区画の間の地上の道はつながっていない
const COURSE = {
  riverHalf: 7,                          // 1 住宅街 と 2 商店街 の間の凍った川（z = -7〜+7）
  rail: { z0: -55, z1: -69 },            // 2 商店街 と 3 公園 の間の線路の掘割（幅 14m）
  wall: { z: -116, h: 22, t: 2 },        // 3 公園 と 4 高架下 の間の塀（z = -115〜-117、高さ 22m）
  canyon: { z0: -160, z1: -200 },        // 4 高架下 と 5 最後の家 の間の谷（幅 40m。高架だけが渡っている）
  deck: { h: 18, z0: -140, z1: -208 },   // 高架道路（上面の高さ 18m、x = -5〜5）
  bounds: { x: 40, zMax: 62, zMin: -250 },
  start: { x: 0, z: 45 },
  sleigh: { x: 9, z: 44 },               // プレゼントの受け取り地点（そり）
  respawn: { x: 7, z: 44 },              // 1 軒目を届けるまでに落ちたら戻る場所（そりの横）
  targets: [                             // 配達先の家（中心）。この順に届ける
    { x: -17, z: 30 }, { x: -20, z: -30 }, { x: -24, z: -88 }, { x: -20, z: -130 }, { x: 0, z: -232 },
  ],
};
```

- [ ] **Step 2: テストを足す**

```js
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
```

- [ ] **Step 3:** `sh build.sh` → verify `PASS 58/58`（数値だけで決まる。通らなければ止めて報告）

- [ ] **Step 4: Commit** — `git add -A && git commit -m "5 区画の配置の数値と、塀を越えるテスト"`

---

### Task 2: 部品（土台の高さ・地面の切れ目・道路・店・雪だるま・明かりなしの街灯）

**Files:** Modify `src/30-world.js`

- [ ] **Step 1: `house()` に土台の高さ `y0` を足す** — シグネチャと中身の高さをすべて `y0` 分上げる。次の関数全体に置き換える

```js
// 家。棟（屋根のてっぺん）は X 方向に通る。y0 は土台の高さ（崖の上の家など。省略で 0）。
// 屋根の見た目は三角、当たり判定は 8 段の階段（乗った足と斜面のずれは 0.15m 以内、1段は stepHeight 以下）。
function house(cx, cz, w, d, wallH, wallColor, y0) {
  y0 = y0 || 0;
  const top = y0 + wallH;   // 軒の高さ
  solid(cx, y0, cz, w, wallH, d, mat(wallColor));

  const over = 0.4, hd = d / 2 + over, len = w + over * 2;
  const roofH = Math.min(2.4, d * 0.35);
  const shape = new THREE.Shape();
  shape.moveTo(-hd, 0); shape.lineTo(hd, 0); shape.lineTo(0, roofH); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false });
  g.translate(0, 0, -len / 2);
  const roof = deco(g, mat(COL.roof), cx, top, cz);
  roof.rotation.y = Math.PI / 2;
  for (const b of roofSteps(cx, top, cz, len, roofH, hd)) PHYS.boxes.push(b);

  // 煙突（配達先になる）
  const chH = roofH + 1.0, chX = cx + w * 0.25, chZ = cz + d * 0.18;
  solid(chX, top, chZ, 0.9, chH, 0.9, mat(COL.brick));
  solid(chX, top + chH, chZ, 1.1, 0.2, 1.1, mat(COL.brickTop));

  // 窓（明かりがついている）とドア
  const floors = wallH >= 5.5 ? [1.5, 4.2] : [1.6];
  for (const fy of floors) for (const fx of [-w * 0.25, w * 0.25]) for (const side of [1, -1]) {
    const win = deco(new THREE.PlaneGeometry(1.1, 1.2), mat(0x000000, COL.glass), cx + fx, y0 + fy, cz + side * (d / 2 + 0.02));
    if (side < 0) win.rotation.y = Math.PI;
  }
  deco(new THREE.PlaneGeometry(1.1, 2.0), mat(COL.door), cx, y0 + 1.0, cz + d / 2 + 0.03);

  // 軒先のイルミネーション
  const pts = [], cols = [], c = new THREE.Color();
  let k = 0;
  for (const side of [1, -1]) for (let x = -len / 2; x <= len / 2; x += 0.6) {
    pts.push(cx + x, top - 0.05, cz + side * (hd - 0.05));
    c.setHex(LIGHT_COLORS[k++ % LIGHT_COLORS.length]);
    cols.push(c.r, c.g, c.b);
  }
  addLights(pts, cols);

  W.houses.push({ x: cx, z: cz, w, d, wallH,
    chimney: { x: chX, y: top + chH + 0.2, z: chZ, base: top, front: { x: cx, y: y0, z: cz + d / 2 + 2.5 } } });
}
```

- [ ] **Step 2: `lamp()` を、明かり（点光源）を付けるかどうか選べるようにする** — 次に置き換える

```js
// 街灯。light が true のときだけ点光源を付ける（点光源は描画が重いので、区画に 1 本ずつ）
function lamp(x, z, light) {
  solid(x, 0, z, 0.2, 4.6, 0.2, mat(0x2b2f3a));
  deco(new THREE.SphereGeometry(0.3, 12, 8), mat(0x000000, 0xffd7a0), x, 4.75, z);
  if (!light) return;
  const L = new THREE.PointLight(0xffc98a, 1.4, 18, 2);
  L.position.set(x, 4.5, z);
  W.scene.add(L);
}
```

- [ ] **Step 3: 新しい部品** — `sleigh()` の後（`function buildWorld()` の前）に足す

```js
// 地面の切れ目（川・線路・谷）。z0〜z1 には地面が無い。底 bedY に当たり判定の底を置く
// （落ちると fallY でやり直しになるので底に立つことはない。底は空中の目印とカメラが働くため）
function cut(z0, z1, bedY, bedMat) {
  const zc = (z0 + z1) / 2, d = Math.abs(z1 - z0), hiZ = Math.max(z0, z1), loZ = Math.min(z0, z1);
  addBox(0, bedY - 3.5, zc, 200, 3.5, d);
  const bed = deco(new THREE.PlaneGeometry(200, d), bedMat, 0, bedY, zc);
  bed.rotation.x = -Math.PI / 2;
  // 両岸の石垣（切れ目の側を向く）
  const a = deco(new THREE.PlaneGeometry(200, -bedY), mat(0x55586a), 0, bedY / 2, hiZ - 0.01);
  a.rotation.y = Math.PI;
  deco(new THREE.PlaneGeometry(200, -bedY), mat(0x55586a), 0, bedY / 2, loZ + 0.01);
}

// z0〜z1 の道路（x = -4〜4）と両側の歩道（高さ 0.15m）
function road(z0, z1) {
  const zc = (z0 + z1) / 2, d = Math.abs(z1 - z0);
  const r = deco(new THREE.PlaneGeometry(8, d), mat(COL.road), 0, 0.01, zc);
  r.rotation.x = -Math.PI / 2;
  solid(5, 0, zc, 2, 0.15, d, mat(COL.walk));
  solid(-5, 0, zc, 2, 0.15, d, mat(COL.walk));
}

// 通行止めの柵（道路の端。歩いては出られない。跳べば越えられる）
function barrier(z) {
  solid(0, 0, z, 8, 1.0, 0.3, mat(0xe0913a));
}

// 商店街の店。平屋根で、道路側（x = 0 の側）に明るいショーウィンドウ・看板・ひさし
function shop(cx, cz, w, d, h, color, signColor) {
  solid(cx, 0, cz, w, h, d, mat(color));
  deco(new THREE.BoxGeometry(w + 0.2, 0.15, d + 0.2), mat(COL.roof), cx, h + 0.07, cz);   // 屋上の雪
  const f = cx > 0 ? -1 : 1, fx = cx + f * (w / 2 + 0.02);                                // f: 道路側の向き
  const win = deco(new THREE.PlaneGeometry(d * 0.7, 2.2), mat(0x000000, 0xffe2a8), fx, 1.6, cz);
  win.rotation.y = f * Math.PI / 2;
  const sign = deco(new THREE.PlaneGeometry(d * 0.8, 1.0), mat(0x000000, signColor), fx, h - 1.0, cz);
  sign.rotation.y = f * Math.PI / 2;
  const aw = deco(new THREE.BoxGeometry(1.4, 0.1, d * 0.8), mat(signColor), cx + f * (w / 2 + 0.6), 3.1, cz);
  aw.rotation.z = -f * 0.35;
}

// 雪だるま（当たり判定は細い箱）
function snowman(x, z) {
  const white = mat(0xf4f6fb);
  deco(new THREE.SphereGeometry(0.6, 16, 12), white, x, 0.6, z);
  deco(new THREE.SphereGeometry(0.42, 16, 12), white, x, 1.5, z);
  deco(new THREE.SphereGeometry(0.3, 14, 10), white, x, 2.15, z);
  const nose = deco(new THREE.ConeGeometry(0.06, 0.3, 8), mat(0xff8a2a), x, 2.15, z + 0.38);
  nose.rotation.x = Math.PI / 2;
  deco(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 12), mat(0x1b1b1f), x, 2.55, z);
  addBox(x, 0, z, 1.0, 2.4, 1.0);
}
```

- [ ] **Step 4:** `sh build.sh` が通る（`buildWorld` の中の `lamp(…)` 呼び出しは Task 3 で全部書き直すので、この時点では明かりが消えているだけでよい）

- [ ] **Step 5: Commit** — `git add -A && git commit -m "街の部品：家の土台の高さ・地面の切れ目・道路・店・雪だるま・明かりなしの街灯"`

---

### Task 3: 5 区画の街を作る

**Files:** Modify `src/30-world.js`

- [ ] **Step 1:** `buildWorld()` の中、`mm.position.set(-80, 70, -140);` `s.add(mm);` の**後ろから関数の閉じ `}` の手前まで**（今の地面と川・道路・両岸の建物・遠くの家並み・街の端の見えない壁）を、まるごと次に置き換える

```js

  // ======== 地面と切れ目 ========
  const ground = (z0, z1) => solid(0, -4, (z0 + z1) / 2, 200, 4, Math.abs(z1 - z0), mat(COL.snow));
  const R = COURSE.riverHalf, RL = COURSE.rail, CY = COURSE.canyon, WL = COURSE.wall, DK = COURSE.deck;
  ground(110, R);              // 1 住宅街（見た目のため街の外まで）
  ground(-R, RL.z0);           // 2 商店街
  ground(RL.z1, CY.z0);        // 3 公園 と 4 高架下（間は塀で仕切る）
  ground(CY.z1, -300);         // 5 最後の家（見た目のため街の外まで）
  cut(R, -R, -2.5, mat(0x9fc6e8, 0x1a2a40));             // 凍った川
  cut(RL.z0, RL.z1, -2.5, mat(0x4a4642));                 // 線路の掘割
  cut(CY.z0, CY.z1, -8, mat(0x232838));                   // 谷
  // 線路（見た目だけ）：2 本の線路が x 方向に走る
  for (const tz of [RL.z0 - 4, RL.z1 + 4]) for (const off of [-0.75, 0.75]) {
    deco(new THREE.BoxGeometry(200, 0.15, 0.12), mat(0x9aa0aa), 0, -2.4, tz + off);
  }
  // 落ちた橋（川の両岸。見た目だけ）
  for (const sd of [1, -1]) {
    const stub = deco(new THREE.BoxGeometry(8, 0.5, 3.2), mat(0x6b5a4a), 0, -1.3, sd * (R - 1.2));
    stub.rotation.x = sd * 0.75;
  }

  // ======== 1 住宅街（z = +62〜+7） ========
  road(62, R);
  barrier(R + 0.6);
  sleigh(COURSE.sleigh.x, COURSE.sleigh.z);
  // 28m のマンション（川の縁）。家の屋根（約 8m）→ 17m の中段 → 屋上 と登り、屋上から跳べば川を越える
  building(15, 13, 12, 12, 28, 0x7d8aa3);
  building(28, 21, 8, 12, 17, 0x8a7f96);
  house(16, 27, 9, 8, 6.5, 0x9fb7c9);
  building(-14, 11, 10, 8, 11, 0xa08f7d);        // 11m の建物（川の縁）。ここからはぎりぎり届く近道
  house(-17, 30, 9, 8, 4.5, 0xc9b79c);           // ★ 1 軒目
  house(-32, 46, 8, 8, 4.5, 0xd1b0c4);
  house(30, 48, 10, 9, 5, 0xb88f86);
  car(2, 30, false, 0xc0392b);
  tree(-28, 20, 1); tree(36, 32, 1.1); tree(-36, 56, 1);
  lamp(7, 20, true); lamp(-7, 38);

  // ======== 2 商店街（z = -7〜-55） ========
  road(-R, RL.z0);
  barrier(-R - 0.6); barrier(RL.z0 + 0.6);
  shop(12, -14, 10, 8, 6, 0xb5655a, 0xff5a5a);
  shop(12, -26, 10, 8, 7, 0x6f8fb0, 0x5ad1ff);
  shop(12, -38, 10, 8, 6, 0xc29a5b, 0xffd45a);
  shop(-12, -14, 10, 8, 7, 0x7fa37a, 0x8dff7a);
  shop(-12, -44, 10, 8, 6, 0x9b7fb0, 0xff8de8);
  house(-20, -30, 9, 8, 5, 0xd8c3a5);            // ★ 2 軒目（店の並びの家）
  // 店の屋上 7m（z=-34〜-26）→ 17m（z=-52〜-40）→ 28m のデパート（川と同じく、屋上から跳べば線路を越える）
  shop(28, -30, 10, 8, 7, 0xa0806a, 0xffa05a);
  building(28, -46, 8, 12, 17, 0x8a7f96);
  building(14, -49, 14, 12, 28, 0x9a6f6f);       // デパート（線路の縁 z=-55）
  car(-2, -24, false, 0x2e86c1);
  lamp(5, -20, true);

  // ======== 3 公園（z = -69〜-115） ========
  xmasTree(0, -90);
  house(-24, -88, 9, 8, 4.5, 0xa9c3a0);          // ★ 3 軒目（公園のそばの家）
  // 11m の展望台。縁（z=-111）は塀（z=-115）の 4m 手前。縁から跳べば塀を越える
  solid(18, 0, -108, 6, 11, 6, mat(0x8c7a64));
  deco(new THREE.BoxGeometry(6.2, 0.15, 6.2), mat(COL.roof), 18, 11.07, -108);
  // 塀（高さ 22m。地面からは越えられない）
  solid(0, 0, WL.z, 80, WL.h, WL.t, mat(0x7a4a3c));
  deco(new THREE.BoxGeometry(80, 0.2, WL.t + 0.2), mat(COL.roof), 0, WL.h + 0.1, WL.z);
  snowman(8, -80); snowman(-8, -102);
  tree(-10, -75, 1); tree(28, -80, 1.1); tree(-32, -105, 1.2); tree(30, -95, 1);
  lamp(5, -85, true);

  // ======== 4 高架下（z = -117〜-160） ========
  road(WL.z - WL.t / 2, CY.z0);                  // 塀の高架下側の面（z=-117）から谷まで
  house(-20, -130, 9, 8, 6.5, 0x9fb7c9);         // ★ 4 軒目
  house(25, -130, 8, 8, 4.5, 0xc9b79c);
  building(12, -146, 8, 8, 9, 0x7d8aa3);         // 9m。屋上から西へ跳べば高架（18m）に乗れる
  car(-8, -150, false, 0x27ae60);
  tree(-32, -150, 1); tree(32, -150, 1.1);
  lamp(6, -125, true);
  // 高架道路（上面 18m、x = -5〜5、z = -140〜-208）。谷を渡る唯一の道
  const deckLen = DK.z0 - DK.z1, deckZ = (DK.z0 + DK.z1) / 2;
  solid(0, DK.h - 1.5, deckZ, 10, 1.5, deckLen, mat(0x6d7280));
  const dr = deco(new THREE.PlaneGeometry(8, deckLen), mat(COL.road), 0, DK.h + 0.01, deckZ);
  dr.rotation.x = -Math.PI / 2;
  solid(4.85, DK.h, deckZ, 0.3, 1.0, deckLen, mat(0x9aa0aa));    // 手すり
  solid(-4.85, DK.h, deckZ, 0.3, 1.0, deckLen, mat(0x9aa0aa));
  solid(0, 0, -150, 2, DK.h - 1.5, 2, mat(0x6d7280));            // 橋脚
  solid(0, -8, -172, 2, DK.h + 6.5, 2, mat(0x6d7280));
  solid(0, -8, -188, 2, DK.h + 6.5, 2, mat(0x6d7280));
  solid(0, 0, -205, 2, DK.h - 1.5, 2, mat(0x6d7280));
  for (let z = DK.z0 - 6; z > DK.z1; z -= 16) {                   // 高架の上の街灯（見た目だけ）
    deco(new THREE.SphereGeometry(0.25, 10, 8), mat(0x000000, 0xffd7a0), 4.2, DK.h + 3.2, z);
    deco(new THREE.BoxGeometry(0.15, 3.2, 0.15), mat(0x2b2f3a), 4.6, DK.h + 1.6, z);
  }

  // ======== 5 最後の家（z = -200〜-250） ========
  // 高さ 20m の崖（z = -214〜-250）。高架の端（z=-208）から跳び移る。下に落ちたら 7m → 13m の段で登れる
  solid(0, 0, -232, 80, 20, 36, mat(0x6a6f7e));
  deco(new THREE.BoxGeometry(80, 0.2, 36), mat(COL.snow), 0, 20.1, -232);
  solid(-28, 0, -211, 10, 7, 6, mat(0x6a6f7e));
  solid(-16, 0, -211, 10, 13, 6, mat(0x6a6f7e));
  house(0, -232, 10, 9, 6, 0xe8d2b0, 20);        // ★ 5 軒目（崖の上の最後の家）

  // ======== 遠くの家並み（見た目だけ。街の外の両側） ========
  for (let i = 0, z = 100; z > -300; z -= 14, i++) {
    for (const sd of [1, -1]) {
      const h = 6 + ((i * 7 + (sd > 0 ? 2 : 0)) % 5) * 2.5;
      deco(new THREE.BoxGeometry(10, h, 10), mat(COL.far), sd * (62 + (i % 3) * 5), h / 2, z);
    }
  }

  // ======== 街の端（見えない壁。カメラは無視する） ========
  const BD = COURSE.bounds, zc = (BD.zMax + BD.zMin) / 2, zl = BD.zMax - BD.zMin;
  for (const b of [addBox(0, -10, BD.zMax + 1, 2 * BD.x + 4, 220, 2), addBox(0, -10, BD.zMin - 1, 2 * BD.x + 4, 220, 2),
                   addBox(BD.x + 1, -10, zc, 2, 220, zl + 4), addBox(-BD.x - 1, -10, zc, 2, 220, zl + 4)]) b.noCam = true;
```


- [ ] **Step 2:** `sh build.sh` → verify `PASS 58/58` のまま

- [ ] **Step 3: Commit** — `git add -A && git commit -m "5 区画の街：住宅街・商店街・公園・高架下・崖の上の最後の家"`

---

### Task 4: 確かめる（コントローラ担当）

- [ ] 実際の当たり判定（`PHYS.boxes`）で `santaStep` を回し、各区画の登り道と仕切りが「地面からは無理、高い所からは余裕」かを確かめる
- [ ] 5 軒すべて届けてクリアになる
- [ ] 各区画のスクリーンショット、コンソールエラーなし、動きが重くないか

### Task 5: 制作記録（コントローラ担当）
