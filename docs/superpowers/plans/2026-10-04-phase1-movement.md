# Phase 1 基本移動 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 雪の夜の小さな一画を、サンタが三人称で歩き回れる（PC とスマホ）。ジャンプはまだ無い。

**Architecture:** three.js r128（CDN）で描画し、当たり判定はすべて自作の AABB。three.js に依存しない計算（当たり判定・操作・カメラ位置）は `12-physics.js` / `14-control.js` に分け、`verify.html` からそのまま試す。`src/` を `sh build.sh` で 1 枚の HTML に結合する。

**Tech Stack:** 素の JavaScript、three.js r128、Web Audio。Node は無い（この PC には入っていない）。

**仕様書:** `docs/superpowers/specs/2026-10-04-santa-design.md`

**座標の約束:** Y が上、単位はメートル。サンタの位置 `pos` は**足元の中心**。カメラの向き `yaw` が 0 のとき前は -Z、右は +X。

---

## ファイル

| ファイル | 役割 |
|---|---|
| `build.sh` | 結合 |
| `src/00-head.html` / `src/99-tail.html` | 外枠・CSS・タイトル画面・three.js の読み込み |
| `src/verify-head.html` | 検証ページの外枠 |
| `src/10-config.js` | 数値 `CFG` |
| `src/12-physics.js` | 箱・移動・着地・段差・レイ（three.js 非依存） |
| `src/14-control.js` | サンタの歩き・カメラ位置の計算（three.js 非依存） |
| `src/20-sound.js` | 風・足音 |
| `src/30-world.js` | 街と雪 |
| `src/40-santa.js` | サンタの見た目 |
| `src/45-camera.js` | three.js カメラを動かす |
| `src/50-input.js` | キーボード・マウス・タッチ |
| `src/90-boot.js` | 起動とメインループ |
| `src/verify-tests.js` | 自動確認 |

テストの「実行」は、`sh build.sh` の後に `verify.html` をブラウザで開くこと（タイトルが `PASS n/n` になれば全部通過）。

---

### Task 1: 骨組み

**Files:** Create `build.sh`, `src/00-head.html`, `src/99-tail.html`, `src/verify-head.html`, `src/10-config.js`, `.gitattributes`

- [ ] **Step 1: `.gitattributes`**（Windows の改行変換で sh が壊れないように）

```
* text=auto eol=lf
```

- [ ] **Step 2: `build.sh`**

```sh
#!/bin/sh
# 分割ソースを1枚のHTMLに結合する
cd "$(dirname "$0")"

# --- 本体 ---
cat src/00-head.html \
    src/10-config.js \
    src/12-physics.js \
    src/14-control.js \
    src/20-sound.js \
    src/30-world.js \
    src/40-santa.js \
    src/45-camera.js \
    src/50-input.js \
    src/90-boot.js \
    src/99-tail.html > santa.html
cp santa.html index.html   # GitHub Pages はルートの index.html を配信する

# --- 検証ページ ---
# 本体と同じく1枚に結合する（<script src> で隣を読むと表示環境によって読み込まれないため）
cat src/verify-head.html \
    src/10-config.js \
    src/12-physics.js \
    src/14-control.js \
    src/verify-tests.js \
    src/99-tail.html > verify.html

echo "built santa.html + index.html ($(wc -c < santa.html) bytes)"
echo "built verify.html ($(wc -c < verify.html) bytes)"
```

- [ ] **Step 3: `src/00-head.html`**

```html
<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<title>サンタ、ちゃんと届けて</title>
<style>
  :root{
    --ink:#fff8ee;
    --red:#e0413a;
    --gold:#ffd27a;
    --jp:"Hiragino Kaku Gothic ProN","Yu Gothic","YuGothic","Meiryo","Noto Sans JP",sans-serif;
  }
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:100%;height:100%;overflow:hidden;background:#0b1430;color:var(--ink);font-family:var(--jp);
    touch-action:none;user-select:none;-webkit-user-select:none}
  canvas{display:block;width:100%;height:100%}

  /* ---- タイトル ---- */
  #title{position:fixed;inset:0;z-index:10;display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:18px;padding:16px;text-align:center;cursor:pointer;background:rgba(8,14,36,.55)}
  #title h1{font-size:clamp(28px,6vw,56px);letter-spacing:.08em;text-shadow:0 2px 18px rgba(0,0,0,.6)}
  #title h1 span{color:var(--red)}
  #title p{font-size:clamp(14px,2.4vw,18px);color:var(--gold);letter-spacing:.2em}
  #title small{font-size:13px;opacity:.75;line-height:1.8}
  #title.off{display:none}

  /* ---- 操作のヒント（PC のみ） ---- */
  #hint{position:fixed;left:16px;bottom:16px;z-index:5;font-size:13px;opacity:.7;pointer-events:none;text-shadow:0 1px 6px #000}
  body.touch #hint{display:none}

  /* ---- スマホの移動スティック（触れた場所に出る） ---- */
  #stick{position:fixed;z-index:6;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;
    border:2px solid rgba(255,255,255,.35);background:rgba(255,255,255,.08);display:none;pointer-events:none}
  #stick.on{display:block}
  #knob{position:absolute;left:50%;top:50%;width:50px;height:50px;margin:-25px 0 0 -25px;border-radius:50%;background:rgba(255,255,255,.45)}
</style>
</head>
<body>
<div id="title">
  <h1>サンタ、<span>ちゃんと</span>届けて</h1>
  <p>クリック / タップで はじめる</p>
  <small>WASD 移動 ・ マウス 視点<br>スマホ：左で移動 ・ 右で視点</small>
</div>
<div id="hint">WASD 移動 ／ マウス 視点 ／ Esc でマウスを離す</div>
<div id="stick"><div id="knob"></div></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
"use strict";
```

