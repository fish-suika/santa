# Phase 3 プレゼントを持つ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スタートの岸のそりで E（スマホは「受け取る」ボタン）を押すとプレゼントを受け取り、胸の前に抱えて運ぶ。持ったまま川に落ちると、プレゼントが宙に放り出されて「プレゼントを落とした！」。1.4 秒後にそりの横から、プレゼントを持った状態でやり直す。持ったまま向こう岸に着くと「向こう岸に着いた！」（配達は Phase 4 で置き換える仮のゴール）。

**Architecture:** 進み具合（持っている・落とした・やり直し・向こう岸）は three.js 非依存の `16-run.js` に置き、verify で試す。ギミック（Phase 5〜6）から呼べるよう、落とす処理は `dropPresent(run)` に切り出す。画面の文字は `60-hud.js`。

**Tech Stack:** 素の JavaScript、three.js r128、Web Audio。Node は無い。

**前提:** Phase 2＋試しコース完了（verify 37/37）。`sh build.sh` → `verify.html` をブラウザで開いてタイトルが `PASS n/n` なら全通過。

---

### Task 1: 進み具合の計算（three.js 非依存）

**Files:** Modify `src/10-config.js`, `build.sh`, `src/verify-tests.js`（`// ===== 結果表示 =====` の直前）; Create `src/16-run.js`

- [ ] **Step 1: `src/10-config.js`** — `CFG` の中、`fallY` の行の次に足す

```js

  // プレゼント
  pickupRange: 2.5,     // そりからこの距離（横）以内なら受け取れる
  dropDelay: 1.4,       // 落としてから、受け取り地点で再開するまでの秒数
```

`COURSE` を次に置き換える

```js
const COURSE = {
  riverHalf: 7,         // 凍った川の幅の半分（川は z = -7〜+7。幅 14m）
  start: { x: 0, z: 45 },
  sleigh: { x: 9, z: 44 },     // プレゼントの受け取り地点（そり）
  respawn: { x: 7, z: 44 },    // 落ちたときに戻る場所（そりの横）
};
```

- [ ] **Step 2: `build.sh`** — 本体と検証ページの両方で、`src/14-control.js \` の次の行に `src/16-run.js \` を足す。本体のほうは `src/50-input.js \` の次の行に `src/60-hud.js \` も足す（`60-hud.js` は Task 3 で作る。それまでは空ファイルを置いておく）。

- [ ] **Step 3: テストを足す**

```js
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

test('checkCrossed: 持って向こう岸に立った瞬間だけ true。持っていなければ false', () => {
  const s = newSanta(0, -COURSE.riverHalf - 3);
  s.onGround = true;
  eq(checkCrossed(newRun(), s), false);
  const r = carryingRun();
  eq(checkCrossed(r, s), true);
  eq(checkCrossed(r, s), false);
});
```

- [ ] **Step 4: 失敗を確かめる** — `src/16-run.js` を空ファイルで作り、`src/60-hud.js` も空ファイルで作って `sh build.sh` → verify でプレゼントのテストが `newRun is not defined` などで FAIL。

- [ ] **Step 5: 実装 `src/16-run.js`**

```js
// ===== 配達の進み具合（three.js に依存しない） =====
// state: 'play'（ふつう）／'dropped'（プレゼントを落とした。dropDelay 秒後に受け取り地点から再開）
function newRun() {
  return { carrying: false, state: 'play', timer: 0, drops: 0, crossed: false };
}

// 受け取り地点 p の近く（横 pickupRange 以内、高さ 2m 未満）にいるか
function nearPickup(s, p) {
  return Math.hypot(s.pos.x - p.x, s.pos.z - p.z) <= CFG.pickupRange && Math.abs(s.pos.y - (p.y || 0)) < 2;
}

// E を押したとき。受け取れたら true
function tryPickup(run, s, p) {
  if (run.state !== 'play' || run.carrying || !nearPickup(s, p)) return false;
  run.carrying = true;
  return true;
}

