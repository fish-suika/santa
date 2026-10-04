// ===== 三人称カメラ =====
const CAM = { yaw: 0, pitch: CFG.camPitch, dist: CFG.camDist, cam: null };

// マウス・タッチの動き（ラジアン）。右へ動かすと右を向き、下へ動かすと見下ろす。
function camLook(dx, dy) {
  CAM.yaw -= dx;
  CAM.pitch = Math.min(CFG.camPitchMax, Math.max(CFG.camPitchMin, CAM.pitch + dy));
}

function updateCamera(s, dt) {
  const target = { x: s.pos.x, y: s.pos.y + CFG.camLookHeight, z: s.pos.z };
  const p = cameraPlace(target, CAM.yaw, CAM.pitch, PHYS.boxes);
  // 壁に寄るときはすぐ、離れるときはゆっくり戻す（カメラがガクガクしないように）
  CAM.dist = p.dist < CAM.dist ? p.dist : CAM.dist + (p.dist - CAM.dist) * Math.min(1, dt * 5);
  const d = p.dir;
  CAM.cam.position.set(target.x + d.x * CAM.dist, target.y + d.y * CAM.dist, target.z + d.z * CAM.dist);
  CAM.cam.lookAt(target.x, target.y, target.z);
}
