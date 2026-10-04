# Phase 4a 配達（2 軒） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 今の川のコースで、2 軒に届けるとクリアになる。

- 配達先の煙突の上で E（スマホは「届ける」ボタン）を押すと、プレゼントが煙突へ吸い込まれる
- 届けたら背中の袋から次のプレゼントを出し、そのまま次へ向かう。落としたときは、届けた家の前からやり直す
- 配達先の煙突から空へ光の柱が伸びている。ただし見えるのは、サンタが 10m より高くいるときだけ
- ほかの家の煙突で E を押すと「この家じゃない！」
- 右上にタイム。2 軒届けるとクリア画面（タイム・自己ベスト・もう一度）

**本人の選択:** 届けたらすぐ次を持つ（背中の袋から）／Phase 4 は 2 回に分ける（4a: 配達の仕組みを 2 軒で、4b: 5 区画の街に広げて 5 軒）

**Architecture:** 配達・タイム・自己ベストの計算は three.js 非依存の `16-run.js` に足し、verify で試す。光の柱と煙突へ入る演出は新しい `42-delivery-fx.js`。仮のゴール「向こう岸に着いた」（`checkCrossed`）は削除する。

**Tech Stack:** 素の JavaScript、three.js r128、Web Audio。Node は無い。

**前提:** Phase 3 完了（verify 46/46）。

---

### Task 1: 配達の計算（three.js 非依存）

**Files:** Modify `src/10-config.js`, `src/16-run.js`, `src/30-world.js`, `src/verify-tests.js`

- [ ] **Step 1: `src/10-config.js`** — `CFG` の `dropDelay` の行の次に足す

```js

  // 配達
  chimneyHalf: 0.55,    // 煙突の上面（縁）の幅の半分
  beaconMinY: 10,       // 足元がこの高さ以上のときだけ、配達先の光の柱が見える
```

`COURSE` の `respawn` の行の次に足す

```js
  targets: [{ x: -17, z: 30 }, { x: 28, z: -38 }],   // 配達先の家（中心）。この順に届ける
```

- [ ] **Step 2: `src/30-world.js`** — `house()` の `W.houses.push(...)` の行を次に置き換える（煙突に、落としたときに戻る「その家の前」を持たせる）

```js
  W.houses.push({ x: cx, z: cz, w, d, wallH,
    chimney: { x: chX, y: wallH + chH + 0.2, z: chZ, front: { x: cx, z: cz + d / 2 + 2.5 } } });
```

- [ ] **Step 3: テスト** — `src/verify-tests.js` の `test('checkCrossed: ...')` を丸ごと削除し、同じ場所（`// ===== 結果表示 =====` の直前）に次を足す

```js
// ===== 配達 =====
function chim(x, y, z) { return { x, y, z, front: { x, z: z + 5 } }; }
function standOn(ch) { const s = newSanta(ch.x, ch.z); s.pos.y = ch.y; s.onGround = true; return s; }

test('onChimney: 煙突の上に立っていれば true。横にずれたり空中・低い所なら false', () => {
  const ch = chim(0, 8, 0);
  eq(onChimney(standOn(ch), ch), true);
  const s = standOn(ch); s.pos.x = 1.0; eq(onChimney(s, ch), false, '横に 1m');
  const s2 = standOn(ch); s2.pos.x = 0.9; eq(onChimney(s2, ch), true, '横に 0.9m（体が縁に乗っている）');
  const a = standOn(ch); a.onGround = false; eq(onChimney(a, ch), false, '空中');
  const low = standOn(ch); low.pos.y = 5; eq(onChimney(low, ch), false, '屋根の上（煙突より低い）');
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

test('tickTime: クリアするまで時間が進み、クリア後は止まる', () => {
  const r = newRun();
  tickTime(r, 1.5); tickTime(r, 0.5);
  near(r.time, 2, 1e-9);
  r.cleared = true;
  tickTime(r, 3);
  near(r.time, 2, 1e-9);
});

test('bestAfter: 初回は記録、速ければ更新、遅ければそのまま', () => {
  eq(bestAfter(null, 90), { best: 90, isNew: true });
  eq(bestAfter(90, 80), { best: 80, isNew: true });
  eq(bestAfter(80, 85), { best: 80, isNew: false });
});

test('fmtTime: 分:秒.1桁（0.1 秒未満は切り捨て）', () => {
  eq(fmtTime(83.42), '1:23.4');
  eq(fmtTime(5), '0:05.0');
  eq(fmtTime(59.96), '0:59.9');
});
```