// サンタを場所 p に置き直す（勢いも消す）
function placeAt(s, p) {
  s.pos = { x: p.x, y: p.y || 0, z: p.z };
  s.vel = { x: 0, y: 0, z: 0 };
  s.onGround = false;
  s.jumpBuf = 0;
  s.coyote = 0;
}

// プレゼントを落とす。川に落ちたときのほか、Phase 5〜6 のギミックからも呼ぶ。落としたら true
function dropPresent(run) {
  if (!run.carrying || run.state !== 'play') return false;
  run.carrying = false;
  run.state = 'dropped';
  run.timer = CFG.dropDelay;
  run.drops++;
  return true;
}

// 毎フレーム呼ぶ。返り値は起きたこと:
// 'dropped'（持ったまま落ちた）／'fell'（持たずに落ちた。すぐ戻した）／'respawn'（落とした後、受け取り地点に戻した）／null
function stepRun(run, s, dt, respawn) {
  if (run.state === 'dropped') {
    run.timer -= dt;
    if (run.timer > 0) return null;
    placeAt(s, respawn);
    run.state = 'play';
    run.carrying = true;   // 受け取り地点から、プレゼントを持った状態でやり直し
    return 'respawn';
  }
  if (s.pos.y >= CFG.fallY) return null;
  if (dropPresent(run)) return 'dropped';
  placeAt(s, respawn);
  return 'fell';
}

// 持ったまま向こう岸に立った瞬間に 1 回だけ true（Phase 4 で配達に置き換える仮のゴール）
function checkCrossed(run, s) {
  if (run.crossed || !run.carrying || !s.onGround || s.pos.z > -COURSE.riverHalf) return false;
  run.crossed = true;
  return true;
}
```

- [ ] **Step 6:** verify が `PASS 46/46`

- [ ] **Step 7: Commit** — `git add -A && git commit -m "プレゼントの進み具合（受け取る・落とす・やり直し・向こう岸）"`

---

### Task 2: そりとプレゼントの見た目

**Files:** Modify `src/30-world.js`, `src/40-santa.js`

- [ ] **Step 1: `src/30-world.js`** — `building()` の後（`function buildWorld()` の前）に足す

```js
// そり（プレゼントの受け取り地点）。当たり判定なし（中に入って受け取れる）
function sleigh(x, z) {
  const red = mat(0xc0392b), gold = mat(0xffd84d, 0x5a4000);
  deco(new THREE.BoxGeometry(1.6, 0.7, 2.8), red, x, 0.75, z);              // 車体
  deco(new THREE.BoxGeometry(1.6, 0.9, 0.3), red, x, 1.25, z + 1.3);        // 背もたれ
  for (const sx of [-0.7, 0.7]) {
    deco(new THREE.BoxGeometry(0.12, 0.12, 3.4), gold, x + sx, 0.12, z - 0.1);   // 刃
    for (const sz of [-1, 1]) deco(new THREE.BoxGeometry(0.1, 0.35, 0.1), gold, x + sx, 0.3, z + sz);   // 脚
  }
  // 積まれたプレゼント
  const cols = [0x2f9e57, 0x3a7bd5, 0xffd84d, 0xd8322c, 0x9b59b6];
  for (let i = 0; i < 5; i++) {
    deco(new THREE.BoxGeometry(0.5, 0.5, 0.5), mat(cols[i]),
      x + (i % 2 ? 0.35 : -0.35), 1.35 + Math.floor(i / 2) * 0.45, z - 0.6 + (i % 3) * 0.4);
  }
  // 足元の光の輪（受け取れる範囲の目安）とやわらかい明かり
  const ring = deco(new THREE.RingGeometry(2.0, 2.3, 40),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.6 }), x, 0.03, z);
  ring.rotation.x = -Math.PI / 2;
  const L = new THREE.PointLight(0xffd27a, 1.0, 10, 2);
  L.position.set(x, 2.5, z);
  W.scene.add(L);
}
```

`buildWorld()` の `// ---- 手前の岸 ----` の行の次に足す

