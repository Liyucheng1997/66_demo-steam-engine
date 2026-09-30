// ---------------------------------------------------------------------------
// 几何工具：回转体、圆角、螺母螺栓、管道、CSG 布尔运算与剖切
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Brush, Evaluator, ADDITION, SUBTRACTION, INTERSECTION } from 'three-bvh-csg';

export { mergeGeometries };

const V3 = THREE.Vector3;

/** 让几何体只保留 position / normal / uv，便于合并与 CSG */
export function clean(g) {
  if (g.index) g = g.toNonIndexed();
  const keep = ['position', 'normal', 'uv'];
  for (const k of Object.keys(g.attributes)) if (!keep.includes(k)) g.deleteAttribute(k);
  if (!g.attributes.uv) {
    const n = g.attributes.position.count;
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}

/** 轮廓点：[r, h] 为尖角（点会被复制以得到锐利法线），[r, h, 1] 为光滑点 */
function profilePts(profile) {
  const pts = [];
  for (const p of profile) {
    const v = new THREE.Vector2(Math.max(p[0], 0), p[1]);
    pts.push(v);
    if (!p[2]) pts.push(v.clone());
  }
  return pts;
}

/**
 * 回转体。profile: [[r, h], ...]（沿轴向 h 递增，r 为半径），axis: 'x' | 'y' | 'z'
 * 自动在两端补到 r=0 形成封闭实体（除非 open=true）。
 */
export function lathe(profile, { segments = 48, axis = 'y', open = false } = {}) {
  const prof = profile.slice();
  if (!open) {
    if (prof[0][0] > 0) prof.unshift([0, prof[0][1]]);
    const l = prof[prof.length - 1];
    if (l[0] > 0) prof.push([0, l[1]]);
  }
  const g = new THREE.LatheGeometry(profilePts(prof), segments);
  orient(g, axis);
  return clean(dropDegenerate(g));
}

/** 圆角矩形截面轮廓（逆时针，供 ring 使用） */
export function roundRect(r0, r1, h0, h1, rad = 0.01, seg = 4) {
  const pts = [];
  const arc = (cx, cy, a0, a1) => {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (a1 - a0) * (i / seg);
      pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, 1]);
    }
  };
  arc(r0 + rad, h0 + rad, Math.PI, Math.PI * 1.5);
  arc(r1 - rad, h0 + rad, Math.PI * 1.5, Math.PI * 2);
  arc(r1 - rad, h1 - rad, 0, Math.PI * 0.5);
  arc(r0 + rad, h1 - rad, Math.PI * 0.5, Math.PI);
  return pts;
}

/** 环形截面回转体：closedPts 为封闭截面轮廓 [[r,h(,smooth)]...]，(r,h) 平面内逆时针 */
export function ring(closedPts, { segments = 64, axis = 'y' } = {}) {
  const pts = profilePts(closedPts.concat([closedPts[0]]));
  const g = new THREE.LatheGeometry(pts, segments);
  orient(g, axis);
  return clean(dropDegenerate(g));
}

/** 空心圆筒（带壁厚，实体封闭） */
export function tube(rIn, rOut, h0, h1, opts = {}) {
  return ring([[rIn, h0], [rOut, h0], [rOut, h1], [rIn, h1]], opts);
}

/** 去除零面积三角形（重复轮廓点、轴线处会产生），并转为非索引 */
export function dropDegenerate(g) {
  const src = g.index ? g.toNonIndexed() : g;
  const pos = src.attributes.position;
  const keep = [];
  const a = new V3(), b = new V3(), c = new V3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    const area = b.sub(a).cross(c.sub(a)).lengthSq();
    if (area > 1e-16) keep.push(i);
  }
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(src.attributes)) {
    const at = src.attributes[name];
    const arr = new Float32Array(keep.length * 3 * at.itemSize);
    let o = 0;
    for (const i of keep) for (let k = 0; k < 3; k++) for (let j = 0; j < at.itemSize; j++) arr[o++] = at.array[(i + k) * at.itemSize + j];
    out.setAttribute(name, new THREE.BufferAttribute(arr, at.itemSize));
  }
  return out;
}

export function orient(g, axis) {
  if (axis === 'x') g.rotateZ(-Math.PI / 2);
  else if (axis === 'z') g.rotateX(Math.PI / 2);
  return g;
}