- [ ] **Step 4: 失敗を確かめる** — `sh build.sh` → verify で配達のテストが FAIL

- [ ] **Step 5: 実装 `src/16-run.js`**

`newRun` を次に置き換える

```js
// targets: 配達先の煙突 {x, y, z, front} を届ける順に並べたもの。front は「その家の前」（届けた後に落としたら戻る場所）
function newRun(targets) {
  return {
    carrying: false, state: 'play', timer: 0, drops: 0,
    targets: targets || [], target: 0,   // target: 次に届ける煙突の番号
    respawn: null,                       // 落としたときに戻る場所（null なら最初のそりの横）
    time: 0, cleared: false,
  };
}
```

`tryPickup` の 1 行目の条件に `run.cleared ||` を足す

```js
  if (run.cleared || run.state !== 'play' || run.carrying || !nearPickup(s, p)) return false;
```

`stepRun` の中の `placeAt(s, respawn);`（2 か所）を両方とも次にする

```js
    placeAt(s, run.respawn || respawn);
```

```js
  placeAt(s, run.respawn || respawn);
```

`checkCrossed` 関数（とその上のコメント）を削除し、ファイル末尾に足す

```js

// 煙突 ch の上に立っているか（縁に体が少しでも乗っていて、足元の高さが煙突の上面）
function onChimney(s, ch) {
  const r = CFG.chimneyHalf + CFG.santaHalf;
  return s.onGround && Math.abs(s.pos.y - ch.y) < 0.05 && Math.abs(s.pos.x - ch.x) < r && Math.abs(s.pos.z - ch.z) < r;
}

// E を押したとき。chimneys は街のすべての煙突。
// 返り値: 'delivered'（届けた）／'cleared'（最後の 1 軒を届けた）／'wrong'（ほかの家の煙突）／null（何も起きない）
function tryDeliver(run, s, chimneys) {
  if (run.state !== 'play' || !run.carrying || run.cleared) return null;
  const ch = chimneys.find(c => onChimney(s, c));
  if (!ch) return null;
  if (ch !== run.targets[run.target]) return 'wrong';
  run.target++;
  run.respawn = ch.front;
  if (run.target >= run.targets.length) {
    run.cleared = true;
    run.carrying = false;
    return 'cleared';
  }
  return 'delivered';   // 背中の袋から次のプレゼントを出すので、持ったまま
}

// タイム。クリアしたら止まる
function tickTime(run, dt) {
  if (!run.cleared) run.time += dt;
}

// 自己ベスト best（無ければ null）と今回のタイム time から、新しいベストと更新したかを返す
function bestAfter(best, time) {
  if (best === null || time < best) return { best: time, isNew: true };
  return { best, isNew: false };
}

// 秒を「分:秒.1桁」に（83.42 → '1:23.4'）。0.1 秒未満は切り捨て（59.96 が '0:60.0' にならないように）
function fmtTime(sec) {
  const tenths = Math.floor(sec * 10);
  const m = Math.floor(tenths / 600), s = (tenths - m * 600) / 10;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
}
```

- [ ] **Step 6:** verify が `PASS 54/54`

- [ ] **Step 7: Commit** — `git add -A && git commit -m "配達の計算（煙突で届ける・次の目的・家の前からやり直し・タイム・自己ベスト）"`

---

### Task 2: 光の柱と、煙突へ入るプレゼント

**Files:** Create `src/42-delivery-fx.js`; Modify `build.sh`

- [ ] **Step 1: `build.sh`** — 本体のほうだけ、`src/40-santa.js \` の次の行に `src/42-delivery-fx.js \` を足す

- [ ] **Step 2: `src/42-delivery-fx.js`**

```js
// ===== 配達の見た目（光の柱・煙突へ入るプレゼント） =====
const FX = { down: null };

function lerp(a, b, k) { return a + (b - a) * k; }

