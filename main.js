import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---------------------------------------------------------------------------
// 基础场景
// ---------------------------------------------------------------------------
const app = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0d1b2a');
scene.fog = new THREE.Fog('#0d1b2a', 22, 48);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
const HOME_CAM = new THREE.Vector3(9, 6.5, 13);
camera.position.copy(HOME_CAM);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(2, 1.2, 0);
controls.maxDistance = 40;
controls.minDistance = 4;

// ---------------------------------------------------------------------------
// 灯光
// ---------------------------------------------------------------------------
scene.add(new THREE.HemisphereLight('#9fc4ff', '#1a2a3a', 0.7));
const key = new THREE.DirectionalLight('#ffffff', 1.4);
key.position.set(8, 14, 10);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 1;
key.shadow.camera.far = 60;
key.shadow.camera.left = -20; key.shadow.camera.right = 20;
key.shadow.camera.top = 20; key.shadow.camera.bottom = -20;
scene.add(key);
const rim = new THREE.DirectionalLight('#58b4ff', 0.5);
rim.position.set(-10, 4, -8);
scene.add(rim);

// 地面
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(40, 64),
  new THREE.MeshStandardMaterial({ color: '#13243a', roughness: 1, metalness: 0 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -3.2;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(40, 40, '#2a4a6a', '#1c3046');
grid.position.y = -3.19;
scene.add(grid);

// ---------------------------------------------------------------------------
// 材质
// ---------------------------------------------------------------------------
const matSteel  = new THREE.MeshStandardMaterial({ color: '#8d99ae', metalness: 0.85, roughness: 0.35 });
const matDark   = new THREE.MeshStandardMaterial({ color: '#3a4a5a', metalness: 0.7, roughness: 0.5 });
const matBrass  = new THREE.MeshStandardMaterial({ color: '#d9a441', metalness: 0.9, roughness: 0.3 });
const matPiston = new THREE.MeshStandardMaterial({ color: '#ffd166', metalness: 0.6, roughness: 0.35 });
const matRod    = new THREE.MeshStandardMaterial({ color: '#06d6a0', metalness: 0.7, roughness: 0.4 });
const matCrank  = new THREE.MeshStandardMaterial({ color: '#ef476f', metalness: 0.7, roughness: 0.4 });
const matFly    = new THREE.MeshStandardMaterial({ color: '#4cc9f0', metalness: 0.8, roughness: 0.3 });
const matValve  = new THREE.MeshStandardMaterial({ color: '#c77dff', metalness: 0.7, roughness: 0.4 });
const matBoiler = new THREE.MeshStandardMaterial({ color: '#ff7b54', metalness: 0.6, roughness: 0.5 });

// 气缸壁：半透明，可剖切
const clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
const matCyl = new THREE.MeshStandardMaterial({
  color: '#aeb8c4', metalness: 0.6, roughness: 0.25,
  transparent: true, opacity: 0.32, side: THREE.DoubleSide,
  clippingPlanes: [], clipShadows: true,
});

// ---------------------------------------------------------------------------
// 机构参数 (滑块-曲柄)
// ---------------------------------------------------------------------------
const R = 1.0;     // 曲柄半径
const L = 3.4;     // 连杆长度
const PISTON_R = 0.62;
const CYL_X0 = 1.7, CYL_X1 = 5.4;        // 气缸内腔 X 范围
const CYL_CENTER = (CYL_X0 + CYL_X1) / 2;
const CYL_LEN = CYL_X1 - CYL_X0;

// 活塞销 X 位置（滑块-曲柄方程）
function pistonX(theta) {
  return R * Math.cos(theta) + Math.sqrt(L * L - (R * Math.sin(theta)) ** 2);
}

// ---------------------------------------------------------------------------
// 部件分组（便于分解视图、标签、拾取）
// ---------------------------------------------------------------------------
const root = new THREE.Group();
scene.add(root);

const parts = {}; // name -> { group, explode: Vector3, labelPos: Vector3 }
function registerPart(name, group, explode, labelLocal) {
  group.userData.partName = name;
  group.userData.basePos = group.position.clone();
  group.userData.explode = explode;
  group.userData.labelLocal = labelLocal;
  parts[name] = group;
  group.traverse(o => { if (o.isMesh) o.userData.partName = name; });
  root.add(group);
}

// ---- 机架 / 底座 ----
const bedGroup = new THREE.Group();
const bed = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.6, 3.2), matDark);
bed.position.set(2.4, -2.6, 0);
bed.castShadow = bed.receiveShadow = true;
bedGroup.add(bed);
// 气缸支座
const cylMount = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.2, 2.4), matDark);
cylMount.position.set(CYL_CENTER, -1.3, 0);
cylMount.castShadow = true;
bedGroup.add(cylMount);
// 曲轴轴承座
for (const z of [1.5, -1.5]) {
  const pil = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.4, 0.5), matDark);
  pil.position.set(0, -1.1, z);
  pil.castShadow = true;
  bedGroup.add(pil);
}
registerPart('机架底座', bedGroup, new THREE.Vector3(0, -2, 0), new THREE.Vector3(2.4, -2.2, 1.6));

