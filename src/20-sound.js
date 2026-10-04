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
