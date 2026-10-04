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

  const START = { x: 0, z: 14 };
  const santa = newSanta(START.x, START.z);
  const sm = makeSantaMesh();
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
      santaStep(santa, readMove(), CAM.yaw, dt, PHYS.boxes);
      // 雪を踏む音（地面を 1.1m 進むごと）
      if (santa.onGround) {
        walked += Math.hypot(santa.pos.x - bx, santa.pos.z - bz);
        if (walked > 1.1) { walked = 0; sndStep(); }
      }
      // 万一、街の外へ落ちたらスタートへ戻す
      if (santa.pos.y < -30) {
        santa.pos = { x: START.x, y: 0, z: START.z };
        santa.vel = { x: 0, y: 0, z: 0 };
      }
    }
    updateSantaMesh(sm, santa, dt, t);
    updateCamera(santa, dt);
    updateSnow(santa.pos, dt, t);
    renderer.render(W.scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // 画面確認用（コンソールから位置やカメラを動かせる）
  window.GAME = { santa, CAM, PHYS, W, renderer, camera };
})();