- [ ] **Step 4: `src/99-tail.html`**

```html
</script>
</body>
</html>
```

- [ ] **Step 5: `src/verify-head.html`**

```html
<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>検証 — サンタ、ちゃんと届けて</title>
<style>
  body{font-family:"Yu Gothic UI",system-ui,sans-serif;background:#1c1c1e;color:#eee;padding:24px;line-height:1.7}
  h1{font-size:18px;margin-bottom:16px}
  .r{padding:4px 0;border-bottom:1px solid #333}
  .ok::before{content:"PASS ";color:#6bd07a;font-weight:bold}
  .ng::before{content:"FAIL ";color:#ff6b6b;font-weight:bold}
  .ng{color:#ffb0b0}
  .why{color:#ff8f8f;padding-left:3em;font-size:13px}
  #sum{margin-top:18px;font-size:16px;font-weight:bold}
</style>
</head>
<body>
<h1>サンタ、ちゃんと届けて — 検証</h1>
<div id="out"></div>
<div id="sum"></div>

<script>
"use strict";
```

- [ ] **Step 6: `src/10-config.js`**

```js
// ===== 数値はすべてここ。遊んでもらいながら調整する =====
const CFG = {
  // サンタの体（位置は足元の中心。単位はメートル）
  santaHalf: 0.4,       // 横幅の半分
  santaHeight: 1.7,

  // 歩き
  walkSpeed: 6,         // 最高速度 m/s
  groundAccel: 40,      // 最高速度へ近づく速さ m/s²（止まるときも同じ）
  stepHeight: 0.35,     // これ以下の段差は歩いて上がれる

  // 落下
  gravity: 30,          // m/s²
  maxFall: 60,          // 落下速度の上限 m/s

  // カメラ（サンタの後ろ）
  camDist: 7,
  camLookHeight: 1.4,   // 足元からどれだけ上を見るか
  camPitch: 0.35,       // 最初の見下ろし角（ラジアン）
  camPitchMin: -0.15,
  camPitchMax: 1.2,
  camMinDist: 1.2,      // 壁に寄ったときの最短距離
  mouseSens: 0.0025,    // マウス 1px あたりの回転（ラジアン）
  touchSens: 0.006,     // タッチ 1px あたりの回転（ラジアン）
};
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "骨組み（結合スクリプト・外枠・数値）"
```

（まだ `12-physics.js` などが無いので build はこの時点では通らない。Task 2 で通る。）

---

### Task 2: 当たり判定

**Files:** Create `src/12-physics.js`, `src/14-control.js`（空のファイル）, `src/verify-tests.js`

- [ ] **Step 1: 失敗するテストを書く** — `src/verify-tests.js`

```js
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
```

`src/14-control.js` はこの時点では 1 行だけ: `// ===== サンタとカメラの操作（three.js に依存しない） =====`

- [ ] **Step 2: 失敗を確かめる** — `src/12-physics.js` を空にして `sh build.sh`、`verify.html` を開く。`makeBox is not defined` で全滅（ReferenceError でスクリプトが止まり何も出ない場合もある）。

- [ ] **Step 3: 実装** — `src/12-physics.js`