// ---- 锅炉 ----
const boilerGroup = new THREE.Group();
const boilerBody = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 4.2, 40), matBoiler);
boilerBody.rotation.z = Math.PI / 2;
boilerBody.castShadow = true;
boilerGroup.add(boilerBody);
// 端盖
for (const x of [-2.1, 2.1]) {
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), matBoiler);
  cap.rotation.z = x < 0 ? Math.PI / 2 : -Math.PI / 2;
  cap.position.x = x;
  boilerGroup.add(cap);
}
// 火膛 + 火光
const firebox = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 2.0), matDark);
firebox.position.set(0, -1.6, 0);
boilerGroup.add(firebox);
const fireGlow = new THREE.PointLight('#ff5a1f', 2.2, 6, 2);
fireGlow.position.set(0, -1.5, 0);
boilerGroup.add(fireGlow);
const fireMat = new THREE.MeshBasicMaterial({ color: '#ff7b1f' });
const fire = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.7), fireMat);
fire.position.set(0, -1.55, 1.01);
boilerGroup.add(fire);
// 烟囱
const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 2.2, 24), matDark);
chimney.position.set(-1.4, 2.4, 0);
boilerGroup.add(chimney);
// 蒸汽管：锅炉 -> 阀箱
const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 4.2, 16), matBrass);
pipe.rotation.z = Math.PI / 2.6;
pipe.position.set(0.9, 1.9, 0);
boilerGroup.add(pipe);
boilerGroup.position.set(-5.2, 0.4, 0);
registerPart('锅炉', boilerGroup, new THREE.Vector3(-3, 1, 0), new THREE.Vector3(0, 1.7, 0));

// ---- 气缸（缸体 + 端盖 + 两侧气体）----
const cylGroup = new THREE.Group();
const cylWall = new THREE.Mesh(
  new THREE.CylinderGeometry(PISTON_R + 0.16, PISTON_R + 0.16, CYL_LEN, 40, 1, true),
  matCyl
);
cylWall.rotation.z = Math.PI / 2;
cylWall.position.x = CYL_CENTER;
cylGroup.add(cylWall);
// 缸盖
const capMat = new THREE.MeshStandardMaterial({ color: '#7d8896', metalness: 0.7, roughness: 0.35 });
for (const x of [CYL_X0, CYL_X1]) {
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(PISTON_R + 0.28, PISTON_R + 0.28, 0.22, 40), capMat);
  cap.rotation.z = Math.PI / 2;
  cap.position.x = x;
  cap.castShadow = true;
  cylGroup.add(cap);
}
// 缸体外散热环
for (let i = 0; i < 7; i++) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(PISTON_R + 0.2, 0.045, 8, 36), matSteel);
  ring.rotation.y = Math.PI / 2;
  ring.position.x = CYL_X0 + 0.35 + i * (CYL_LEN - 0.7) / 6;
  cylGroup.add(ring);
}
// 两侧气体体积（可变长，显示进汽/排汽）
const gasMatA = new THREE.MeshBasicMaterial({ color: '#ff6b6b', transparent: true, opacity: 0.35, clippingPlanes: [] });
const gasMatB = new THREE.MeshBasicMaterial({ color: '#4cc9f0', transparent: true, opacity: 0.35, clippingPlanes: [] });
const gasA = new THREE.Mesh(new THREE.CylinderGeometry(PISTON_R + 0.02, PISTON_R + 0.02, 1, 32), gasMatA);
const gasB = new THREE.Mesh(new THREE.CylinderGeometry(PISTON_R + 0.02, PISTON_R + 0.02, 1, 32), gasMatB);
gasA.rotation.z = Math.PI / 2; gasB.rotation.z = Math.PI / 2;
cylGroup.add(gasA, gasB);
registerPart('气缸', cylGroup, new THREE.Vector3(2, 2.5, 0), new THREE.Vector3(CYL_CENTER, PISTON_R + 0.5, 0));

