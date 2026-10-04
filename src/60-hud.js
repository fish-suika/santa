// ===== 画面の文字（目的・お知らせ・操作の案内） =====
const HUD = { toastTimer: 0 };

// 左上の「いまやること」。空文字なら隠す
function setObjective(text) {
  document.getElementById('objText').textContent = text;
  document.getElementById('obj').classList.toggle('on', !!text);
}

// 画面中央の大きなお知らせ。sec 秒で消える
function showToast(text, sec) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.add('on');
  HUD.toastTimer = sec || 2;
}

// 下の操作の案内（「E で受け取る」など）。null なら隠す
function setPrompt(text) {
  const el = document.getElementById('prompt');
  if (el.textContent !== (text || '')) el.textContent = text || '';
  el.classList.toggle('on', !!text);
}

function updateHud(dt) {
  if (HUD.toastTimer <= 0) return;
  HUD.toastTimer -= dt;
  if (HUD.toastTimer <= 0) document.getElementById('toast').classList.remove('on');
}

// クリア画面
function showClear() {
  document.getElementById('clear').classList.add('on');
}
function hideClear() {
  document.getElementById('clear').classList.remove('on');
}
