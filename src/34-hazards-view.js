// ===== 電線と走る車の見た目 =====
const HZ = { wires: [], cars: [] };

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
    for (const a of [w.a0, w.a1]) {
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

function updateHazardViews(dt, t) {
  for (const hw of HZ.wires) {
    hw.w.shake = Math.max(0, hw.w.shake - dt * 2);
    hw.g.position.y = Math.sin(t * 40) * 0.25 * hw.w.shake;   // 引っかかった電線がビヨンと揺れる
  }
  for (const c of HZ.cars) {
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.dir > 0 ? Math.PI : 0;   // 進む向きに正面（-Z）を向ける
  }
}