// 光の柱。配達先の煙突から空へ伸びる。サンタの足元が beaconMinY より高いときだけ見える
function makeBeacon() {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 120, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0, depthWrite: false, fog: false,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  m.visible = false;
  W.scene.add(m);
  return { mesh: m, alpha: 0 };
}

// ch: いまの配達先の煙突（クリア後は null）
function updateBeacon(b, ch, s, dt, t) {
  const want = ch && s.pos.y >= CFG.beaconMinY ? 1 : 0;
  b.alpha += (want - b.alpha) * Math.min(1, dt * 5);
  b.mesh.visible = !!ch && b.alpha > 0.01;
  if (!ch) return;
  b.mesh.position.set(ch.x, ch.y + 60, ch.z);
  b.mesh.material.opacity = b.alpha * (0.45 + Math.sin(t * 3) * 0.1);
}

// 届けたプレゼントが、サンタの頭の上から弧を描いて煙突の真上へ移り、煙突の中へ沈む
function sendDown(sm, ch) {
  if (FX.down) W.scene.remove(FX.down.mesh);
  const wp = new THREE.Vector3();
  sm.present.getWorldPosition(wp);
  const m = makePresentMesh();
  m.position.copy(wp);
  W.scene.add(m);
  FX.down = { mesh: m, from: wp, ch, t: 0 };
}

function updateFx(dt) {
  const d = FX.down;
  if (!d) return;
  d.t += dt;
  d.mesh.rotation.y += dt * 8;
  const k = Math.min(1, d.t / 0.35);
  if (k < 1) {
    // 0.35 秒で煙突の真上（1.2m 上）へ。途中で少し上に膨らむ
    d.mesh.position.set(lerp(d.from.x, d.ch.x, k), lerp(d.from.y, d.ch.y + 1.2, k) + Math.sin(k * Math.PI) * 1.2, lerp(d.from.z, d.ch.z, k));
    return;
  }
  // 0.4 秒で煙突の中へ沈む
  const k2 = Math.min(1, (d.t - 0.35) / 0.4);
  d.mesh.position.set(d.ch.x, d.ch.y + 1.2 - k2 * 2.2, d.ch.z);
  d.mesh.scale.setScalar(1 - k2 * 0.5);
  if (k2 >= 1) { W.scene.remove(d.mesh); FX.down = null; }
}
```

- [ ] **Step 3:** `sh build.sh` が通る。verify は 54/54 のまま

- [ ] **Step 4: Commit** — `git add -A && git commit -m "光の柱と、煙突へ入るプレゼントの演出"`

---

### Task 3: タイム・クリア画面・音・つなぎ込み

**Files:** Modify `src/00-head.html`, `src/20-sound.js`, `src/60-hud.js`, `src/90-boot.js`

- [ ] **Step 1: `src/00-head.html`** — `</style>` の直前に足す

```css

  /* ---- タイム（右上）。左上の目的と重ならないよう目的の幅を詰める ---- */
  #obj{max-width:calc(100vw - 140px)}
  #timer{position:fixed;right:16px;top:16px;z-index:5;font-size:18px;font-variant-numeric:tabular-nums;letter-spacing:.05em;
    background:rgba(8,14,36,.62);padding:6px 12px;border-radius:4px;text-shadow:0 1px 6px #000;pointer-events:none;display:none}
  #timer.on{display:block}

  /* ---- クリア画面 ---- */
  #clear{position:fixed;inset:0;z-index:12;display:none;flex-direction:column;align-items:center;justify-content:center;
    gap:14px;padding:16px;text-align:center;background:rgba(8,14,36,.72)}
  #clear.on{display:flex}
  #clear h2{font-size:clamp(28px,6vw,52px);letter-spacing:.08em;color:var(--gold);text-shadow:0 2px 18px rgba(0,0,0,.6)}
  #clear p{font-size:16px;letter-spacing:.12em}
  #clear .time{font-size:22px}
  #clear .time b{font-size:30px;font-variant-numeric:tabular-nums}
  #clearBest{color:var(--gold)}
  #againBtn{margin-top:10px;font:700 18px var(--jp);letter-spacing:.15em;color:#fff;background:var(--red);border:0;
    border-radius:28px;padding:12px 34px;cursor:pointer}