```js
// ===== 当たり判定（three.js に依存しない。verify から直接試す） =====
// 箱は {minX,maxX,minY,maxY,minZ,maxZ}。街の当たり判定はすべてこの箱で表す。
const PHYS = { boxes: [] };
const EPS = 0.001;

// 中心 (cx, cz)、下端 y0、幅 w・高さ h・奥行 d の箱
function makeBox(cx, y0, cz, w, h, d) {
  return { minX: cx - w / 2, maxX: cx + w / 2, minY: y0, maxY: y0 + h, minZ: cz - d / 2, maxZ: cz + d / 2 };
}
function addBox(cx, y0, cz, w, h, d) {
  const b = makeBox(cx, y0, cz, w, h, d);
  PHYS.boxes.push(b);
  return b;
}
function removeBox(b) {
  const i = PHYS.boxes.indexOf(b);
  if (i >= 0) PHYS.boxes.splice(i, 1);
}

// 面が接しているだけなら重なりに数えない
function overlaps(a, b) {
  return a.minX < b.maxX && a.maxX > b.minX &&
         a.minY < b.maxY && a.maxY > b.minY &&
         a.minZ < b.maxZ && a.maxZ > b.minZ;
}
// 足元の位置 p にいるときの体の箱
function bodyBox(p) {
  const r = CFG.santaHalf;
  return { minX: p.x - r, maxX: p.x + r, minY: p.y, maxY: p.y + CFG.santaHeight, minZ: p.z - r, maxZ: p.z + r };
}
function hitAll(p, boxes) {
  const me = bodyBox(p);
  return boxes.filter(b => overlaps(me, b));
}
function hitAny(p, boxes) {
  const me = bodyBox(p);
  for (const b of boxes) if (overlaps(me, b)) return b;
  return null;
}

// 体 {pos, vel, onGround} を dt 秒動かす。重力・壁・段差・着地・天井を処理する。
// 速いときに薄い箱をすり抜けないよう、1回の移動が 0.2m 以下になるよう刻む。
function moveBody(body, dt, boxes) {
  const v = body.vel;
  v.y = Math.max(v.y - CFG.gravity * dt, -CFG.maxFall);
  const far = Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)) * dt;
  const n = Math.max(1, Math.ceil(far / 0.2));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    moveAxisH(body, 'x', v.x * h, boxes);
    moveAxisH(body, 'z', v.z * h, boxes);
    moveAxisY(body, v.y * h, boxes);
  }
  // 足元のすぐ下に箱があれば接地
  body.onGround = v.y <= 0 && !!hitAny({ x: body.pos.x, y: body.pos.y - 0.02, z: body.pos.z }, boxes);
}

// 横（x か z）に d だけ動かす。低い段差なら上に乗り、それ以外は壁の手前で止める。
function moveAxisH(body, ax, d, boxes) {
  if (d === 0) return;
  const p = body.pos;
  p[ax] += d;
  const hits = hitAll(p, boxes);
  if (!hits.length) return;
  const top = Math.max(...hits.map(b => b.maxY));
  if (body.onGround && top - p.y <= CFG.stepHeight) {
    const up = { x: p.x, y: top + EPS, z: p.z };
    if (!hitAny(up, boxes)) { p.y = up.y; return; }
  }
  const r = CFG.santaHalf, A = ax.toUpperCase();
  p[ax] = d > 0 ? Math.min(...hits.map(b => b['min' + A])) - r - EPS
                : Math.max(...hits.map(b => b['max' + A])) + r + EPS;
  body.vel[ax] = 0;
}

// 縦に d だけ動かす。下向きなら一番高い面に乗り、上向きなら頭を一番低い面で止める。
function moveAxisY(body, d, boxes) {
  if (d === 0) return;
  const p = body.pos;
  p.y += d;
  const hits = hitAll(p, boxes);
  if (!hits.length) return;
  p.y = d < 0 ? Math.max(...hits.map(b => b.maxY))
              : Math.min(...hits.map(b => b.minY)) - CFG.santaHeight - EPS;
  body.vel.y = 0;
}

// 原点 o から方向 dir（長さ1）へ飛ばした線が箱に当たる距離。当たらなければ Infinity。
// o が箱の中なら 0。
function rayBox(o, dir, b) {
  let tmin = 0, tmax = Infinity;
  for (const ax of ['x', 'y', 'z']) {
    const A = ax.toUpperCase(), lo = b['min' + A], hi = b['max' + A];
    if (Math.abs(dir[ax]) < 1e-9) {
      if (o[ax] < lo || o[ax] > hi) return Infinity;
      continue;
    }
    let t1 = (lo - o[ax]) / dir[ax], t2 = (hi - o[ax]) / dir[ax];
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return Infinity;
  }
  return tmin;
}
```

- [ ] **Step 4: 通過を確かめる** — `sh build.sh` → `verify.html` が `PASS 12/12`。

- [ ] **Step 5: Commit** — `git add -A && git commit -m "当たり判定（箱・着地・壁・段差・レイ）"`

---

### Task 3: サンタの歩きとカメラ位置の計算

**Files:** Modify `src/14-control.js`, `src/verify-tests.js`（「結果表示」の直前に足す）

- [ ] **Step 1: 失敗するテストを足す**

```js
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
```

- [ ] **Step 2: 失敗を確かめる** — `sh build.sh` → `verify.html` で操作のテストが `santaStep is not defined` などで FAIL。

- [ ] **Step 3: 実装** — `src/14-control.js`

```js
// ===== サンタとカメラの操作（three.js に依存しない） =====
function newSanta(x, z) {
  return { pos: { x, y: 0, z }, vel: { x: 0, y: 0, z: 0 }, onGround: false, facing: 0 };
}

// カメラの向き yaw（0 で -Z を向く）から見た「前」と「右」
function camAxes(yaw) {
  return { fx: -Math.sin(yaw), fz: -Math.cos(yaw), rx: Math.cos(yaw), rz: -Math.sin(yaw) };
}

// 速度 (vx, vz) を目標 (tx, tz) へ、最大 k だけ近づける
function approachVec(vx, vz, tx, tz, k) {
  const ex = tx - vx, ez = tz - vz, e = Math.hypot(ex, ez);
  if (e <= k) return [tx, tz];
  return [vx + ex / e * k, vz + ez / e * k];
}

// 入力 {x: 右が+, z: 前が+}（各 -1〜1）とカメラの向き yaw で、サンタを dt 秒動かす
function santaStep(s, input, yaw, dt, boxes) {
  const a = camAxes(yaw);
  let dx = a.rx * input.x + a.fx * input.z;
  let dz = a.rz * input.x + a.fz * input.z;
  const len = Math.hypot(dx, dz);
  if (len > 1) { dx /= len; dz /= len; }
  [s.vel.x, s.vel.z] = approachVec(s.vel.x, s.vel.z, dx * CFG.walkSpeed, dz * CFG.walkSpeed, CFG.groundAccel * dt);
  if (len > 0.1) s.facing = Math.atan2(-dx, -dz);   // 見た目の正面は -Z
  moveBody(s, dt, boxes);
}

// カメラを置く場所。target から yaw の後ろ・pitch の高さへ camDist 離す。
// 間に箱があれば、その 0.3m 手前まで寄せる（ただし camMinDist より近づけない）。
function cameraPlace(target, yaw, pitch, boxes) {
  const cp = Math.cos(pitch);
  const dir = { x: Math.sin(yaw) * cp, y: Math.sin(pitch), z: Math.cos(yaw) * cp };
  let dist = CFG.camDist;
  for (const b of boxes) {
    if (b.noCam) continue;
    const t = rayBox(target, dir, b);
    if (t - 0.3 < dist) dist = t - 0.3;
  }
  dist = Math.max(CFG.camMinDist, dist);
  return { x: target.x + dir.x * dist, y: target.y + dir.y * dist, z: target.z + dir.z * dist, dist, dir };
}
```

