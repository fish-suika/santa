# Phase 4b 手直し：線路は列車の屋根で、塀と崖を延ばす Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**本人の感想（2026-10-04）**
1. 高い塀の横に通れそうな隙間がある → 塀を長くして塞ぐ
2. 建物から建物へ飛び移る所が 2 つ（川・線路）似ている → 2 つ目（線路）を違う感じに。選んだのは **列車の屋根を使う**

**原因（1）:** 当たり判定上は、塀の端（x=±40）と街の端の見えない壁がつながっていて通れない。ただ、見た目の地面は x=±100 まで続いていて、塀は x=±40 で終わっている。そのため「横を回れそう」に見えていた。崖（x=±40）も同じ。

**線路の新しい遊び:** 掘割を 14m → **22m**（z = -47〜-69）に広げ、真ん中（z = -58）に止まっている列車（屋根は地面から 2m、奥行き 3.2m）を置く。

- 地面から向こう岸へ直接 → 22m なので届かない
- 岸 → 列車の屋根：約 9.4m。屋根の高さ 2m へ着くまで 1.86 秒で 11.2m 進むので届く。縁の手前 約 2.2m の範囲で踏み切ればよい
- 列車の屋根 → 向こう岸：約 9.4m。屋根から跳ぶと 12m 届くので余裕
- 車両の間（連結部 1.5m）に落ちると、掘割に落ちてやり直し
- 商店街の「店 7m → 17m → 28m のデパート」の登り道は外し、駅舎（見た目だけ）にする

---

### Task 1: 数値と、列車越えのテスト

**Files:** Modify `src/10-config.js`, `src/verify-tests.js`

- [ ] **Step 1:** `COURSE` の `rail:` の行を次の 2 行に置き換える

```js
  rail: { z0: -47, z1: -69 },            // 2 商店街 と 3 公園 の間の線路の掘割（幅 22m。真ん中に列車）
  train: { h: 4.5, w: 3.2 },             // 掘割の底（-2.5）に止まっている列車。屋根は地面から 2m、奥行き 3.2m
```

- [ ] **Step 2: テスト** — `// ===== 結果表示 =====` の直前に足す

```js
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
```

- [ ] **Step 3:** `sh build.sh` → verify `PASS 60/60`

---

### Task 2: 列車・駅舎、塀と崖を延ばす

**Files:** Modify `src/30-world.js`

- [ ] **Step 1:** `snowman()` の後（`function buildWorld()` の前）に足す

```js
// 掘割の底に止まっている列車。x 方向に車両（長さ 18m）が並び、連結部（1.5m）は隙間。屋根に乗れる
function train(zc) {
  const TR = COURSE.train, top = -2.5 + TR.h;
  for (let cx = -50; cx <= 50; cx += 19.5) {
    solid(cx, -2.5, zc, 18, TR.h, TR.w, mat(0x2f6f4f));
    deco(new THREE.BoxGeometry(18, 0.12, TR.w - 0.2), mat(COL.snow), cx, top + 0.06, zc);       // 屋根の雪
    for (const sd of [1, -1]) {
      deco(new THREE.BoxGeometry(18.02, 0.35, 0.05), mat(0xd8322c), cx, top - 2.6, zc + sd * (TR.w / 2 + 0.01));   // 赤い帯
      for (let wx = -7.5; wx <= 7.5; wx += 2.5) {                                                // 明かりのついた窓
        const win = deco(new THREE.PlaneGeometry(1.6, 1.0), mat(0x000000, COL.glass), cx + wx, top - 1.4, zc + sd * (TR.w / 2 + 0.02));
        if (sd < 0) win.rotation.y = Math.PI;
      }
    }
  }
}
```

- [ ] **Step 2:** `buildWorld()` の線路の見た目を置き換える。次の 4 行

```js
  // 線路（見た目だけ）：2 本の線路が x 方向に走る
  for (const tz of [RL.z0 - 4, RL.z1 + 4]) for (const off of [-0.75, 0.75]) {
    deco(new THREE.BoxGeometry(200, 0.15, 0.12), mat(0x9aa0aa), 0, -2.4, tz + off);
  }
```

を

```js
  // 線路（見た目だけ）と、真ん中に止まっている列車
  const railZ = (RL.z0 + RL.z1) / 2;
  for (const off of [-0.75, 0.75]) deco(new THREE.BoxGeometry(200, 0.15, 0.12), mat(0x9aa0aa), 0, -2.4, railZ + off);
  train(railZ);
```

- [ ] **Step 3:** 商店街のブロック。次の行

```js
  shop(-12, -44, 10, 8, 6, 0x9b7fb0, 0xff8de8);
```

を

```js
  shop(-12, -40, 10, 8, 6, 0x9b7fb0, 0xff8de8);
```

に（掘割が z=-47 まで来たので手前へ寄せる）。そして次の 4 行

```js
  // 店の屋上 7m（z=-34〜-26）→ 17m（z=-52〜-40）→ 28m のデパート（川と同じく、屋上から跳べば線路を越える）
  shop(28, -30, 10, 8, 7, 0xa0806a, 0xffa05a);
  building(28, -46, 8, 12, 17, 0x8a7f96);
  building(14, -49, 14, 12, 28, 0x9a6f6f);       // デパート（線路の縁 z=-55）
```

を

```js
  // 線路は、岸から止まっている列車の屋根へ跳び、そこから向こう岸へ跳んで渡る（川とは違う遊び）
  shop(28, -30, 10, 8, 7, 0xa0806a, 0xffa05a);
  shop(26, -41, 12, 8, 5, 0x8a6a5a, 0xffffff);   // 駅舎（見た目は店と同じ作り。看板は白）
```

に置き換える。

- [ ] **Step 4:** 塀と崖を、見た目の地面の端（x=±100）まで延ばす。次の 2 行

```js
  solid(0, 0, WL.z, 80, WL.h, WL.t, mat(0x7a4a3c));
  deco(new THREE.BoxGeometry(80, 0.2, WL.t + 0.2), mat(COL.roof), 0, WL.h + 0.1, WL.z);
```

の `80` を両方 `200` に。次の 2 行

```js
  solid(0, 0, -232, 80, 20, 36, mat(0x6a6f7e));
  deco(new THREE.BoxGeometry(80, 0.2, 36), mat(COL.snow), 0, 20.1, -232);
```

の `80` も両方 `200` に。それぞれの上のコメントの行末に「（見た目の地面の端まで延ばし、横を回れそうに見えないようにする）」を足す。

- [ ] **Step 5:** `sh build.sh` → verify `PASS 60/60`

- [ ] **Step 6: Commit** — `git add -A && git commit -m "線路は止まっている列車の屋根を中継して渡るようにする（川と同じ登って跳ぶ形だったため）。塀と崖を地面の端まで延ばす"`

### Task 3: 確かめる（コントローラ担当）