// ---- 滑阀 + 阀箱 ----
const valveGroup = new THREE.Group();
const chest = new THREE.Mesh(new THREE.BoxGeometry(CYL_LEN * 0.7, 0.5, 1.0), matSteel);
chest.position.set(CYL_CENTER, PISTON_R + 0.45, 0);
valveGroup.add(chest);
const valveBlock = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.34, 0.8), matValve);
valveBlock.position.set(CYL_CENTER, PISTON_R + 0.45, 0);
valveGroup.add(valveBlock);
// 阀杆
const valveRod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 12), matBrass);
valveRod.rotation.z = Math.PI / 2;
valveRod.position.set(CYL_CENTER - 1.3, PISTON_R + 0.45, 0);
valveGroup.add(valveRod);
registerPart('滑阀', valveGroup, new THREE.Vector3(2, 4, 0), new THREE.Vector3(CYL_CENTER, PISTON_R + 0.95, 0));

// ---- 活塞 + 活塞杆 ----
const pistonGroup = new THREE.Group();
const pistonHead = new THREE.Mesh(new THREE.CylinderGeometry(PISTON_R, PISTON_R, 0.5, 36), matPiston);
pistonHead.rotation.z = Math.PI / 2;
pistonHead.castShadow = true;
pistonGroup.add(pistonHead);
// 活塞环
for (const dx of [-0.12, 0.12]) {
  const r = new THREE.Mesh(new THREE.TorusGeometry(PISTON_R, 0.035, 8, 32), matDark);
  r.rotation.y = Math.PI / 2;
  r.position.x = dx;
  pistonGroup.add(r);
}
// 活塞杆（向曲轴方向延伸）
const pistonRod = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.6, 16), matSteel);
pistonRod.rotation.z = Math.PI / 2;
pistonRod.position.x = -0.95;
pistonRod.castShadow = true;
pistonGroup.add(pistonRod);
// 十字头销
const wristPin = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.5, 16), matBrass);
wristPin.position.x = -1.75;
pistonGroup.add(wristPin);
registerPart('活塞', pistonGroup, new THREE.Vector3(3, 1.5, 0), new THREE.Vector3(0, PISTON_R + 0.35, 0));
// 活塞销在组内的本地 X（相对 group 原点，group 原点放在活塞销处）
const PIN_LOCAL = -1.75;

// ---- 连杆 ----
const conrodGroup = new THREE.Group();
const conrod = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, L - 0.3, 8, 16), matRod);
conrod.castShadow = true;
conrodGroup.add(conrod);
// 大头 / 小头
const bigEnd = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.1, 12, 24), matRod);
const smallEnd = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.08, 12, 24), matRod);
conrodGroup.add(bigEnd, smallEnd);
registerPart('连杆', conrodGroup, new THREE.Vector3(1, -1.5, 1.5), new THREE.Vector3(0, 0.5, 0));

