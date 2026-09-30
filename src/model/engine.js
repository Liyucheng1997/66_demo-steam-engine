// ---------------------------------------------------------------------------
// 卧式单缸双作用蒸汽机 —— 机座、气缸、阀箱、滑阀、活塞、十字头、连杆、
// 曲轴、飞轮、偏心轮、主轴承、节流阀、离心调速器、皮带传动、排汽管路
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import {
  D, crossheadX, eccentricCenter, valveU, valveKnuckleX,
} from '../dims.js';
import * as G from '../geo.js';
import { M, CUT, gaugeFaceTexture } from '../materials.js';
import { GOV } from '../physics.js';

const V3 = THREE.Vector3;
const X = { axis: 'x' }, Z = { axis: 'z' };

export function buildEngine(parts) {
  const secPlane = new THREE.Plane(new V3(0, 1, 0), 0);   // 剖切：去掉 y > 0
  const section = (m, cut) => parts.sectionable('engine', m, secPlane, cut);
  const add = (p, g, m, o) => parts.mesh(p, g, m, o);

  const FY = D.FLOOR_Y;
  const ZG0 = 0.305, ZG1 = 0.365;       // 侧梁内外侧 z
  const GX = D.VX, GZ = 0.29;           // 节流阀 / 调速器 轴线
  const nutS = G.hexNut(0.032, 0.022);
  const nutM = G.hexNut(0.026, 0.018);
  const stud = G.studNut(0.03, 0.022, 0.014);
  const studSmall = G.studNut(0.024, 0.017, 0.01);

  // =========================================================================
  // 机座（两根带拱形减重孔的侧梁 + 横梁 + 导板座 + 气缸座）
  // =========================================================================
  const bed = parts.add('bed', {
    name: '机座（床身）', cat: '机架',
    desc: '铸铁床身把气缸、导板和曲轴轴承刚性地连成一体，承受活塞推力的反作用力并传给地基。侧梁上的拱形孔用来减轻重量。',
    explode: [0, -0.45, 0], anchor: [1.3, -0.5, 0.4],
    view: { pos: [2.6, 0.4, 3.2], target: [1.2, -0.45, 0] },
  });
  {
    const shape = new THREE.Shape();
    const x0 = -0.62, x1 = 2.8, yb = FY, yt = -0.27;
    shape.moveTo(x0, yb); shape.lineTo(x1, yb); shape.lineTo(x1, yt); shape.lineTo(x0, yt); shape.closePath();
    const arch = (a, b, y0, ys, rise) => {
      const h = new THREE.Path();
      h.moveTo(a, y0); h.lineTo(b, y0); h.lineTo(b, ys);
      h.quadraticCurveTo((a + b) / 2, ys + 2 * rise, a, ys); h.closePath();
      return h;
    };
    shape.holes.push(arch(-0.46, 0.46, -0.7, -0.52, 0.07));
    shape.holes.push(arch(0.68, 1.66, -0.7, -0.52, 0.07));
    shape.holes.push(arch(1.9, 2.6, -0.7, -0.52, 0.07));
    const girder = G.extrude(shape, ZG1 - ZG0, { bevel: 0.008 });
    const parts2 = [];
    for (const zc of [(ZG0 + ZG1) / 2, -(ZG0 + ZG1) / 2]) {
      parts2.push(girder.clone().translate(0, 0, zc));
      // 上下翼缘
      parts2.push(G.rboxAB(-0.64, -0.275, zc - 0.07, 2.82, -0.24, zc + 0.07, 0.008));
      parts2.push(G.rboxAB(-0.66, FY, zc - 0.1, 2.84, FY + 0.035, zc + 0.1, 0.008));
    }
    // 横梁
    parts2.push(G.rboxAB(-0.64, FY, -ZG0, -0.56, -0.3, ZG0, 0.01));
    parts2.push(G.rboxAB(0.64, FY, -ZG0, 0.76, -0.32, ZG0, 0.01));
    parts2.push(G.rboxAB(2.72, FY, -ZG0, 2.8, -0.62, ZG0, 0.01));
    // 曲轴坑底板
    parts2.push(G.boxAB(-0.56, FY, -ZG0, 0.64, FY + 0.04, ZG0));
    add(bed, G.mergeGeometries(parts2), M.green);

    // 导板座（十字头导板下方）
    let guideBed = G.rboxAB(0.88, -0.36, -ZG0, 1.86, -0.145, ZG0, 0.012);
    guideBed = G.union(guideBed, [G.rboxAB(0.9, -0.62, -0.18, 1.84, -0.35, 0.18, 0.01)]);
    add(bed, guideBed, M.green);
    // 气缸座（弧形托座）
    let saddle = G.rboxAB(1.96, -0.36, -ZG0, 2.56, -0.14, ZG0, 0.012);
    saddle = G.subtract(saddle, [
      G.cyl(0.172, 1.9, 2.6, X),
      G.cyl(0.066, -0.5, 0.0, { segments: 24 }).translate(GX, 0, 0.16),
    ]);
    add(bed, saddle, M.green);

    // 地脚螺栓
    const bolts = [];
    for (const zc of [(ZG0 + ZG1) / 2, -(ZG0 + ZG1) / 2]) {
      for (let x = -0.55; x <= 2.8; x += 0.42) {
        for (const dz of [-0.075, 0.075]) bolts.push(new THREE.Matrix4().makeTranslation(x, FY + 0.035, zc + dz));
      }
    }
    add(bed, G.replicate(stud, bolts), M.iron);
  }

  // =========================================================================
  // 主轴承（前、后）与外侧轴承
  // =========================================================================
  const bearings = parts.add('bearings', {
    name: '主轴承', cat: '传动',
    desc: '曲轴支承在带黄铜轴瓦的轴承座里，轴承盖用双头螺栓压紧。顶部的油杯持续滴油润滑。',
    explode: [0, 0.35, 0], anchor: [0, 0.2, 0.38],
    view: { pos: [1.1, 0.7, 1.7], target: [0, 0, 0.1] },
  });
  {
    const oilCup = G.lathe([[0.012, 0], [0.012, 0.03], [0.03, 0.035, 1], [0.034, 0.06], [0.034, 0.09], [0.02, 0.1], [0.02, 0.11], [0.008, 0.125]], { segments: 20 });
    const glass = G.cyl(0.028, 0.06, 0.09, { segments: 20 });
    const makePedestal = (zc, width, baseY) => {
      const g = [];
      g.push(G.rboxAB(-0.26, baseY, zc - width / 2 - 0.02, 0.26, baseY + 0.04, zc + width / 2 + 0.02, 0.01));
      g.push(G.rboxAB(-0.18, baseY + 0.03, zc - width / 2, 0.18, -0.005, zc + width / 2, 0.02));
      return G.mergeGeometries(g);
    };
    for (const zc of [0.38, -0.38]) {
      add(bearings, makePedestal(zc, 0.15, -0.245), M.green);
      // 轴承盖
      add(bearings, G.rboxAB(-0.15, 0.005, zc - 0.07, 0.15, 0.11, zc + 0.07, 0.035), M.green);
      // 黄铜轴瓦露出端
      add(bearings, G.tube(0.075, 0.095, -0.081, 0.081, Z).translate(0, 0, zc), M.brass);
      // 螺母
      const ms = [-0.11, 0.11].map((x) => new THREE.Matrix4().makeTranslation(x, 0.11, zc));
      add(bearings, G.replicate(stud, ms), M.steelDark);
      const ms2 = [];
      for (const x of [-0.22, 0.22]) for (const dz of [-0.06, 0.06]) ms2.push(new THREE.Matrix4().makeTranslation(x, -0.205, zc + dz));
      add(bearings, G.replicate(nutS, ms2), M.iron);
      add(bearings, oilCup.clone().translate(0, 0.11, zc), M.brass);
      add(bearings, glass.clone().translate(0, 0.11, zc), M.glass, { cast: false });
    }
    // 外侧轴承：砖墩 + 轴承座
    const zo = -1.22;
    add(bearings, G.boxAB(-0.32, FY, zo - 0.2, 0.32, -0.29, zo + 0.2), M.brick);
    add(bearings, G.rboxAB(-0.34, -0.29, zo - 0.22, 0.34, -0.25, zo + 0.22, 0.01), M.concrete);
    add(bearings, makePedestal(zo, 0.15, -0.25), M.green);
    add(bearings, G.rboxAB(-0.15, 0.005, zo - 0.07, 0.15, 0.11, zo + 0.07, 0.035), M.green);
    add(bearings, G.tube(0.075, 0.095, -0.081, 0.081, Z).translate(0, 0, zo), M.brass);
    add(bearings, G.replicate(stud, [-0.11, 0.11].map((x) => new THREE.Matrix4().makeTranslation(x, 0.11, zo))), M.steelDark);
    add(bearings, oilCup.clone().translate(0, 0.11, zo), M.brass);
  }

  // =========================================================================
  // 曲轴（主轴 + 曲柄臂 + 曲柄销 + 偏心轮 + 皮带轮）
  // =========================================================================
  const crank = parts.add('crank', {
    name: '曲轴与曲柄', cat: '传动',
    desc: '曲柄把连杆传来的推拉力变成绕主轴的扭矩：扭矩 = 连杆力 × 力臂。曲柄臂对侧的配重块平衡旋转质量，减小振动。',
    explode: [0, 0, 0], anchor: [0, 0.34, 0.1],
    view: { pos: [1.3, 0.5, 1.5], target: [0.1, 0, 0] },
  });
  const crankRot = new THREE.Group();
  crank.group.add(crankRot);
  {
    const R = D.R;
    // 主轴
    add(crank, G.cyl(0.075, -1.36, -0.098, Z), M.steel, { parent: crankRot });
    add(crank, G.cyl(0.075, 0.098, 0.7, Z), M.steel, { parent: crankRot });
    // 曲柄臂（带配重）
    const r1 = 0.15, r2 = 0.1, d = R;
    const beta = Math.acos((r1 - r2) / d);
    const gam = 0.95;
    const s = new THREE.Shape();
    s.absarc(d, 0, r2, -beta, beta, false);
    s.absarc(0, 0, r1, beta, Math.PI - gam, false);
    s.lineTo(Math.cos(Math.PI - gam) * 0.29, Math.sin(Math.PI - gam) * 0.29);
    s.absarc(0, 0, 0.29, Math.PI - gam, Math.PI + gam, false);
    s.lineTo(Math.cos(Math.PI + gam) * r1, Math.sin(Math.PI + gam) * r1);
    s.absarc(0, 0, r1, Math.PI + gam, Math.PI * 2 - beta, false);
    s.closePath();
    const web = G.extrude(s, 0.065, { bevel: 0.01, curveSegments: 32 });
    add(crank, web.clone().translate(0, 0, 0.13), M.steelDark, { parent: crankRot });
    add(crank, web.clone().translate(0, 0, -0.13), M.steelDark, { parent: crankRot });
    // 曲柄销
    add(crank, G.cyl(0.055, -0.1, 0.1, Z).translate(R, 0, 0), M.steel, { parent: crankRot });
    // 曲柄臂端面的键与螺塞
    add(crank, G.cyl(0.03, 0.16, 0.172, Z).translate(R, 0, 0), M.steel, { parent: crankRot });
    add(crank, G.cyl(0.03, -0.172, -0.16, Z).translate(R, 0, 0), M.steel, { parent: crankRot });
    // 皮带轮（驱动调速器）
    const pul = G.ring(G.roundRect(0.075, 0.125, 0.53, 0.6, 0.006), { segments: 48, axis: 'z' });
    add(crank, pul, M.iron, { parent: crankRot });
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      add(crank, G.box(0.05, 0.012, 0.03).rotateZ(a).translate(Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0.565), M.iron, { parent: crankRot });
    }
  }

  // ---- 偏心轮（随曲轴转）----
  const ecc = parts.add('eccentric', {
    name: '偏心轮与偏心杆', cat: '配汽',
    desc: '偏心轮就是一个“小曲柄”：圆盘中心偏离轴心 60 mm，随曲轴转动时推动偏心杆往复，带动滑阀。它比曲柄超前 90° + 超前角，使滑阀在活塞到达死点前就打开进汽口（导程）。',
    explode: [0, 0, 0.5], anchor: [0.55, 0.12, D.ZV],
    view: { pos: [1.2, 0.55, 1.7], target: [0.45, 0, 0.2] },
  });
  const eccRot = new THREE.Group();
  ecc.group.add(eccRot);
  const eccRodG = new THREE.Group();
  ecc.group.add(eccRodG);
  {
    const phi = D.ECC_PHASE;
    const ex = Math.cos(phi) * D.ECC_R, ey = Math.sin(phi) * D.ECC_R;
    const zv = D.ZV;
    const sheave = G.lathe([[0.1, zv - 0.03], [0.15, zv - 0.03], [0.155, zv - 0.024], [0.155, zv + 0.024], [0.15, zv + 0.03], [0.1, zv + 0.03]], { segments: 48, axis: 'z' });
    add(ecc, sheave.translate(ex, ey, 0), M.steelDark, { parent: eccRot });
    add(ecc, G.cyl(0.105, zv - 0.045, zv + 0.045, { axis: 'z', segments: 32 }), M.steelDark, { parent: eccRot });
    // 偏心带（两半环 + 连接耳 + 螺栓）
    const strap = G.tube(0.155, 0.19, zv - 0.035, zv + 0.035, { axis: 'z', segments: 48 });
    add(ecc, strap, M.bronze, { parent: eccRodG });
    for (const a of [Math.PI / 2, -Math.PI / 2]) {
      const lug = G.rboxAB(-0.035, 0.175, zv - 0.035, 0.035, 0.235, zv + 0.035, 0.008).rotateZ(a - Math.PI / 2);
      add(ecc, lug, M.bronze, { parent: eccRodG });
    }
    const boltMs = [];
    for (const sy of [1, -1]) for (const dx of [-0.018, 0.018]) {
      const m = new THREE.Matrix4().makeRotationX(sy > 0 ? 0 : Math.PI);
      m.setPosition(dx, sy * 0.235, zv);
      boltMs.push(m);
    }
    add(ecc, G.replicate(G.studNut(0.02, 0.014, 0.01), boltMs), M.steelDark, { parent: eccRodG });
    // 偏心杆：带端座 + 渐细圆杆 + 叉头
    add(ecc, G.rboxAB(0.18, -0.05, zv - 0.03, 0.3, 0.05, zv + 0.03, 0.012), M.steelDark, { parent: eccRodG });
    const rod = G.lathe([[0.024, 0.28], [0.03, 0.3, 1], [0.022, 0.36, 1], [0.018, D.ECC_L - 0.1, 1], [0.024, D.ECC_L - 0.07]], { segments: 18, axis: 'x' });
    add(ecc, rod.translate(0, 0, zv), M.steel, { parent: eccRodG });
    add(ecc, G.rboxAB(D.ECC_L - 0.08, -0.035, zv - 0.03, D.ECC_L + 0.04, 0.035, zv + 0.03, 0.012), M.steelDark, { parent: eccRodG });
    add(ecc, G.cyl(0.014, zv - 0.04, zv + 0.04, Z).translate(D.ECC_L, 0, 0), M.steel, { parent: eccRodG });
  }

  // =========================================================================
  // 飞轮
  // =========================================================================
  const fly = parts.add('flywheel', {
    name: '飞轮', cat: '传动',
    desc: '直径 2.1 m、约 1.2 吨的铸铁飞轮。每转中活塞推力时大时小（死点处为零），飞轮储存多余动能、在推力不足时释放，使转速平稳，并带着曲柄越过死点。',
    explode: [0, 0, -0.9], anchor: [0, 1.15, D.FLY_Z],
    view: { pos: [2.6, 1.0, 1.6], target: [0, 0, -0.8] },
  });
  {
    const z = D.FLY_Z;
    const rim = G.ring([
      [0.93, -0.1], [0.955, -0.1], [0.955, -0.085], [1.06, -0.085, 1], [1.07, -0.075, 1],
      [1.075, 0, 1], [1.07, 0.075, 1], [1.06, 0.085, 1], [0.955, 0.085], [0.955, 0.1], [0.93, 0.1],
    ].map(([r, h, s]) => [r, h + z, s]), { segments: 128, axis: 'z' });
    add(fly, rim, M.green);
    // 抛光的轮缘外圆
    add(fly, G.tube(1.0755, 1.078, z - 0.07, z + 0.07, { axis: 'z', segments: 128 }), M.steelDark, { receive: true });
    // 装饰线
    for (const s of [1, -1]) {
      add(fly, G.tube(0.965, 0.972, z + s * 0.1 - 0.001, z + s * 0.1 + 0.001, { axis: 'z', segments: 96 }), new THREE.MeshStandardMaterial({ color: '#b8342a', roughness: 0.5 }), { cast: false });
    }
    // 轮毂
    const hub = G.lathe([[0.075, z - 0.14], [0.17, z - 0.14], [0.2, z - 0.1, 1], [0.21, z - 0.05, 1], [0.21, z + 0.05, 1], [0.2, z + 0.1, 1], [0.17, z + 0.14], [0.075, z + 0.14]], { segments: 48, axis: 'z' });
    add(fly, hub, M.green);
    add(fly, G.boxAB(-0.02, 0.07, z - 0.16, 0.02, 0.1, z + 0.12), M.steel);
    // 椭圆截面辐条
    const spoke = new THREE.CylinderGeometry(0.036, 0.052, 0.76, 20);
    spoke.scale(1, 1, 0.62);
    spoke.translate(0, 0.575, 0);
    const sp = [];
    for (let i = 0; i < 6; i++) sp.push(G.clean(spoke.clone()).rotateZ(i * Math.PI / 3 + Math.PI / 6).translate(0, 0, z));
    add(fly, G.mergeGeometries(sp), M.green);
  }

  // =========================================================================
  // 连杆
  // =========================================================================
  const rod = parts.add('conrod', {
    name: '连杆', cat: '传动',
    desc: '连杆一端（小头）挂在十字头销上做直线往复，另一端（大头）套在曲柄销上做圆周运动——正是它把“直线”变成“旋转”。大头为船用式：黄铜轴瓦、轴承盖与两根大头螺栓。',
    explode: [0, 0, 0.55], anchor: [0.6, 0.18, 0],
    view: { pos: [1.4, 0.6, 1.6], target: [0.6, 0, 0] },
  });
  {
    const L = D.L;
    // 大头：杆脚 + 轴承盖（挖出轴瓦孔）+ 轴瓦
    let foot = G.rboxAB(0.0, -0.1, -0.048, 0.15, 0.1, 0.048, 0.015);
    let cap = G.rboxAB(-0.13, -0.1, -0.048, -0.004, 0.1, 0.048, 0.03);
    const bore = G.cyl(0.075, -0.1, 0.1, Z);
    foot = G.subtract(foot, [bore]);
    cap = G.subtract(cap, [bore]);
    add(rod, foot, M.steelDark);
    add(rod, cap, M.steelDark);
    add(rod, G.tube(0.056, 0.076, -0.052, 0.052, Z), M.brass);
    // 大头螺栓与螺母
    const bolt = G.cyl(0.014, -0.15, 0.16, X);
    add(rod, G.mergeGeometries([bolt.clone().translate(0, 0.08, 0), bolt.clone().translate(0, -0.08, 0)]), M.steel);
    const nutX = nutM.clone().rotateZ(Math.PI / 2);
    add(rod, G.mergeGeometries([
      nutX.clone().translate(-0.13, 0.08, 0), nutX.clone().translate(-0.13, -0.08, 0),
      nutX.clone().translate(-0.152, 0.08, 0), nutX.clone().translate(-0.152, -0.08, 0),
    ]), M.steel);
    // 杆身（渐细圆杆）
    const shank = G.lathe([
      [0.065, 0.14], [0.05, 0.19, 1], [0.047, 0.3, 1], [0.04, L - 0.22, 1], [0.042, L - 0.16, 1], [0.05, L - 0.11],
    ], { segments: 28, axis: 'x' });
    add(rod, shank, M.steel);
    // 小头：方框 + 轴瓦 + 楔铁
    let se = G.rboxAB(L - 0.11, -0.07, -0.04, L + 0.07, 0.07, 0.04, 0.02);
    se = G.subtract(se, [G.cyl(0.05, -0.1, 0.1, Z).translate(L, 0, 0)]);
    add(rod, se, M.steelDark);
    add(rod, G.tube(0.04, 0.05, -0.043, 0.043, Z).translate(L, 0, 0), M.brass);
    add(rod, G.boxAB(L + 0.065, -0.09, -0.012, L + 0.085, 0.09, 0.012), M.steel);
  }

  // =========================================================================
  // 十字头 + 导板
  // =========================================================================
  const xhead = parts.add('crosshead', {
    name: '十字头与导板', cat: '传动',
    desc: '十字头夹在上下两条导板之间滑动：活塞杆只受轴向力，而连杆倾斜产生的侧向分力由导板承受，保护活塞杆与填料函不被压弯、磨偏。滑块表面镶有减摩的白合金。',
    explode: [0, 0.5, 0], anchor: [1.25, 0.2, 0],
    view: { pos: [1.9, 0.55, 1.4], target: [1.25, 0, 0] },
  });
  const guides = new THREE.Group();
  xhead.root.add(guides);
  {
    let body = G.rboxAB(-0.1, -0.075, -0.078, 0.1, 0.075, 0.078, 0.012);
    body = G.subtract(body, [G.boxAB(-0.12, -0.08, -0.046, 0.045, 0.08, 0.046)]);
    add(xhead, body, M.steelDark);
    add(xhead, G.rboxAB(-0.105, 0.075, -0.09, 0.105, 0.108, 0.09, 0.006), M.whiteMetal);
    add(xhead, G.rboxAB(-0.105, -0.108, -0.09, 0.105, -0.075, 0.09, 0.006), M.whiteMetal);
    // 十字头销
    add(xhead, G.cyl(0.04, -0.085, 0.085, Z), M.steel);
    add(xhead, nutM.clone().rotateX(Math.PI / 2).translate(0, 0, 0.078), M.steel);
    // 活塞杆接头
    add(xhead, G.lathe([[0.05, 0.095], [0.05, 0.14], [0.038, 0.165]], { segments: 24, axis: 'x' }), M.steelDark);
    add(xhead, G.boxAB(0.115, -0.065, -0.01, 0.13, 0.065, 0.01), M.steel);

    // 导板（上下）及隔块
    const gx0 = 0.88, gx1 = 1.8;
    const bars = [
      G.rboxAB(gx0, 0.108, -0.1, gx1, 0.145, 0.1, 0.006),
      G.rboxAB(gx0, -0.145, -0.1, gx1, -0.108, 0.1, 0.006),
    ];
    for (const x of [gx0 + 0.03, gx1 - 0.03]) for (const z of [-0.125, 0.125]) {
      bars.push(G.rboxAB(x - 0.025, -0.145, z - 0.025, x + 0.025, 0.145, z + 0.025, 0.006));
    }
    const gm = new THREE.Mesh(G.mergeGeometries(bars), M.steel);
    gm.castShadow = gm.receiveShadow = true;
    gm.userData.partId = 'crosshead';
    guides.add(gm);
    const gn = [];
    for (const x of [gx0 + 0.03, gx1 - 0.03]) for (const z of [-0.125, 0.125]) gn.push(new THREE.Matrix4().makeTranslation(x, 0.145, z));
    const gnm = new THREE.Mesh(G.replicate(stud, gn), M.steelDark);
    gnm.userData.partId = 'crosshead';
    guides.add(gnm);
    // 导板支架（与前缸盖相连）
    let br = G.rboxAB(1.8, -0.2, -0.16, 1.84, 0.2, 0.16, 0.01);
    br = G.subtract(br, [G.cyl(0.08, 1.7, 1.9, X)]);
    const brm = new THREE.Mesh(br, M.green);
    brm.castShadow = true; brm.userData.partId = 'crosshead';
    guides.add(brm);
  }

  // =========================================================================
  // 活塞 + 活塞杆
  // =========================================================================
  const piston = parts.add('piston', {
    name: '活塞与活塞杆', cat: '气缸',
    desc: '活塞把两侧的蒸汽压力差变成推力：F = (p₁ − p₂) × A。活塞直径 250 mm，面积约 0.049 m²，7 bar 的压差就能产生约 34 kN（3.5 吨）的推力。三道活塞环防止蒸汽从活塞边缘漏过。',
    explode: [0, 0.55, 0], anchor: [2.25, 0.3, 0],
    view: { pos: [2.6, 1.0, 1.25], target: [2.2, 0, 0.05] },
  });
  {
    const r = D.BORE_R - 0.0008, t = D.PISTON_T / 2;
    const body = G.lathe([
      [0.03, -t], [r - 0.01, -t], [r, -t + 0.008], [r, -0.04], [r - 0.006, -0.04], [r - 0.006, -0.028], [r, -0.028],
      [r, -0.006], [r - 0.006, -0.006], [r - 0.006, 0.006], [r, 0.006], [r, 0.028], [r - 0.006, 0.028], [r - 0.006, 0.04],
      [r, 0.04], [r, t - 0.008], [r - 0.01, t], [0.03, t],
    ], { segments: 48, axis: 'x' });
    const pm = add(piston, body, M.iron);
    section(pm, CUT.iron);
    const rings = G.mergeGeometries([-0.034, 0, 0.034].map((x) => G.tube(r - 0.0065, r + 0.0005, x - 0.0055, x + 0.0055, { axis: 'x', segments: 48 })));
    const rm = add(piston, rings, M.brass);
    section(rm, CUT.brass);
    const pnut = G.hexNut(0.06, 0.035).rotateZ(-Math.PI / 2).translate(t, 0, 0);
    const nm = add(piston, pnut, M.steel);
    section(nm, CUT.steel);
    // 活塞杆
    add(piston, G.cyl(D.ROD_R, -D.ROD + 0.16, t + 0.01, X), M.steel);
  }

  // =========================================================================
  // 气缸铸件（缸筒 + 法兰 + 汽口带，内含两条进汽道与排汽道）
  // =========================================================================
  const cyl = parts.add('cylinder', {
    name: '气缸', cat: '气缸',
    desc: '气缸是蒸汽做功的地方。缸壁内铸有两条汽道：分别通向缸的两端；中间一条是排汽道。外面包着柚木保温板与黄铜箍，减少热量散失（冷缸壁会让蒸汽凝结，损失做功能力）。',
    explode: [0, 0.95, -0.15], anchor: [2.25, 0.28, -0.05],
    view: { pos: [3.3, 1.3, 1.9], target: [2.25, 0, 0] },
  });
  const passY = D.PORT_H / 2;
  {
    const x0 = 1.87, x1 = 2.63;
    let casting = G.union(G.cyl(D.BARREL_R, x0, x1, { axis: 'x', segments: 64 }), [
      G.cyl(D.CYL_FLANGE_R, x0, x0 + 0.06, { axis: 'x', segments: 64 }),
      G.cyl(D.CYL_FLANGE_R, x1 - 0.06, x1, { axis: 'x', segments: 64 }),
      G.rboxAB(1.93, -0.1, 0.0, 2.57, 0.1, D.FACE_Z, 0.008),
      G.cyl(0.06, -0.13, -0.05, { segments: 28 }).translate(GX, 0, 0.16),
      G.cyl(0.075, -0.14, -0.12, { segments: 28 }).translate(GX, 0, 0.16),
    ]);
    const fz = D.FACE_Z;
    const voids = [
      G.cyl(D.BORE_R, x0 - 0.01, x1 + 0.01, { axis: 'x', segments: 64 }),
      // 曲轴端(CE)汽道：阀座口 → 纵向汽道 → 缸端入口
      G.boxAB(D.CE_PORT_X0, -passY, 0.14, D.CE_PORT_X1, passY, fz + 0.01),
      G.boxAB(D.BORE_X0, -passY, 0.14, D.CE_PORT_X1, passY, 0.17),
      G.boxAB(D.BORE_X0, -passY, 0.05, D.BORE_X0 + 0.03, passY, 0.17),
      // 缸盖端(HE)汽道
      G.boxAB(D.HE_PORT_X0, -passY, 0.14, D.HE_PORT_X1, passY, fz + 0.01),
      G.boxAB(D.HE_PORT_X0, -passY, 0.14, D.BORE_X1, passY, 0.17),
      G.boxAB(D.BORE_X1 - 0.03, -passY, 0.05, D.BORE_X1, passY, 0.17),
      // 排汽道：阀座中央 → 向下出口
      G.boxAB(D.EXH_X0, -passY, 0.13, D.EXH_X1, passY, fz + 0.01),
      G.cyl(0.042, -0.16, 0.0, { segments: 24 }).translate(GX, 0, 0.16),
    ];
    casting = G.subtract(casting, voids);
    const cm = add(cyl, casting, M.green);
    section(cm, CUT.iron);

    // 保温层（柚木板条 + 黄铜箍），避开汽口带与阀箱
    let lag = G.tube(D.BARREL_R, 0.205, 1.935, 2.565, { axis: 'x', segments: 64 });
    const lagCut = G.boxAB(1.9, -0.105, 0.05, 2.6, 0.105, 0.5);
    lag = G.subtract(lag, [lagCut]);
    const lm = add(cyl, lag, M.wood);
    section(lm, CUT.wood);
    let bands = G.mergeGeometries([1.99, 2.25, 2.51].map((x) => G.tube(0.2, 0.21, x - 0.012, x + 0.012, { axis: 'x', segments: 64 })));
    bands = G.subtract(bands, [lagCut]);
    const bm = add(cyl, bands, M.brass);
    section(bm, CUT.brass);
    // 气缸螺母（缸盖连接）属于缸盖；这里放示功器旋塞（缸顶两端）
    const cock = G.mergeGeometries([
      G.cyl(0.018, 0.2, 0.26, { segments: 16 }),
      G.cyl(0.026, 0.26, 0.29, { segments: 6 }),
      G.cyl(0.012, 0.29, 0.33, { segments: 12 }),
      G.box(0.07, 0.01, 0.012, 0, 0.31, 0),
    ]);
    const cocks = add(cyl, G.mergeGeometries([cock.clone().translate(1.97, 0, -0.03), cock.clone().translate(2.53, 0, -0.03)]), M.brass);
    parts.hideInSection('engine', cocks);
    // 排水阀（缸底两端）
    const drain = G.mergeGeometries([G.cyl(0.015, -0.24, -0.16, { segments: 12 }), G.box(0.05, 0.01, 0.01, 0, -0.22, 0)]);
    add(cyl, G.mergeGeometries([drain.clone().translate(1.97, 0, -0.06), drain.clone().translate(2.53, 0, -0.06)]), M.brass);
  }

  // ---- 前缸盖（带填料函）与后缸盖 ----
  const covers = parts.add('covers', {
    name: '缸盖与填料函', cat: '气缸',
    desc: '两端缸盖封闭气缸。前缸盖中心是填料函（盘根箱）：活塞杆穿出处塞满浸油的石棉盘根，用压盖压紧，既让杆自由滑动又不漏汽。',
    explode: [0, 0.62, 0.42], anchor: [1.78, 0.16, 0],
    view: { pos: [2.2, 0.6, 1.2], target: [1.8, 0, 0] },
  });
  {
    const fr = D.CYL_FLANGE_R;
    // 前缸盖（环形截面，中心孔穿活塞杆）
    const front = G.ring([
      [0.027, 1.72], [0.075, 1.72], [0.075, 1.79], [0.11, 1.825, 1], [fr, 1.83], [fr, 1.87],
      [D.BORE_R - 0.001, 1.87], [D.BORE_R - 0.001, D.BORE_X0], [0.027, D.BORE_X0],
    ], { segments: 64, axis: 'x' });
    const f = add(covers, front, M.green);
    section(f, CUT.iron);
    // 填料压盖
    const gland = G.ring([[0.027, 1.66], [0.1, 1.66], [0.1, 1.675], [0.058, 1.68], [0.058, 1.73], [0.027, 1.73]], { segments: 40, axis: 'x' });
    const gm = add(covers, gland, M.brass);
    section(gm, CUT.brass);
    add(covers, G.mergeGeometries([0.075, -0.075].map((z) => G.cyl(0.009, 1.64, 1.75, X).translate(0, 0, z))), M.steel);
    add(covers, G.mergeGeometries([0.075, -0.075].map((z) => nutM.clone().rotateZ(Math.PI / 2).translate(1.66, 0, z))), M.steel);
    // 后缸盖（带凸台）
    const back = G.lathe([
      [D.BORE_R - 0.001, D.BORE_X1], [D.BORE_R - 0.001, 2.63], [fr, 2.63], [fr, 2.67], [0.2, 2.678, 1],
      [0.14, 2.705, 1], [0.08, 2.72], [0.07, 2.72], [0.07, 2.745], [0.0, 2.745],
    ], { segments: 64, axis: 'x' });
    const b = add(covers, back, M.green);
    section(b, CUT.iron);
    // 法兰螺母
    const ms = [];
    for (const [x, dir] of [[1.83, -1], [2.67, 1]]) {
      for (const m of G.circleMatrices(12, 0.205, { axis: 'x', at: x, normalOut: dir, phase: Math.PI / 12 })) ms.push(m);
    }
    const nm = add(covers, G.replicate(stud, ms), M.steelDark);
    section(nm, CUT.steel);
  }

  // =========================================================================
  // 阀箱 + 阀箱盖
  // =========================================================================
  const chest = parts.add('chest', {
    name: '阀箱（汽室）', cat: '配汽',
    desc: '阀箱紧贴在气缸侧面，里面始终充满来自锅炉的新鲜蒸汽。滑阀就在阀箱里、贴着阀座面滑动，决定蒸汽何时进入哪一端。',
    explode: [0, 0, 0.45], anchor: [2.25, 0.2, 0.33],
    view: { pos: [2.6, 1.3, 1.5], target: [2.25, 0, 0.25] },
  });
  {
    const fz = D.FACE_Z;
    let body = G.rboxAB(2.0, -0.135, fz, 2.5, 0.135, 0.38, 0.012);
    body = G.union(body, [
      G.cyl(0.06, 0.12, 0.175, { segments: 28 }).translate(GX, 0, GZ),
      G.cyl(0.042, 1.94, 2.01, X).translate(0, 0, D.ZV),
    ]);
    body = G.subtract(body, [
      G.boxAB(2.03, -0.105, fz - 0.01, 2.47, 0.105, 0.39),
      G.cyl(0.04, 0.09, 0.2, { segments: 24 }).translate(GX, 0, GZ),
      G.cyl(0.019, 1.9, 2.06, X).translate(0, 0, D.ZV),
    ]);
    const cm = add(chest, body, M.green);
    section(cm, CUT.iron);
    // 阀杆填料压盖
    const g2 = G.ring([[0.018, 1.905], [0.05, 1.905], [0.05, 1.918], [0.032, 1.922], [0.032, 1.945], [0.018, 1.945]], { segments: 28, axis: 'x' }).translate(0, 0, D.ZV);
    const g2m = add(chest, g2, M.brass);
    section(g2m, CUT.brass);
    // 阀箱盖
    const coverG = G.rboxAB(1.99, -0.145, 0.38, 2.51, 0.145, 0.402, 0.01);
    const rib = G.mergeGeometries([
      G.rboxAB(2.05, -0.012, 0.4, 2.45, 0.012, 0.425, 0.006),
      G.rboxAB(GX - 0.012, -0.1, 0.4, GX + 0.012, 0.1, 0.425, 0.006),
    ]);
    const chestCover = parts.add('chestCover', {
      name: '阀箱盖', cat: '配汽', desc: '拆下阀箱盖即可检修滑阀、研磨阀座。',
      explode: [0, 0, 0.75], anchor: [2.25, 0.18, 0.42], label: false,
    });
    const ccm = add(chestCover, G.mergeGeometries([coverG, rib]), M.green);
    section(ccm, CUT.iron);
    const cms = [];
    for (let i = 0; i < 5; i++) for (const y of [-0.12, 0.12]) cms.push(new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(2.03 + i * 0.11, y, 0.402));
    for (const x of [2.015, 2.485]) cms.push(new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(x, 0, 0.402));
    const nn = add(chestCover, G.replicate(studSmall, cms), M.steelDark);
    section(nn, CUT.steel);
  }

  // =========================================================================
  // 滑阀（D 形阀）+ 阀杆 + 阀杆导向
  // =========================================================================
  const valve = parts.add('valve', {
    name: '滑阀（D 形阀）', cat: '配汽',
    desc: 'D 形滑阀是蒸汽机的“大脑”。它外侧边缘控制新汽进入：阀向一侧移动，就把那一端的汽口暴露给阀箱里的高压蒸汽；阀底的 D 形空腔同时把另一端汽口与中间的排汽口连通。阀边比汽口多出的“余面”决定何时截汽，让蒸汽靠膨胀继续做功。',
    explode: [0, 0, 0.25], anchor: [2.25, 0.12, 0.27],
    view: { pos: [2.3, 1.35, 0.95], target: [2.25, 0, 0.2] },
  });
  {
    const fz = D.FACE_Z, zv = D.ZV;
    let v = G.rboxAB(D.VALVE_X0, -0.085, fz, D.VALVE_X1, 0.085, 0.25, 0.008);
    v = G.subtract(v, [G.rboxAB(D.CAV_X0, -0.066, fz - 0.02, D.CAV_X1, 0.066, 0.226, 0.01)]);
    v = G.union(v, [G.rboxAB(GX - 0.06, -0.035, 0.24, GX + 0.06, 0.035, 0.29, 0.006)]);
    v = G.subtract(v, [G.cyl(0.018, GX - 0.1, GX + 0.1, X).translate(0, 0, zv)]);
    const vm = add(valve, v, M.bronze);
    section(vm, CUT.brass);
    // 阀杆
    const K0 = D.ECC_L - (D.ECC_R * D.ECC_R) / (4 * D.ECC_L);
    const spindle = G.cyl(0.017, K0 + 0.03, GX + 0.14, X).translate(0, 0, zv);
    const sm = add(valve, spindle, M.steel);
    const vn = G.mergeGeometries([
      nutM.clone().rotateZ(Math.PI / 2).translate(GX - 0.06, 0, zv),
      nutM.clone().rotateZ(-Math.PI / 2).translate(GX + 0.06, 0, zv),
    ]);
    const vnm = add(valve, vn, M.steel);
    section(vnm, CUT.steel);
    section(sm, CUT.steel);
    // 阀杆接头（叉头）
    add(valve, G.rboxAB(K0 - 0.045, -0.04, zv - 0.028, K0 + 0.05, 0.04, zv + 0.028, 0.01).translate(0, 0, 0), M.steelDark);
    valve.K0 = K0;
  }
  // 阀杆导向架（固定）
  {
    const vg = parts.add('valveGuide', { name: '阀杆导向', cat: '配汽', desc: '支承阀杆，保证其直线运动。', label: false, explode: [0, -0.2, 0.2] });
    const zv = D.ZV;
    add(vg, G.rboxAB(1.4, -0.145, zv - 0.03, 1.5, -0.03, zv + 0.03, 0.008), M.green);
    add(vg, G.tube(0.019, 0.036, 1.38, 1.52, X).translate(0, 0, zv), M.brass);
  }

  // =========================================================================
  // 节流阀 + 离心调速器 + 皮带
  // =========================================================================
  const throttle = parts.add('throttle', {
    name: '节流阀', cat: '调速',
    desc: '主汽管进入阀箱前要经过节流阀（蝶阀）。它的开度由调速器自动控制：开大则进汽多、功率大；关小则进汽压力降低、功率减小。侧面的小压力表显示阀箱内的汽压。',
    explode: [0, 0.35, 0], anchor: [GX + 0.08, 0.32, GZ + 0.05],
    view: { pos: [2.9, 0.9, 1.3], target: [GX, 0.45, GZ] },
  });
  const thrArm = new THREE.Group();
  const chestGauge = { needle: null };
  {
    const body = G.lathe([
      [0.09, 0.165], [0.09, 0.19], [0.06, 0.195], [0.07, 0.22, 1], [0.075, 0.3, 1], [0.07, 0.38, 1], [0.06, 0.4], [0.08, 0.405], [0.08, 0.425],
    ], { segments: 36 }).translate(GX, 0, GZ);
    add(throttle, body, M.green);
    // 侧向进汽口（指向 -z，接主汽管）
    add(throttle, G.cyl(0.05, GZ - 0.16, GZ, Z).translate(GX, 0.33, 0), M.green);
    add(throttle, G.cyl(0.085, GZ - 0.165, GZ - 0.14, Z).translate(GX, 0.33, 0), M.green);
    // 法兰螺母
    add(throttle, G.replicate(nutM, G.circleMatrices(6, 0.075, { axis: 'y', at: 0.19 }).map((m) => m.premultiply(new THREE.Matrix4().makeTranslation(GX, 0, GZ)))), M.steelDark);
    // 蝶阀轴 + 外摆臂
    add(throttle, G.cyl(0.012, GZ + 0.05, GZ + 0.1, Z).translate(GX + 0.0, 0.3, 0), M.steel);
    thrArm.position.set(GX, 0.3, GZ + 0.095);
    throttle.group.add(thrArm);
    add(throttle, G.rboxAB(-0.015, -0.015, -0.008, 0.2, 0.015, 0.008, 0.006), M.steelDark, { parent: thrArm });
    add(throttle, G.cyl(0.02, -0.012, 0.012, Z), M.steel, { parent: thrArm });
    // 开度刻度弧
    const arc = new THREE.Mesh(new THREE.RingGeometry(0.21, 0.225, 32, 1, -0.6, 1.2), new THREE.MeshBasicMaterial({ color: '#d9ab52', side: THREE.DoubleSide }));
    arc.position.set(GX, 0.3, GZ + 0.09);
    throttle.group.add(arc);
    // 阀箱压力表
    add(throttle, G.cyl(0.008, 0.0, 0.11, { segments: 8 }).rotateZ(-Math.PI / 2).translate(GX - 0.14, 0.4, GZ), M.copper);
    const bez = G.cyl(0.055, -0.02, 0.012, Z);
    const gpos = new V3(GX - 0.19, 0.4, GZ);
    const gauge = new THREE.Group();
    gauge.position.copy(gpos);
    throttle.group.add(gauge);
    add(throttle, bez, M.brass, { parent: gauge });
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.047, 40), new THREE.MeshStandardMaterial({ map: gaugeFaceTexture('bar', 10, 9), roughness: 0.4 }));
    face.position.z = 0.0125;
    gauge.add(face);
    const needle = new THREE.Mesh(G.box(0.003, 0.04, 0.002, 0, 0.017, 0), new THREE.MeshBasicMaterial({ color: '#111' }));
    needle.position.z = 0.015;
    gauge.add(needle);
    chestGauge.needle = needle;
    const glassM = new THREE.Mesh(new THREE.CircleGeometry(0.048, 32), M.glass);
    glassM.position.z = 0.017;
    gauge.add(glassM);
  }

  const gov = parts.add('governor', {
    name: '离心调速器', cat: '调速',
    desc: '瓦特于 1788 年用在蒸汽机上的“自动控制”装置。主轴由曲轴经皮带和伞齿轮带动：转得越快，飞球被离心力甩得越开，套筒上升，经杠杆把节流阀关小；转速下降时则相反。这就是最早的负反馈控制。',
    explode: [0, 0.5, 0.25], anchor: [GX, 1.1, GZ],
    view: { pos: [3.1, 1.25, 1.45], target: [GX, 0.75, GZ] },
  });
  const govSpin = new THREE.Group();
  govSpin.position.set(GX, 0, GZ);
  gov.group.add(govSpin);
  const govArms = [];
  const sleeve = new THREE.Group();
  govSpin.add(sleeve);
  const collar = new THREE.Group();
  collar.position.set(GX, 0, GZ);
  gov.group.add(collar);
  const lever = new THREE.Group();
  gov.group.add(lever);
  const govPul = new THREE.Group();
  govPul.position.set(GX, 0.47, 0);
  gov.group.add(govPul);
  const govRod = new THREE.Mesh(G.cyl(0.007, 0, 1, { segments: 8 }), M.steel);
  govRod.castShadow = true; govRod.userData.partId = 'governor';
  gov.group.add(govRod);
  const YT = 1.08, ARM = GOV.ARM, E0 = 0.028;
  const LEV = { x: GX + 0.15, y: 0.6, left: 0.15, right: 0.08 };
  {
    // 伞齿轮箱
    add(gov, G.rboxAB(GX - 0.065, 0.425, GZ - 0.065, GX + 0.065, 0.52, GZ + 0.11, 0.012), M.green);
    // 水平传动轴 + 轴承 + 皮带轮
    add(gov, G.cyl(0.014, GZ + 0.1, 0.61, Z).translate(GX, 0.47, 0), M.steel);
    add(gov, G.rboxAB(GX - 0.03, 0.43, 0.47, GX + 0.03, 0.51, 0.51, 0.006), M.green);
    add(gov, G.rboxAB(GX - 0.012, 0.3, 0.47, GX + 0.012, 0.44, 0.51, 0.004), M.green);
    // 主轴（旋转）
    add(gov, G.cyl(0.012, 0.5, YT + 0.06), M.steel, { parent: govSpin });
    // 顶部铰接头
    add(gov, G.lathe([[0.02, YT - 0.03], [0.035, YT - 0.02, 1], [0.035, YT + 0.02, 1], [0.02, YT + 0.04], [0.01, YT + 0.08]], { segments: 24 }), M.brass, { parent: govSpin });
    for (let i = 0; i < 2; i++) {
      const side = new THREE.Group();
      side.rotation.y = i * Math.PI;
      govSpin.add(side);
      const up = new THREE.Group();          // 上臂：绕顶部铰点摆动
      up.position.set(E0, YT, 0);
      side.add(up);
      add(gov, G.rboxAB(-0.008, -ARM - 0.02, -0.006, 0.008, 0, 0.006, 0.004), M.steel, { parent: up });
      const ball = G.lathe([[0.0, -0.05], [0.03, -0.042, 1], [0.047, -0.02, 1], [0.05, 0, 1], [0.047, 0.02, 1], [0.03, 0.042, 1], [0, 0.05]], { segments: 32 });
      const bm = add(gov, ball.translate(0, -ARM, 0), M.brass, { parent: up });
      bm.userData.ball = true;
      const low = new THREE.Group();         // 下连杆：连到套筒
      side.add(low);
      add(gov, G.rboxAB(-0.006, 0, -0.005, 0.006, ARM, 0.005, 0.003), M.steel, { parent: low });
      govArms.push({ up, low });
    }
    // 套筒 + 波特式中心重锤
    add(gov, G.tube(0.013, 0.03, -0.02, 0.02), M.steel, { parent: sleeve });
    add(gov, G.lathe([[0.014, -0.105], [0.06, -0.1], [0.075, -0.09, 1], [0.075, -0.045, 1], [0.07, -0.03], [0.014, -0.025]], { segments: 36 }), M.brass, { parent: sleeve });
    // 不转的环槽套
    add(gov, G.tube(0.026, 0.04, -0.012, 0.012), M.steelDark, { parent: collar });
    for (const s of [1, -1]) add(gov, G.cyl(0.006, 0.04, 0.055, Z).rotateY(Math.PI / 2).translate(0, 0, 0), M.steel, { parent: collar }).rotation.y = s > 0 ? 0 : Math.PI;
    // 杠杆（绕支点）
    add(gov, G.rboxAB(-LEV.left, -0.008, -0.012, LEV.right, 0.008, 0.012, 0.004), M.steelDark, { parent: lever });
    add(gov, G.cyl(0.012, -0.02, 0.02, Z), M.steel, { parent: lever });
    lever.position.set(LEV.x, LEV.y, GZ + 0.045);
    // 杠杆支柱
    add(gov, G.rboxAB(LEV.x - 0.012, 0.43, GZ + 0.02, LEV.x + 0.012, LEV.y, GZ + 0.035, 0.004), M.green);
    add(gov, G.rboxAB(GX + 0.06, 0.43, GZ + 0.015, LEV.x + 0.012, 0.455, GZ + 0.04, 0.004), M.green);
  }

  // ---- 皮带 ----
  const belt = parts.add('belt', {
    name: '皮带传动', cat: '调速', desc: '平皮带把曲轴的转动传给调速器，使调速器转速始终与发动机转速成正比。',
    explode: [0, 0, 0.35], anchor: [1.1, 0.35, 0.56], label: false,
  });
  let beltTex;
  {
    const zc = 0.565;
    const c1 = new THREE.Vector2(0, 0), r1 = 0.128;
    const c2 = new THREE.Vector2(GX, 0.47), r2 = 0.1;
    // 皮带轮（调速器端）
    const pul = G.ring(G.roundRect(0.02, r2 - 0.003, 0.53, 0.6, 0.005), { segments: 40, axis: 'z' });
    add(gov, pul, M.iron, { parent: govPul });
    for (let i = 0; i < 3; i++) add(gov, G.box(0.03, 0.01, 0.02).translate(0.055, 0, 0.565).rotateZ(i * Math.PI * 2 / 3), M.iron, { parent: govPul });
    // 开口皮带路径
    const d = c2.clone().sub(c1);
    const dist = d.length();
    const ang = Math.atan2(d.y, d.x);
    const a = Math.acos((r1 - r2) / dist);
    const pts = [];
    const arcPts = (c, r, a0, a1, n) => { for (let i = 0; i <= n; i++) { const t = a0 + (a1 - a0) * i / n; pts.push(new THREE.Vector2(c.x + Math.cos(t) * r, c.y + Math.sin(t) * r)); } };
    arcPts(c1, r1 + 0.004, ang + a, ang + Math.PI * 2 - a, 40);
    arcPts(c2, r2 + 0.004, ang - a, ang + a, 24);
    const ribbon = beltRibbon(pts, zc, 0.05, 0.006);
    beltTex = makeBeltTexture();
    const bmat = new THREE.MeshStandardMaterial({ color: '#7a4a2a', map: beltTex, roughness: 0.75 });
    add(belt, ribbon, bmat);
  }

  // =========================================================================
  // 排汽管、换向阀、排汽立管、冷凝器
  // =========================================================================
  const exhaust = parts.add('exhaust', {
    name: '排汽管', cat: '排汽',
    desc: '做完功的“乏汽”经滑阀空腔、排汽道从缸底排出。非冷凝运行时经立管排入大气——“噗、噗”的排汽声正是每个冲程排汽阀打开的节拍。',
    explode: [0, -0.2, 0.3], anchor: [3.3, 1.5, -1.2],
    view: { pos: [5.4, 2.0, 2.4], target: [3.1, 0.8, -0.6] },
  });
  const exTop = new V3(3.3, 3.3, -1.2);
  {
    const r = 0.052;
    const p = G.pipePath([[GX, -0.14, 0.16], [GX, -0.56, 0.16], [3.3, -0.56, 0.16], [3.3, -0.56, -1.2], [3.3, 3.0, -1.2]], r, 0.16);
    add(exhaust, p.geometry, M.black);
    for (const t of [0.02, 0.24, 0.45, 0.7]) add(exhaust, G.flangeAt(p.curve, t, r, { bolts: 6 }), M.iron);
    // 排汽头（消声器）
    add(exhaust, G.ring([[0.052, 2.9], [0.062, 2.9], [0.075, 3.05, 1], [0.1, 3.18, 1], [0.14, 3.26, 1], [0.15, 3.3], [0.135, 3.3], [0.09, 3.2, 1], [0.065, 3.06, 1], [0.052, 2.95]], { segments: 36 }).translate(3.3, 0, -1.2), M.black);
    // 支架与拉索卡箍
    add(exhaust, G.rboxAB(3.22, -0.8, 0.08, 3.38, -0.6, 0.24, 0.01), M.green);
    add(exhaust, G.rboxAB(3.2, -0.8, -1.3, 3.4, -0.62, -1.1, 0.01), M.green);
    add(exhaust, G.tube(r, r + 0.015, 2.0, 2.05).translate(3.3, 0, -1.2), M.iron);
    // 冷凝器切换阀
    add(exhaust, G.lathe([[0.09, -0.07], [0.1, -0.05, 1], [0.1, 0.05, 1], [0.09, 0.07]], { segments: 28 }).rotateZ(Math.PI / 2).translate(3.3, -0.56, 0.16), M.green);
  }
  const condenser = parts.add('condenser', {
    name: '冷凝器', cat: '排汽',
    desc: '瓦特最重要的发明——分离式冷凝器。乏汽在冷水管外凝结成水，体积缩小上千倍，形成约 0.2 bar 的真空。活塞背面的阻力由 1.06 bar 降到 0.2 bar，同样的蒸汽能多做约 20% 的功。',
    explode: [0.4, 0, 0.3], anchor: [4.2, 0.05, -0.45],
    view: { pos: [5.6, 1.1, 1.8], target: [4.0, -0.3, -0.4] },
  });
  const vacNeedle = { needle: null };
  {
    const cx0 = 3.65, cx1 = 4.75, cy = -0.35, cz = -0.45, cr = 0.28;
    const shell = G.lathe([[0.0, cx0 - 0.06], [cr * 0.8, cx0 - 0.05, 1], [cr, cx0, 1], [cr, cx1], [cr * 0.8, cx1 + 0.05, 1], [0, cx1 + 0.06]], { segments: 48, axis: 'x' });
    add(condenser, shell.translate(0, cy, cz), M.green);
    for (const x of [cx0 + 0.05, cx1 - 0.05]) add(condenser, G.tube(cr, cr + 0.02, x - 0.02, x + 0.02, { axis: 'x', segments: 48 }).translate(0, cy, cz), M.green);
    for (const x of [cx0 + 0.18, cx1 - 0.18]) {
      add(condenser, G.rboxAB(x - 0.05, D.FLOOR_Y, cz - 0.24, x + 0.05, cy - 0.15, cz + 0.24, 0.01), M.green);
    }
    const p = G.pipePath([[3.3, -0.56, 0.16], [3.5, -0.56, 0.16], [3.5, -0.56, cz], [3.5, cy, cz], [3.6, cy, cz]], 0.05, 0.1);
    add(condenser, p.geometry, M.black);
    // 冷却水管
    const w1 = G.pipePath([[4.3, cy + cr, cz], [4.3, 0.35, cz], [4.3, 0.35, cz - 0.9]], 0.03, 0.1);
    add(condenser, w1.geometry, M.copper);
    const w2 = G.pipePath([[4.0, cy - cr, cz], [4.0, D.FLOOR_Y + 0.08, cz], [4.0, D.FLOOR_Y + 0.08, cz - 0.9]], 0.03, 0.1);
    add(condenser, w2.geometry, M.copper);
    // 真空表
    const gauge = new THREE.Group();
    gauge.position.set(3.9, 0.02, cz + 0.02);
    condenser.group.add(gauge);
    add(condenser, G.cyl(0.008, cy + cr - 0.02, 0.0, { segments: 8 }).translate(3.9, 0, cz), M.copper);
    add(condenser, G.cyl(0.07, -0.02, 0.012, Z), M.brass, { parent: gauge });
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.06, 40), new THREE.MeshStandardMaterial({ map: gaugeFaceTexture('vac', 10, 11), roughness: 0.4 }));
    face.position.z = 0.013;
    gauge.add(face);
    const needle = new THREE.Mesh(G.box(0.004, 0.05, 0.002, 0, 0.022, 0), new THREE.MeshBasicMaterial({ color: '#111' }));
    needle.position.z = 0.016;
    gauge.add(needle);
    vacNeedle.needle = needle;
  }

  // 剖视气缸时，隐藏位于剖切面上方、会挡住视线的部件
  for (const p of [throttle, gov, belt]) parts.hideInSection('engine', p.root);

  // =========================================================================
  // 剖视专用：气体着色区域（位于剖切面略下方）
  // =========================================================================
  const gas = buildGasFills(parts);

  // 流动粒子路径（剖切面上）
  const yP = 0.012;
  const P = (x, z) => new V3(x, yP, z);
  const ceX = (D.CE_PORT_X0 + D.CE_PORT_X1) / 2, heX = (D.HE_PORT_X0 + D.HE_PORT_X1) / 2;
  const flowPaths = {
    ceIn: [P(ceX - 0.03, 0.3), P(ceX, 0.2), P(ceX, 0.155), P(1.925, 0.155), P(1.925, 0.09), P(1.97, 0.02)],
    heIn: [P(heX + 0.03, 0.3), P(heX, 0.2), P(heX, 0.155), P(2.575, 0.155), P(2.575, 0.09), P(2.53, 0.02)],
    ceOut: [P(1.97, -0.02), P(1.925, 0.09), P(1.925, 0.155), P(ceX, 0.155), P(ceX, 0.205), P(2.22, 0.212), P(GX, 0.19), P(GX, 0.14)],
    heOut: [P(2.53, -0.02), P(2.575, 0.09), P(2.575, 0.155), P(heX, 0.155), P(heX, 0.205), P(2.28, 0.212), P(GX, 0.19), P(GX, 0.14)],
  };

  // 力箭头
  const arrow = makeArrow();
  arrow.position.set(1.6, 0.3, 0);
  parts.scene.add(arrow);

  // =========================================================================
  // 每帧更新
  // =========================================================================
  const tmp = new V3();
  function update(o, dt, time) {
    const th = o.theta;
    const xh = crossheadX(th);
    const R = D.R;
    crankRot.rotation.z = th;
    eccRot.rotation.z = th;
    fly.group.rotation.z = th;
    const px = R * Math.cos(th), py = R * Math.sin(th);
    rod.group.position.set(px, py, 0);
    rod.group.rotation.z = Math.atan2(-py, xh - px);
    xhead.group.position.x = xh;
    piston.group.position.x = xh + D.ROD;
    const e = eccentricCenter(th);
    const kx = valveKnuckleX(th);
    eccRodG.position.set(e.x, e.y, 0);
    eccRodG.rotation.z = Math.atan2(-e.y, kx - e.x);
    const u = valveU(th);
    valve.group.position.x = u;

    // 调速器
    const phi = o.phi;
    govSpin.rotation.y = o.govAngle;
    const ys = YT - 2 * ARM * Math.cos(phi);
    for (const a of govArms) {
      a.up.rotation.z = phi;
      const bx = E0 + ARM * Math.sin(phi), by = YT - ARM * Math.cos(phi);
      a.low.position.set(E0, ys, 0);
      a.low.rotation.z = -Math.atan2(bx - E0, by - ys);
    }
    sleeve.position.y = ys;
    const yc = ys - 0.12;
    collar.position.y = yc;
    const beta = Math.asin(THREE.MathUtils.clamp((yc - LEV.y) / LEV.left, -0.9, 0.9));
    lever.rotation.z = -beta;
    const rex = LEV.x + LEV.right * Math.cos(beta), rey = LEV.y - LEV.right * Math.sin(beta);
    // 节流阀臂：长 0.2，支点 (GX, 0.3)
    const armEndY = rey - 0.31;
    const gam = Math.asin(THREE.MathUtils.clamp((armEndY - 0.3) / 0.2, -0.9, 0.9));
    thrArm.rotation.z = gam;
    const ax = GX + 0.2 * Math.cos(gam), ay = 0.3 + 0.2 * Math.sin(gam);
    const a0 = new V3(ax, ay, GZ + 0.095), a1 = new V3(rex, rey, GZ + 0.045);
    govRod.position.copy(a0);
    tmp.copy(a1).sub(a0);
    govRod.scale.set(1, tmp.length(), 1);
    govRod.quaternion.setFromUnitVectors(new V3(0, 1, 0), tmp.normalize());
    // 调速器皮带轮
    govPul.rotation.z = th * (0.128 / 0.1);
    if (beltTex) beltTex.offset.x = -(th * 0.128) / 0.6;

    // 仪表
    chestGauge.needle.rotation.z = needleAngle(Math.max(0, (o.pCh - 1.013e5) / 1e5), 10);
    const vac = Math.max(0, (1.013e5 - o.pEx) / 1e5) * 10;
    vacNeedle.needle.rotation.z = needleAngle(vac, 10);

    // 气体着色
    gas.update(o, xh + D.ROD, u);

    // 力箭头
    arrow.userData.set(o.force, xh);
  }

  return {
    update, flowPaths, arrow, gas, exTop,
    parts: { crank, fly, rod, xhead, piston, valve, gov },
  };
}

