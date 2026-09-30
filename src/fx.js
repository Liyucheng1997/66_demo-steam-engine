// ---------------------------------------------------------------------------
// 视觉特效：炉火着色器、粒子（烟、排汽、安全阀喷汽、排水阀）、
//          剖视汽流粒子、锅炉内气泡与烟气流动
// ---------------------------------------------------------------------------
import * as THREE from 'three';

const NOISE_GLSL = `
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
`;

export function makeFireMaterial() {
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPower: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv; uniform float uTime; uniform float uPower;
      ${NOISE_GLSL}
      void main(){
        vec2 uv = vUv;
        float n = fbm(vec2(uv.x * 3.2, uv.y * 2.2 - uTime * 1.9));
        float n2 = fbm(vec2(uv.x * 6.0 + 3.1, uv.y * 4.0 - uTime * 3.1));
        float body = (1.0 - uv.y) * uPower;
        float edge = 1.0 - pow(abs(uv.x - 0.5) * 2.0, 1.6);
        float f = body * edge * 1.5 + n * 0.75 + n2 * 0.25 - 0.72;
        f = clamp(f * 1.8, 0.0, 1.0);
        vec3 col = mix(vec3(0.9, 0.18, 0.02), vec3(1.0, 0.75, 0.3), f);
        col = mix(col, vec3(1.0, 0.95, 0.8), smoothstep(0.75, 1.0, f));
        gl_FragColor = vec4(col * (0.9 + 1.5 * f), f * 0.85);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  m.userData.shared = true;
  return m;
}

function puffTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  // 絮状噪点
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 90; i++) {
    const a = Math.random() * Math.PI * 2, r = 20 + Math.random() * 40;
    const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r;
    const gg = g.createRadialGradient(x, y, 0, x, y, 10 + Math.random() * 14);
    gg.addColorStop(0, 'rgba(0,0,0,0.35)');
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gg;
    g.fillRect(x - 30, y - 30, 60, 60);
  }
  const t = new THREE.CanvasTexture(c);
  return t;
}
const PUFF = puffTexture();

/** 通用粒子系统（Points + 自定义着色器，逐粒子大小/透明度/颜色） */
export class Particles {
  constructor(max, { additive = false, soft = true, renderOrder = 4 } = {}) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.age = new Float32Array(max).fill(1e9);
    this.life = new Float32Array(max).fill(1);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max);
    this.a0 = new Float32Array(max);
    this.buoy = new Float32Array(max); this.drag = new Float32Array(max);
    this.cursor = 0;
    this.acc = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: PUFF }, uScale: { value: 800 }, uSoft: { value: soft ? 1 : 0 } },
      vertexShader: `
        attribute vec3 aColor; attribute float aSize; attribute float aAlpha;
        varying vec3 vColor; varying float vAlpha;
        uniform float uScale;
        void main(){
          vColor = aColor; vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uScale / max(0.1, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D uMap; uniform float uSoft;
        varying vec3 vColor; varying float vAlpha;
        void main(){
          vec2 c = gl_PointCoord;
          float a;
          if (uSoft > 0.5) a = texture2D(uMap, c).a;
          else { float d = length(c - 0.5) * 2.0; a = smoothstep(1.0, 0.3, d); }
          if (a * vAlpha < 0.004) discard;
          gl_FragColor = vec4(vColor, a * vAlpha);
        }`,
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = renderOrder;
  }

  emit(p, v, { life = 2, s0 = 0.1, s1 = 0.5, a0 = 0.6, color = [1, 1, 1], buoy = 0, drag = 0.5 } = {}) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = v.x; this.vel[i * 3 + 1] = v.y; this.vel[i * 3 + 2] = v.z;
    this.col[i * 3] = color[0]; this.col[i * 3 + 1] = color[1]; this.col[i * 3 + 2] = color[2];
    this.age[i] = 0; this.life[i] = life;
    this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a0;
    this.buoy[i] = buoy; this.drag[i] = drag;
  }

  /** 按速率（个/秒）发射，返回本帧发射个数 */
  rate(r, dt, fn) {
    this.acc += r * dt;
    let n = 0;
    while (this.acc >= 1) { this.acc -= 1; fn(); n++; if (n > 60) { this.acc = 0; break; } }
    return n;
  }

  update(dt, wind = 0) {
    const { pos, vel } = this;
    for (let i = 0; i < this.max; i++) {
      if (this.age[i] >= this.life[i]) { this.alpha[i] = 0; continue; }
      this.age[i] += dt;
      const t = Math.min(1, this.age[i] / this.life[i]);
      const k = Math.max(0, 1 - this.drag[i] * dt);
      vel[i * 3] = vel[i * 3] * k + wind * dt;
      vel[i * 3 + 1] = vel[i * 3 + 1] * k + this.buoy[i] * dt;
      vel[i * 3 + 2] *= k;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * Math.sqrt(t);
      const fin = Math.min(1, t / 0.08);
      this.alpha[i] = this.a0[i] * fin * Math.pow(1 - t, 1.4);
    }
    const g = this.geo.attributes;
    g.position.needsUpdate = g.aSize.needsUpdate = g.aAlpha.needsUpdate = g.aColor.needsUpdate = true;
  }
}