// ---- 曲轴 / 曲柄 ----
const crankGroup = new THREE.Group();
// 主轴
const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3.4, 24), matSteel);
shaft.rotation.x = Math.PI / 2;
crankGroup.add(shaft);
// 曲柄臂（两片）+ 曲柄销
const crankPivot = new THREE.Group(); // 随 θ 旋转
for (const z of [0.45, -0.45]) {
  const web = new THREE.Mesh(new THREE.BoxGeometry(R + 0.5, 0.5, 0.22), matCrank);
  web.position.set(R / 2, 0, z);
  web.castShadow = true;
  crankPivot.add(web);
}
const crankPin = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.0, 20), matBrass);
crankPin.rotation.x = Math.PI / 2;
crankPin.position.set(R, 0, 0);
crankPivot.add(crankPin);
crankGroup.add(crankPivot);
registerPart('曲轴', crankGroup, new THREE.Vector3(-1, -2, 0), new THREE.Vector3(0, -0.7, 1.8));

// ---- 飞轮 ----
const flyGroup = new THREE.Group();
const flyPivot = new THREE.Group();
const flyRim = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.28, 20, 64), matFly);
flyPivot.add(flyRim);
const flyTread = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.05, 0.5, 64, 1, true), matFly);
flyTread.rotation.x = Math.PI / 2;
flyPivot.add(flyTread);
const flyHub = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.7, 24), matSteel);
flyHub.rotation.x = Math.PI / 2;
flyPivot.add(flyHub);
for (let i = 0; i < 6; i++) {
  const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.4, 0.16), matSteel);
  spoke.rotation.z = (i / 6) * Math.PI * 2;
  flyPivot.add(spoke);
}
flyPivot.castShadow = true;
flyGroup.add(flyPivot);
flyGroup.position.set(0, 0, -1.9);
registerPart('飞轮', flyGroup, new THREE.Vector3(-2, 0, -2.5), new THREE.Vector3(0, 2.3, 0));

// ---------------------------------------------------------------------------
// 偏心轮配气机构（装在曲轴上，驱动滑阀）
// ---------------------------------------------------------------------------
const ECC_THROW = 0.42;            // 偏心距
const ECC_Z = 1.05;                // 沿曲轴的位置
const ECC_LEAD = Math.PI / 2;      // 相位超前 90°（简化）
const VALVE_TAIL_X = CYL_CENTER - 1.95;
const VALVE_Y = PISTON_R + 0.45;

const eccPivot = new THREE.Group(); // 随曲轴旋转，几何中心偏置
eccPivot.position.z = ECC_Z;
const eccDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.16, 28), matBrass);
eccDisc.rotation.x = Math.PI / 2;
eccDisc.position.x = ECC_THROW; // 偏置 -> 偏心旋转
eccPivot.add(eccDisc);
const eccStrap = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.07, 12, 28), matSteel);
eccStrap.position.x = ECC_THROW;
eccPivot.add(eccStrap);
crankGroup.add(eccPivot);

// 偏心杆：偏心轮 -> 滑阀杆尾端
const eccRod = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 1.6, 6, 12), matBrass);
root.add(eccRod);

// ---------------------------------------------------------------------------
// 离心式调速器（瓦特反馈机构）
// ---------------------------------------------------------------------------
const govGroup = new THREE.Group();
const GOV_X = -2.2, GOV_BASE_Y = -2.3, GOV_Z = 1.7;
// 底座 + 立柱
const govStand = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 0.4, 20), matDark);
govGroup.add(govStand);
const govColumn = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 2.6, 16), matSteel);
govColumn.position.y = 1.5;
govGroup.add(govColumn);
// 锥齿轮箱（暗示由曲轴驱动）
const govGearbox = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.7), matDark);
govGearbox.position.y = 0.45;
govGroup.add(govGearbox);

// 旋转主轴组件
const govSpin = new THREE.Group();
govSpin.position.y = 2.9;
const govHub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.4, 16), matBrass);
govSpin.add(govHub);
const govBalls = [];   // {pivot, arm, ball}
for (let i = 0; i < 2; i++) {
  const pivot = new THREE.Group();          // 绕水平轴摆动（飞球张开）
  pivot.rotation.y = i * Math.PI;           // 两球对称
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 1.1, 4, 8), matRod);
  arm.position.set(0, -0.55, 0);            // 默认下垂
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 16), matCrank);
  ball.position.set(0, -1.15, 0);
  ball.castShadow = true;
  const swing = new THREE.Group();          // 摆角控制组
  swing.add(arm, ball);
  pivot.add(swing);
  govSpin.add(pivot);
  govBalls.push({ pivot, swing });
}
govGroup.add(govSpin);