- [ ] **Step 4: 通過を確かめる** — `verify.html` が `PASS 23/23`。

- [ ] **Step 5: Commit** — `git add -A && git commit -m "サンタの歩きとカメラ位置の計算"`

---

### Task 4: 街と雪

**Files:** Create `src/30-world.js`

ここから先は three.js を使うので verify では試さない。Task 6 でブラウザで描画して確かめる。

- [ ] **Step 1: `src/30-world.js`**

```js
// ===== 街（見た目と当たり判定を一緒に作る） =====
const W = { scene: null, houses: [], snow: null };

const COL = {
  snow: 0xe4ebf5, road: 0x3b4356, walk: 0xbfc8d8, roof: 0xe8eef8,
  brick: 0x8a4a3a, brickTop: 0x6e3a2e, trunk: 0x5a3a28, leaf: 0x2f6b4a,
  glass: 0xffc56e, door: 0x5b3524, far: 0x18213a,
};
const LIGHT_COLORS = [0xff4d4d, 0x4dff88, 0x4da6ff, 0xffd84d, 0xff8de8];

const MATS = {};
function mat(color, emissive) {
  const k = color + '/' + (emissive || 0);
  if (!MATS[k]) MATS[k] = new THREE.MeshLambertMaterial({ color, emissive: emissive || 0 });
  return MATS[k];
}
// 見た目だけ置く
function deco(geo, material, x, y, z) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  W.scene.add(m);
  return m;
}
// 見た目の箱と当たり判定の箱を同じ寸法で置く
function solid(cx, y0, cz, w, h, d, material) {
  addBox(cx, y0, cz, w, h, d);
  return deco(new THREE.BoxGeometry(w, h, d), material, cx, y0 + h / 2, cz);
}
// 色付きの点（イルミネーション）
const LIGHT_MAT = new THREE.PointsMaterial({ size: 0.28, vertexColors: true });
function addLights(pts, cols) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  W.scene.add(new THREE.Points(g, LIGHT_MAT));
}

// 家。棟（屋根のてっぺん）は X 方向に通る。
// 屋根の見た目は三角、当たり判定は 8 段の階段（乗った足と斜面のずれは 0.15m 以内、1段は stepHeight 以下）。
function house(cx, cz, w, d, wallH, wallColor) {
  solid(cx, 0, cz, w, wallH, d, mat(wallColor));

  const over = 0.4, hd = d / 2 + over, len = w + over * 2;
  const roofH = Math.min(2.4, d * 0.35);
  const shape = new THREE.Shape();
  shape.moveTo(-hd, 0); shape.lineTo(hd, 0); shape.lineTo(0, roofH); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false });
  g.translate(0, 0, -len / 2);
  const roof = deco(g, mat(COL.roof), cx, wallH, cz);
  roof.rotation.y = Math.PI / 2;
  const n = 8;
  for (let i = 0; i < n; i++) addBox(cx, wallH, cz, len, roofH * (i + 0.5) / n, hd * 2 * (1 - i / n));

  // 煙突（配達先になる）
  const chH = roofH + 1.0, chX = cx + w * 0.25, chZ = cz + d * 0.18;
  solid(chX, wallH, chZ, 0.9, chH, 0.9, mat(COL.brick));
  solid(chX, wallH + chH, chZ, 1.1, 0.2, 1.1, mat(COL.brickTop));

  // 窓（明かりがついている）とドア
  const floors = wallH >= 5.5 ? [1.5, 4.2] : [1.6];
  for (const fy of floors) for (const fx of [-w * 0.25, w * 0.25]) for (const side of [1, -1]) {
    const win = deco(new THREE.PlaneGeometry(1.1, 1.2), mat(0x000000, COL.glass), cx + fx, fy, cz + side * (d / 2 + 0.02));
    if (side < 0) win.rotation.y = Math.PI;
  }
  deco(new THREE.PlaneGeometry(1.1, 2.0), mat(COL.door), cx, 1.0, cz + d / 2 + 0.03);

  // 軒先のイルミネーション
  const pts = [], cols = [], c = new THREE.Color();
  let k = 0;
  for (const side of [1, -1]) for (let x = -len / 2; x <= len / 2; x += 0.6) {
    pts.push(cx + x, wallH - 0.05, cz + side * (hd - 0.05));
    c.setHex(LIGHT_COLORS[k++ % LIGHT_COLORS.length]);
    cols.push(c.r, c.g, c.b);
  }
  addLights(pts, cols);

  W.houses.push({ x: cx, z: cz, w, d, wallH, chimney: { x: chX, y: wallH + chH + 0.2, z: chZ } });
}

// 車。alongX なら X 方向に長い。屋根に乗れる。
function car(cx, cz, alongX, color) {
  const L = 4.2, Wd = 1.9;
  solid(cx, 0.35, cz, alongX ? L : Wd, 0.9, alongX ? Wd : L, mat(color));
  solid(cx, 1.25, cz, alongX ? 2.3 : 1.7, 0.75, alongX ? 1.7 : 2.3, mat(0x2a3140));
  deco(new THREE.BoxGeometry(alongX ? 2.2 : 1.6, 0.08, alongX ? 1.6 : 2.2), mat(COL.snow), cx, 2.04, cz);
  const wg = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    const wh = deco(wg, mat(0x15171c), cx + (alongX ? a * 1.35 : b * 0.85), 0.36, cz + (alongX ? b * 0.85 : a * 1.35));
    if (alongX) wh.rotation.x = Math.PI / 2; else wh.rotation.z = Math.PI / 2;
  }
}

// 木。当たり判定は幹だけ。
function tree(x, z, s) {
  solid(x, 0, z, 0.4 * s, 1.2 * s, 0.4 * s, mat(COL.trunk));
  deco(new THREE.ConeGeometry(1.6 * s, 2.4 * s, 8), mat(COL.leaf), x, 2.2 * s, z);
  deco(new THREE.ConeGeometry(1.2 * s, 2.0 * s, 8), mat(COL.leaf), x, 3.4 * s, z);
  deco(new THREE.ConeGeometry(0.55 * s, 0.6 * s, 8), mat(COL.snow), x, 4.25 * s, z);
}

// 広場の大きなクリスマスツリー
function xmasTree(x, z) {
  const s = 2.2;
  tree(x, z, s);
  deco(new THREE.OctahedronGeometry(0.6), mat(0xffd84d, 0xffb300), x, 4.55 * s + 0.4, z);
  const pts = [], cols = [], c = new THREE.Color();
  for (let i = 0; i < 140; i++) {
    const t = i / 140, a = i * 0.9, r = (1 - t) * 3.4 + 0.25;
    pts.push(x + Math.cos(a) * r, 2.2 + t * 7.4, z + Math.sin(a) * r);
    c.setHex(LIGHT_COLORS[i % LIGHT_COLORS.length]);
    cols.push(c.r, c.g, c.b);
  }
  addLights(pts, cols);
}

// 街灯
function lamp(x, z) {
  solid(x, 0, z, 0.2, 4.6, 0.2, mat(0x2b2f3a));
  deco(new THREE.SphereGeometry(0.3, 12, 8), mat(0x000000, 0xffd7a0), x, 4.75, z);
  const L = new THREE.PointLight(0xffc98a, 1.4, 18, 2);
  L.position.set(x, 4.5, z);
  W.scene.add(L);
}

function buildWorld() {
  const s = W.scene;
  s.background = new THREE.Color(0x0b1430);
  s.fog = new THREE.Fog(0x0b1430, 35, 120);
  s.add(new THREE.HemisphereLight(0x9fb4ff, 0x30384f, 0.6));
  const moon = new THREE.DirectionalLight(0xbfd0ff, 0.45);
  moon.position.set(-30, 60, -20);
  s.add(moon);
  const mm = new THREE.Mesh(new THREE.SphereGeometry(6, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff4d6, fog: false }));
  mm.position.set(-80, 70, -140);
  s.add(mm);

  // 地面（雪）と十字の道路（道路は見た目だけ）
  solid(0, -1, 0, 160, 1, 160, mat(COL.snow));
  const r1 = deco(new THREE.PlaneGeometry(120, 8), mat(COL.road), 0, 0.01, 0); r1.rotation.x = -Math.PI / 2;
  const r2 = deco(new THREE.PlaneGeometry(8, 120), mat(COL.road), 0, 0.012, 0); r2.rotation.x = -Math.PI / 2;

  // 歩道（0.15m の段差。歩いて上がれる）
  for (const sd of [1, -1]) {
    solid(sd * 33, 0, 5, 54, 0.15, 2, mat(COL.walk));
    solid(sd * 33, 0, -5, 54, 0.15, 2, mat(COL.walk));
    solid(5, 0, sd * 33, 2, 0.15, 54, mat(COL.walk));
    solid(-5, 0, sd * 33, 2, 0.15, 54, mat(COL.walk));
  }

  house(16, 15, 9, 8, 4.5, 0xc9b79c);
  house(31, 16, 10, 9, 6.5, 0x9fb7c9);
  house(16, -16, 8, 9, 5, 0xd8c3a5);
  house(30, -17, 11, 8, 4.5, 0xb88f86);
  house(-17, 16, 9, 8, 6.5, 0xa9c3a0);
  house(-31, 15, 8, 8, 4.5, 0xd1b0c4);

  xmasTree(-18, -18);
  tree(-28, -10, 1); tree(-30, -27, 1.2); tree(-11, -30, 1); tree(-40, -20, 1.1); tree(42, 8, 1); tree(8, 42, 1.1);

  car(14, -2, true, 0xc0392b);
  car(-2, 26, false, 0x2e86c1);
  car(-22, 2, true, 0x27ae60);

  lamp(7, 5); lamp(-7, -5); lamp(20, -5); lamp(-5, 22);

  // 遠くの家並み（見た目だけ。街の外）
  for (let i = 0; i < 28; i++) {
    const a = i / 28 * Math.PI * 2, r = 78 + (i % 3) * 6, h = 6 + ((i * 7) % 5) * 2.5;
    deco(new THREE.BoxGeometry(10, h, 10), mat(COL.far), Math.cos(a) * r, h / 2, Math.sin(a) * r);
  }

  // 街の端（見えない壁。カメラは無視する）
  const B = 58;
  for (const b of [addBox(0, -1, B + 1, 2 * B + 4, 200, 2), addBox(0, -1, -B - 1, 2 * B + 4, 200, 2),
                   addBox(B + 1, -1, 0, 2, 200, 2 * B + 4), addBox(-B - 1, -1, 0, 2, 200, 2 * B + 4)]) b.noCam = true;
}

// 雪。サンタの周り 80m 四方・高さ 40m の中を降り続け、はみ出たら反対側へ回す。
function makeSnow() {
  const N = 1800, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 80;
    pos[i * 3 + 1] = Math.random() * 40;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 80;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  W.snow = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.85 }));
  W.snow.frustumCulled = false;
  W.scene.add(W.snow);
}
function wrapAround(v, c, h) {
  while (v < c - h) v += 2 * h;
  while (v > c + h) v -= 2 * h;
  return v;
}
function updateSnow(center, dt, t) {
  const a = W.snow.geometry.attributes.position, arr = a.array;
  for (let i = 0; i < arr.length; i += 3) {
    arr[i + 1] -= 1.6 * dt;
    arr[i] += Math.sin(t * 0.7 + i) * 0.3 * dt;
    if (arr[i + 1] < center.y - 10) arr[i + 1] += 40;
    arr[i] = wrapAround(arr[i], center.x, 40);
    arr[i + 2] = wrapAround(arr[i + 2], center.z, 40);
  }
  a.needsUpdate = true;
}
```

