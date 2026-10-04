// ===== 配達の進み具合（three.js に依存しない） =====
// state: 'play'（ふつう）／'dropped'（プレゼントを落とした。dropDelay 秒後に受け取り地点から再開）
// targets: 配達先の煙突 {x, y, z, front} を届ける順に並べたもの。front は「その家の前」（届けた後に落としたら戻る場所）
function newRun(targets) {
  return {
    carrying: false, state: 'play', timer: 0, drops: 0,
    targets: targets || [], target: 0,   // target: 次に届ける煙突の番号
    respawn: null,                       // 落としたときに戻る場所（null なら最初のそりの横）
    time: 0, cleared: false,
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


// 煙突 ch の上に立っているか（縁に体が少しでも乗っていて、足元の高さが煙突の上面）
function onChimney(s, ch) {
  const r = CFG.chimneyHalf + CFG.santaHalf;
  return s.onGround && Math.abs(s.pos.y - ch.y) < 0.05 && Math.abs(s.pos.x - ch.x) < r && Math.abs(s.pos.z - ch.z) < r;
}

// E を押したとき。chimneys は街のすべての煙突。
// 返り値: 'delivered'（届けた）／'cleared'（最後の 1 軒を届けた）／'wrong'（ほかの家の煙突）／null（何も起きない）
function tryDeliver(run, s, chimneys) {
  if (run.state !== 'play' || !run.carrying || run.cleared) return null;
  const ch = chimneys.find(c => onChimney(s, c));
  if (!ch) return null;
  if (ch !== run.targets[run.target]) return 'wrong';
  run.target++;
  run.respawn = ch.front;
  if (run.target >= run.targets.length) {
    run.cleared = true;
    run.carrying = false;
    return 'cleared';
  }
  return 'delivered';   // 背中の袋から次のプレゼントを出すので、持ったまま
}

// タイム。クリアしたら止まる
function tickTime(run, dt) {
  if (!run.cleared) run.time += dt;
}

// 自己ベスト best（無ければ null）と今回のタイム time から、新しいベストと更新したかを返す
function bestAfter(best, time) {
  if (best === null || time < best) return { best: time, isNew: true };
  return { best, isNew: false };
}

// 秒を「分:秒.1桁」に（83.42 → '1:23.4'）。0.1 秒未満は切り捨て（59.96 が '0:60.0' にならないように）
function fmtTime(sec) {
  const tenths = Math.floor(sec * 10);
  const m = Math.floor(tenths / 600), s = (tenths - m * 600) / 10;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
}