// 滑动套筒（飞球张开 -> 套筒上升 -> 关小节气阀）
const govCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.22, 18), matValve);
govCollar.position.y = 2.0;
govGroup.add(govCollar);

govGroup.position.set(GOV_X, GOV_BASE_Y, GOV_Z);
registerPart('离心调速器', govGroup, new THREE.Vector3(-2.5, 1.5, 1.5), new THREE.Vector3(0, 3.4, 0));

// 传动皮带：飞轮 -> 调速器（细线示意）
const govPulley = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 16), matSteel);
govPulley.position.set(GOV_X, GOV_BASE_Y + 0.45, GOV_Z);
root.add(govPulley);
const beltMat = new THREE.LineBasicMaterial({ color: '#cdd6e0', transparent: true, opacity: 0.5 });
const beltGeo = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(0, 0, -1.6), new THREE.Vector3(GOV_X, GOV_BASE_Y + 0.45, GOV_Z),
  new THREE.Vector3(0, -0.3, -1.6), new THREE.Vector3(GOV_X, GOV_BASE_Y + 0.15, GOV_Z),
]);
const belt = new THREE.LineSegments(beltGeo, beltMat);
root.add(belt);

// ---------------------------------------------------------------------------
// HUD 仪表
// ---------------------------------------------------------------------------
const dial = document.getElementById('dial');
const dctx = dial.getContext('2d');
const hudRpm = document.getElementById('hud-rpm');
const hudDeg = document.getElementById('hud-deg');
const hudStroke = document.getElementById('hud-stroke');

function drawDial(theta, intakeLeft, moving) {
  const w = dial.width, h = dial.height, cx = w / 2, cy = h / 2, r = 52;
  dctx.clearRect(0, 0, w, h);
  // 外圈
  dctx.lineWidth = 3; dctx.strokeStyle = '#2a4a6a';
  dctx.beginPath(); dctx.arc(cx, cy, r, 0, Math.PI * 2); dctx.stroke();
  // 上下死点标记
  dctx.fillStyle = '#9fb3c8'; dctx.font = '10px sans-serif'; dctx.textAlign = 'center';
  dctx.fillText('上死点', cx + r + 2, cy + 3);
  dctx.fillText('下死点', cx - r - 2, cy + 3);
  // 曲柄半径线（注意屏幕 y 向下，取负）
  const ang = -theta;
  const px = cx + Math.cos(ang) * (r - 8), py = cy + Math.sin(ang) * (r - 8);
  dctx.strokeStyle = '#58b4ff'; dctx.lineWidth = 3;
  dctx.beginPath(); dctx.moveTo(cx, cy); dctx.lineTo(px, py); dctx.stroke();
  // 曲柄销
  dctx.fillStyle = '#ef476f';
  dctx.beginPath(); dctx.arc(px, py, 6, 0, Math.PI * 2); dctx.fill();
  // 中心
  dctx.fillStyle = '#e6eef7';
  dctx.beginPath(); dctx.arc(cx, cy, 4, 0, Math.PI * 2); dctx.fill();
  // 活塞方向箭头
  dctx.fillStyle = moving ? '#ffd166' : '#56657a';
  dctx.font = '16px sans-serif';
  dctx.fillText(moving > 0 ? '活塞 →' : (moving < 0 ? '← 活塞' : '—'), cx, cy + r + 18);
}

// ---------------------------------------------------------------------------
// 蒸汽粒子系统
// ---------------------------------------------------------------------------
const STEAM_COUNT = 260;
const steamGeo = new THREE.BufferGeometry();
const steamPos = new Float32Array(STEAM_COUNT * 3);
const steamData = []; // {x,y,z,vx,vy,vz,life,maxLife,kind}
const chimneyTip = new THREE.Vector3(-5.2 - 1.4, 0.4 + 3.5, 0);