export function cyl(r, h0, h1, { axis = 'y', segments = 32, rTop } = {}) {
  const g = new THREE.CylinderGeometry(rTop ?? r, r, h1 - h0, segments);
  g.translate(0, (h0 + h1) / 2, 0);
  orient(g, axis);
  return clean(g);
}

/** 圆角盒 */
export function rbox(w, h, d, r = 0.01, seg = 3) {
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  return clean(new RoundedBoxGeometry(w, h, d, seg, r));
}
export function rboxAB(x0, y0, z0, x1, y1, z1, r = 0.01, seg = 3) {
  const g = rbox(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), r, seg);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

export function box(w, h, d, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return clean(g);
}
/** 由两个角点给出的盒子 */
export function boxAB(x0, y0, z0, x1, y1, z1) {
  return box(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
}

/** 平面形状拉伸：shape 在 xy 平面，沿 z 拉伸 depth，居中 */
export function extrude(shape, depth, { bevel = 0.006, seg = 2, curveSegments = 24 } = {}) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: depth - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: seg, curveSegments,
  });
  g.translate(0, 0, -(depth - 2 * bevel) / 2);
  return clean(g);
}

/** 六角螺母（带倒角），轴向 +y，底面在 y=0 */
export function hexNut(size = 0.03, height = 0.022) {
  const r = size / Math.sqrt(3);
  const g = new THREE.CylinderGeometry(r * 1.02, r * 1.02, height, 6);
  g.translate(0, height / 2, 0);
  const cap = new THREE.CylinderGeometry(r * 0.78, r * 1.02, height * 0.18, 12);
  cap.translate(0, height + height * 0.09, 0);
  return clean(mergeGeometries([clean(g), clean(cap)]));
}

/** 螺栓头 + 伸出螺杆 + 螺母（用于法兰） */
export function studNut(size = 0.03, height = 0.022, stud = 0.012) {
  const nut = hexNut(size, height);
  const s = new THREE.CylinderGeometry(size * 0.3, size * 0.3, height + stud, 10);
  s.translate(0, (height + stud) / 2 + 0.002, 0);
  const tip = new THREE.SphereGeometry(size * 0.3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  tip.translate(0, height + stud + 0.002, 0);
  return mergeGeometries([nut, clean(s), clean(tip)]);
}

/**
 * 沿圆周布置实例（螺母、铆钉等）。axis 为圆周所在平面的法线轴。
 * 返回矩阵数组，可喂给 InstancedMesh 或合并。
 */
export function circleMatrices(n, radius, { axis = 'x', at = 0, phase = 0, normalOut = 1 } = {}) {
  const out = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new V3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    const c = Math.cos(a) * radius, s = Math.sin(a) * radius;
    let p, dir;
    if (axis === 'x') { p = new V3(at, c, s); dir = new V3(normalOut, 0, 0); }
    else if (axis === 'y') { p = new V3(c, at, s); dir = new V3(0, normalOut, 0); }
    else { p = new V3(c, s, at); dir = new V3(0, 0, normalOut); }
    q.setFromUnitVectors(up, dir);
    m.compose(p, q, new V3(1, 1, 1));
    out.push(m.clone());
  }
  return out;
}

/** 把几何体按矩阵数组复制合并 */
export function replicate(geo, matrices) {
  return mergeGeometries(matrices.map((m) => geo.clone().applyMatrix4(m)));
}

/** 把几何体放到某位置并使其 +y 轴指向 dir */
export function placeY(geo, pos, dir = new V3(0, 1, 0), spin = 0) {
  const g = geo.clone();
  if (spin) g.rotateY(spin);
  const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), dir.clone().normalize());
  g.applyQuaternion(q);
  g.translate(pos.x, pos.y, pos.z);
  return g;
}

/**
 * 管道：沿折线走管，拐角用圆弧过渡。返回 { geometry, curve }。
 */