/** 表盘指针角：刻度从左下 (135°) 顺时针到右下 (405°) */
export function needleAngle(v, max) {
  const a = 0.75 * Math.PI + THREE.MathUtils.clamp(v / max, 0, 1.05) * 1.5 * Math.PI;
  return -a - Math.PI / 2;
}

// ---------------------------------------------------------------------------
// 剖视中的气体着色（压力 → 颜色）
// ---------------------------------------------------------------------------
export function pressureColor(p, out = new THREE.Color()) {
  // 0.2 bar（真空）→ 深蓝；1 bar → 蓝；4 bar → 黄；8 bar → 红
  const bar = p / 1e5;
  const stops = [
    [0.15, '#3446d6'], [1.0, '#2f9bff'], [2.2, '#26c2b0'], [4.0, '#f2d13a'], [6.0, '#ff8a2a'], [8.2, '#ff3b2f'],
  ];
  if (bar <= stops[0][0]) return out.set(stops[0][1]);
  for (let i = 1; i < stops.length; i++) {
    if (bar <= stops[i][0]) {
      const t = (bar - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      return out.set(stops[i - 1][1]).lerp(new THREE.Color(stops[i][1]), t);
    }
  }
  return out.set(stops[stops.length - 1][1]);
}

function buildGasFills(parts) {
  const grp = new THREE.Group();
  parts.scene.add(grp);
  parts.sectionOnlyObj('engine', grp);
  const mk = (shapePts, y) => {
    const s = new THREE.Shape(shapePts.map(([x, z]) => new THREE.Vector2(x, z)));
    const g = new THREE.ShapeGeometry(s);
    g.rotateX(Math.PI / 2);
    g.translate(0, y, 0);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#888', side: THREE.DoubleSide, toneMapped: false, transparent: true, opacity: 0.96, depthWrite: false }));
    m.renderOrder = 2;
    grp.add(m);
    return m;
  };
  const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const br = D.BORE_R - 0.001;
  const heCh = mk(rect(0, -br, 1, br), -0.004);
  const ceCh = mk(rect(0, -br, 1, br), -0.004);
  const fz = D.FACE_Z;
  const cePass = mk([[D.BORE_X0, 0.1], [D.BORE_X0 + 0.03, 0.1], [D.BORE_X0 + 0.03, 0.14], [D.CE_PORT_X1, 0.14], [D.CE_PORT_X1, fz], [D.CE_PORT_X0, fz], [D.CE_PORT_X0, 0.17], [D.BORE_X0, 0.17]], -0.004);
  const hePass = mk([[D.BORE_X1, 0.1], [D.BORE_X1 - 0.03, 0.1], [D.BORE_X1 - 0.03, 0.14], [D.HE_PORT_X0, 0.14], [D.HE_PORT_X0, fz], [D.HE_PORT_X1, fz], [D.HE_PORT_X1, 0.17], [D.BORE_X1, 0.17]], -0.004);
  const chest = mk(rect(2.03, fz, 2.47, 0.38), -0.006);
  const exPort = mk(rect(D.EXH_X0, 0.13, D.EXH_X1, fz), -0.004);
  const cav = mk(rect(D.CAV_X0, fz, D.CAV_X1, 0.226), -0.003);
  const c = new THREE.Color();
  return {
    group: grp,
    update(o, xp, u) {
      const t2 = D.PISTON_T / 2;
      const heX0 = xp + t2, ceX1 = xp - t2;
      heCh.scale.x = Math.max(0.001, D.BORE_X1 - heX0); heCh.position.x = heX0;
      ceCh.scale.x = Math.max(0.001, ceX1 - D.BORE_X0); ceCh.position.x = D.BORE_X0;
      pressureColor(o.pHE, heCh.material.color); hePass.material.color.copy(heCh.material.color);
      pressureColor(o.pCE, ceCh.material.color); cePass.material.color.copy(ceCh.material.color);
      pressureColor(o.pCh, chest.material.color);
      pressureColor(o.pEx, exPort.material.color); cav.material.color.copy(exPort.material.color);
      cav.position.x = u;
    },
  };
}

// ---------------------------------------------------------------------------
function beltRibbon(pts2, zc, width, thick) {
  // 闭合平皮带：沿路径生成外/内表面与两个侧边
  const n = pts2.length;
  const pos = [], nor = [], uv = [], idx = [];
  let acc = 0;
  const ring = [];
  for (let i = 0; i <= n; i++) {
    const p = pts2[i % n], q = pts2[(i + 1) % n], o = pts2[(i - 1 + n) % n];
    const t = q.clone().sub(o).normalize();
    const nrm = new THREE.Vector2(t.y, -t.x);
    if (i > 0) acc += p.distanceTo(pts2[(i - 1) % n]);
    ring.push({ p, nrm, acc });
  }
  const verts = (off, zSign, nx, ny, nz, v) => {
    for (const r of ring) {
      pos.push(r.p.x + r.nrm.x * off, r.p.y + r.nrm.y * off, zc + zSign * width / 2);
      nor.push(nx === null ? r.nrm.x * ny : nx, nx === null ? r.nrm.y * ny : ny, nz);
      uv.push(r.acc / 0.6, v);
    }
  };
  const quads = (a, b) => {
    for (let i = 0; i < n; i++) {
      const i0 = a + i, i1 = a + i + 1, j0 = b + i, j1 = b + i + 1;
      idx.push(i0, j0, i1, i1, j0, j1);
    }
  };
  const S = ring.length;
  // 外表面（两排：z-, z+）
  verts(thick, -1, null, 1, 0, 0); verts(thick, 1, null, 1, 0, 1);
  // 内表面
  verts(0, -1, null, -1, 0, 0); verts(0, 1, null, -1, 0, 1);
  // 侧边
  verts(thick, 1, 0, 0, 1, 0); verts(0, 1, 0, 0, 1, 1);
  verts(thick, -1, 0, 0, -1, 0); verts(0, -1, 0, 0, -1, 1);
  quads(0, S); quads(3 * S, 2 * S); quads(5 * S, 4 * S); quads(6 * S, 7 * S);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return G.clean(g);
}

function makeBeltTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#9a6a42'; g.fillRect(0, 0, 256, 32);
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(60,30,10,${Math.random() * 0.15})`; g.fillRect(Math.random() * 256, Math.random() * 32, 3, 1); }
  // 皮带接头（明显标记，便于看出运动）
  g.fillStyle = '#3a2412'; g.fillRect(120, 0, 16, 32);
  g.fillStyle = '#c9a060';
  for (let y = 4; y < 32; y += 7) { g.fillRect(122, y, 3, 3); g.fillRect(131, y, 3, 3); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** 活塞推力箭头 */
function makeArrow() {
  const grp = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: '#ffcf4a', toneMapped: false, transparent: true, opacity: 0.95, depthTest: false });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 12), mat);
  shaft.rotation.z = Math.PI / 2;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 16), mat);
  grp.add(shaft, head);
  grp.renderOrder = 10;
  shaft.renderOrder = head.renderOrder = 10;
  grp.userData.set = (F, xh) => {
    // F：沿 +x 的合力（N）。长度按 40 kN = 0.8 m
    const len = Math.min(0.55, Math.abs(F) / 40000 * 0.5);
    const dir = F >= 0 ? 1 : -1;
    shaft.scale.y = Math.max(0.001, len);
    shaft.position.x = dir * (len / 2 - 0.3);
    head.position.x = dir * (len - 0.3 + 0.05);
    head.rotation.z = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    grp.position.x = xh + 0.05;
    mat.color.set(dir < 0 ? '#ffcf4a' : '#7fd1ff');
    grp.userData.F = F;
  };
  return grp;
}