```

タイトルの説明とヒントの「E 受け取る」を「E 受け取る・届ける」に書き換える

```html
  <small>WASD 移動 ・ Space ジャンプ ・ E 受け取る・届ける ・ マウス 視点<br>スマホ：左で移動 ・ 右で視点 ・ 右下のボタン</small>
```

```html
<div id="hint">WASD 移動 ／ Space ジャンプ ／ E 受け取る・届ける ／ マウス 視点 ／ Esc でマウスを離す</div>
```

`<div id="prompt"></div>` の次の行に足す

```html
<div id="timer"></div>
<div id="clear">
  <h2>ぜんぶ届けた！</h2>
  <p>メリークリスマス</p>
  <p class="time">タイム <b id="clearTime"></b></p>
  <p id="clearBest"></p>
  <button id="againBtn">もう一度</button>
</div>
```

- [ ] **Step 2: `src/20-sound.js`** — 末尾に足す

```js

// 届けた「シャラララン」（上がっていく 4 音）
function sndDeliver() {
  const c = SND.ctx;
  if (!c) return;
  const t = c.currentTime;
  [1047, 1319, 1568, 2093].forEach((f, i) => sndTone(f, t + i * 0.08, 0.35, 'sine', 0.16));
}

// 違う家「ブブッ」
function sndWrong() {
  const c = SND.ctx;
  if (!c) return;
  const t = c.currentTime;
  sndTone(180, t, 0.12, 'square', 0.08);
  sndTone(150, t + 0.13, 0.18, 'square', 0.08);
}

// クリアのファンファーレ
function sndClear() {
  const c = SND.ctx;
  if (!c) return;
  const t = c.currentTime;
  [784, 988, 1175, 1568, 1319, 1568].forEach((f, i) => sndTone(f, t + i * 0.14, i === 5 ? 0.9 : 0.3, 'triangle', 0.18));
}
```

- [ ] **Step 3: `src/60-hud.js`** — 末尾に足す

```js

// 右上のタイム
function setTimer(sec) {
  const el = document.getElementById('timer');
  const txt = fmtTime(sec);
  if (el.textContent !== txt) el.textContent = txt;
  el.classList.add('on');
}

// クリア画面
function showClear(time, best, isNew) {
  document.getElementById('clearTime').textContent = fmtTime(time);
  document.getElementById('clearBest').textContent = isNew ? '自己ベスト更新！' : '自己ベスト ' + fmtTime(best);
  document.getElementById('clear').classList.add('on');
}
function hideClear() {
  document.getElementById('clear').classList.remove('on');
}

// 自己ベスト（この端末のブラウザに保存。保存できない環境では null のまま）
const BEST_KEY = 'santa-todokete.best';
function loadBest() {
  try {
    const v = parseFloat(localStorage.getItem(BEST_KEY));
    return isFinite(v) ? v : null;
  } catch (e) { return null; }
}
function saveBest(v) {
  try { localStorage.setItem(BEST_KEY, String(v)); } catch (e) { /* 保存できなくても遊べる */ }
}
```

- [ ] **Step 4: `src/90-boot.js`**

(a) `const run = newRun();` を次に置き換える

```js
  // 配達先：COURSE.targets の家の煙突を、届ける順に並べる
  const chimneys = W.houses.map(h => h.chimney);
  const targets = COURSE.targets.map(tg => W.houses.find(h => h.x === tg.x && h.z === tg.z).chimney);
  let run = newRun(targets);
  let best = loadBest();
  const beacon = makeBeacon();

  function objectiveText() {
    if (!run.carrying && run.target === 0) return 'そりでプレゼントを受け取ろう';
    return '高く跳んで光の柱を探し、煙突から届けよう（' + run.target + '/' + run.targets.length + '）';
  }

  function finish() {
    sndClear();
    const r = bestAfter(best, run.time);
    best = r.best;
    if (r.isNew) saveBest(best);
    setObjective('');
    setPrompt(null);
    setTimeout(() => {
      showClear(run.time, best, r.isNew);
      if (document.exitPointerLock) document.exitPointerLock();
    }, 900);
  }

  document.getElementById('againBtn').addEventListener('click', () => {
    run = newRun(targets);
    placeAt(santa, COURSE.start);
    clearThrown(sm);
    hideClear();
    setObjective(objectiveText());
    if (!INPUT.touch) lockPointer(renderer.domElement);
  });
