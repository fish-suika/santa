# Phase 2b 試しコース（高さに意味を持たせる）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 十字路の街を「スタートの岸 → 凍った川（幅 14m）→ 向こう岸」に作り替える。地面から跳んでも川は越えられず、高い建物に登ってから跳ぶと越えられる。

**Why:** 本人の要望「高くジャンプする意味を持たせたい」。選んだ方向は「地上では行けない街」と「高い所からしか見えない」（後者は Phase 4 の配達で入れる）。鍵は **高い所から跳ぶほど遠くへ届く** こと。

**届く距離（walkSpeed 6 m/s、初速 約29 m/s、重力 30）**

| 跳ぶ高さ（着地は地面） | 滞空 | 前へ進む距離 |
|---|---|---|
| 0m | 1.93 秒 | 11.6m |
| 11m | 2.26 秒 | 13.5m |
| 19m | 2.45 秒 | 14.7m |

川幅 14m（z = -7〜+7）。体の幅のぶん（縁から 0.4m はみ出して立てる）、必要な移動は約 13.2〜13.4m。地面からは届かず、11m の建物からはぎりぎり、19m のマンションからは余裕で届く。

**Architecture:** 川幅と落下判定の高さを `10-config.js` に置き、`verify` で「地面からは届かない／19m からは届く」を実際に跳ばせて確かめる。街は `30-world.js` の `buildWorld` を作り替え、平屋根の高い建物 `building()` を足す。

---

### Task 1: 数値と「渡れる／渡れない」のテスト

**Files:** Modify `src/10-config.js`, `src/verify-tests.js`（`// ===== 結果表示 =====` の直前）

- [ ] **Step 1: `src/10-config.js`** — `CFG` の中、`maxFall` の行の次に足す

```js
  fallY: -1,            // 足元がこれより下がったら「落ちた」（川・穴）
```

そして `CFG` の閉じ `};` の後に足す

```js

// ===== 試しコースの寸法 =====
const COURSE = {
  riverHalf: 7,         // 凍った川の幅の半分（川は z = -7〜+7。幅 14m）
  start: { x: 0, z: 45 },
};
```

- [ ] **Step 2: テストを足す**

```js
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

test('川: 19m の建物の屋上から走って跳べば届く', () => {
  eq(tryCross(19), true);
});
```

- [ ] **Step 3:** `sh build.sh` → verify が `PASS 37/37`（この 2 本は数値だけで決まるので、実装を待たずに通る。通らなければ数値の前提が崩れているので止めて報告）

- [ ] **Step 4: Commit** — `git add -A && git commit -m "川幅と落下判定の数値、高さで届く距離のテスト"`

---

### Task 2: 街を作り替える

**Files:** Modify `src/30-world.js`, `src/90-boot.js`

- [ ] **Step 1: `src/30-world.js`** — `lamp()` の後（`function buildWorld()` の前）に `building()` を足す

```js
// 平屋根の高い建物（マンション・ビル）。地面から一気には届かない高さにして、段を登らせる。
// 窓は階ごと（3m おき）に四面へ並べ、明かりはところどころ。
function building(cx, cz, w, d, h, color) {
  solid(cx, 0, cz, w, h, d, mat(color));
  deco(new THREE.BoxGeometry(w + 0.2, 0.15, d + 0.2), mat(COL.roof), cx, h + 0.07, cz);   // 屋上の雪
  solid(cx + w * 0.25, h, cz - d * 0.2, 2, 2, 2, mat(0x8a93a6));                           // 給水タンク
  const lit = mat(0x000000, COL.glass), dark = mat(0x1d2436);
  const geo = new THREE.PlaneGeometry(1.2, 1.4);
  let k = 0;
  for (let fy = 1.6; fy < h - 1; fy += 3) {
    for (let side = 0; side < 4; side++) {
      const along = side < 2 ? w : d;
      for (let u = -along / 2 + 1.5; u <= along / 2 - 1.5; u += 2.5) {
        const p = deco(geo, (k++ * 7) % 5 < 3 ? lit : dark, 0, 0, 0);
        if (side === 0) p.position.set(cx + u, fy, cz + d / 2 + 0.02);
        else if (side === 1) { p.position.set(cx + u, fy, cz - d / 2 - 0.02); p.rotation.y = Math.PI; }
        else if (side === 2) { p.position.set(cx + w / 2 + 0.02, fy, cz + u); p.rotation.y = Math.PI / 2; }
        else { p.position.set(cx - w / 2 - 0.02, fy, cz + u); p.rotation.y = -Math.PI / 2; }
      }
    }
  }
}
```

- [ ] **Step 2: `src/30-world.js`** — `buildWorld()` の、`mm.position.set(-80, 70, -140);` `s.add(mm);` の**後ろから**、`// 遠くの家並み` の**前まで**（地面・十字の道路・歩道・家 6 軒・ツリーと木・車 3 台・街灯 4 本）を、次にまるごと置き換える。光・月・遠くの家並み・見えない壁はそのまま残す。

