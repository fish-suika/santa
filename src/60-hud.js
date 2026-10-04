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

// 右上のタイム
function setTimer(sec) {
  const el = document.getElementById('timer');
  const txt = fmtTime(sec);
  if (el.textContent !== txt) el.textContent = txt;
  el.classList.add('on');
}

// クリア画面
function showClear(time, best, isNew) {
  document.getElementById('clearTime').textContent = fmtTime(time);
  document.getElementById('clearBest').textContent = isNew ? '自己ベスト更新！' : '自己ベスト ' + fmtTime(best);
  document.getElementById('clear').classList.add('on');
}
function hideClear() {
  document.getElementById('clear').classList.remove('on');
}

// 自己ベスト（この端末のブラウザに保存。保存できない環境では null のまま）
const BEST_KEY = 'santa-todokete.best';
function loadBest() {
  try {
    const v = parseFloat(localStorage.getItem(BEST_KEY));
    return isFinite(v) ? v : null;
  } catch (e) { return null; }
}
function saveBest(v) {
  try { localStorage.setItem(BEST_KEY, String(v)); } catch (e) { /* 保存できなくても遊べる */ }
}