function spawnSteam(i) {
  // kind 0 = 烟囱白汽; 1 = 进汽侧彩色汽
  const kind = Math.random() < 0.55 ? 0 : 1;
  const d = steamData[i] || {};
  d.kind = kind;
  if (kind === 0) {
    d.x = chimneyTip.x + (Math.random() - 0.5) * 0.5;
    d.y = chimneyTip.y;
    d.z = (Math.random() - 0.5) * 0.5;
    d.vx = -0.4 - Math.random() * 0.3;
    d.vy = 1.1 + Math.random() * 0.6;
    d.vz = (Math.random() - 0.5) * 0.3;
    d.maxLife = 2.2 + Math.random();
  } else {
    // 沿蒸汽管喷向阀箱
    d.x = -3.5 + Math.random() * 0.4;
    d.y = 2.4 + (Math.random() - 0.5) * 0.3;
    d.z = (Math.random() - 0.5) * 0.3;
    d.vx = 2.6 + Math.random();
    d.vy = -0.2;
    d.vz = (Math.random() - 0.5) * 0.2;
    d.maxLife = 1.4 + Math.random() * 0.6;
  }
  d.life = 0;
  steamData[i] = d;
}
for (let i = 0; i < STEAM_COUNT; i++) { spawnSteam(i); steamData[i].life = Math.random() * 2; }
steamGeo.setAttribute('position', new THREE.BufferAttribute(steamPos, 3));
const steamTex = makeSteamTexture();
const steamMat = new THREE.PointsMaterial({
  size: 0.7, map: steamTex, transparent: true, opacity: 0.5,
  depthWrite: false, blending: THREE.NormalBlending, sizeAttenuation: true,
  color: '#dce8f5',
});
const steamPoints = new THREE.Points(steamGeo, steamMat);
scene.add(steamPoints);

function makeSteamTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,0.95)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}

// ---------------------------------------------------------------------------
// 标签（HTML 投影）
// ---------------------------------------------------------------------------
const labelLayer = document.getElementById('labels');
const labelEls = {};
for (const name of Object.keys(parts)) {
  const el = document.createElement('div');
  el.className = 'label';
  el.textContent = name;
  labelLayer.appendChild(el);
  labelEls[name] = el;
}
const tmpV = new THREE.Vector3();
function updateLabels() {
  for (const name of Object.keys(parts)) {
    const g = parts[name];
    tmpV.copy(g.userData.labelLocal);
    g.localToWorld(tmpV);
    const wp = tmpV.clone();
    tmpV.project(camera);
    const el = labelEls[name];
    const behind = tmpV.z > 1;
    if (behind || !labelsVisible) { el.style.display = 'none'; continue; }
    el.style.display = 'block';
    el.style.left = (tmpV.x * 0.5 + 0.5) * window.innerWidth + 'px';
    el.style.top = (-tmpV.y * 0.5 + 0.5) * window.innerHeight + 'px';
  }
}
let labelsVisible = true;

// ---------------------------------------------------------------------------
// 交互：鼠标拾取提示
// ---------------------------------------------------------------------------
const tooltip = document.createElement('div');
tooltip.id = 'tooltip';
document.body.appendChild(tooltip);
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const pickables = [];
root.traverse(o => { if (o.isMesh) pickables.push(o); });

renderer.domElement.addEventListener('pointermove', e => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(pickables, false);
  if (hits.length && hits[0].object.userData.partName) {
    tooltip.style.display = 'block';
    tooltip.style.left = e.clientX + 14 + 'px';
    tooltip.style.top = e.clientY + 'px';
    tooltip.textContent = hits[0].object.userData.partName;
  } else {
    tooltip.style.display = 'none';
  }
});

// ---------------------------------------------------------------------------
// 动画状态 & 控制
// ---------------------------------------------------------------------------
let theta = 0;
let playing = true;
let speed = 1;
let steamOn = true;
let exploded = false;
let explodeAmt = 0;     // 0..1 平滑
let sectioned = false;
let govSwing = 0.2;     // 调速器飞球摆角（平滑）
let hudFrame = 0;

const clock = new THREE.Clock();