```js
  sleigh(COURSE.sleigh.x, COURSE.sleigh.z);
```

- [ ] **Step 2: `src/40-santa.js`** — `makeSantaMesh()` の `W.scene.add(g);` の直前に足す

```js
  const present = makePresentMesh();     // 胸の前に抱えるプレゼント（持っているときだけ見える）
  present.position.set(0, 1.0, -0.55);
  present.visible = false;
  g.add(present);
```

return を次にする

```js
  return { group: g, legL, legR, armL, armR, rot: 0, squash: 0, present, carrying: false, thrown: null };
```

`updateSantaMesh` の `// 着地でつぶれて、すぐ戻る` の行の直前に足す

```js
  // プレゼントを持っているときは、両腕を前に出して抱える
  if (sm.carrying) sm.armL.rotation.x = sm.armR.rotation.x = 1.25;
  sm.present.visible = sm.carrying;
```

`updateSantaMesh` の後に足す

```js
// プレゼント（緑の箱に金のリボン）
function makePresentMesh() {
  const g = new THREE.Group(), s = 0.55, gold = mat(0xffd84d, 0x6a4a00);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mat(0x2f9e57)));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(s + 0.02, s + 0.02, 0.1), gold));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, s + 0.02, s + 0.02), gold));
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 6, 12), gold);
  bow.position.y = s / 2 + 0.06;
  g.add(bow);
  return g;
}

// 落としたプレゼントを宙に放り出す（見た目だけ。当たり判定なし。川の氷の下へ消える）
function throwPresent(sm) {
  clearThrown(sm);
  const wp = new THREE.Vector3();
  sm.present.getWorldPosition(wp);
  const m = makePresentMesh();
  m.position.copy(wp);
  W.scene.add(m);
  sm.thrown = { mesh: m, vx: (Math.random() - 0.5) * 3, vy: 7, vz: (Math.random() - 0.5) * 3 };
}
function updateThrown(sm, dt) {
  const th = sm.thrown;
  if (!th) return;
  th.vy -= CFG.gravity * dt;
  th.mesh.position.x += th.vx * dt;
  th.mesh.position.y += th.vy * dt;
  th.mesh.position.z += th.vz * dt;
  th.mesh.rotation.x += 6 * dt;
  th.mesh.rotation.z += 4 * dt;
  if (th.mesh.position.y < -30) clearThrown(sm);
}
function clearThrown(sm) {
  if (!sm.thrown) return;
  W.scene.remove(sm.thrown.mesh);
  sm.thrown = null;
}
```

- [ ] **Step 3:** `sh build.sh` が通り、verify が `PASS 46/46` のまま

- [ ] **Step 4: Commit** — `git add -A && git commit -m "そりと、抱えて運ぶプレゼントの見た目"`

---

### Task 3: 画面の文字・入力・音・つなぎ込み

**Files:** Modify `src/00-head.html`, `src/50-input.js`, `src/20-sound.js`, `src/90-boot.js`; Write `src/60-hud.js`

- [ ] **Step 1: `src/00-head.html`** — `</style>` の直前に足す

