// ===== 起動とメインループ =====
(function boot() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  document.body.prepend(renderer.domElement);

  W.scene = new THREE.Scene();
  buildWorld();
  buildWires();
  buildCars();
  buildTrain();
  buildRunaway();
  makeSnow();
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400);
  CAM.cam = camera;

  const START = COURSE.start;
  const santa = newSanta(START.x, START.z);
  const sm = makeSantaMesh();
  const mk = makeMarker();
  // 配達先：COURSE.targets の家の煙突を、届ける順に並べる
  const chimneys = W.houses.map(h => h.chimney);
  const targets = COURSE.targets.map(tg => W.houses.find(h => h.x === tg.x && h.z === tg.z).chimney);
  let run = newRun(targets);
  let best = loadBest();
  const beacon = makeBeacon();

  function objectiveText() {
    if (!run.carrying && run.target === 0) return 'そりでプレゼントを受け取ろう';
    return '高く跳んで光の柱を探し、煙突から届けよう（' + run.target + '/' + run.targets.length + '）';
  }

  function finish() {
    sndClear();
    const r = bestAfter(best, run.time);
    best = r.best;
    if (r.isNew) saveBest(best);
    setObjective('');
    setPrompt(null);
    setTimeout(() => {
      showClear(run.time, best, r.isNew);
      if (document.exitPointerLock) document.exitPointerLock();
    }, 900);
  }

  document.getElementById('againBtn').addEventListener('click', () => {
    run = newRun(targets);
    placeAt(santa, COURSE.start);
    clearThrown(sm);
    resetRunaway(HZ.runaway);
    HZ.runaway.noticed = false;
    hideClear();
    setObjective(objectiveText());
    if (!INPUT.touch) lockPointer(renderer.domElement);
  });
  initInput(renderer.domElement);

  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  });

  // タイトル：クリック・タップで始める
  let started = false;
  const title = document.getElementById('title');
  title.addEventListener('touchstart', () => { INPUT.touch = true; document.body.classList.add('touch'); }, { passive: true });
  title.addEventListener('click', () => {
    started = true;
    title.classList.add('off');
    sndInit();
    setObjective(objectiveText());
    const cv = renderer.domElement;
    if (!INPUT.touch) lockPointer(cv);
  });

  let last = performance.now(), t = 0, walked = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    if (started) {
      const l = takeLook();
      camLook(l.x, l.y);
      const bx = santa.pos.x, bz = santa.pos.z;
      const playing = run.state === 'play' && !run.cleared;
      const mv = playing ? readMove() : { x: 0, z: 0 };
      mv.jump = takeJump() && playing;
      const act = takeAct();
      for (const c of HZ.cars) {
        if (updateCar(c, santa, dt) !== 'hit') continue;
        sndHonk();
        if (dropPresent(run)) {
          throwPresent(sm);
          sndDrop();
          showToast('車にはねられて、プレゼントを落とした！', CFG.dropDelay);
        } else {
          showToast('車にはねられた！', 1.2);
        }
      }
      // 理不尽ギミック：動き出す列車・逃げる家
      if (updateTrain(HZ.train, santa, dt) === 'start') {
        sndWhistle();
        showToast('列車が動き出した！？', 1.6);
      }
      const ra = HZ.runaway, raRes = stepRunaway(ra, santa, dt, run.state === 'play' && run.target === ra.target);
      if (raRes === 'flee' && !ra.noticed) {
        ra.noticed = true;
        sndScurry();
        showToast('家が逃げた！？', 1.6);
      } else if (raRes === 'caught') {
        showToast('つかまえた！', 1.2);
      }
      santaStep(santa, mv, CAM.yaw, dt, PHYS.boxes);
      if (checkWires(santa, COURSE.wires, dt)) {
        sndBoing();
        if (dropPresent(run)) {
          throwPresent(sm);
          sndDrop();
          showToast('電線に引っかかって、プレゼントを落とした！', CFG.dropDelay);
        } else {
          showToast('電線に引っかかった！', 1.0);
        }
      }
      if (santa.jumped) { santa.jumped = false; sndJump(); }
      if (santa.landSpeed > 0) {
        // 歩道の段差を降りたくらいの小さな着地は無視する
        if (santa.landSpeed > 4) {
          sndLand(Math.min(1, santa.landSpeed / 30));
          sm.squash = Math.min(0.35, santa.landSpeed / 60);
        }
        santa.landSpeed = 0;
      }
      // 雪を踏む音（地面を 1.1m 進むごと）
      if (santa.onGround) {
        walked += Math.hypot(santa.pos.x - bx, santa.pos.z - bz);
        if (walked > 1.1) { walked = 0; sndStep(); }
      }
      // プレゼント：受け取る・届ける・落とす・やり直し
      if (act) {
        if (tryPickup(run, santa, COURSE.sleigh)) {
          sndPickup();
          showToast('プレゼントを受け取った！', 1.6);
          setObjective(objectiveText());
        } else {
          const ch = run.targets[run.target];
          const res = tryDeliver(run, santa, chimneys);
          if (res === 'wrong') {
            sndWrong();
            showToast('この家じゃない！', 1.2);
          } else if (res === 'delivered' || res === 'cleared') {
            sendDown(sm, ch);
            sndDeliver();
            if (res === 'delivered') {
              showToast('配達完了！ ' + run.target + '/' + run.targets.length, 1.8);
              setObjective(objectiveText());
            } else {
              finish();
            }
          }
        }
      }
      const ev = stepRun(run, santa, dt, COURSE.respawn);
      if (ev === 'dropped') {
        throwPresent(sm);
        sndDrop();
        showToast('プレゼントを落とした！', CFG.dropDelay);
      } else if (ev === 'respawn') {
        clearThrown(sm);
        showToast(run.target === 0 ? 'そりからやり直し' : '届けた家の前からやり直し', 1.4);
      }
      tickTime(run, dt);
      setTimer(run.time);
      const goal = run.targets[run.target];
      const canPick = !run.carrying && run.state === 'play' && nearPickup(santa, COURSE.sleigh);
      const canGive = run.carrying && run.state === 'play' && goal && nearChimney(santa, goal);
      setPrompt(canPick ? (INPUT.touch ? '「受け取る」ボタンで受け取る' : 'E で受け取る')
              : canGive ? (INPUT.touch ? '「届ける」ボタンで届ける' : 'E で届ける') : null);
      const ab = document.getElementById('actBtn'), abText = run.carrying ? '届ける' : '受け取る';
      if (ab.textContent !== abText) ab.textContent = abText;
      sm.carrying = run.carrying;
    }
    updateSantaMesh(sm, santa, dt, t);
    updateThrown(sm, dt);
    updateHud(dt);
    updateBeacon(beacon, run.cleared ? null : run.targets[run.target], santa, dt, t);
    updateFx(dt);
    updateHazardViews(dt, t);
    updateMarker(mk, santa, t);
    updateCamera(santa, dt);
    updateSnow(santa.pos, dt, t);
    renderer.render(W.scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // 画面確認用（コンソールから位置やカメラを動かせる）
  window.GAME = { santa, get run() { return run; }, sm, CAM, PHYS, W, renderer, camera };
})();