- [ ] **Step 2: Commit** — `git add -A && git commit -m "雪の夜の街（家・車・木・街灯・雪）"`

---

### Task 5: サンタの見た目・カメラ・入力・音・起動

**Files:** Create `src/40-santa.js`, `src/45-camera.js`, `src/50-input.js`, `src/20-sound.js`, `src/90-boot.js`

- [ ] **Step 1: `src/40-santa.js`**

```js
// ===== サンタの見た目（正面は -Z） =====
function makeSantaMesh() {
  const g = new THREE.Group();
  const red = mat(0xd8322c), white = mat(0xf4f1ea), black = mat(0x1b1b1f), skin = mat(0xf2c7a5);
  const add = (geo, m, x, y, z, parent) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    (parent || g).add(o);
    return o;
  };
  // 脚と腕は付け根を中心に振るので Group に入れる
  const leg = x => {
    const p = new THREE.Group(); p.position.set(x, 0.6, 0); g.add(p);
    add(new THREE.BoxGeometry(0.26, 0.5, 0.28), red, 0, -0.25, 0, p);
    add(new THREE.BoxGeometry(0.3, 0.14, 0.4), black, 0, -0.53, -0.05, p);
    return p;
  };
  const arm = x => {
    const p = new THREE.Group(); p.position.set(x, 1.25, 0); g.add(p);
    add(new THREE.BoxGeometry(0.2, 0.55, 0.22), red, 0, -0.27, 0, p);
    add(new THREE.SphereGeometry(0.12, 10, 8), white, 0, -0.58, 0, p);
    return p;
  };
  const legL = leg(-0.17), legR = leg(0.17), armL = arm(-0.5), armR = arm(0.5);
  add(new THREE.BoxGeometry(0.8, 0.75, 0.6), red, 0, 0.95, 0);                     // 胴
  add(new THREE.BoxGeometry(0.82, 0.12, 0.62), black, 0, 0.78, 0);                 // ベルト
  add(new THREE.BoxGeometry(0.16, 0.1, 0.04), mat(0xffd84d), 0, 0.78, -0.33);      // バックル
  add(new THREE.BoxGeometry(0.14, 0.62, 0.04), white, 0, 1.02, -0.31);             // 前の白い線
  add(new THREE.SphereGeometry(0.24, 16, 12), skin, 0, 1.5, 0);                    // 顔
  add(new THREE.SphereGeometry(0.2, 12, 10), white, 0, 1.38, -0.12);               // ひげ
  add(new THREE.SphereGeometry(0.03, 6, 6), black, -0.08, 1.56, -0.22);            // 目
  add(new THREE.SphereGeometry(0.03, 6, 6), black, 0.08, 1.56, -0.22);
  add(new THREE.CylinderGeometry(0.27, 0.27, 0.08, 16), white, 0, 1.62, 0);        // 帽子のふち
  add(new THREE.ConeGeometry(0.25, 0.45, 14), red, 0, 1.88, 0.02);                 // 帽子
  add(new THREE.SphereGeometry(0.08, 10, 8), white, 0, 2.12, 0.03);                // ぼんぼり
  add(new THREE.SphereGeometry(0.38, 14, 10), mat(0x9a6a3a), 0, 1.1, 0.42);        // 背中の袋
  W.scene.add(g);
  return { group: g, legL, legR, armL, armR, rot: 0 };
}

// 角度 a を b へ、最短の回り方で f の割合だけ近づける
function lerpAngle(a, b, f) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * f;
}

function updateSantaMesh(sm, s, dt, t) {
  sm.group.position.set(s.pos.x, s.pos.y, s.pos.z);
  sm.rot = lerpAngle(sm.rot, s.facing, Math.min(1, dt * 14));
  sm.group.rotation.y = sm.rot;
  const sp = Math.min(1, Math.hypot(s.vel.x, s.vel.z) / CFG.walkSpeed);
  const sw = s.onGround ? Math.sin(t * 11) * 0.7 * sp : 0;
  sm.legL.rotation.x = sw;  sm.legR.rotation.x = -sw;
  sm.armL.rotation.x = -sw * 0.8; sm.armR.rotation.x = sw * 0.8;
}
```

