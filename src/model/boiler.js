// ---------------------------------------------------------------------------
// 机车式火管锅炉：外火箱、内火箱（铜）、炉排与炉火、火管、汽包、烟箱与烟囱、
// 安全阀、汽笛、压力表、水位计、主汽阀、主蒸汽管
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import * as G from '../geo.js';
import { M, CUT, gaugeFaceTexture } from '../materials.js';
import { needleAngle } from './engine.js';
import { makeFireMaterial } from '../fx.js';

const V3 = THREE.Vector3;

export const BOILER = {
  Z: -3.1, Y: 0.2, R: 0.58,            // 锅筒轴线 z、y，外半径
  X0: -1.45, XF: -0.12, X1: 2.45, XS: 3.15,  // 火箱后板、火箱前、烟箱管板、烟箱前
  DX: 1.0,                              // 汽包 x
  CX: 2.8,                              // 烟囱 x
  WATER_Y: 0.5,
};

export function buildBoiler(parts) {
  const B = BOILER;
  const ZB = B.Z, YB = B.Y, RB = B.R, T = 0.018;
  const FY = -0.8;
  const plane = new THREE.Plane(new V3(0, 0, 1), -ZB);   // 剖切：去掉 z > ZB（前半）
  const section = (m, cut) => parts.sectionable('boiler', m, plane, cut);
  const add = (p, g, m, o) => parts.mesh(p, g, m, o);
  const at = (g) => g.translate(0, YB, ZB);   // 以锅筒轴线为参考

  // =========================================================================
  // 锅炉本体（外壳）
  // =========================================================================
  const boiler = parts.add('boiler', {
    name: '锅炉（机车式火管锅炉）', cat: '锅炉',
    desc: '燃料在火箱中燃烧，高温烟气经过浸在水中的几十根火管流向烟箱，把热量传给周围的水。水沸腾产生的饱和蒸汽聚集在水面上方的汽空间和汽包里，压力约 7 bar（温度约 170 °C）。',
    explode: [0, 0, -0.6], anchor: [0.9, 0.85, ZB + 0.4],
    view: { pos: [2.4, 1.6, -0.2], target: [0.8, 0.3, ZB] },
  });
  let barrel, wrapper, smokebox;
  {
    // 锅筒：带汽包开孔
    barrel = G.tube(RB - T, RB, B.XF - 0.02, B.X1, { axis: 'x', segments: 72 });
    at(barrel);
    barrel = G.subtract(barrel, [G.cyl(0.2, 0.3, 1.2, { segments: 32 }).translate(B.DX, 0, ZB)]);
    const bm = add(boiler, barrel, M.maroon);
    section(bm, CUT.plate);

    // 外火箱（圆顶）
    const outer = G.union(
      G.boxAB(B.X0, -0.62, ZB - RB - 0.02, B.XF, YB, ZB + RB + 0.02),
      [G.cyl(RB + 0.02, B.X0, B.XF, { axis: 'x', segments: 72 }).translate(0, YB, ZB)],
    );
    const inner = G.union(
      G.boxAB(B.X0 + T, -0.6, ZB - RB + T, B.XF + 0.05, YB, ZB + RB - T),
      [G.cyl(RB + 0.02 - T, B.X0 + T, B.XF + 0.05, { axis: 'x', segments: 72 }).translate(0, YB, ZB)],
    );
    wrapper = G.subtract(outer, [
      inner,
      G.boxAB(-1.36, -0.7, ZB - 0.48, -0.22, -0.55, ZB + 0.48),               // 炉排口（通灰坑）
      G.cyl(0.13, B.X0 - 0.05, B.X0 + 0.1, X_).translate(0, -0.18, ZB),         // 炉门口
    ]);
    const wm = add(boiler, wrapper, M.black);
    section(wm, CUT.plate);
    // 底圈（火箱底部连接内外火箱的“基础圈”）
    let ring = G.boxAB(B.X0 + T, -0.62, ZB - RB + T, -0.2, -0.5, ZB + RB - T);
    ring = G.subtract(ring, [G.boxAB(-1.375, -0.7, ZB - 0.495, -0.205, -0.4, ZB + 0.495)]);
    const rm = add(boiler, ring, M.iron);
    section(rm, CUT.iron);
    // 炉门圈
    const fh = G.tube(0.1, 0.13, B.X0 - 0.03, -1.36, { axis: 'x', segments: 36 }).translate(0, -0.18, ZB);
    const fhm = add(boiler, fh, M.iron);
    section(fhm, CUT.iron);

    // 烟箱
    smokebox = G.tube(RB, RB + 0.03, B.X1, B.XS, { axis: 'x', segments: 72 });
    at(smokebox);
    const sm = add(boiler, smokebox, M.soot);
    section(sm, CUT.iron);
    const front = G.tube(RB - 0.02, RB + 0.055, B.XS - 0.02, B.XS + 0.015, { axis: 'x', segments: 72 });
    at(front);
    const fm = add(boiler, front, M.black);
    section(fm, CUT.iron);
    // 烟箱管板
    let tp = G.cyl(RB - T, B.X1 - 0.02, B.X1, { axis: 'x', segments: 64 });
    at(tp);
    const tpm = add(boiler, tp, M.iron);
    section(tpm, CUT.plate);
    // 烟箱门
    const door = G.lathe([[RB + 0.03, B.XS + 0.015], [RB + 0.01, B.XS + 0.04, 1], [0.48, B.XS + 0.08, 1], [0.32, B.XS + 0.105, 1], [0.12, B.XS + 0.118, 1], [0.0, B.XS + 0.12]], { axis: 'x', segments: 64 });
    at(door);
    const dm = add(boiler, door, M.black);
    section(dm, CUT.iron);
    // 门把手 + 铰链
    add(boiler, G.cyl(0.02, B.XS + 0.12, B.XS + 0.2, { axis: 'x', segments: 12 }).translate(0, YB, ZB), M.steel);
    add(boiler, G.box(0.03, 0.02, 0.3).translate(B.XS + 0.2, YB, ZB), M.steel);
    for (const dy of [0.28, -0.28]) add(boiler, G.boxAB(B.XS + 0.05, YB + dy - 0.03, ZB - 0.66, B.XS + 0.1, YB + dy + 0.03, ZB + 0.3), M.black);

    // 包带（黄铜）
    const bands = [0.35, 0.95, 1.55, 2.15].map((x) => at(G.tube(RB, RB + 0.012, x - 0.02, x + 0.02, { axis: 'x', segments: 72 })));
    let bandG = G.mergeGeometries(bands);
    bandG = G.subtract(bandG, [G.cyl(0.24, 0.3, 1.3, { segments: 32 }).translate(B.DX, 0, ZB)]);
    const bdm = add(boiler, bandG, M.brass);
    section(bdm, CUT.brass);

    // 铆钉（前半/后半分开，剖视时只隐藏前半）
    const rivet = new THREE.SphereGeometry(0.011, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
    const front$ = [], back$ = [];
    const put = (p, n) => {
      const m = new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), n), new V3(1, 1, 1));
      (p.z > ZB + 0.01 ? front$ : back$).push(m);
    };
    // 锅筒环缝
    for (const x of [-0.05, 0.65, 1.3, 1.85, 2.4]) {
      for (let i = 0; i < 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        const n = new V3(0, Math.cos(a), Math.sin(a));
        for (const dx of [-0.018, 0.018]) put(new V3(x + dx, YB + n.y * RB, ZB + n.z * RB), n);
      }
    }
    // 锅筒纵缝（右侧）
    for (let x = -0.03; x < 2.4; x += 0.05) {
      const a = 0.9;
      const n = new V3(0, Math.cos(a), Math.sin(a));
      put(new V3(x, YB + n.y * RB, ZB + n.z * RB), n);
    }
    // 外火箱：侧板拉撑螺栓头（方阵）
    for (let x = B.X0 + 0.1; x < B.XF - 0.05; x += 0.1) {
      for (let y = -0.52; y < YB; y += 0.1) {
        put(new V3(x, y, ZB + RB + 0.02), new V3(0, 0, 1));
        put(new V3(x, y, ZB - RB - 0.02), new V3(0, 0, -1));
      }
    }
    // 烟箱前环
    for (let i = 0; i < 56; i++) {
      const a = (i / 56) * Math.PI * 2;
      put(new V3(B.XS + 0.017, YB + Math.cos(a) * (RB + 0.03), ZB + Math.sin(a) * (RB + 0.03)), new V3(1, 0, 0));
    }
    const mkInst = (list) => {
      const im = new THREE.InstancedMesh(rivet, M.black, list.length);
      list.forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = false; im.receiveShadow = true;
      im.userData.partId = 'boiler';
      boiler.group.add(im);
      return im;
    };
    const rf = mkInst(front$);
    mkInst(back$);
    parts.hideInSection('boiler', rf);

    // 支座：火箱灰坑座、中部支架、烟箱砖墩
    const sup = [
      [G.boxAB(B.X0 - 0.02, FY, ZB - RB - 0.04, -0.15, -0.62, ZB + RB + 0.04), M.brick, CUT.iron],
      [G.boxAB(2.55, FY, ZB - 0.5, 3.05, YB - 0.62, ZB + 0.5), M.brick, CUT.iron],
      [G.subtract(G.rboxAB(2.53, YB - 0.66, ZB - 0.55, 3.07, YB - 0.4, ZB + 0.55, 0.01), [at(G.cyl(RB + 0.03, 2.4, 3.2, { axis: 'x', segments: 64 }))]), M.black, CUT.iron],
      [G.boxAB(1.15, FY, ZB - 0.35, 1.55, YB - 0.62, ZB + 0.35), M.brick, CUT.iron],
      [G.subtract(G.rboxAB(1.12, YB - 0.66, ZB - 0.42, 1.58, YB - 0.45, ZB + 0.42, 0.01), [at(G.cyl(RB, 1.0, 1.7, { axis: 'x', segments: 64 }))]), M.black, CUT.iron],
    ];
    for (const [g, m, c] of sup) section(add(boiler, g, m), c);
    // 灰坑前的风门（发红光的缝）
    const slitMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff7a2a').multiplyScalar(3.2), toneMapped: true });
    slitMat.userData.shared = true;
    const slit = new THREE.Mesh(G.boxAB(-1.25, -0.72, ZB + RB + 0.04, -0.35, -0.69, ZB + RB + 0.045), slitMat);
    boiler.group.add(slit);
    boiler.slitMat = slitMat;
  }

  // =========================================================================
  // 内火箱 / 炉排 / 炉火 / 火管（剖视可见）
  // =========================================================================
  const firebox = parts.add('firebox', {
    name: '火箱与炉排', cat: '锅炉',
    desc: '煤在炉排上燃烧，火焰温度可达 1000 °C 以上。内火箱四周（除底部）都被水包围——铜板导热好，把辐射热直接传给水。耐火砖拱让火焰在箱内绕行，烧得更完全。',
    explode: [0, 0, 0], anchor: [-0.8, 0.1, ZB],
    view: { pos: [-0.2, 0.55, -1.2], target: [-0.8, 0.0, ZB] },
  });
  const fireMat = makeFireMaterial();
  const fireGroup = new THREE.Group();
  firebox.group.add(fireGroup);
  const fireLight = new THREE.PointLight('#ff7a30', 0, 3.2, 1.6);
  fireLight.position.set(-0.8, -0.2, ZB);
  firebox.group.add(fireLight);
  parts.sectionOnlyObj('boiler', fireLight);
  {
    // 内火箱（铜，底部开口）
    let ib = G.boxAB(-1.375, -0.5, ZB - 0.495, -0.205, 0.415, ZB + 0.495);
    ib = G.subtract(ib, [
      G.boxAB(-1.36, -0.6, ZB - 0.48, -0.22, 0.4, ZB + 0.48),
      G.cyl(0.1, B.X0 - 0.05, -1.2, X_).translate(0, -0.18, ZB),
    ]);
    const ibm = add(firebox, ib, M.copper);
    section(ibm, CUT.brass);
    // 炉排
    const bars = [];
    for (let z = -0.46; z <= 0.0; z += 0.045) bars.push(G.boxAB(-1.36, -0.53, ZB + z - 0.012, -0.22, -0.5, ZB + z + 0.012));
    const grate = new THREE.Mesh(G.mergeGeometries(bars), M.iron);
    grate.userData.partId = 'firebox';
    firebox.group.add(grate);
    parts.sectionOnlyObj('boiler', grate);
    // 耐火砖拱
    const arch = new THREE.Mesh(G.clean(new THREE.BoxGeometry(0.7, 0.07, 0.48)).rotateZ(-0.22).translate(-0.55, -0.25, ZB - 0.24), M.firebrick);
    arch.userData.partId = 'firebox';
    firebox.group.add(arch);
    parts.sectionOnlyObj('boiler', arch);
    // 燃烧的煤层（发光）
    const emberMat = new THREE.MeshStandardMaterial({ color: '#2a1206', emissive: '#ff5a14', emissiveIntensity: 1.4, roughness: 0.9, flatShading: true });
    emberMat.userData.shared = true;
    const coal = new THREE.DodecahedronGeometry(0.045, 0);
    const emb = new THREE.InstancedMesh(coal, emberMat, 140);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 140; i++) {
      const s = 0.6 + Math.random() * 0.8;
      m4.compose(
        new V3(-1.33 + Math.random() * 1.08, -0.47 + Math.random() * 0.05, ZB - 0.46 + Math.random() * 0.46),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, 0)),
        new V3(s, s * 0.7, s),
      );
      emb.setMatrixAt(i, m4);
    }
    fireGroup.add(emb);
    // 火焰（着色器片）
    for (let i = 0; i < 7; i++) {
      const w = 0.35 + Math.random() * 0.25;
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.55), fireMat);
      pl.position.set(-1.25 + i * 0.16, -0.2, ZB - 0.05 - (i % 3) * 0.13);
      pl.renderOrder = 5;
      fireGroup.add(pl);
    }
    parts.sectionOnlyObj('boiler', fireGroup);

    // 火管（只建后半，前半剖视时本就被剖掉）
    const tubes = [];
    const tubePos = [];
    for (let y = -0.24; y <= 0.36; y += 0.12) {
      for (const dz of [-0.07, -0.21, -0.35]) {
        const dy = y - YB;
        if (Math.hypot(dy, dz) > 0.48) continue;
        tubes.push(G.cyl(0.028, -0.205, B.X1 - 0.02, { axis: 'x', segments: 14 }).translate(0, y, ZB + dz));
        tubePos.push([y, ZB + dz]);
      }
    }
    const tubesM = new THREE.Mesh(G.mergeGeometries(tubes), M.steelDark);
    tubesM.userData.partId = 'firebox';
    firebox.group.add(tubesM);
    parts.sectionOnlyObj('boiler', tubesM);
    firebox.tubePos = tubePos;

    // 水（只做剖视后的后半）
    const waterMat = M.water;
    const wCut = new THREE.MeshStandardMaterial({ color: '#2f7fcf', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide });
    wCut.userData.shared = true;
    waterMat.userData.shared = true;
    let water = G.union(
      G.cyl(RB - T - 0.002, B.XF - 0.1, B.X1 - 0.022, { axis: 'x', segments: 64 }).translate(0, YB, ZB),
      [G.boxAB(B.X0 + T + 0.002, -0.5, ZB - RB + T + 0.002, B.XF, YB, ZB + RB - T - 0.002),
        G.cyl(RB + 0.018 - T, B.X0 + T + 0.002, B.XF, { axis: 'x', segments: 64 }).translate(0, YB, ZB)],
    );
    water = G.intersect(water, [G.boxAB(-2, -0.5, ZB - 1, 3, B.WATER_Y, ZB + 1)]);
    water = G.subtract(water, [G.boxAB(-1.376, -0.6, ZB - 0.496, -0.204, 0.416, ZB + 0.496)]);
    const wg = G.sectionGeometry(water, plane);
    const wm = new THREE.Mesh(wg, [waterMat, wCut]);
    wm.renderOrder = 3;
    firebox.group.add(wm);
    parts.sectionOnlyObj('boiler', wm);
    // 汽包内的集汽管
    const dp = new THREE.Mesh(G.cyl(0.04, YB + 0.5, YB + 0.95, { segments: 20 }).translate(B.DX, 0, ZB - 0.02), M.copper);
    firebox.group.add(dp);
    parts.sectionOnlyObj('boiler', dp);

    // 炉门（半开）+ 炉口光
    const doorPivot = new THREE.Group();
    doorPivot.position.set(B.X0 - 0.035, -0.18, ZB + 0.16);
    doorPivot.rotation.y = -0.9;
    firebox.group.add(doorPivot);
    add(firebox, G.rboxAB(-0.02, -0.15, -0.32, 0.0, 0.15, 0.0, 0.01), M.black, { parent: doorPivot });
    add(firebox, G.box(0.03, 0.02, 0.08, -0.03, 0, -0.26), M.steel, { parent: doorPivot });
    const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff8a3a').multiplyScalar(2.6) });
    glowMat.userData.shared = true;
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.1, 28), glowMat);
    glow.rotation.y = -Math.PI / 2;
    glow.position.set(B.X0 - 0.02, -0.18, ZB);
    firebox.group.add(glow);
    firebox.glowMat = glowMat;
    const fdLight = new THREE.PointLight('#ff8a3a', 1.2, 3.5, 1.8);
    fdLight.position.set(B.X0 - 0.35, -0.2, ZB + 0.1);
    firebox.group.add(fdLight);
    firebox.fdLight = fdLight;
  }

  // =========================================================================
  // 汽包、烟囱、安全阀、汽笛
  // =========================================================================
  const dome = parts.add('dome', {
    name: '汽包（汽室）', cat: '锅炉',
    desc: '锅筒顶部的圆顶，是整个锅炉的最高点。蒸汽从这里引出，离沸腾的水面最远，带出的水滴最少（“干蒸汽”）。主汽阀装在汽包顶上。',
    explode: [0, 0.55, 0], anchor: [B.DX, YB + 1.0, ZB],
    view: { pos: [2.2, 1.9, -1.2], target: [B.DX, 0.9, ZB] },
  });
  {
    const h0 = YB + 0.4;
    const shell = [
      [0.282, h0], [0.3, h0], [0.32, h0 + 0.1, 1], [0.27, h0 + 0.22], [0.27, h0 + 0.32, 1], [0.25, h0 + 0.4, 1],
      [0.21, h0 + 0.47, 1], [0.14, h0 + 0.515, 1], [0.07, h0 + 0.53, 1], [0, h0 + 0.535],
      [0, h0 + 0.517], [0.068, h0 + 0.512, 1], [0.13, h0 + 0.497, 1], [0.195, h0 + 0.455, 1], [0.232, h0 + 0.39, 1],
      [0.252, h0 + 0.32, 1], [0.252, h0 + 0.22], [0.302, h0 + 0.1, 1],
    ];
    let domeG = G.ring(shell, { segments: 56 }).translate(B.DX, 0, ZB);
    domeG = G.subtract(domeG, [G.cyl(RB - 0.002, -0.6, 2.6, { axis: 'x', segments: 72 }).translate(0, YB, ZB)]);
    const dm = add(dome, domeG, M.brass);
    section(dm, CUT.brass);
  }
  const chimney = parts.add('chimney', {
    name: '烟囱', cat: '锅炉',
    desc: '烟囱产生“抽力”：管内热烟气比外面的冷空气轻，向上流动，把新鲜空气从灰坑经炉排吸入火箱，维持燃烧。烟囱越高，抽力越大。',
    explode: [0, 0.8, 0], anchor: [B.CX, 3.2, ZB],
    view: { pos: [4.6, 2.9, -0.5], target: [B.CX, 2.1, ZB] },
  });
  {
    const y0 = YB + 0.35;
    const outer = [
      [0.3, y0], [0.3, y0 + 0.3], [0.26, y0 + 0.36, 1], [0.19, y0 + 0.45, 1], [0.165, y0 + 0.6], [0.15, 4.25],
      [0.18, 4.28, 1], [0.22, 4.36, 1], [0.23, 4.42], [0.2, 4.44],
    ];
    const g = G.ring([[0.13, y0]].concat(outer, [[0.13, 4.44]]), { segments: 56 });
    g.translate(B.CX, 0, ZB);
    const ch = G.subtract(g, [G.cyl(RB + 0.029, 2.3, 3.4, { axis: 'x', segments: 72 }).translate(0, YB, ZB)]);
    const cm = add(chimney, ch, M.black);
    section(cm, CUT.iron);
    // 铜顶
    const cap = G.ring([[0.165, 4.24], [0.18, 4.24], [0.235, 4.36, 1], [0.24, 4.45], [0.2, 4.46], [0.165, 4.3]], { segments: 56 }).translate(B.CX, 0, ZB);
    const cpm = add(chimney, cap, M.copper);
    section(cpm, CUT.brass);
  }
  const safety = parts.add('safety', {
    name: '安全阀', cat: '锅炉',
    desc: '弹簧压住阀芯。锅炉压力一旦超过整定值（9 bar），蒸汽顶开阀芯喷出，防止锅炉爆炸——早期锅炉爆炸事故频发，安全阀是最重要的保命装置。',
    explode: [0, 0.4, 0], anchor: [-0.75, YB + 0.95, ZB],
    view: { pos: [0.6, 1.6, -1.7], target: [-0.75, 0.9, ZB] },
  });
  const safetyTop = new V3(-0.75, YB + 0.98, ZB);
  {
    const x = -0.75, y0 = YB + RB;
    const body = G.lathe([[0.09, y0 - 0.05], [0.09, y0 + 0.02], [0.06, y0 + 0.04], [0.055, y0 + 0.15, 1], [0.07, y0 + 0.17], [0.07, y0 + 0.2], [0.04, y0 + 0.22]], { segments: 36 }).translate(x, 0, ZB);
    add(safety, body, M.brass);
    // 弹簧
    const pts = [];
    for (let i = 0; i <= 120; i++) { const t = i / 120; pts.push(new V3(Math.cos(t * Math.PI * 14) * 0.035, y0 + 0.22 + t * 0.13, Math.sin(t * Math.PI * 14) * 0.035)); }
    const spring = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, 0.007, 8);
    add(safety, G.clean(spring).translate(x, 0, ZB), M.steel);
    add(safety, G.lathe([[0.045, y0 + 0.35], [0.045, y0 + 0.37], [0.012, y0 + 0.38], [0.012, y0 + 0.42]], { segments: 24 }).translate(x, 0, ZB), M.brass);
    // 杠杆
    add(safety, G.rboxAB(x - 0.02, y0 + 0.395, ZB - 0.012, x + 0.35, y0 + 0.415, ZB + 0.012, 0.005), M.steelDark);
  }
  const whistle = parts.add('whistle', { name: '汽笛', cat: '锅炉', desc: '开车、停车时鸣笛示警。', label: false, explode: [0, 0.3, 0] });
  {
    const x = -1.25, y0 = YB + RB;
    add(whistle, G.lathe([[0.02, y0 - 0.02], [0.02, y0 + 0.12], [0.035, y0 + 0.13], [0.04, y0 + 0.14], [0.045, y0 + 0.3, 1], [0.05, y0 + 0.32], [0.012, y0 + 0.34], [0.012, y0 + 0.36]], { segments: 28 }).translate(x, 0, ZB), M.brass);
  }

  // =========================================================================
  // 压力表、水位计
  // =========================================================================
  const inst = parts.add('instruments', {
    name: '压力表与水位计', cat: '锅炉',
    desc: '司炉工的两件“眼睛”：压力表（波登管）显示锅炉蒸汽压力；玻璃水位计显示锅内水位——水位过低会让火箱顶板露出水面被烧坏，是锅炉最危险的事故之一。',
    explode: [0, 0, 0.35], anchor: [-0.75, 0.75, ZB + RB + 0.1],
    view: { pos: [-0.5, 0.75, -1.5], target: [-0.7, 0.5, ZB + 0.6] },
  });
  parts.hideInSection('boiler', inst.root);
  const boilerNeedle = {};
  let gaugeWaterMesh;
  {
    const zf = ZB + RB + 0.02;
    // 虹吸弯管（猪尾管）
    const coil = [];
    for (let i = 0; i <= 40; i++) { const t = i / 40; coil.push(new V3(-0.95 + Math.sin(t * Math.PI * 2) * 0.03, 0.45 + t * 0.04 + Math.cos(t * Math.PI * 2) * 0.03 - 0.03, zf + 0.06)); }
    const siphon = G.pipePath([[-0.95, 0.25, zf], [-0.95, 0.25, zf + 0.06], [-0.95, 0.42, zf + 0.06]], 0.008, 0.03);
    add(inst, siphon.geometry, M.copper);
    add(inst, G.clean(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 60, 0.008, 8)), M.copper);
    add(inst, G.cyl(0.008, 0.46, 0.53, { segments: 8 }).translate(-0.95, 0, zf + 0.06), M.copper);
    const gauge = new THREE.Group();
    gauge.position.set(-0.95, 0.62, zf + 0.06);
    inst.group.add(gauge);
    add(inst, G.lathe([[0.1, -0.03], [0.105, -0.02, 1], [0.105, 0.015, 1], [0.095, 0.022]], { segments: 48, axis: 'z' }), M.brass, { parent: gauge });
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.088, 48), new THREE.MeshStandardMaterial({ map: gaugeFaceTexture('bar', 12, 9), roughness: 0.4 }));
    face.position.z = 0.016;
    gauge.add(face);
    const needle = new THREE.Mesh(G.box(0.005, 0.075, 0.002, 0, 0.03, 0), new THREE.MeshBasicMaterial({ color: '#111' }));
    needle.position.z = 0.019;
    gauge.add(needle);
    add(inst, G.cyl(0.008, 0.018, 0.024, Z_), M.brass, { parent: gauge });
    const gl = new THREE.Mesh(new THREE.CircleGeometry(0.09, 40), M.glass);
    gl.position.z = 0.024;
    gauge.add(gl);
    boilerNeedle.needle = needle;

    // 水位计
    const x = -0.45, zg = zf + 0.07;
    for (const y of [0.3, 0.86]) {
      add(inst, G.cyl(0.02, zf - 0.02, zg, Z_).translate(x, y, 0), M.brass);
      add(inst, G.rboxAB(x - 0.03, y - 0.035, zg - 0.03, x + 0.03, y + 0.035, zg + 0.03, 0.008), M.brass);
      add(inst, G.box(0.08, 0.012, 0.012, x + 0.05, y, zg + 0.03), M.brass);
    }
    add(inst, G.cyl(0.013, 0.335, 0.825, { segments: 16 }).translate(x, 0, zg), M.glass, { cast: false });
    const wmat = new THREE.MeshStandardMaterial({ color: '#4aa8ff', transparent: true, opacity: 0.8, roughness: 0.1 });
    wmat.userData.shared = true;
    gaugeWaterMesh = new THREE.Mesh(G.cyl(0.009, 0.335, B.WATER_Y, { segments: 12 }).translate(x, 0, zg), wmat);
    inst.group.add(gaugeWaterMesh);
    // 保护杆
    for (const dx of [-0.025, 0.025]) add(inst, G.cyl(0.004, 0.335, 0.825, { segments: 6 }).translate(x + dx, 0, zg + 0.022), M.brass);
  }

  // =========================================================================
  // 主汽阀 + 主蒸汽管
  // =========================================================================
  const stop = parts.add('stopValve', {
    name: '主汽阀', cat: '供汽',
    desc: '装在汽包顶上的截止阀，是开车与停车的总开关。司机转动手轮打开它，蒸汽就进入主蒸汽管送往发动机。',
    explode: [0, 0.45, 0], anchor: [B.DX, YB + 1.35, ZB],
    view: { pos: [2.0, 2.0, -1.4], target: [B.DX, 1.3, ZB] },
  });
  const wheel = new THREE.Group();
  const yv = YB + 0.93;
  {
    add(stop, G.lathe([[0.1, yv - 0.02], [0.1, yv + 0.01], [0.07, yv + 0.02], [0.08, yv + 0.08, 1], [0.08, yv + 0.16, 1], [0.06, yv + 0.2], [0.07, yv + 0.21], [0.07, yv + 0.24], [0.03, yv + 0.25], [0.03, yv + 0.32]], { segments: 36 }).translate(B.DX, 0, ZB), M.brass);
    add(stop, G.cyl(0.06, ZB, ZB + 0.16, Z_).translate(B.DX, yv + 0.12, 0), M.brass);
    add(stop, G.cyl(0.08, ZB + 0.14, ZB + 0.165, Z_).translate(B.DX, yv + 0.12, 0), M.brass);
    // 手轮
    wheel.position.set(B.DX, yv + 0.34, ZB);
    stop.group.add(wheel);
    const tor = new THREE.TorusGeometry(0.11, 0.012, 10, 48);
    tor.rotateX(Math.PI / 2);
    add(stop, G.clean(tor), M.steelDark, { parent: wheel });
    for (let i = 0; i < 5; i++) add(stop, G.box(0.11, 0.012, 0.014, 0.055, 0, 0).rotateY(i * Math.PI * 2 / 5), M.steelDark, { parent: wheel });
    add(stop, G.cyl(0.022, -0.02, 0.02), M.steel, { parent: wheel });
    add(stop, G.cyl(0.01, 0.0, 0.06).translate(0.1, 0, 0), M.steel, { parent: wheel });
  }
  const pipe = parts.add('steamPipe', {
    name: '主蒸汽管', cat: '供汽',
    desc: '紫铜蒸汽管把锅炉的蒸汽送到发动机。沿途弯管可吸收受热膨胀；法兰用螺栓连接，便于拆装。',
    explode: [0, 0.25, 0], anchor: [2.25, 1.35, -1.6],
    view: { pos: [4.0, 2.2, 0.8], target: [2.0, 0.9, -1.5] },
  });
  {
    const GX = 2.25, GZ = 0.29;
    const r = 0.045;
    const p = G.pipePath([
      [B.DX, yv + 0.12, ZB + 0.16], [B.DX, yv + 0.12, -2.3], [GX, yv + 0.12, -2.3], [GX, yv + 0.12, -0.9],
      [GX, 0.33, -0.9], [GX, 0.33, GZ - 0.165],
    ], r, 0.2);
    add(pipe, p.geometry, M.copper);
    for (const t of [0.005, 0.2, 0.52, 0.8, 0.995]) add(pipe, G.flangeAt(p.curve, t, r, { bolts: 6, thick: 0.014, rF: 0.085 }), M.brass);
    // 管架
    for (const [x, z] of [[1.62, -2.3], [GX, -1.55]]) {
      add(pipe, G.cyl(0.022, -0.8, yv + 0.12 - r, { segments: 12 }).translate(x, 0, z), M.iron);
      add(pipe, G.rboxAB(x - 0.12, -0.8, z - 0.12, x + 0.12, -0.76, z + 0.12, 0.01), M.iron);
      add(pipe, G.rboxAB(x - 0.06, yv + 0.12 - r - 0.03, z - 0.06, x + 0.06, yv + 0.12 - r, z + 0.06, 0.006), M.iron);
    }
    pipe.curve = p.curve;
    parts.hideInSection('engine', pipe.root);
  }

  // =========================================================================
  function update(o, dt, time, sim) {
    const bar = (o.pB - 1.013e5) / 1e5;
    boilerNeedle.needle.rotation.z = needleAngle(bar, 12);
    wheel.rotation.y = -o.stop * Math.PI * 3;
    const f = o.fire;
    const flick = 0.85 + 0.15 * Math.sin(time * 13) * Math.sin(time * 7.3);
    fireMat.uniforms.uTime.value = time;
    fireMat.uniforms.uPower.value = 0.3 + f * 0.7;
    fireLight.intensity = (0.6 + f * 2.2) * flick;
    firebox.fdLight.intensity = (0.4 + f * 1.8) * flick;
    firebox.glowMat.color.set('#ff8a3a').multiplyScalar(1.2 + f * 2.5 * flick);
    boiler.slitMat.color.set('#ff7a2a').multiplyScalar(0.8 + f * 3 * flick);
  }

  return {
    update, safetyTop,
    chimneyTop: new V3(B.CX, 4.46, ZB),
    tubePos: firebox.tubePos,
    pipeCurve: pipe.curve,
  };
}

const X_ = { axis: 'x' };
const Z_ = { axis: 'z' };
