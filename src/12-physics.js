// ===== 当たり判定（three.js に依存しない。verify から直接試す） =====
// 箱は {minX,maxX,minY,maxY,minZ,maxZ}。街の当たり判定はすべてこの箱で表す。
const PHYS = { boxes: [] };
const EPS = 0.001;

// 中心 (cx, cz)、下端 y0、幅 w・高さ h・奥行 d の箱
function makeBox(cx, y0, cz, w, h, d) {
  return { minX: cx - w / 2, maxX: cx + w / 2, minY: y0, maxY: y0 + h, minZ: cz - d / 2, maxZ: cz + d / 2 };
}
function addBox(cx, y0, cz, w, h, d) {
  const b = makeBox(cx, y0, cz, w, h, d);
  PHYS.boxes.push(b);
  return b;
}
function removeBox(b) {
  const i = PHYS.boxes.indexOf(b);
  if (i >= 0) PHYS.boxes.splice(i, 1);
}

// 面が接しているだけなら重なりに数えない
function overlaps(a, b) {
  return a.minX < b.maxX && a.maxX > b.minX &&
         a.minY < b.maxY && a.maxY > b.minY &&
         a.minZ < b.maxZ && a.maxZ > b.minZ;
}
// 足元の位置 p にいるときの体の箱
function bodyBox(p) {
  const r = CFG.santaHalf;
  return { minX: p.x - r, maxX: p.x + r, minY: p.y, maxY: p.y + CFG.santaHeight, minZ: p.z - r, maxZ: p.z + r };
}
function hitAll(p, boxes) {
  const me = bodyBox(p);
  return boxes.filter(b => overlaps(me, b));
}
function hitAny(p, boxes) {
  const me = bodyBox(p);
  for (const b of boxes) if (overlaps(me, b)) return b;
  return null;
}

// 体 {pos, vel, onGround} を dt 秒動かす。重力・壁・段差・着地・天井を処理する。
// 速いときに薄い箱をすり抜けないよう、1回の移動が 0.2m 以下になるよう刻む。
function moveBody(body, dt, boxes) {
  const v = body.vel;
  v.y = Math.max(v.y - CFG.gravity * dt, -CFG.maxFall);
  const far = Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)) * dt;
  const n = Math.max(1, Math.ceil(far / 0.2));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    moveAxisH(body, 'x', v.x * h, boxes);
    moveAxisH(body, 'z', v.z * h, boxes);
    moveAxisY(body, v.y * h, boxes);
  }
  // 足元のすぐ下に箱があれば接地
  body.onGround = v.y <= 0 && !!hitAny({ x: body.pos.x, y: body.pos.y - 0.02, z: body.pos.z }, boxes);
}

// 横（x か z）に d だけ動かす。低い段差なら上に乗り、それ以外は壁の手前で止める。
function moveAxisH(body, ax, d, boxes) {
  if (d === 0) return;
  const p = body.pos;
  p[ax] += d;
  const hits = hitAll(p, boxes);
  if (!hits.length) return;
  const top = Math.max(...hits.map(b => b.maxY));
  if (body.onGround && top - p.y <= CFG.stepHeight) {
    const up = { x: p.x, y: top + EPS, z: p.z };
    if (!hitAny(up, boxes)) { p.y = up.y; return; }
  }
  const r = CFG.santaHalf, A = ax.toUpperCase();
  p[ax] = d > 0 ? Math.min(...hits.map(b => b['min' + A])) - r - EPS
                : Math.max(...hits.map(b => b['max' + A])) + r + EPS;
  body.vel[ax] = 0;
}

// 縦に d だけ動かす。下向きなら、動く前に足元より下にあった面のうち一番高い面に乗る
// （横から箱にめり込んだときに、その箱のてっぺんへ持ち上げられないように）。上向きなら頭を一番低い面で止める。
function moveAxisY(body, d, boxes) {
  if (d === 0) return;
  const p = body.pos, prev = p.y;
  p.y += d;
  const hits = hitAll(p, boxes);
  if (!hits.length) return;
  if (d < 0) {
    const below = hits.filter(b => b.maxY <= prev + 2 * EPS);
    p.y = below.length ? Math.max(...below.map(b => b.maxY)) : prev;
  } else {
    p.y = Math.min(...hits.map(b => b.minY)) - CFG.santaHeight - EPS;
  }
  body.vel.y = 0;
}

// 原点 o から方向 dir（長さ1）へ飛ばした線が箱に当たる距離。当たらなければ Infinity。
// o が箱の中なら 0。
function rayBox(o, dir, b) {
  let tmin = 0, tmax = Infinity;
  for (const ax of ['x', 'y', 'z']) {
    const A = ax.toUpperCase(), lo = b['min' + A], hi = b['max' + A];
    if (Math.abs(dir[ax]) < 1e-9) {
      if (o[ax] < lo || o[ax] > hi) return Infinity;
      continue;
    }
    let t1 = (lo - o[ax]) / dir[ax], t2 = (hi - o[ax]) / dir[ax];
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return Infinity;
  }
  return tmin;
}

// 点 p の真下（x, z が同じ）で、p.y 以下にある一番高い面の高さ。無ければ -Infinity
function groundBelow(p, boxes) {
  let best = -Infinity;
  for (const b of boxes) {
    if (p.x < b.minX || p.x > b.maxX || p.z < b.minZ || p.z > b.maxZ) continue;
    if (b.maxY <= p.y + 0.01 && b.maxY > best) best = b.maxY;
  }
  return best;
}

// 三角屋根の当たり判定。棟は X 方向（長さ len）、斜面は Z 方向（中心から軒先まで hd）。
// 8 段の階段で近似する。1 段は roofH / 8（屋根 2.4m で 0.3m）で、歩いて上がれる高さ以下。
function roofSteps(cx, wallH, cz, len, roofH, hd) {
  const n = 8, out = [];
  for (let i = 0; i < n; i++) out.push(makeBox(cx, wallH, cz, len, roofH * (i + 0.5) / n, hd * 2 * (1 - i / n)));
  return out;
}
