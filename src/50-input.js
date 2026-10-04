// ===== 入力（キーボード・マウス・タッチ） =====
const INPUT = { keys: {}, lookX: 0, lookY: 0, stick: null, lookTouch: null, touch: false };
const STICK_R = 50;   // スティックを倒しきる距離 px

function initInput(canvas) {
  addEventListener('keydown', e => {
    INPUT.keys[e.code] = true;
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', e => { INPUT.keys[e.code] = false; });
  addEventListener('blur', () => { INPUT.keys = {}; });

  addEventListener('mousemove', e => {
    if (document.pointerLockElement !== canvas) return;
    INPUT.lookX += e.movementX * CFG.mouseSens;
    INPUT.lookY += e.movementY * CFG.mouseSens;
  });
  canvas.addEventListener('click', () => {
    if (!INPUT.touch && canvas.requestPointerLock && document.pointerLockElement !== canvas) canvas.requestPointerLock();
  });

  // タッチ：画面の左半分は移動スティック（触れた場所に出る）、右半分はドラッグで視点
  const stickEl = document.getElementById('stick'), knob = document.getElementById('knob');
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    INPUT.touch = true;
    document.body.classList.add('touch');
    for (const t of e.changedTouches) {
      if (t.clientX < innerWidth / 2 && !INPUT.stick) {
        INPUT.stick = { id: t.identifier, ox: t.clientX, oy: t.clientY, x: 0, z: 0 };
        stickEl.style.left = t.clientX + 'px';
        stickEl.style.top = t.clientY + 'px';
        knob.style.transform = '';
        stickEl.classList.add('on');
      } else if (!INPUT.lookTouch) {
        INPUT.lookTouch = { id: t.identifier, x: t.clientX, y: t.clientY };
      }
    }
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const s = INPUT.stick, l = INPUT.lookTouch;
      if (s && t.identifier === s.id) {
        let dx = t.clientX - s.ox, dy = t.clientY - s.oy;
        const len = Math.hypot(dx, dy);
        if (len > STICK_R) { dx *= STICK_R / len; dy *= STICK_R / len; }
        s.x = dx / STICK_R;
        s.z = -dy / STICK_R;
        knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      } else if (l && t.identifier === l.id) {
        INPUT.lookX += (t.clientX - l.x) * CFG.touchSens;
        INPUT.lookY += (t.clientY - l.y) * CFG.touchSens;
        l.x = t.clientX;
        l.y = t.clientY;
      }
    }
  }, { passive: false });
  const end = e => {
    for (const t of e.changedTouches) {
      if (INPUT.stick && t.identifier === INPUT.stick.id) { INPUT.stick = null; stickEl.classList.remove('on'); }
      if (INPUT.lookTouch && t.identifier === INPUT.lookTouch.id) INPUT.lookTouch = null;
    }
  };
  canvas.addEventListener('touchend', end);
  canvas.addEventListener('touchcancel', end);
}

// 移動入力 {x: 右が+, z: 前が+}
function readMove() {
  if (INPUT.stick) return { x: INPUT.stick.x, z: INPUT.stick.z };
  const k = INPUT.keys;
  const x = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
  const z = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
  return { x, z };
}
// たまった視点の動きを受け取って空にする
function takeLook() {
  const l = { x: INPUT.lookX, y: INPUT.lookY };
  INPUT.lookX = 0;
  INPUT.lookY = 0;
  return l;
}
