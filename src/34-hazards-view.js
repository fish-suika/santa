// ===== 電線と走る車の見た目 =====
const HZ = { wires: [], cars: [], train: null, runaway: null };

// 電線の束（3 本、横 0.6m おき）と、両端の電柱（電柱は電線の真下に立ち、当たり判定あり。腕木と電線は見た目だけ）
function buildWires() {
  for (const w of COURSE.wires) {
    const len = Math.abs(w.a1 - w.a0), mid = (w.a0 + w.a1) / 2;
    const g = new THREE.Group();
    for (const off of [-0.6, 0, 0.6]) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, len, 6), mat(0x15171c));
      if (w.ax === 'x') { m.rotation.z = Math.PI / 2; m.position.set(mid, w.y, w.c + off); }
      else { m.rotation.x = Math.PI / 2; m.position.set(w.c + off, w.y, mid); }
      g.add(m);
    }
    W.scene.add(g);
    const nSeg = Math.max(1, Math.ceil(len / 20));   // 電柱は両端と、間に 20m 以下おき
    for (let i = 0; i <= nSeg; i++) {
      const a = w.a0 + (w.a1 - w.a0) * i / nSeg;
      const px = w.ax === 'x' ? a : w.c, pz = w.ax === 'x' ? w.c : a;
      solid(px, 0, pz, 0.3, w.y + 0.4, 0.3, mat(0x5a4a3a));   // 電柱（歩道の上、電線の真下）
      deco(new THREE.BoxGeometry(w.ax === 'x' ? 0.15 : 1.6, 0.15, w.ax === 'x' ? 1.6 : 0.15), mat(0x5a4a3a), px, w.y, pz);   // 腕木
    }
    w.shake = 0;
    HZ.wires.push({ w, g });
  }
}

// 走る車の見た目（Z 方向に長い。正面は -Z。ヘッドライトとテールランプ付き）
function carMesh(color) {
  const g = new THREE.Group();
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  add(new THREE.BoxGeometry(1.9, 0.9, 4.2), mat(color), 0, 0.8, 0);
  add(new THREE.BoxGeometry(1.7, 0.75, 2.3), mat(0x2a3140), 0, 1.625, 0);
  add(new THREE.BoxGeometry(1.6, 0.08, 2.2), mat(COL.snow), 0, 2.04, 0);
  for (const sx of [-0.6, 0.6]) {
    add(new THREE.BoxGeometry(0.4, 0.2, 0.05), mat(0x000000, 0xfff2c0), sx, 0.95, -2.12);   // ヘッドライト
    add(new THREE.BoxGeometry(0.4, 0.2, 0.05), mat(0x000000, 0xff3030), sx, 0.95, 2.12);    // テールランプ
  }
  const wg = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  for (const sx of [-0.85, 0.85]) for (const sz of [-1.35, 1.35]) {
    const wh = add(wg, mat(0x15171c), sx, 0.36, sz);
    wh.rotation.z = Math.PI / 2;
  }
  W.scene.add(g);
  return g;
}

function buildCars() {
  for (const cd of COURSE.cars) {
    const c = newCar(cd.x, cd.z0, cd.z1, cd.speed, cd.at);
    for (const b of c.boxes) PHYS.boxes.push(b);
    c.mesh = carMesh(cd.color);
    HZ.cars.push(c);
  }
}