- [ ] **Step 2: `src/45-camera.js`**

```js
// ===== 三人称カメラ =====
const CAM = { yaw: 0, pitch: CFG.camPitch, dist: CFG.camDist, cam: null };

// マウス・タッチの動き（ラジアン）。右へ動かすと右を向き、下へ動かすと見下ろす。
function camLook(dx, dy) {
  CAM.yaw -= dx;
  CAM.pitch = Math.min(CFG.camPitchMax, Math.max(CFG.camPitchMin, CAM.pitch + dy));
}

function updateCamera(s, dt) {
  const target = { x: s.pos.x, y: s.pos.y + CFG.camLookHeight, z: s.pos.z };
  const p = cameraPlace(target, CAM.yaw, CAM.pitch, PHYS.boxes);
  // 壁に寄るときはすぐ、離れるときはゆっくり戻す（カメラがガクガクしないように）
  CAM.dist = p.dist < CAM.dist ? p.dist : CAM.dist + (p.dist - CAM.dist) * Math.min(1, dt * 5);
  const d = p.dir;
  CAM.cam.position.set(target.x + d.x * CAM.dist, target.y + d.y * CAM.dist, target.z + d.z * CAM.dist);
  CAM.cam.lookAt(target.x, target.y, target.z);
}
```

- [ ] **Step 3: `src/50-input.js`**

