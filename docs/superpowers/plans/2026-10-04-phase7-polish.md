# Phase 7 仕上げ（最後の家・クリアの花火・スマホの軽さ） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**本人の選択（2026-10-04）:** 最後の家を特別に／クリアの演出／スマホの軽さ対策。公開は fish-suika/santa（public）の GitHub Pages（公開作業はコントローラが行う）。

**Goal**
1. **最後の家**: 崖の上（y=20）に大きなクリスマスツリーと木、崖の縁にイルミネーション、玄関にリース、家を照らす暖かい明かり
2. **クリアの花火**: 最後の 1 軒を届けた瞬間、カメラの前方の夜空に 5 発の花火（0.45 秒おき）。クリア画面は 2.6 秒後に出す
3. **軽さ**: 動かない部品（`W.scene` 直下の Mesh）を材質ごとに 1 つにまとめる。描画回数を 588 → 数十へ。動くもの（車・列車・電線は Group、逃げる家と脚、後から作る影・目印・光の柱・プレゼント）はまとめない

---

### Task 1: 最後の家（崖の上）

**Files:** Modify `src/30-world.js`

- [ ] **Step 1:** `tree()` と `xmasTree()` に土台の高さ `y0`（省略で 0）を足す。次の 2 関数に置き換える

```js
// 木。当たり判定は幹だけ。y0 は土台の高さ（崖の上など。省略で 0）
function tree(x, z, s, y0) {
  y0 = y0 || 0;
  solid(x, y0, z, 0.4 * s, 1.2 * s, 0.4 * s, mat(COL.trunk));
  deco(new THREE.ConeGeometry(1.6 * s, 2.4 * s, 8), mat(COL.leaf), x, y0 + 2.2 * s, z);
  deco(new THREE.ConeGeometry(1.2 * s, 2.0 * s, 8), mat(COL.leaf), x, y0 + 3.4 * s, z);
  deco(new THREE.ConeGeometry(0.55 * s, 0.6 * s, 8), mat(COL.snow), x, y0 + 4.25 * s, z);
}

// 大きなクリスマスツリー（星とらせんのイルミネーション）。y0 は土台の高さ
function xmasTree(x, z, y0) {
  y0 = y0 || 0;
  const s = 2.2;
  tree(x, z, s, y0);
  deco(new THREE.OctahedronGeometry(0.6), mat(0xffd84d, 0xffb300), x, y0 + 4.55 * s + 0.4, z);
  const pts = [], cols = [], c = new THREE.Color();
  for (let i = 0; i < 140; i++) {
    const t = i / 140, a = i * 0.9, r = (1 - t) * 3.4 + 0.25;
    pts.push(x + Math.cos(a) * r, y0 + 2.2 + t * 7.4, z + Math.sin(a) * r);
    c.setHex(LIGHT_COLORS[i % LIGHT_COLORS.length]);
    cols.push(c.r, c.g, c.b);
  }
  addLights(pts, cols);
}
```

（`tree` の上にあった元のコメント行「木。当たり判定は幹だけ。」と `xmasTree` の上の「広場の大きなクリスマスツリー」は、上のコメントに置き換える）

- [ ] **Step 2:** `buildWorld()` の `house(0, -232, 10, 9, 6, 0xe8d2b0, 20);        // ★ 5 軒目（崖の上の最後の家）` の次に足す

```js
  // 最後の家を特別に：大きなツリー・木・崖の縁のイルミネーション・玄関のリース・暖かい明かり
  xmasTree(13, -236, 20);
  tree(-14, -241, 1.2, 20); tree(-20, -226, 1, 20); tree(22, -224, 1.1, 20); tree(-30, -238, 1.3, 20);
  {
    const pts = [], cols = [], c = new THREE.Color();
    let k = 0;
    for (let x = -36; x <= 36; x += 0.8) {                     // 崖の縁（z=-214）に沿って垂れ下がる電球
      pts.push(x, 20.1 - Math.abs(Math.sin(x * 0.7)) * 0.6, -213.9);
      c.setHex(LIGHT_COLORS[k++ % LIGHT_COLORS.length]);
      cols.push(c.r, c.g, c.b);
    }
    addLights(pts, cols);
  }
  const wreath = deco(new THREE.TorusGeometry(0.42, 0.12, 8, 20), mat(0x2f8f4f), 0, 21.95, -227.4);   // 玄関のリース
  deco(new THREE.BoxGeometry(0.25, 0.18, 0.08), mat(0xd8322c), 0, 21.55, -227.33);                    // リボン
  wreath.rotation.y = 0;
  const homeLight = new THREE.PointLight(0xffc98a, 1.6, 22, 2);
  homeLight.position.set(0, 25, -222);
  s.add(homeLight);
```

（玄関は家の +Z 側の面 z = -232 + 9/2 = -227.5、ドアの中心は y = 20 + 1.0。リースはドアの上 y≈21.95）

- [ ] **Step 3:** `sh build.sh` が通り、verify 82/82 のまま
- [ ] **Step 4: Commit** — `git add -A && git commit -m "最後の家を特別に：崖の上のツリー・木・縁のイルミネーション・リース・明かり"`

---

### Task 2: クリアの花火

**Files:** Modify `src/42-delivery-fx.js`, `src/20-sound.js`, `src/90-boot.js`

