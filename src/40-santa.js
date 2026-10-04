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
  // 頭の上に両手で掲げるプレゼント（持っているときだけ見える）。胸の前だと後ろからのカメラで体と袋に隠れるので上に掲げる
  const present = makePresentMesh();
  present.position.set(0, 2.1, -0.35);
  present.visible = false;
  g.add(present);
  W.scene.add(g);
  return { group: g, legL, legR, armL, armR, rot: 0, squash: 0, present, carrying: false, thrown: null };
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
  if (s.onGround) {
    const sp = Math.min(1, Math.hypot(s.vel.x, s.vel.z) / CFG.walkSpeed);
    const sw = Math.sin(t * 11) * 0.7 * sp;
    sm.legL.rotation.x = sw;  sm.legR.rotation.x = -sw;
    sm.armL.rotation.x = -sw * 0.8; sm.armR.rotation.x = sw * 0.8;
  } else {
    // 空中：両腕を前上へ上げ、脚を少し前後に開く
    sm.armL.rotation.x = sm.armR.rotation.x = 2.6;
    sm.legL.rotation.x = 0.4; sm.legR.rotation.x = -0.4;
  }
  // プレゼントを持っているときは、両腕を上げて頭の上に掲げる
  if (sm.carrying) sm.armL.rotation.x = sm.armR.rotation.x = 2.9;
  sm.present.visible = sm.carrying;
  // 着地でつぶれて、すぐ戻る
  sm.squash = Math.max(0, sm.squash - dt * 2.5);
  sm.group.scale.set(1 + sm.squash * 0.5, 1 - sm.squash, 1 + sm.squash * 0.5);
}

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

// 真下の影（いつも）と、着地点の目印の輪（空中だけ。建物越しでも見える）
function makeMarker() {
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false, fog: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.renderOrder = 10;
  W.scene.add(shadow);
  W.scene.add(ring);
  return { shadow, ring };
}

function updateMarker(mk, s, t) {
  const gy = s.onGround ? s.pos.y : groundBelow(s.pos, PHYS.boxes);
  const ok = isFinite(gy);
  mk.shadow.visible = ok;
  mk.ring.visible = ok && !s.onGround;
  if (!ok) return;
  mk.shadow.position.set(s.pos.x, gy + 0.04, s.pos.z);
  mk.ring.position.set(s.pos.x, gy + 0.06, s.pos.z);
  const pulse = 1 + Math.sin(t * 10) * 0.08;
  mk.ring.scale.set(pulse, pulse, 1);
}