// 掘割の底に止まっている列車（8 両、19.5m おき。車両ごとに Group にして動かす。屋根に乗れる）
function buildTrain() {
  const RL = COURSE.rail, TR = COURSE.train, zc = (RL.z0 + RL.z1) / 2, top = -2.5 + TR.h;
  const xs = [];
  for (let k = -4; k <= 3; k++) xs.push(k * 19.5);   // 止まっている間は x=0（道路の真ん中）に車両がある
  const tr = newTrain(xs, zc, 18, TR.w, -2.5, TR.h, 8 * 19.5);
  for (const c of tr.cars) {
    PHYS.boxes.push(c.box);
    const g = new THREE.Group();
    const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
    add(new THREE.BoxGeometry(18, TR.h, TR.w), mat(0x2f6f4f), 0, -2.5 + TR.h / 2, zc);
    add(new THREE.BoxGeometry(18, 0.12, TR.w - 0.2), mat(COL.snow), 0, top + 0.06, zc);           // 屋根の雪
    for (const sd of [1, -1]) {
      add(new THREE.BoxGeometry(18.02, 0.35, 0.05), mat(0xd8322c), 0, top - 2.6, zc + sd * (TR.w / 2 + 0.01));   // 赤い帯
      for (let wx = -7.5; wx <= 7.5; wx += 2.5) {                                                    // 明かりのついた窓
        const win = add(new THREE.PlaneGeometry(1.6, 1.0), mat(0x000000, COL.glass), wx, top - 1.4, zc + sd * (TR.w / 2 + 0.02));
        if (sd < 0) win.rotation.y = Math.PI;
      }
    }
    g.position.x = c.x;
    W.scene.add(g);
    c.group = g;
  }
  HZ.train = tr;

  // 街の両端（x = ±41〜）の線路はトンネル。列車は片方のトンネルに入り、反対側から出てくる（見た目だけ。街の外なので触れない）
  const BX = COURSE.bounds.x + 1, d = Math.abs(RL.z1 - RL.z0);
  for (const sd of [1, -1]) {
    deco(new THREE.BoxGeometry(60, 16, d), mat(0x55586a), sd * (BX + 30), -2.5 + 8, zc);                // トンネルの山（線路を覆う）
    deco(new THREE.BoxGeometry(60, 0.3, d), mat(COL.snow), sd * (BX + 30), 13.65, zc);                   // 山の上の雪
    const hole = deco(new THREE.PlaneGeometry(TR.w + 0.8, TR.h + 0.4), mat(0x05060a), sd * (BX - 0.02), -2.5 + (TR.h + 0.4) / 2, zc);
    hole.rotation.y = sd > 0 ? -Math.PI / 2 : Math.PI / 2;                                              // 入口の暗がり（街の側を向く）
  }
}

// 逃げる家（3 軒目）。house() を呼んで、そのとき増えたメッシュと当たり判定の箱を捕まえ、いっしょに動かす
function buildRunaway() {
  const RA = COURSE.runaway;
  const nBox = PHYS.boxes.length, nObj = W.scene.children.length;
  house(RA.x, RA.z, 9, 8, 4.5, 0xa9c3a0);
  const boxes = PHYS.boxes.slice(nBox), meshes = W.scene.children.slice(nObj);
  for (const m of meshes) m.userData.base = m.position.clone();
  const ra = newRunaway(RA.x, RA.z, boxes, W.houses[W.houses.length - 1].chimney, RA.bounds);
  ra.meshes = meshes;
  ra.target = RA.target;
  ra.lift = 0;
  ra.noticed = false;
  // 脚（逃げている間だけ見える）
  ra.legs = [];
  for (const lx of [-2.5, 2.5]) for (const lz of [-2, 2]) {
    const leg = deco(new THREE.CylinderGeometry(0.25, 0.2, 1.2, 8), mat(0x8a5a3a), RA.x + lx, 0.6, RA.z + lz);
    leg.visible = false;
    leg.userData.base = leg.position.clone();
    ra.legs.push(leg);
  }
  HZ.runaway = ra;
}

function updateHazardViews(dt, t) {
  for (const hw of HZ.wires) {
    hw.w.shake = Math.max(0, hw.w.shake - dt * 2);
    hw.g.position.y = Math.sin(t * 40) * 0.25 * hw.w.shake;   // 引っかかった電線がビヨンと揺れる
  }
  for (const c of HZ.cars) {
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.dir > 0 ? Math.PI : 0;   // 進む向きに正面（-Z）を向ける
  }
  if (HZ.train) for (const c of HZ.train.cars) c.group.position.x = c.x;
  const ra = HZ.runaway;
  if (ra) {
    // 逃げている間は家が持ち上がって脚が生え、トコトコ跳ねる（見た目だけ。当たり判定は地面のまま）
    const running = ra.fleeing && !ra.caught;
    ra.lift += ((running ? 1.2 : 0) - ra.lift) * Math.min(1, dt * 8);
    const bob = running ? Math.abs(Math.sin(t * 12)) * 0.35 : 0;
    const ox = ra.x - ra.x0, oz = ra.z - ra.z0, up = ra.lift + bob;
    for (const m of ra.meshes) m.position.set(m.userData.base.x + ox, m.userData.base.y + up, m.userData.base.z + oz);
    ra.legs.forEach((L, i) => {
      L.visible = ra.lift > 0.1;
      L.position.set(L.userData.base.x + ox, up / 2, L.userData.base.z + oz);
      L.scale.y = Math.max(0.01, up / 1.2);
      L.rotation.x = running ? Math.sin(t * 12 + i * Math.PI) * 0.5 : 0;
    });
  }
}