// 控制按钮
const btnPlay = document.getElementById('btn-play');
const btnSteam = document.getElementById('btn-steam');
const btnExplode = document.getElementById('btn-explode');
const btnSection = document.getElementById('btn-section');
const btnView = document.getElementById('btn-view');
const speedSlider = document.getElementById('speed');

btnPlay.onclick = () => {
  playing = !playing;
  btnPlay.textContent = playing ? '⏸ 暂停' : '▶ 播放';
};
speedSlider.oninput = () => { speed = parseFloat(speedSlider.value); };
btnSteam.onclick = () => {
  steamOn = !steamOn;
  steamPoints.visible = steamOn;
  fire.visible = fireGlow.visible = steamOn;
  btnSteam.textContent = steamOn ? '🌫 蒸汽：开' : '🌫 蒸汽：关';
  btnSteam.classList.toggle('off', !steamOn);
};
btnExplode.onclick = () => {
  exploded = !exploded;
  btnExplode.classList.toggle('off', !exploded);
  labelsVisible = exploded ? true : labelsVisible;
};
btnSection.onclick = () => {
  sectioned = !sectioned;
  const planes = sectioned ? [clipPlane] : [];
  matCyl.clippingPlanes = planes;
  gasMatA.clippingPlanes = planes;
  gasMatB.clippingPlanes = planes;
  btnSection.classList.toggle('off', !sectioned);
};
btnView.onclick = () => {
  camera.position.copy(HOME_CAM);
  controls.target.set(2, 1.2, 0);
};

// 选项卡
document.querySelectorAll('.tab').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.querySelector(`.tab-content[data-tab="${tab.dataset.tab}"]`).classList.add('active');
  };
});

// ---------------------------------------------------------------------------
// 主循环
// ---------------------------------------------------------------------------
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();

