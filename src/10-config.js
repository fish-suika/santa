// ===== 数値はすべてここ。遊んでもらいながら調整する =====
const CFG = {
  // サンタの体（位置は足元の中心。単位はメートル）
  santaHalf: 0.4,       // 横幅の半分
  santaHeight: 1.7,

  // 歩き
  walkSpeed: 6,         // 最高速度 m/s
  groundAccel: 40,      // 最高速度へ近づく速さ m/s²（止まるときも同じ）
  stepHeight: 0.35,     // これ以下の段差は歩いて上がれる

  // 落下
  gravity: 30,          // m/s²
  maxFall: 60,          // 落下速度の上限 m/s

  // カメラ（サンタの後ろ）
  camDist: 7,
  camLookHeight: 1.4,   // 足元からどれだけ上を見るか
  camPitch: 0.35,       // 最初の見下ろし角（ラジアン）
  camPitchMin: -0.15,
  camPitchMax: 1.2,
  camMinDist: 1.2,      // 壁に寄ったときの最短距離
  mouseSens: 0.0025,    // マウス 1px あたりの回転（ラジアン）
  touchSens: 0.006,     // タッチ 1px あたりの回転（ラジアン）
};
