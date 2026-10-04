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