- [ ] **Step 1: `src/42-delivery-fx.js`** — `const FX = { down: null };` を次にする

```js
const FX = { down: null, bursts: [], pending: [], clock: 0 };
```

`updateFx(dt)` の関数の**先頭**（`const d = FX.down;` の前）に 1 行足す

```js
  updateBursts(dt);
```

ファイル末尾に足す

```js

// クリアの花火。center のまわり（横 ±8m・高さ +0〜8m）に、0.45 秒おきに 5 発
function celebrate(center) {
  FX.clock = 0;
  FX.pending = [];
  for (let k = 0; k < 5; k++) {
    FX.pending.push({ at: k * 0.45, x: center.x + (Math.random() - 0.5) * 16, y: center.y + Math.random() * 8, z: center.z + (Math.random() - 0.5) * 16 });
  }
}

// 1 発ぶん：140 粒が四方へ飛び散り、重力で垂れながら 2.2 秒で消える
function burst(p) {
  const N = 140, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), vel = [];
  const c = new THREE.Color(LIGHT_COLORS[Math.floor(Math.random() * LIGHT_COLORS.length)]);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
    const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), sp = 7 + Math.random() * 3;
    vel.push(Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.5, vertexColors: true, transparent: true, opacity: 1, fog: false, depthWrite: false }));
  W.scene.add(m);
  FX.bursts.push({ m, vel, t: 0 });
  sndBoom();
}

function updateBursts(dt) {
  FX.clock += dt;
  while (FX.pending.length && FX.pending[0].at <= FX.clock) burst(FX.pending.shift());
  for (let i = FX.bursts.length - 1; i >= 0; i--) {
    const b = FX.bursts[i];
    b.t += dt;
    const a = b.m.geometry.attributes.position, arr = a.array;
    for (let j = 0; j < b.vel.length; j += 3) {
      b.vel[j + 1] -= 6 * dt;
      arr[j] += b.vel[j] * dt; arr[j + 1] += b.vel[j + 1] * dt; arr[j + 2] += b.vel[j + 2] * dt;
    }
    a.needsUpdate = true;
    b.m.material.opacity = Math.max(0, 1 - b.t / 2.2);
    if (b.t > 2.2) {
      W.scene.remove(b.m);
      b.m.geometry.dispose();
      b.m.material.dispose();
      FX.bursts.splice(i, 1);
    }
  }
}
```

- [ ] **Step 2: `src/20-sound.js`** — 末尾に足す

```js

// 花火「ドーン」（低い音とノイズ）
function sndBoom() {
  const c = SND.ctx;
  if (!c) return;
  const t = c.currentTime;
  sndTone(90, t, 0.5, 'sine', 0.35, 40);
  const src = c.createBufferSource(); src.buffer = SND.noise;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  src.connect(lp); lp.connect(g); g.connect(SND.out);
  src.start(t, Math.random() * 1.2, 0.65);
}
```

- [ ] **Step 3: `src/90-boot.js`** — `finish()` の `sndClear();` の次の行に足す

```js
    // カメラの前方 14m・サンタの 9m 上のあたりに花火
    const a = camAxes(CAM.yaw);
    celebrate({ x: santa.pos.x + a.fx * 14, y: santa.pos.y + 9, z: santa.pos.z + a.fz * 14 });
```

同じ `finish()` の `}, 900);` を `}, 2600);` に（花火を見せてからクリア画面）

- [ ] **Step 4:** `sh build.sh` → verify 82/82
- [ ] **Step 5: Commit** — `git add -A && git commit -m "クリアの花火"`

---

### Task 3: 動かない部品を材質ごとにまとめる（軽さ）

**Files:** Modify `src/30-world.js`, `src/90-boot.js`

- [ ] **Step 1: `src/30-world.js`** — 末尾（`updateSnow` の後）に足す

```js

// 動かない部品（W.scene 直下の Mesh）を、材質ごとに 1 つのメッシュにまとめる。描画回数が減り、スマホでも軽くなる。
// skip に入れた物と、Group の中身（車・列車・電線・サンタ）はまとめない。これより後に作った物（影・目印・光の柱など）も対象外
function mergeStatic(skip) {
  const byMat = new Map();
  for (const m of W.scene.children.slice()) {
    if (!m.isMesh || skip.has(m)) continue;
    m.updateMatrixWorld(true);
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    if (!byMat.has(m.material)) byMat.set(m.material, []);
    byMat.get(m.material).push(g);
    W.scene.remove(m);
  }
  for (const [material, geos] of byMat) {
    let n = 0;
    for (const g of geos) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
    let o = 0;
    for (const g of geos) {
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      o += g.attributes.position.count;
      g.dispose();
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    W.scene.add(new THREE.Mesh(merged, material));
  }
}
```

- [ ] **Step 2: `src/90-boot.js`** — `buildRunaway();` の次の行に足す（`makeSnow();` より前）

```js
  mergeStatic(new Set([...HZ.runaway.meshes, ...HZ.runaway.legs]));   // 逃げる家とその脚は動くのでまとめない
```

- [ ] **Step 3:** `sh build.sh` → verify 82/82
- [ ] **Step 4: Commit** — `git add -A && git commit -m "動かない部品を材質ごとにまとめて描画回数を減らす"`

### Task 4: 確かめる・公開（コントローラ担当）