export function pipePath(points, radius, bend = 0.12, radialSeg = 16) {
  const path = new THREE.CurvePath();
  const P = points.map((p) => (p.isVector3 ? p : new V3(...p)));
  let prev = P[0].clone();
  for (let i = 1; i < P.length; i++) {
    const cur = P[i];
    if (i < P.length - 1) {
      const next = P[i + 1];
      const dIn = cur.clone().sub(prev).normalize();
      const dOut = next.clone().sub(cur).normalize();
      const b = Math.min(bend, cur.distanceTo(prev) / 2, cur.distanceTo(next) / 2);
      const a = cur.clone().addScaledVector(dIn, -b);
      const c = cur.clone().addScaledVector(dOut, b);
      if (a.distanceTo(prev) > 1e-5) path.add(new THREE.LineCurve3(prev.clone(), a));
      path.add(new THREE.QuadraticBezierCurve3(a, cur.clone(), c));
      prev = c;
    } else {
      path.add(new THREE.LineCurve3(prev.clone(), cur.clone()));
    }
  }
  const len = path.getLength();
  const g = new THREE.TubeGeometry(path, Math.max(8, Math.ceil(len / 0.03)), radius, radialSeg, false);
  return { geometry: clean(g), curve: path, length: len };
}

/** 管道法兰（一对），位于曲线上参数 t 处 */
export function flangeAt(curve, t, rPipe, { thick = 0.02, rF, bolts = 6 } = {}) {
  rF = rF ?? rPipe * 2.1;
  const p = curve.getPointAt(t);
  const d = curve.getTangentAt(t);
  const parts = [];
  const f = cyl(rF, -thick, thick, { segments: 28 });
  parts.push(f);
  const nut = hexNut(rF * 0.28, thick * 0.9);
  for (let i = 0; i < bolts; i++) {
    const a = (i / bolts) * Math.PI * 2;
    const r = rF * 0.78;
    const n1 = nut.clone(); n1.translate(Math.cos(a) * r, thick, Math.sin(a) * r);
    const n2 = nut.clone(); n2.rotateX(Math.PI); n2.translate(Math.cos(a) * r, -thick, Math.sin(a) * r);
    parts.push(n1, n2);
  }
  return placeY(mergeGeometries(parts), p, d);
}

// ---------------------------------------------------------------------------
// CSG
// ---------------------------------------------------------------------------
const evaluator = new Evaluator();
evaluator.attributes = ['position', 'uv', 'normal'];
evaluator.useGroups = false;

function brush(g, mat) {
  const b = new Brush(g, mat);
  b.updateMatrixWorld();
  return b;
}

/** 几何布尔：base 与若干工具体做 op，返回 BufferGeometry（单材质） */
export function csg(base, tools, op = SUBTRACTION) {
  let a = brush(base);
  for (const t of [].concat(tools)) {
    if (!t) continue;
    a = evaluator.evaluate(a, brush(t), op);
  }
  const g = a.geometry;
  g.clearGroups();
  return g;
}
export const union = (base, tools) => csg(base, tools, ADDITION);
export const subtract = (base, tools) => csg(base, tools, SUBTRACTION);
export const intersect = (base, tools) => csg(base, tools, INTERSECTION);

const cutEvaluator = new Evaluator();
cutEvaluator.attributes = ['position', 'uv', 'normal'];
cutEvaluator.useGroups = true;

/**
 * 剖切：返回去掉平面正侧后的几何体，剖面使用材质索引 1。
 * plane 给出在几何体局部坐标中的平面（法线指向要去除的一侧）。
 */
export function sectionGeometry(geometry, plane, size = 20) {
  const g = geometry;
  const matA = new THREE.MeshBasicMaterial();
  const matB = new THREE.MeshBasicMaterial();
  const a = new Brush(g, matA); a.updateMatrixWorld();
  const cutter = new THREE.BoxGeometry(size, size, size);
  cutter.translate(0, 0, size / 2);         // 盒子占据 z>0 半空间
  const b = new Brush(clean(cutter), matB);
  // 把盒子的 +z 对准平面法线，放到平面上
  const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), plane.normal);
  b.quaternion.copy(q);
  b.position.copy(plane.normal).multiplyScalar(-plane.constant);
  b.updateMatrixWorld();
  const res = cutEvaluator.evaluate(a, b, SUBTRACTION);
  const out = res.geometry;
  // 把 group 的材质索引映射为 0 = 原材质，1 = 剖面
  const mats = res.material;
  for (const grp of out.groups) grp.materialIndex = mats[grp.materialIndex] === matB ? 1 : 0;
  return out;
}
