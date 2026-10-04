// ===== 音（Web Audio で自作。ファイルは使わない） =====
const SND = { ctx: null, out: null, noise: null };

// 最初のクリック・タップで呼ぶ（ブラウザは操作前に音を出させない）
function sndInit() {
  if (SND.ctx) return;
  try { SND.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  const c = SND.ctx;
  SND.out = c.createGain();
  SND.out.gain.value = 0.7;
  SND.out.connect(c.destination);
  const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  SND.noise = buf;

  // 風：ノイズを低くこもらせ、ゆっくり強弱をつけて流し続ける
  const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
  const g = c.createGain(); g.gain.value = 0.06;
  const lfo = c.createOscillator(); lfo.frequency.value = 0.08;
  const lg = c.createGain(); lg.gain.value = 0.04;
  lfo.connect(lg); lg.connect(g.gain);
  src.connect(lp); lp.connect(g); g.connect(SND.out);
  src.start(); lfo.start();
}

// 雪を踏む「ザクッ」
function sndStep() {
  const c = SND.ctx;
  if (!c) return;
  const t = c.currentTime;
  const src = c.createBufferSource(); src.buffer = SND.noise;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100 + Math.random() * 700; bp.Q.value = 1.1;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  src.connect(bp); bp.connect(g); g.connect(SND.out);
  src.start(t, Math.random() * 1.5, 0.14);
}

// ジャンプ「ボヨーン」（音程が上がる）
function sndJump() {
  const c = SND.ctx;
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(700, t + 0.22);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(g); g.connect(SND.out);
  o.start(t); o.stop(t + 0.32);
}

// 着地「ドスッ」。power は 0〜1（高いところから落ちたほど大きい）
function sndLand(power) {
  const c = SND.ctx;
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5 * power + 0.05, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  o.connect(g); g.connect(SND.out);
  o.start(t); o.stop(t + 0.25);
  const src = c.createBufferSource(); src.buffer = SND.noise;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
  const g2 = c.createGain();
  g2.gain.setValueAtTime(0.0001, t);
  g2.gain.exponentialRampToValueAtTime(0.4 * power + 0.05, t + 0.01);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  src.connect(lp); lp.connect(g2); g2.connect(SND.out);
  src.start(t, Math.random() * 1.5, 0.18);
}

// 単音。freqEnd を渡すとその音程まで滑る
function sndTone(freq, t0, dur, type, vol, freqEnd) {
  const c = SND.ctx;
  const o = c.createOscillator(); o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, t0);
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(SND.out);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

// 受け取り「ピロリン」
function sndPickup() {
  const c = SND.ctx;
  if (!c) return;
  const t = c.currentTime;
  sndTone(988, t, 0.15, 'sine', 0.2);
  sndTone(1319, t + 0.1, 0.25, 'sine', 0.2);
}

// 落とした「ヒュ〜〜」（音程が下がる）
function sndDrop() {
  const c = SND.ctx;
  if (!c) return;
  sndTone(700, c.currentTime, 0.7, 'triangle', 0.22, 110);
}

// 届けた「シャラララン」（上がっていく 4 音）
function sndDeliver() {
  const c = SND.ctx;
  if (!c) return;
  const t = c.currentTime;
  [1047, 1319, 1568, 2093].forEach((f, i) => sndTone(f, t + i * 0.08, 0.35, 'sine', 0.16));
}

// 違う家「ブブッ」
function sndWrong() {
  const c = SND.ctx;
  if (!c) return;
  const t = c.currentTime;
  sndTone(180, t, 0.12, 'square', 0.08);
  sndTone(150, t + 0.13, 0.18, 'square', 0.08);
}

// クリアのファンファーレ
function sndClear() {
  const c = SND.ctx;
  if (!c) return;
  const t = c.currentTime;
  [784, 988, 1175, 1568, 1319, 1568].forEach((f, i) => sndTone(f, t + i * 0.14, i === 5 ? 0.9 : 0.3, 'triangle', 0.18));
}

// 電線「ビヨーン」（音程が揺れながら下がる）
function sndBoing() {
  const c = SND.ctx;
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(260, t);
  o.frequency.exponentialRampToValueAtTime(120, t + 0.5);
  const lfo = c.createOscillator(); lfo.frequency.value = 18;
  const lg = c.createGain(); lg.gain.value = 60;
  lfo.connect(lg); lg.connect(o.frequency);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
  o.connect(g); g.connect(SND.out);
  o.start(t); lfo.start(t);
  o.stop(t + 0.6); lfo.stop(t + 0.6);
}

// クラクション「プップー」
function sndHonk() {
  const c = SND.ctx;
  if (!c) return;
  const t = c.currentTime;
  for (const f of [440, 554]) {
    sndTone(f, t, 0.12, 'square', 0.08);
    sndTone(f, t + 0.16, 0.3, 'square', 0.08);
  }
}

// 汽笛「ポーッ」（3 つの音を重ねる）
function sndWhistle() {
  const c = SND.ctx;
  if (!c) return;
  const t = c.currentTime;
  for (const f of [587, 740, 880]) sndTone(f, t, 0.9, 'triangle', 0.07);
}

// 家が逃げる足音「トコトコトコ」
function sndScurry() {
  const c = SND.ctx;
  if (!c) return;
  const t = c.currentTime;
  for (let i = 0; i < 8; i++) sndTone(i % 2 ? 660 : 520, t + i * 0.07, 0.06, 'square', 0.06);
}

// 花火「ドーン」（低い音とノイズ）
function sndBoom() {
  const c = SND.ctx;
  if (!c) return;
  const t = c.currentTime;
  sndTone(90, t, 0.5, 'sine', 0.35, 40);
  const src = c.createBufferSource(); src.buffer = SND.noise;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  src.connect(lp); lp.connect(g); g.connect(SND.out);
  src.start(t, Math.random() * 1.2, 0.65);
}
