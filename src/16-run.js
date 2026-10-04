// ===== 配達の進み具合（three.js に依存しない） =====
// state: 'play'（ふつう）／'dropped'（プレゼントを落とした。dropDelay 秒後に受け取り地点から再開）
function newRun() {
  return { carrying: false, state: 'play', timer: 0, drops: 0, crossed: false };
}

// 受け取り地点 p の近く（横 pickupRange 以内、高さ 2m 未満）にいるか
function nearPickup(s, p) {
  return Math.hypot(s.pos.x - p.x, s.pos.z - p.z) <= CFG.pickupRange && Math.abs(s.pos.y - (p.y || 0)) < 2;
}

// E を押したとき。受け取れたら true
function tryPickup(run, s, p) {
  if (run.state !== 'play' || run.carrying || !nearPickup(s, p)) return false;
  run.carrying = true;
  return true;
}

// サンタを場所 p に置き直す（勢いも消す）
function placeAt(s, p) {
  s.pos = { x: p.x, y: p.y || 0, z: p.z };
  s.vel = { x: 0, y: 0, z: 0 };
  s.onGround = false;
  s.jumpBuf = 0;
  s.coyote = 0;
}

// プレゼントを落とす。川に落ちたときのほか、Phase 5〜6 のギミックからも呼ぶ。落としたら true
function dropPresent(run) {
  if (!run.carrying || run.state !== 'play') return false;
  run.carrying = false;
  run.state = 'dropped';
  run.timer = CFG.dropDelay;
  run.drops++;
  return true;
}

// 毎フレーム呼ぶ。返り値は起きたこと:
// 'dropped'（持ったまま落ちた）／'fell'（持たずに落ちた。すぐ戻した）／'respawn'（落とした後、受け取り地点に戻した）／null
function stepRun(run, s, dt, respawn) {
  if (run.state === 'dropped') {
    run.timer -= dt;
    if (run.timer > 0) return null;
    placeAt(s, respawn);
    run.state = 'play';
    run.carrying = true;   // 受け取り地点から、プレゼントを持った状態でやり直し
    return 'respawn';
  }
  if (s.pos.y >= CFG.fallY) return null;
  if (dropPresent(run)) return 'dropped';
  placeAt(s, respawn);
  return 'fell';
}

// 持ったまま向こう岸に立った瞬間に 1 回だけ true（Phase 4 で配達に置き換える仮のゴール）
function checkCrossed(run, s) {
  if (run.crossed || !run.carrying || !s.onGround || s.pos.z > -COURSE.riverHalf) return false;
  run.crossed = true;
  return true;
}
