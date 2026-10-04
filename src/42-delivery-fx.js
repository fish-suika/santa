// ===== 配達の見た目（光の柱・煙突へ入るプレゼント） =====
const FX = { down: null, bursts: [], pending: [], clock: 0 };

function lerp(a, b, k) { return a + (b - a) * k; }

// 光の柱。配達先の煙突から空へ伸びる。サンタの足元が beaconMinY より高いときだけ見える
function makeBeacon() {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 120, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0, depthWrite: false, fog: false,
      side: THREE.DoubleSide }));   // 加算合成だと雪の白の上で白くなって見えないので、ふつうの合成で濃い金色
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
  b.mesh.material.opacity = b.alpha * (0.75 + Math.sin(t * 3) * 0.12);
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
  updateBursts(dt);
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

// クリアの花火。center のまわり（横 ±8m・高さ +0〜5m）に、0.45 秒おきに 5 発
function celebrate(center) {
  FX.clock = 0;
  FX.pending = [];
  for (let k = 0; k < 5; k++) {
    FX.pending.push({ at: k * 0.45, x: center.x + (Math.random() - 0.5) * 16, y: center.y + Math.random() * 5, z: center.z + (Math.random() - 0.5) * 16 });
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
