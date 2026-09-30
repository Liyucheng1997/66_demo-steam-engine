// ---------------------------------------------------------------------------
// 机房环境：地砖地面（含飞轮坑）、砖墙与拱窗、煤堆
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import * as G from '../geo.js';
import { M } from '../materials.js';
import { D } from '../dims.js';

export function buildHouse(scene) {
  const FY = D.FLOOR_Y;
  const grp = new THREE.Group();
  scene.add(grp);

  // 地面（带飞轮坑开口）
  const pit = { x0: -1.2, x1: 1.2, z0: -1.0, z1: -0.6, depth: 0.45 };
  const S = 16;
  const shape = new THREE.Shape([
    new THREE.Vector2(-S, -S), new THREE.Vector2(S, -S), new THREE.Vector2(S, S), new THREE.Vector2(-S, S),
  ]);
  const hole = new THREE.Path([
    new THREE.Vector2(pit.x0, -pit.z1), new THREE.Vector2(pit.x1, -pit.z1),
    new THREE.Vector2(pit.x1, -pit.z0), new THREE.Vector2(pit.x0, -pit.z0),
  ]);
  shape.holes.push(hole);
  const fg = new THREE.ShapeGeometry(shape);
  fg.rotateX(-Math.PI / 2);
  // 世界坐标 UV（每 2 m 一张贴图 = 每砖 0.25 m）
  const pos = fg.attributes.position, uv = fg.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 3.2, pos.getZ(i) / 3.2);
  fg.translate(0, FY, 0);
  const floor = new THREE.Mesh(fg, M.floor);
  floor.receiveShadow = true;
  grp.add(floor);

  // 飞轮坑壁与坑底
  const pitMat = M.brick;
  const d = pit.depth;
  const walls = [
    G.boxAB(pit.x0 - 0.05, FY - d, pit.z0 - 0.05, pit.x1 + 0.05, FY, pit.z0),
    G.boxAB(pit.x0 - 0.05, FY - d, pit.z1, pit.x1 + 0.05, FY, pit.z1 + 0.05),
    G.boxAB(pit.x0 - 0.05, FY - d, pit.z0, pit.x0, FY, pit.z1),
    G.boxAB(pit.x1, FY - d, pit.z0, pit.x1 + 0.05, FY, pit.z1),
  ];
  const wm = new THREE.Mesh(G.mergeGeometries(walls), pitMat);
  wm.receiveShadow = true;
  grp.add(wm);
  const pb = new THREE.Mesh(G.boxAB(pit.x0, FY - d - 0.05, pit.z0, pit.x1, FY - d, pit.z1), M.concrete);
  pb.receiveShadow = true;
  grp.add(pb);
  // 坑沿铁护边
  const edge = [
    G.boxAB(pit.x0 - 0.06, FY, pit.z0 - 0.06, pit.x1 + 0.06, FY + 0.01, pit.z0),
    G.boxAB(pit.x0 - 0.06, FY, pit.z1, pit.x1 + 0.06, FY + 0.01, pit.z1 + 0.06),
  ];
  grp.add(new THREE.Mesh(G.mergeGeometries(edge), M.iron));

  // 远处砖墙 + 拱窗（营造机房氛围）
  const wallMat = M.brick.clone();
  wallMat.map = M.brick.map.clone();
  wallMat.map.repeat.set(6, 2.5);
  wallMat.map.needsUpdate = true;
  wallMat.color = new THREE.Color('#6d625b');
  const wallZ = -5.2;
  const wshape = new THREE.Shape([new THREE.Vector2(-7, FY), new THREE.Vector2(9, FY), new THREE.Vector2(9, 6), new THREE.Vector2(-7, 6)]);
  const winMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#b9cde0').multiplyScalar(0.9) });
  for (const x of [-4.5, -1.5, 1.5, 4.5, 7.2]) {
    const h = new THREE.Path();
    h.moveTo(x - 0.7, 0.4); h.lineTo(x + 0.7, 0.4); h.lineTo(x + 0.7, 3.2); h.absarc(x, 3.2, 0.7, 0, Math.PI, false); h.lineTo(x - 0.7, 0.4);
    wshape.holes.push(h);
    // 窗格
    const glass = new THREE.Shape();
    glass.moveTo(x - 0.7, 0.4); glass.lineTo(x + 0.7, 0.4); glass.lineTo(x + 0.7, 3.2); glass.absarc(x, 3.2, 0.7, 0, Math.PI, false); glass.lineTo(x - 0.7, 0.4);
    const gm = new THREE.Mesh(new THREE.ShapeGeometry(glass, 24), winMat);
    gm.position.z = wallZ - 0.12;
    grp.add(gm);
    const bars = [];
    for (let i = 1; i < 4; i++) bars.push(G.box(0.03, 3.6, 0.03, x - 0.7 + i * 0.35, 2.2, wallZ - 0.08));
    for (let j = 0; j < 6; j++) bars.push(G.box(1.4, 0.03, 0.03, x, 0.4 + j * 0.56, wallZ - 0.08));
    grp.add(new THREE.Mesh(G.mergeGeometries(bars), M.black));
  }
  const wg = new THREE.ExtrudeGeometry(wshape, { depth: 0.25, bevelEnabled: false, curveSegments: 16 });
  const uvw = wg.attributes.uv;
  for (let i = 0; i < uvw.count; i++) uvw.setXY(i, uvw.getX(i) / 2.6, uvw.getY(i) / 2.6);
  wg.translate(0, 0, wallZ - 0.25);
  const wall = new THREE.Mesh(wg, wallMat);
  wall.receiveShadow = true;
  grp.add(wall);
  // 左侧山墙（带门洞的暗墙，避免视野露出空背景）
  const side = new THREE.Mesh(G.boxAB(-6.25, FY, -5.45, -6.0, 6, 9), wallMat.clone());
  side.material.map = M.brick.map.clone();
  side.material.map.repeat.set(7, 3);
  side.material.map.needsUpdate = true;
  side.material.color = new THREE.Color('#4e4640');
  side.receiveShadow = true;
  grp.add(side);
  // 屋架（深色铁桁架，暗示厂房屋顶）
  const truss = [];
  for (let x = -5; x <= 8; x += 2.6) {
    truss.push(G.box(0.12, 0.25, 11, x, 5.4, 0.5));
    truss.push(G.box(0.08, 0.08, 11, x, 4.9, 0.5));
  }
  truss.push(G.box(14.5, 0.14, 0.14, 1.2, 5.35, -5.0));
  grp.add(new THREE.Mesh(G.mergeGeometries(truss), M.black));

  // 煤堆 + 铁锹（锅炉炉门旁）
  const coalG = new THREE.DodecahedronGeometry(0.06, 0);
  const n = 260;
  const coal = new THREE.InstancedMesh(coalG, M.coal, n);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt(Math.random()) * 0.55;
    const a = Math.random() * Math.PI * 2;
    const h = (1 - r / 0.55) * 0.35;
    const s = 0.5 + Math.random() * 0.9;
    m4.compose(
      new THREE.Vector3(-2.35 + Math.cos(a) * r, FY + Math.random() * h + 0.03, -2.3 + Math.sin(a) * r * 0.8),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3)),
      new THREE.Vector3(s, s * 0.8, s),
    );
    coal.setMatrixAt(i, m4);
  }
  coal.castShadow = coal.receiveShadow = true;
  grp.add(coal);
  const shovel = new THREE.Group();
  const blade = new THREE.Mesh(G.rboxAB(-0.13, -0.004, -0.1, 0.13, 0.004, 0.1, 0.003), M.iron);
  const handle = new THREE.Mesh(G.cyl(0.015, 0.0, 0.85, { axis: 'x', segments: 10 }), new THREE.MeshStandardMaterial({ color: '#6b4a2e', roughness: 0.7 }));
  handle.position.x = 0.12;
  shovel.add(blade, handle);
  shovel.position.set(-1.95, FY + 0.3, -1.85);
  shovel.rotation.set(0.2, 0.9, 0.55);
  shovel.traverse((o) => { o.castShadow = true; });
  grp.add(shovel);

  return grp;
}