```js

  // ---- 地面と凍った川 ----
  // 両岸は厚さ 4m の地面。間の z = -R〜+R が川で、落ちたらやり直し（足元が fallY より下）
  const R = COURSE.riverHalf;
  solid(0, -4, (R + 80) / 2, 160, 4, 80 - R, mat(COL.snow));    // 手前の岸 z = R〜80
  solid(0, -4, -(R + 80) / 2, 160, 4, 80 - R, mat(COL.snow));   // 向こう岸 z = -80〜-R
  const ice = deco(new THREE.PlaneGeometry(160, R * 2), mat(0x9fc6e8, 0x1a2a40), 0, -2.5, 0);
  ice.rotation.x = -Math.PI / 2;
  const bank1 = deco(new THREE.PlaneGeometry(160, 4), mat(0x55586a), 0, -2, R - 0.01);    // 手前の岸の石垣（川側を向く）
  bank1.rotation.y = Math.PI;
  deco(new THREE.PlaneGeometry(160, 4), mat(0x55586a), 0, -2, -R + 0.01);                  // 向こう岸の石垣

  // ---- 道路と歩道（両岸。川で途切れる） ----
  for (const sd of [1, -1]) {
    const zc = sd * (R + 80) / 2;
    const road = deco(new THREE.PlaneGeometry(8, 80 - R), mat(COL.road), 0, 0.01, zc);
    road.rotation.x = -Math.PI / 2;
    solid(5, 0, zc, 2, 0.15, 80 - R, mat(COL.walk));
    solid(-5, 0, zc, 2, 0.15, 80 - R, mat(COL.walk));
    // 落ちた橋：道路の先で、橋の板が川へ垂れ下がっている（見た目だけ）
    const stub = deco(new THREE.BoxGeometry(8, 0.5, 3.2), mat(0x6b5a4a), 0, -1.3, sd * (R - 1.2));
    stub.rotation.x = sd * 0.75;
    // 通行止めの柵（歩いては川へ出られない。跳べば越えられる）
    solid(0, 0, sd * (R + 0.6), 8, 1.0, 0.3, mat(0xe0913a));
  }

  // ---- 手前の岸 ----
  // 19m のマンション（川の縁に建つ）。地面からは届かないので、隣の家の屋根から登る
  building(15, 13, 12, 12, 19, 0x7d8aa3);
  house(16, 27, 9, 8, 6.5, 0x9fb7c9);           // マンションへの足がかり（屋根から跳べば屋上に届く）
  // 11m の建物（川の縁）。ここから跳んでもぎりぎり届く
  building(-14, 11, 10, 8, 11, 0xa08f7d);
  house(-17, 30, 9, 8, 4.5, 0xc9b79c);
  house(-32, 46, 8, 8, 4.5, 0xd1b0c4);
  house(30, 48, 10, 9, 5, 0xb88f86);
  car(2, 30, false, 0xc0392b);
  tree(-28, 20, 1); tree(40, 30, 1.1); tree(-40, 60, 1);
  lamp(7, 20); lamp(-7, 38);

  // ---- 向こう岸 ----
  house(16, -20, 9, 8, 5, 0xd8c3a5);
  house(-18, -18, 8, 8, 4.5, 0xa9c3a0);
  house(28, -38, 10, 9, 6.5, 0x9fb7c9);
  house(-30, -42, 9, 8, 4.5, 0xc9b79c);
  building(10, -50, 10, 10, 16, 0x8f7da0);
  xmasTree(-12, -32);
  car(-2, -26, false, 0x2e86c1);
  tree(-36, -24, 1.2); tree(36, -16, 1); tree(-20, -56, 1.1);
  lamp(7, -20); lamp(-7, -40);

```

- [ ] **Step 3: `src/90-boot.js`**

`const START = { x: 0, z: 14 };` を

```js
  const START = COURSE.start;
```

に。そして

```js
      // 万一、街の外へ落ちたらスタートへ戻す
      if (santa.pos.y < -30) {
```

を

```js
      // 川に落ちたらスタートへ戻す（Phase 3 で「プレゼントを落とす → 受け取り地点からやり直し」にする）
      if (santa.pos.y < CFG.fallY) {
```

に置き換える（中身の 2 行はそのまま）。

- [ ] **Step 4:** `sh build.sh` → verify が `PASS 37/37` のまま

- [ ] **Step 5: Commit** — `git add -A && git commit -m "試しコース: 凍った川で街を二つに分け、高い建物から跳ばないと渡れないようにする"`

---

### Task 3: 画面で確かめる（コントローラ担当）

- [ ] スタート地点のスクリーンショット（川・マンション・落ちた橋が見える）
- [ ] 実際に操作して：地面から川へ跳ぶと落ちてスタートに戻る／家 → マンション屋上 → 川越えができる
- [ ] コンソールエラーなし

### Task 4: 制作記録（コントローラ担当）