```js
// ===== 入力（キーボード・マウス・タッチ） =====
const INPUT = { keys: {}, lookX: 0, lookY: 0, stick: null, lookTouch: null, touch: false };
const STICK_R = 50;   // スティックを倒しきる距離 px

function initInput(canvas) {
  addEventListener('keydown', e => {
    INPUT.keys[e.code] = true;
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', e => { INPUT.keys[e.code] = false; });
  addEventListener('blur', () => { INPUT.keys = {}; });

  addEventListener('mousemove', e => {
    if (document.pointerLockElement !== canvas) return;
    INPUT.lookX += e.movementX * CFG.mouseSens;
    INPUT.lookY += e.movementY * CFG.mouseSens;
  });
  canvas.addEventListener('click', () => {
    if (!INPUT.touch && canvas.requestPointerLock && document.pointerLockElement !== canvas) canvas.requestPointerLock();
  });

  // タッチ：画面の左半分は移動スティック（触れた場所に出る）、右半分はドラッグで視点
  const stickEl = document.getElementById('stick'), knob = document.getElementById('knob');
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    INPUT.touch = true;
    document.body.classList.add('touch');
    for (const t of e.changedTouches) {
      if (t.clientX < innerWidth / 2 && !INPUT.stick) {
        INPUT.stick = { id: t.identifier, ox: t.clientX, oy: t.clientY, x: 0, z: 0 };
        stickEl.style.left = t.clientX + 'px';
        stickEl.style.top = t.clientY + 'px';
        knob.style.transform = '';
        stickEl.classList.add('on');
      } else if (!INPUT.lookTouch) {
        INPUT.lookTouch = { id: t.identifier, x: t.clientX, y: t.clientY };
      }
    }
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const s = INPUT.stick, l = INPUT.lookTouch;
      if (s && t.identifier === s.id) {
        let dx = t.clientX - s.ox, dy = t.clientY - s.oy;
        const len = Math.hypot(dx, dy);
        if (len > STICK_R) { dx *= STICK_R / len; dy *= STICK_R / len; }
        s.x = dx / STICK_R;
        s.z = -dy / STICK_R;
        knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      } else if (l && t.identifier === l.id) {
        INPUT.lookX += (t.clientX - l.x) * CFG.touchSens;
        INPUT.lookY += (t.clientY - l.y) * CFG.touchSens;
        l.x = t.clientX;
        l.y = t.clientY;
      }
    }
  }, { passive: false });
  const end = e => {
    for (const t of e.changedTouches) {
      if (INPUT.stick && t.identifier === INPUT.stick.id) { INPUT.stick = null; stickEl.classList.remove('on'); }
      if (INPUT.lookTouch && t.identifier === INPUT.lookTouch.id) INPUT.lookTouch = null;
    }
  };
  canvas.addEventListener('touchend', end);
  canvas.addEventListener('touchcancel', end);
}

// 移動入力 {x: 右が+, z: 前が+}
function readMove() {
  if (INPUT.stick) return { x: INPUT.stick.x, z: INPUT.stick.z };
  const k = INPUT.keys;
  const x = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
  const z = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
  return { x, z };
}
// たまった視点の動きを受け取って空にする
function takeLook() {
  const l = { x: INPUT.lookX, y: INPUT.lookY };
  INPUT.lookX = 0;
  INPUT.lookY = 0;
  return l;
}
```