```

(b) タイトル click の中の `setObjective('そりでプレゼントを受け取ろう');` を

```js
    setObjective(objectiveText());
```

(c) `const playing = run.state === 'play';` を

```js
      const playing = run.state === 'play' && !run.cleared;
```

(d) `// プレゼント：受け取る・落とす・やり直し・向こう岸（…）` のコメントから、`sm.carrying = run.carrying;` の行まで（受け取り・stepRun・checkCrossed・setPrompt を含む範囲）を丸ごと次に置き換える

```js
      // プレゼント：受け取る・届ける・落とす・やり直し
      if (act) {
        if (tryPickup(run, santa, COURSE.sleigh)) {
          sndPickup();
          showToast('プレゼントを受け取った！', 1.6);
          setObjective(objectiveText());
        } else {
          const ch = run.targets[run.target];
          const res = tryDeliver(run, santa, chimneys);
          if (res === 'wrong') {
            sndWrong();
            showToast('この家じゃない！', 1.2);
          } else if (res === 'delivered' || res === 'cleared') {
            sendDown(sm, ch);
            sndDeliver();
            if (res === 'delivered') {
              showToast('配達完了！ ' + run.target + '/' + run.targets.length, 1.8);
              setObjective(objectiveText());
            } else {
              finish();
            }
          }
        }
      }
      const ev = stepRun(run, santa, dt, COURSE.respawn);
      if (ev === 'dropped') {
        throwPresent(sm);
        sndDrop();
        showToast('プレゼントを落とした！', CFG.dropDelay);
      } else if (ev === 'respawn') {
        clearThrown(sm);
        showToast(run.target === 0 ? 'そりからやり直し' : '届けた家の前からやり直し', 1.4);
      }
      tickTime(run, dt);
      setTimer(run.time);
      const goal = run.targets[run.target];
      const canPick = !run.carrying && run.state === 'play' && nearPickup(santa, COURSE.sleigh);
      const canGive = run.carrying && run.state === 'play' && goal && onChimney(santa, goal);
      setPrompt(canPick ? (INPUT.touch ? '「受け取る」ボタンで受け取る' : 'E で受け取る')
              : canGive ? (INPUT.touch ? '「届ける」ボタンで届ける' : 'E で届ける') : null);
      const ab = document.getElementById('actBtn'), abText = run.carrying ? '届ける' : '受け取る';
      if (ab.textContent !== abText) ab.textContent = abText;
      sm.carrying = run.carrying;
```

(e) `updateHud(dt);` の次の行に足す

```js
    updateBeacon(beacon, run.cleared ? null : run.targets[run.target], santa, dt, t);
    updateFx(dt);
```

(f) `window.GAME = { ... }` を次にする（もう一度で run が作り直されても最新を返す）

```js
  window.GAME = { santa, get run() { return run; }, sm, CAM, PHYS, W, renderer, camera };
```

- [ ] **Step 5:** `sh build.sh` → verify `PASS 54/54` のまま。`grep -n checkCrossed src/*.js` で何も出ないこと

- [ ] **Step 6: Commit** — `git add -A && git commit -m "煙突で届ける操作・タイム・クリア画面・音をつなぐ（仮ゴールの向こう岸は削除）"`

---

### Task 4: 画面で確かめる（コントローラ担当）

- [ ] 地上では光の柱が見えず、跳んで 10m を超えると見える（スクリーンショット 2 枚）
- [ ] 1 軒目の煙突で「E で届ける」→ 届ける → 「配達完了！ 1/2」、持ったまま
- [ ] ほかの家の煙突で E → 「この家じゃない！」
- [ ] 届けた後に川へ落ちる → 1 軒目の家の前からやり直し
- [ ] 2 軒目で届ける → クリア画面（タイム・自己ベスト）→ もう一度で最初から
- [ ] スマホ幅で、目的とタイムが重ならない
- [ ] コンソールエラーなし

### Task 5: 制作記録（コントローラ担当）