/** 沿折线路径流动的发光点（剖视汽流、火管烟气） */
export class PathFlow {
  constructor(max, { size = 0.022 } = {}) {
    this.max = max;
    this.items = [];     // { path, s, speed, c0, c1 }
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.sz = new Float32Array(max).fill(size);
    this.al = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.sz, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.al, 1));
    const p = new Particles(1, { additive: true, soft: false });
    this.points = new THREE.Points(g, p.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 12;
    p.mat.depthTest = false;
    this.acc = {};
  }

  static prep(pts) {
    const segs = [];
    let L = 0;
    for (let i = 1; i < pts.length; i++) { const l = pts[i].distanceTo(pts[i - 1]); segs.push(l); L += l; }
    return { pts, segs, L };
  }

  spawn(path, { speed = 1, c0 = [1, 0.6, 0.2], c1 = c0, jitter = 0 } = {}) {
    if (this.items.length >= this.max) return;
    this.items.push({ path, s: 0, speed, c0, c1, jx: (Math.random() - 0.5) * jitter, jz: (Math.random() - 0.5) * jitter });
  }

  rate(key, r, dt, fn) {
    this.acc[key] = (this.acc[key] || 0) + r * dt;
    while (this.acc[key] >= 1) { this.acc[key] -= 1; fn(); }
  }

  update(dt) {
    const tmp = new THREE.Vector3();
    let n = 0;
    this.items = this.items.filter((it) => (it.s += it.speed * dt / it.path.L) < 1);
    for (const it of this.items) {
      if (n >= this.max) break;
      const { pts, segs, L } = it.path;
      let d = it.s * L, k = 0;
      while (k < segs.length - 1 && d > segs[k]) { d -= segs[k]; k++; }
      tmp.copy(pts[k]).lerp(pts[k + 1], Math.min(1, d / segs[k]));
      this.pos[n * 3] = tmp.x; this.pos[n * 3 + 1] = tmp.y + it.jx * 0.3; this.pos[n * 3 + 2] = tmp.z + it.jz;
      const t = it.s;
      this.col[n * 3] = it.c0[0] + (it.c1[0] - it.c0[0]) * t;
      this.col[n * 3 + 1] = it.c0[1] + (it.c1[1] - it.c0[1]) * t;
      this.col[n * 3 + 2] = it.c0[2] + (it.c1[2] - it.c0[2]) * t;
      this.al[n] = Math.min(1, t * 10) * Math.min(1, (1 - t) * 6);
      n++;
    }
    for (let i = n; i < this.max; i++) this.al[i] = 0;
    const g = this.points.geometry.attributes;
    g.position.needsUpdate = g.aColor.needsUpdate = g.aAlpha.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// 汇总：由仿真状态驱动所有粒子
// ---------------------------------------------------------------------------
export function createFX(scene, { engine, boiler }) {
  const smoke = new Particles(700);
  const steam = new Particles(900);
  const flow = new PathFlow(900);
  const gasFlow = new PathFlow(500, { size: 0.03 });
  const bubbles = new PathFlow(400, { size: 0.018 });
  scene.add(smoke.points, steam.points, flow.points, gasFlow.points, bubbles.points);
  flow.points.visible = false;
  gasFlow.points.visible = false;
  bubbles.points.visible = false;

  const paths = {};
  for (const [k, v] of Object.entries(engine.flowPaths)) paths[k] = PathFlow.prep(v);

  // 锅炉：烟气路径（火床 → 砖拱上方 → 火管 → 烟箱 → 烟囱）
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const ZB = boiler.chimneyTop.z;
  const tubePaths = boiler.tubePos.map(([y, z]) => PathFlow.prep([
    V(-1.2, -0.42, z), V(-1.05, 0.2, z), V(-0.5, 0.33, z), V(-0.19, y, z), V(2.45, y, z), V(2.75, y + 0.1, z),
    V(2.8, 0.85, ZB - 0.04), V(2.8, 4.4, ZB - 0.06),
  ]));

  const WARM = [1.0, 0.55, 0.18], HOT = [1.0, 0.85, 0.5], COOL = [0.35, 0.75, 1.0], VAC = [0.4, 0.45, 1.0];
  const v = new THREE.Vector3(), p = new THREE.Vector3();
  let drainT = 0;

  return {
    smoke, steam, flow,
    setSection(engineOn, boilerOn) {
      flow.points.visible = engineOn;
      gasFlow.points.visible = boilerOn;
      bubbles.points.visible = boilerOn;
    },
    setScale(h, fov) {
      const s = h / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2));
      smoke.mat.uniforms.uScale.value = s;
      steam.mat.uniforms.uScale.value = s;
      flow.points.material.uniforms.uScale.value = s;
      gasFlow.points.material.uniforms.uScale.value = s;
      bubbles.points.material.uniforms.uScale.value = s;
    },
    update(sim, dt, opts) {
      const o = sim.out;
      const fl = sim.flow;
      if (dt <= 0) return;
      // ---- 烟囱冒烟 ----
      const ct = boiler.chimneyTop;
      smoke.rate(opts.effects ? 10 + o.fire * 40 : 0, dt, () => {
        p.set(ct.x + (Math.random() - 0.5) * 0.15, ct.y, ct.z + (Math.random() - 0.5) * 0.15);
        v.set((Math.random() - 0.5) * 0.2, 1.0 + o.fire * 1.2 + Math.random() * 0.4, (Math.random() - 0.5) * 0.2);
        const g = 0.16 + Math.random() * 0.08;
        smoke.emit(p, v, { life: 5 + Math.random() * 2, s0: 0.3, s1: 2.2, a0: 0.28 + o.fire * 0.2, color: [g, g * 0.95, g * 0.9], buoy: 0.25, drag: 0.35 });
      });
      smoke.update(dt, 0.18);

      // ---- 排汽（非冷凝时，随排汽流量“一噗一噗”） ----
      const ex = sim.condenser ? 0 : Math.max(0, fl.heOut) + Math.max(0, fl.ceOut);
      const et = engine.exTop;
      steam.rate(opts.effects ? Math.min(160, ex * 70) : 0, dt, () => {
        p.set(et.x + (Math.random() - 0.5) * 0.12, et.y, et.z + (Math.random() - 0.5) * 0.12);
        v.set((Math.random() - 0.5) * 0.5, 2.2 + Math.random() * 1.5 + ex * 0.5, (Math.random() - 0.5) * 0.5);
        steam.emit(p, v, { life: 2.2 + Math.random(), s0: 0.18, s1: 1.4, a0: 0.5, color: [0.93, 0.95, 0.97], buoy: 0.4, drag: 1.1 });
      });
      // ---- 安全阀起跳 ----
      const st = boiler.safetyTop;
      steam.rate(opts.effects ? Math.min(140, o.safety * 900) : 0, dt, () => {
        p.set(st.x, st.y, st.z);
        v.set((Math.random() - 0.5) * 0.6, 4 + Math.random() * 2, (Math.random() - 0.5) * 0.6);
        steam.emit(p, v, { life: 1.6, s0: 0.08, s1: 1.0, a0: 0.55, color: [0.95, 0.96, 0.98], buoy: 0.3, drag: 1.4 });
      });
      // ---- 开车时排水阀喷出冷凝水与蒸汽 ----
      if (sim.running && o.stop < 1 && o.stop > 0.02) drainT = 6;
      drainT = Math.max(0, drainT - dt);
      if (drainT > 0 && opts.effects) {
        steam.rate(50 * Math.min(1, drainT / 2), dt, () => {
          const x = Math.random() < 0.5 ? 1.97 : 2.53;
          p.set(x, -0.24, -0.06);
          v.set((Math.random() - 0.5) * 0.3, -0.4 + Math.random() * 0.3, 1.6 + Math.random() * 0.8);
          steam.emit(p, v, { life: 1.3, s0: 0.05, s1: 0.5, a0: 0.45, color: [0.95, 0.96, 0.98], buoy: 0.6, drag: 1.5 });
        });
      }
      steam.update(dt, 0.1);

      // ---- 剖视：阀箱/汽道中的蒸汽流 ----
      if (flow.points.visible) {
        const spd = 0.9;
        const r = (m) => Math.min(260, Math.max(0, m) * 110);
        flow.rate('ceIn', r(fl.ceIn), dt, () => flow.spawn(paths.ceIn, { speed: spd, c0: HOT, c1: WARM, jitter: 0.02 }));
        flow.rate('heIn', r(fl.heIn), dt, () => flow.spawn(paths.heIn, { speed: spd, c0: HOT, c1: WARM, jitter: 0.02 }));
        const exC = sim.condenser ? VAC : COOL;
        flow.rate('ceOut', r(fl.ceOut), dt, () => flow.spawn(paths.ceOut, { speed: spd, c0: WARM, c1: exC, jitter: 0.02 }));
        flow.rate('heOut', r(fl.heOut), dt, () => flow.spawn(paths.heOut, { speed: spd, c0: WARM, c1: exC, jitter: 0.02 }));
      }
      flow.update(dt);

      // ---- 剖视：锅炉内烟气与气泡 ----
      if (gasFlow.points.visible) {
        gasFlow.rate('g', 20 + o.fire * 80, dt, () => {
          const tp = tubePaths[(Math.random() * tubePaths.length) | 0];
          gasFlow.spawn(tp, { speed: 1.4 + o.fire, c0: [1.0, 0.75, 0.3], c1: [0.25, 0.22, 0.2], jitter: 0.02 });
        });
        bubbles.rate('b', 30 + o.fire * 120, dt, () => {
          const x = -1.35 + Math.random() * 3.7;
          let y0, z;
          if (x < -0.2) {
            if (Math.random() < 0.5) { y0 = 0.42; z = ZB - 0.02 - Math.random() * 0.46; }
            else { y0 = -0.45 + Math.random() * 0.85; z = ZB - 0.51 - Math.random() * 0.04; }
          } else { y0 = -0.32 + Math.random() * 0.7; z = ZB - 0.02 - Math.random() * 0.5; }
          const path = PathFlow.prep([V(x, y0, z), V(x + (Math.random() - 0.5) * 0.05, 0.5, z)]);
          bubbles.spawn(path, { speed: 0.35 + Math.random() * 0.3, c0: [0.8, 0.9, 1.0], c1: [1, 1, 1] });
        });
      }
      gasFlow.update(dt);
      bubbles.update(dt);
    },
  };
}