- [ ] **Step 4: `src/20-sound.js`**

```js
// ===== 音（Web Audio で自作。ファイルは使わない） =====
const SND = { ctx: null, out: null, noise: null };

// 最初のクリック・タップで呼ぶ（ブラウザは操作前に音を出させない）
function sndInit() {
  if (SND.ctx) return;
  try { SND.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  const c = SND.ctx;
  SND.out = c.createGain();
  SND.out.gain.value = 0.7;
  SND.out.connect(c.destination);
  const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  SND.noise = buf;

  // 風：ノイズを低くこもらせ、ゆっくり強弱をつけて流し続ける
  const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
  const g = c.createGain(); g.gain.value = 0.06;
  const lfo = c.createOscillator(); lfo.frequency.value = 0.08;
  const lg = c.createGain(); lg.gain.value = 0.04;
  lfo.connect(lg); lg.connect(g.gain);
  src.connect(lp); lp.connect(g); g.connect(SND.out);
  src.start(); lfo.start();
}

// 雪を踏む「ザクッ」
function sndStep() {
  const c = SND.ctx;
  if (!c) return;
  const t = c.currentTime;
  const src = c.createBufferSource(); src.buffer = SND.noise;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100 + Math.random() * 700; bp.Q.value = 1.1;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  src.connect(bp); bp.connect(g); g.connect(SND.out);
  src.start(t, Math.random() * 1.5, 0.14);
}
```

- [ ] **Step 5: `src/90-boot.js`**

```js
// ===== 起動とメインループ =====
(function boot() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  document.body.prepend(renderer.domElement);

  W.scene = new THREE.Scene();
  buildWorld();
  makeSnow();
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400);
  CAM.cam = camera;

  const START = { x: 0, z: 14 };
  const santa = newSanta(START.x, START.z);
  const sm = makeSantaMesh();
  initInput(renderer.domElement);

  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  });

  // タイトル：クリック・タップで始める
  let started = false;
  const title = document.getElementById('title');
  title.addEventListener('touchstart', () => { INPUT.touch = true; document.body.classList.add('touch'); }, { passive: true });
  title.addEventListener('click', () => {
    started = true;
    title.classList.add('off');
    sndInit();
    const cv = renderer.domElement;
    if (!INPUT.touch && cv.requestPointerLock) cv.requestPointerLock();
  });

  let last = performance.now(), t = 0, walked = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    if (started) {
      const l = takeLook();
      camLook(l.x, l.y);
      const bx = santa.pos.x, bz = santa.pos.z;
      santaStep(santa, readMove(), CAM.yaw, dt, PHYS.boxes);
      // 雪を踏む音（地面を 1.1m 進むごと）
      if (santa.onGround) {
        walked += Math.hypot(santa.pos.x - bx, santa.pos.z - bz);
        if (walked > 1.1) { walked = 0; sndStep(); }
      }
      // 万一、街の外へ落ちたらスタートへ戻す
      if (santa.pos.y < -30) {
        santa.pos = { x: START.x, y: 0, z: START.z };
        santa.vel = { x: 0, y: 0, z: 0 };
      }
    }
    updateSantaMesh(sm, santa, dt, t);
    updateCamera(santa, dt);
    updateSnow(santa.pos, dt, t);
    renderer.render(W.scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // 画面確認用（コンソールから位置やカメラを動かせる）
  window.GAME = { santa, CAM, PHYS, W, renderer, camera };
})();
```

- [ ] **Step 6: build して verify が通ることを確かめる** — `sh build.sh` → `verify.html` が `PASS 23/23` のまま。

- [ ] **Step 7: Commit** — `git add -A && git commit -m "サンタの見た目・三人称カメラ・入力・音・起動"`

---

### Task 6: 画面で確かめる（コントローラ担当）

- [ ] `santa.html` をアプリ内ブラウザで開き、コンソールエラーが無いこと
- [ ] タイトルをクリック → `GAME.santa` を歩かせ（`INPUT.keys.KeyW = true` を一定時間）、位置が変わる・歩道に上がる・家の壁で止まること
- [ ] スクリーンショットで、雪・家・イルミネーション・街灯・月・サンタが見えること。暗すぎ・明るすぎなら `buildWorld` の光の強さだけ直す
- [ ] `resize_window` mobile で、タイトルが崩れないこと
- [ ] 直したら commit

### Task 7: 制作記録（コントローラ担当）

- [ ] 保管庫 `02_ゲーム/サンタ、ちゃんと届けて/` に 01_目次〜07_学んだこと を作る（DISARM と同じ構成）。05_制作ログ に Phase 1 の回を書く（何を作ったか・なぜそうしたか）。03_仕様リファレンス に CFG の数値表
- [ ] 保管庫側リポジトリにコミット
