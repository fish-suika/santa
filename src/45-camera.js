// ===== 三人称カメラ =====
const CAM = { yaw: 0, pitch: CFG.camPitch, dist: CFG.camDist, cam: null, ty: null, tp: 0 };

// マウス・タッチの動き（ラジアン）。右へ動かすと右を向き、下へ動かすと見下ろす。
function camLook(dx, dy) {
  CAM.yaw -= dx;
  CAM.pitch = Math.min(CFG.camPitchMax, Math.max(CFG.camPitchMin, CAM.pitch + dy));
}

function updateCamera(s, dt) {
  // 空中では注視点を下げ、カメラを後ろへ引いて、サンタと真下の着地点が両方画面に入るようにする
  const gy = groundBelow(s.pos, PHYS.boxes);
  const h = s.onGround || !isFinite(gy) ? 0 : Math.min(CFG.camAirMaxH, Math.max(0, s.pos.y - gy));
  const wantY = s.pos.y + CFG.camLookHeight - h * CFG.camAirDrop;
  const wantP = Math.min(1, h / CFG.jumpHeight) * CFG.camAirPitch;
  const f = Math.min(1, dt * 6);
  CAM.ty = CAM.ty === null ? wantY : CAM.ty + (wantY - CAM.ty) * f;
  CAM.tp += (wantP - CAM.tp) * f;
  const pitch = Math.min(1.45, CAM.pitch + CAM.tp);

  const target = { x: s.pos.x, y: CAM.ty, z: s.pos.z };
  const p = cameraPlace(target, CAM.yaw, pitch, PHYS.boxes, CFG.camDist + h * CFG.camAirBack);
  // 壁に寄るときはすぐ、離れるときはゆっくり戻す（カメラがガクガクしないように）
  CAM.dist = p.dist < CAM.dist ? p.dist : CAM.dist + (p.dist - CAM.dist) * Math.min(1, dt * 5);
  const d = p.dir;
  CAM.cam.position.set(target.x + d.x * CAM.dist, target.y + d.y * CAM.dist, target.z + d.z * CAM.dist);
  CAM.cam.lookAt(target.x, target.y, target.z);
}
