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
  for (const b of roofSteps(cx, wallH, cz, len, roofH, hd)) PHYS.boxes.push(b);

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
