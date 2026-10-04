// ===== 起動とメインループ =====
(function boot() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  document.body.prepend(renderer.domElement);

  W.scene = new THREE.Scene();
  buildWorld();
  makeSnow();
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400);
  CAM.cam = camera;

  const START = COURSE.start;
  const santa = newSanta(START.x, START.z);
  const sm = makeSantaMesh();
  const mk = makeMarker();
  const run = newRun();
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
    setObjective('そりでプレゼントを受け取ろう');
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
      const playing = run.state === 'play';
      const mv = playing ? readMove() : { x: 0, z: 0 };
      mv.jump = takeJump() && playing;
      const act = takeAct();
      santaStep(santa, mv, CAM.yaw, dt, PHYS.boxes);
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
      // プレゼント：受け取る・落とす・やり直し・向こう岸（向こう岸は Phase 4 で配達に置き換える）
      if (act && tryPickup(run, santa, COURSE.sleigh)) {
        sndPickup();
        showToast('プレゼントを受け取った！', 1.6);
        setObjective('プレゼントを持って、川の向こう岸へ');
      }
      const ev = stepRun(run, santa, dt, COURSE.respawn);
      if (ev === 'dropped') {
        throwPresent(sm);
        sndDrop();
        showToast('プレゼントを落とした！', CFG.dropDelay);
      } else if (ev === 'respawn') {
        clearThrown(sm);
        showToast('そりからやり直し', 1.4);
      }
      if (checkCrossed(run, santa)) {
        showToast('向こう岸に着いた！', 2.2);
        setObjective('向こう岸に着いた！（配達は次の段階で作ります）');
      }
      const canPick = !run.carrying && run.state === 'play' && nearPickup(santa, COURSE.sleigh);
      setPrompt(canPick ? (INPUT.touch ? '「受け取る」ボタンで受け取る' : 'E で受け取る') : null);
      sm.carrying = run.carrying;
    }
    updateSantaMesh(sm, santa, dt, t);
    updateThrown(sm, dt);
    updateHud(dt);
    updateMarker(mk, santa, t);
    updateCamera(santa, dt);
    updateSnow(santa.pos, dt, t);
    renderer.render(W.scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // 画面確認用（コンソールから位置やカメラを動かせる）
  window.GAME = { santa, run, sm, CAM, PHYS, W, renderer, camera };
})();