```css

  /* ---- 目的・お知らせ・操作の案内 ---- */
  #obj{position:fixed;left:16px;top:16px;z-index:5;max-width:calc(100vw - 32px);font-size:15px;letter-spacing:.06em;
    background:rgba(8,14,36,.62);border-left:3px solid var(--gold);padding:9px 14px 10px 12px;border-radius:0 4px 4px 0;
    text-shadow:0 1px 6px #000;pointer-events:none;display:none}
  #obj.on{display:block}
  #obj b{display:block;font-size:11px;letter-spacing:.25em;color:var(--gold);font-weight:400;margin-bottom:3px}
  #toast{position:fixed;left:50%;top:30%;z-index:7;transform:translate(-50%,-50%);width:max-content;max-width:90vw;
    font-size:clamp(22px,5vw,40px);font-weight:700;letter-spacing:.08em;text-align:center;
    text-shadow:0 2px 16px rgba(0,0,0,.8);opacity:0;transition:opacity .25s;pointer-events:none}
  #toast.on{opacity:1}
  #prompt{position:fixed;left:50%;bottom:22%;z-index:5;transform:translateX(-50%);font-size:16px;letter-spacing:.1em;
    background:rgba(8,14,36,.7);border:1px solid rgba(255,210,122,.6);padding:8px 16px;border-radius:20px;
    pointer-events:none;display:none;white-space:nowrap}
  #prompt.on{display:block}

  /* ---- スマホの「受け取る」ボタン（ジャンプボタンの左） ---- */
  #actBtn{position:fixed;right:132px;bottom:40px;z-index:6;width:72px;height:72px;border-radius:50%;
    border:2px solid rgba(255,255,255,.5);background:rgba(255,210,122,.45);color:#fff;font:700 14px var(--jp);
    display:none;touch-action:none}
  body.touch #actBtn{display:block}
  #actBtn:active{background:rgba(255,210,122,.8)}
```

タイトルの説明とヒントを書き換える

```html
  <small>WASD 移動 ・ Space ジャンプ ・ E 受け取る ・ マウス 視点<br>スマホ：左で移動 ・ 右で視点 ・ 右下のボタン</small>
```

```html
<div id="hint">WASD 移動 ／ Space ジャンプ ／ E 受け取る ／ マウス 視点 ／ Esc でマウスを離す</div>
```

`<button id="jumpBtn">ジャンプ</button>` の次の行に足す

```html
<button id="actBtn">受け取る</button>
<div id="obj"><b>いまやること</b><span id="objText"></span></div>
<div id="toast"></div>
<div id="prompt"></div>
```

- [ ] **Step 2: `src/50-input.js`** — `INPUT` に `act: false` を足す

```js
const INPUT = { keys: {}, lookX: 0, lookY: 0, stick: null, lookTouch: null, touch: false, jump: false, act: false };
```

keydown の `if (e.code === 'Space' && !e.repeat) INPUT.jump = true;` の次の行に

```js
    if (e.code === 'KeyE' && !e.repeat) INPUT.act = true;
```

`jb.addEventListener('touchstart', ...)` の行の次に

```js
  const ab = document.getElementById('actBtn');
  ab.addEventListener('touchstart', e => { e.preventDefault(); INPUT.act = true; }, { passive: false });
```

`takeJump` の後に

```js
// E（受け取る・届ける）が押されたか（押された瞬間に 1 回だけ true）
function takeAct() {
  const a = INPUT.act;
  INPUT.act = false;
  return a;
}
```

- [ ] **Step 3: `src/60-hud.js`**（空ファイルを置き換える）

```js
// ===== 画面の文字（目的・お知らせ・操作の案内） =====
const HUD = { toastTimer: 0 };

// 左上の「いまやること」。空文字なら隠す
function setObjective(text) {
  document.getElementById('objText').textContent = text;
  document.getElementById('obj').classList.toggle('on', !!text);
}

// 画面中央の大きなお知らせ。sec 秒で消える
function showToast(text, sec) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.add('on');
  HUD.toastTimer = sec || 2;
}

// 下の操作の案内（「E で受け取る」など）。null なら隠す
function setPrompt(text) {
  const el = document.getElementById('prompt');
  if (el.textContent !== (text || '')) el.textContent = text || '';
  el.classList.toggle('on', !!text);
}

function updateHud(dt) {
  if (HUD.toastTimer <= 0) return;
  HUD.toastTimer -= dt;
  if (HUD.toastTimer <= 0) document.getElementById('toast').classList.remove('on');
}
```

- [ ] **Step 4: `src/20-sound.js`** — 末尾に足す

