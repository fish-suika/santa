// ===== 配達の進み具合（three.js に依存しない） =====
// state: 'play'（ふつう）／'dropped'（プレゼントを落とした。dropDelay 秒後に受け取り地点から再開）
// targets: 配達先の煙突 {x, y, z, front} を届ける順に並べたもの。front は「その家の前」（届けた後に落としたら戻る場所）
function newRun(targets) {
  return {
    carrying: false, state: 'play', timer: 0, drops: 0,
    targets: targets || [], target: 0,   // target: 次に届ける煙突の番号
    respawn: null,                       // 落としたときに戻る場所（null なら最初のそりの横）
    cleared: false,
  };
}

// 受け取り地点 p の近く（横 pickupRange 以内、高さ 2m 未満）にいるか
function nearPickup(s, p) {
  return Math.hypot(s.pos.x - p.x, s.pos.z - p.z) <= CFG.pickupRange && Math.abs(s.pos.y - (p.y || 0)) < 2;
}

// E を押したとき。受け取れたら true
function tryPickup(run, s, p) {
  if (run.cleared || run.state !== 'play' || run.carrying || !nearPickup(s, p)) return false;
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
    placeAt(s, run.respawn || respawn);
    run.state = 'play';
    run.carrying = true;   // 受け取り地点から、プレゼントを持った状態でやり直し
    return 'respawn';
  }
  if (s.pos.y >= CFG.fallY) return null;
  if (dropPresent(run)) return 'dropped';
  placeAt(s, run.respawn || respawn);
  return 'fell';
}


// 煙突 ch の近くにいて届けられるか。横 deliverRange 以内で、足元が軒（ch.base）より上。
// 屋根の上に立っていても、煙突の上を飛んでいる途中でもよい（煙突の上に乗るのは難しすぎたため）
function nearChimney(s, ch) {
  return Math.hypot(s.pos.x - ch.x, s.pos.z - ch.z) <= CFG.deliverRange && s.pos.y >= ch.base;
}

// E を押したとき。chimneys は街のすべての煙突。
// 返り値: 'delivered'（届けた）／'cleared'（最後の 1 軒を届けた）／'wrong'（ほかの家の煙突）／null（何も起きない）
function tryDeliver(run, s, chimneys) {
  if (run.state !== 'play' || !run.carrying || run.cleared) return null;
  // 配達先の煙突が近ければそちらを優先（隣の家の煙突も近いときに wrong にしない）
  const goal = run.targets[run.target];
  const ch = goal && nearChimney(s, goal) ? goal : chimneys.find(c => nearChimney(s, c));
  if (!ch) return null;
  if (ch !== goal) return 'wrong';
  run.target++;
  run.respawn = ch.front;
  if (run.target >= run.targets.length) {
    run.cleared = true;
    run.carrying = false;
    return 'cleared';
  }
  return 'delivered';   // 背中の袋から次のプレゼントを出すので、持ったまま
}