function update(dt) {
  // 角速度
  if (playing) theta += dt * speed * 2.2;
  const omega = playing ? speed * 2.2 : 0;

  // --- 机构运动学 ---
  const px = pistonX(theta);                         // 活塞销 X（世界）
  const pinX = R * Math.cos(theta);
  const pinY = R * Math.sin(theta);

  // 活塞组：原点对齐到活塞销
  pistonGroup.position.set(px - PIN_LOCAL, 0, 0);

  // 曲柄/飞轮旋转
  crankPivot.rotation.z = theta;
  flyPivot.rotation.z = theta;

  // 连杆：连接曲柄销(pinX,pinY) 到活塞销(px,0)
  tmpA.set(pinX, pinY, 0);
  tmpB.set(px, 0, 0);
  const mid = tmpA.clone().add(tmpB).multiplyScalar(0.5);
  conrodGroup.position.copy(mid);
  const dir = tmpB.clone().sub(tmpA);
  const ang = Math.atan2(dir.y, dir.x);
  conrodGroup.rotation.z = ang - Math.PI / 2; // capsule 默认沿 Y
  bigEnd.position.set(0, -(L - 0.3) / 2, 0);
  smallEnd.position.set(0, (L - 0.3) / 2, 0);

  // 偏心轮驱动滑阀（真实配气链：偏心轮 -> 偏心杆 -> 阀杆 -> 滑阀）
  const eccRot = theta + ECC_LEAD;
  eccPivot.rotation.z = eccRot;
  const eccCx = ECC_THROW * Math.cos(eccRot);
  const eccCy = ECC_THROW * Math.sin(eccRot);
  const valveDisp = eccCx;
  valveBlock.position.x = CYL_CENTER + valveDisp;
  valveRod.position.x = CYL_CENTER - 1.3 + valveDisp;
  // 偏心杆：偏心轮中心 -> 阀杆尾
  tmpA.set(eccCx, eccCy, ECC_Z);
  tmpB.set(VALVE_TAIL_X + valveDisp, VALVE_Y, 0);
  eccRod.position.copy(tmpA).add(tmpB).multiplyScalar(0.5);
  const eDir = tmpB.clone().sub(tmpA);
  eccRod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), eDir.clone().normalize());
  eccRod.scale.y = eDir.length() / 1.74; // capsule 原长≈0.07*2+1.6

  // --- 两侧气体体积 ---
  // A = 曲轴侧(左, x: CYL_X0..pistonFace), B = 缸盖侧(右, x: pistonFace..CYL_X1)
  const face = px; // 活塞工作面近似在活塞销 X
  const lenA = Math.max(0.05, face - 0.25 - CYL_X0);
  const lenB = Math.max(0.05, CYL_X1 - (face + 0.25));
  gasA.scale.y = lenA; gasA.position.x = CYL_X0 + lenA / 2;
  gasB.scale.y = lenB; gasB.position.x = CYL_X1 - lenB / 2;

  // 活塞速度方向决定进汽/驱动侧
  const v = -R * Math.sin(theta) - (R * R * Math.sin(theta) * Math.cos(theta)) / Math.sqrt(L * L - (R * Math.sin(theta)) ** 2);
  const movingRight = v > 0;
  // 向右运动 => 左腔(A)进汽膨胀(红)，右腔(B)排汽(蓝)
  gasMatA.color.set(movingRight ? '#ff5252' : '#4cc9f0');
  gasMatB.color.set(movingRight ? '#4cc9f0' : '#ff5252');
  const drive = Math.min(1, Math.abs(v));
  gasMatA.opacity = (movingRight ? 0.18 + 0.3 * drive : 0.14);
  gasMatB.opacity = (movingRight ? 0.14 : 0.18 + 0.3 * drive);

  // 火光闪烁
  fireGlow.intensity = 1.8 + Math.sin(performance.now() * 0.01) * 0.5;

  // --- 分解视图插值 ---
  explodeAmt += ((exploded ? 1 : 0) - explodeAmt) * Math.min(1, dt * 4);
  for (const name of Object.keys(parts)) {
    const g = parts[name];
    if (name === '活塞' || name === '连杆') continue; // 运动件不参与位移分解（避免错乱）
    const base = g.userData.basePos;
    const off = g.userData.explode;
    g.position.set(
      base.x + off.x * explodeAmt,
      base.y + off.y * explodeAmt,
      base.z + off.z * explodeAmt
    );
  }

  // --- 离心调速器 ---
  govSpin.rotation.y += dt * omega * 1.6;
  const targetSwing = playing ? 0.18 + (speed / 3) * 0.92 : 0.12;
  govSwing += (targetSwing - govSwing) * Math.min(1, dt * 3);
  for (const g of govBalls) g.swing.rotation.x = govSwing;
  govCollar.position.y = 1.7 + Math.sin(govSwing) * 0.7;

  // --- HUD 仪表（节流更新文字）---
  const rpm = (omega / (2 * Math.PI)) * 60;
  if ((hudFrame++ % 4) === 0) {
    hudRpm.textContent = rpm.toFixed(0);
    hudDeg.textContent = ((theta * 180 / Math.PI) % 360 + 360) % 360 | 0;
    hudDeg.textContent += '°';
    if (!playing) {
      hudStroke.textContent = '— 已暂停 —';
    } else if (movingRight) {
      hudStroke.innerHTML = '活塞右行<br>左腔进汽做功 · 右腔排汽';
    } else {
      hudStroke.innerHTML = '活塞左行<br>右腔进汽做功 · 左腔排汽';
    }
    drawDial(theta, !movingRight, playing ? (movingRight ? 1 : -1) : 0);
  }

  // --- 蒸汽粒子 ---
  if (steamOn) {
    for (let i = 0; i < STEAM_COUNT; i++) {
      const d = steamData[i];
      d.life += dt;
      if (d.life > d.maxLife) spawnSteam(i);
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      d.vy += d.kind === 0 ? 0.2 * dt : 0; // 白汽上浮
      d.vx *= 0.99;
      steamPos[i * 3] = d.x;
      steamPos[i * 3 + 1] = d.y;
      steamPos[i * 3 + 2] = d.z;
    }
    steamGeo.attributes.position.needsUpdate = true;
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  update(dt);
  controls.update();
  updateLabels();
  renderer.render(scene, camera);
}
animate();

// ---------------------------------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
