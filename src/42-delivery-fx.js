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