```js

// 単音。freqEnd を渡すとその音程まで滑る
function sndTone(freq, t0, dur, type, vol, freqEnd) {
  const c = SND.ctx;
  const o = c.createOscillator(); o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, t0);
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(SND.out);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

// 受け取り「ピロリン」
function sndPickup() {
  const c = SND.ctx;
  if (!c) return;
  const t = c.currentTime;
  sndTone(988, t, 0.15, 'sine', 0.2);
  sndTone(1319, t + 0.1, 0.25, 'sine', 0.2);
}

// 落とした「ヒュ〜〜」（音程が下がる）
function sndDrop() {
  const c = SND.ctx;
  if (!c) return;
  sndTone(700, c.currentTime, 0.7, 'triangle', 0.22, 110);
}
```

- [ ] **Step 5: `src/90-boot.js`**

`const mk = makeMarker();` の次の行に

```js
  const run = newRun();
```

タイトルの click の中、`sndInit();` の次の行に

```js
    setObjective('そりでプレゼントを受け取ろう');
```

`if (started) {` の中の、`const mv = readMove();` と `mv.jump = takeJump();` の 2 行を次に置き換える（落とした直後は操作を止める）

```js
      const playing = run.state === 'play';
      const mv = playing ? readMove() : { x: 0, z: 0 };
      mv.jump = takeJump() && playing;
      const act = takeAct();
```

`// 川に落ちたらスタートへ戻す（Phase 3 で…）` のコメントとその `if (santa.pos.y < CFG.fallY) { ... }` のブロックを丸ごと、次に置き換える

```js
      // プレゼント：受け取る・落とす・やり直し・向こう岸（向こう岸は Phase 4 で配達に置き換える）
      if (act && tryPickup(run, santa, COURSE.sleigh)) {
        sndPickup();
        showToast('プレゼントを受け取った！', 1.6);
        setObjective('プレゼントを持って、川の向こう岸へ');
      }
      const ev = stepRun(run, santa, dt, COURSE.respawn);
      if (ev === 'dropped') {
        throwPresent(sm);
        sndDrop();
        showToast('プレゼントを落とした！', CFG.dropDelay);
      } else if (ev === 'respawn') {
        clearThrown(sm);
        showToast('そりからやり直し', 1.4);
      }
      if (checkCrossed(run, santa)) {
        showToast('向こう岸に着いた！', 2.2);
        setObjective('向こう岸に着いた！（配達は次の段階で作ります）');
      }
      const canPick = !run.carrying && run.state === 'play' && nearPickup(santa, COURSE.sleigh);
      setPrompt(canPick ? (INPUT.touch ? '「受け取る」ボタンで受け取る' : 'E で受け取る') : null);
      sm.carrying = run.carrying;
```

`updateSantaMesh(sm, santa, dt, t);` の次の行に

```js
    updateThrown(sm, dt);
    updateHud(dt);
```

`window.GAME = { ... }` に `run` を足す

```js
  window.GAME = { santa, run, sm, CAM, PHYS, W, renderer, camera };
```

- [ ] **Step 6:** `sh build.sh` → verify が `PASS 46/46` のまま

- [ ] **Step 7: Commit** — `git add -A && git commit -m "受け取る操作・画面の文字・音をつなぎ、落としたらそりからやり直す"`

---

### Task 4: 画面で確かめる（コントローラ担当）

- [ ] そりの前で「E で受け取る」が出る → E でプレゼントを抱える（スクリーンショット）
- [ ] 持ったまま川に落ちる → プレゼントが宙に飛ぶ・「プレゼントを落とした！」→ 1.4 秒後にそりの横で持った状態
- [ ] 持たずに落ちる → すぐそりの横へ
- [ ] 持ったまま向こう岸 → 「向こう岸に着いた！」
- [ ] スマホ幅で「受け取る」ボタン・左上の目的が重ならない
- [ ] コンソールエラーなし

### Task 5: 制作記録（コントローラ担当）
