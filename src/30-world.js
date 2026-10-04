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

// 街灯。light が true のときだけ点光源を付ける（点光源は描画が重いので、区画に 1 本ずつ）
function lamp(x, z, light) {
  solid(x, 0, z, 0.2, 4.6, 0.2, mat(0x2b2f3a));
  deco(new THREE.SphereGeometry(0.3, 12, 8), mat(0x000000, 0xffd7a0), x, 4.75, z);
  if (!light) return;
  const L = new THREE.PointLight(0xffc98a, 1.4, 18, 2);
  L.position.set(x, 4.5, z);
  W.scene.add(L);
}

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

// 掘割の底に止まっている列車。x 方向に車両（長さ 18m）が並び、連結部（1.5m）は隙間。屋根に乗れる
function train(zc) {
  const TR = COURSE.train, top = -2.5 + TR.h;
  for (let cx = -39; cx <= 39; cx += 19.5) {     // 道路の真ん中（x=0）に車両が来るように並べる（隙間は x=±9〜10.5、±28.5〜30）
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

function buildWorld() {
  const s = W.scene;
  s.background = new THREE.Color(0x0b1430);
  s.fog = new THREE.Fog(0x0b1430, 35, 120);
  s.add(new THREE.HemisphereLight(0x9fb4ff, 0x30384f, 0.8));
  const moon = new THREE.DirectionalLight(0xbfd0ff, 0.45);
  moon.position.set(-30, 60, -20);
  s.add(moon);
  // 反対側から弱い暖色の光（家の明かりの照り返し）。月の当たらない面が真っ暗にならないように
  const fill = new THREE.DirectionalLight(0xffd9b0, 0.3);
  fill.position.set(30, 25, 40);
  s.add(fill);
  const mm = new THREE.Mesh(new THREE.SphereGeometry(6, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff4d6, fog: false }));
  mm.position.set(-80, 70, -140);
  s.add(mm);

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
  // 線路（見た目だけ）と、真ん中に止まっている列車
  const railZ = (RL.z0 + RL.z1) / 2;
  for (const off of [-0.75, 0.75]) deco(new THREE.BoxGeometry(200, 0.15, 0.12), mat(0x9aa0aa), 0, -2.4, railZ + off);
  train(railZ);
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
  tree(-28, 20, 1); tree(36, 32, 1.1); tree(-36, 56, 1);
  lamp(10.5, 20, true); lamp(-10.5, 38);

  // ======== 2 商店街（z = -7〜-55） ========
  road(-R, RL.z0);
  barrier(-R - 0.6);                             // 線路側には柵を置かない（岸の縁から列車へ跳ぶので、柵があると踏み切れる幅が狭くなる）
  shop(15, -14, 10, 8, 6, 0xb5655a, 0xff5a5a);
  shop(15, -26, 10, 8, 7, 0x6f8fb0, 0x5ad1ff);
  shop(15, -38, 10, 8, 6, 0xc29a5b, 0xffd45a);
  shop(-15, -14, 10, 8, 7, 0x7fa37a, 0x8dff7a);
  shop(-15, -40, 10, 8, 6, 0x9b7fb0, 0xff8de8);
  house(-20, -30, 9, 8, 5, 0xd8c3a5);            // ★ 2 軒目（店の並びの家）
  // 線路は、岸から止まっている列車の屋根へ跳び、そこから向こう岸へ跳んで渡る（川とは違う遊び）
  shop(28, -30, 10, 8, 7, 0xa0806a, 0xffa05a);
  shop(26, -41, 12, 8, 5, 0x8a6a5a, 0xffffff);   // 駅舎（見た目は店と同じ作り。看板は白）
  lamp(9.5, -20, true);

  // ======== 3 公園（z = -69〜-115） ========
  xmasTree(0, -90);
  house(-24, -88, 9, 8, 4.5, 0xa9c3a0);          // ★ 3 軒目（公園のそばの家）
  // 11m の展望台。縁（z=-111）は塀（z=-115）の 4m 手前。縁から跳べば塀を越える
  solid(18, 0, -108, 6, 11, 6, mat(0x8c7a64));
  deco(new THREE.BoxGeometry(6.2, 0.15, 6.2), mat(COL.roof), 18, 11.07, -108);
  // 塀（高さ 22m。地面からは越えられない）（見た目の地面の端まで延ばし、横を回れそうに見えないようにする）
  solid(0, 0, WL.z, 200, WL.h, WL.t, mat(0x7a4a3c));
  deco(new THREE.BoxGeometry(200, 0.2, WL.t + 0.2), mat(COL.roof), 0, WL.h + 0.1, WL.z);
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
  lamp(10.5, -125, true);
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
  // 高さ 20m の崖（z = -214〜-250）。高架の端（z=-208）から跳び移る。下に落ちたら 7m → 13m の段で登れる（見た目の地面の端まで延ばし、横を回れそうに見えないようにする）
  solid(0, 0, -232, 200, 20, 36, mat(0x6a6f7e));
  deco(new THREE.BoxGeometry(200, 0.2, 36), mat(COL.snow), 0, 20.1, -232);
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
