// ---------------------------------------------------------------------------
// 蒸汽机热力 + 动力学仿真（纯 JS，不依赖 three）
//
//   锅炉 ──主汽阀──节流阀──▶ 阀箱 ──滑阀──▶ 气缸两端 ──滑阀──▶ 排汽（大气 / 冷凝器）
//
// · 每个容腔用“质量 m + 体积 V”描述，压力 p = m·c / V（等温近似 pV≈常数，
//   即经典蒸汽机教材中的“双曲线膨胀”）。
// · 汽口流量用孔口公式 ṁ = Cd·A·√(2ρΔp)，含临界（壅塞）限制，并对单步传质做
//   “不越过压力平衡点”的钳位，保证数值稳定。
// · 活塞推力 → 曲柄扭矩（含往复惯性力）→ 飞轮角加速度，负载与摩擦为阻力矩。
// · 瓦特-波特式离心调速器：飞球摆角动力学 → 套筒升程 → 节流阀开度。
// · 锅炉：自动司炉（PI）维持设定压力，安全阀超压排汽。
// ---------------------------------------------------------------------------
import {
  D, crossheadX, crossheadDX, crossheadDDX, valveU, portOpenings,
} from './dims.js';

export const P_ATM = 1.013e5;
const C_GAS = 2.05e5;          // R·T，饱和蒸汽约 170 °C
const CD = 0.7;
const A_P = Math.PI * D.BORE_R ** 2;             // 活塞面积
const A_ROD = Math.PI * D.ROD_R ** 2;
const A_HE = A_P, A_CE = A_P - A_ROD;
const V_CLEAR = 0.0030;                          // 每端余隙容积（含汽道）
const V_CHEST = 0.018;
const A_PIPE = Math.PI * 0.04 ** 2;              // 主汽管 DN80
const A_EXPIPE = Math.PI * 0.05 ** 2;            // 排汽管 DN100
const I_FLY = 1300;                              // 飞轮+曲轴 转动惯量 kg·m²
const M_RECIP = 180;                             // 往复质量 kg
const H_EVAP = 2.6e6;                            // 给水→饱和蒸汽 焓升 J/kg
const ETA_BOILER = 0.72;
const G_MAX = 0.6;                               // 最大产汽量 kg/s
const C_BOILER = 6e-6;                           // 锅炉“压力容量” kg/Pa
const P_SAFETY = 9.0e5 + P_ATM;                  // 安全阀整定 9.0 bar(g)
const GRAV = 9.81;

// 调速器参数（见 README 推导）
export const GOV = {
  ARM: 0.22,
  RATIO: 1.544,            // 调速器主轴 / 曲轴 转速比
  K: (GRAV / 0.22) * (1 + 3),   // 波特式：中心重锤 M = 3m
  PHI_MIN: 12 * Math.PI / 180,
  PHI_MAX: 50 * Math.PI / 180,
  PHI_OPEN: 17 * Math.PI / 180,   // 小于此角度：节流阀全开
  PHI_SHUT: 45 * Math.PI / 180,   // 大于此角度：节流阀全关
  DAMP: 5,
};

export const PARAMS = { A_P, A_ROD, A_HE, A_CE, V_CLEAR, I_FLY, M_RECIP, C_GAS };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** 孔口流量（kg/s），正值表示 up → down */
function orifice(pUp, pDown, area) {
  if (area <= 1e-9) return 0;
  const hi = pUp > pDown ? pUp : pDown;
  const lo = pUp > pDown ? pDown : pUp;
  const dp = Math.min(hi - lo, 0.46 * hi);        // 壅塞
  const m = CD * area * Math.sqrt(2 * (hi / C_GAS) * dp);
  return pUp >= pDown ? m : -m;
}
/** 两段孔口串联的等效面积 */
function series(a, b) {
  if (a <= 1e-9 || b <= 1e-9) return 0;
  return 1 / Math.sqrt(1 / (a * a) + 1 / (b * b));
}

export class SteamEngineSim {
  constructor() {
    // ---- 用户可调 ----
    this.running = true;          // 主汽阀目标（启动 / 停车）
    this.loadSet = 3800;          // 负载扭矩设定 N·m
    this.boilerSet = 7.0e5;       // 锅炉设定表压 Pa(g)
    this.governorAuto = true;
    this.throttleManual = 1.0;
    this.condenser = false;

    // ---- 状态 ----
    this.theta = 0.7;             // 曲柄角（0 = 缸盖端死点）
    this.omega = 0;
    this.revs = 0;
    this.pB = this.boilerSet + P_ATM;
    this.fire = 0.35;
    this.fireI = 0.35;
    this.stop = 0;                // 主汽阀实际开度
    this.throttle = 1;
    this.phi = GOV.PHI_MIN;
    this.phiDot = 0;
    this.govAngle = 0;            // 调速器主轴转角（仅动画用）
    this.stuckT = 0;
    this.barring = false;

    this.pEx = P_ATM * 1.06;
    const V = this.volumes(this.theta);
    this.mCh = P_ATM * V_CHEST / C_GAS;
    this.mHE = P_ATM * V.he / C_GAS;
    this.mCE = P_ATM * V.ce / C_GAS;

    // ---- 瞬时量（供渲染） ----
    this.out = {};
    this.flow = { heIn: 0, ceIn: 0, heOut: 0, ceOut: 0, supply: 0, safety: 0 };
    this.torque = 0;
    this.force = 0;

    // ---- 每转记录（按曲柄角 1° 分格）----
    this.cycle = makeCycleBuffer();
    this.lastCycle = makeCycleBuffer();
    this.cycleWork = 0;           // 当前转累积 ∮p dV
    this.cycleTime = 0;
    this.cycleSteam = 0;
    this.stats = {
      ihp: 0,           // 指示功率 W
      brake: 0,         // 有效（输出）功率 W
      friction: 0,
      steamRate: 0,     // kg/s
      fuelHeat: 0,      // W
      eff: 0,
      cutoff: 0,        // 截汽点（行程 %）
      rpmAvg: 0,
    };
    this._avg = { brake: 0, friction: 0, fuel: 0 };
    this.history = [];            // 转速/负载历史（条带图）
    this._histT = 0;
    this.time = 0;
  }

  volumes(theta) {
    const xp = crossheadX(theta) + D.ROD;
    const heLen = D.BORE_X1 - (xp + D.PISTON_T / 2);
    const ceLen = (xp - D.PISTON_T / 2) - D.BORE_X0;
    return { he: V_CLEAR + A_HE * heLen, ce: V_CLEAR + A_CE * ceLen, xp };
  }

  /** 推进 dt 秒（仿真时间） */
  step(dt) {
    if (dt <= 0) return;
    // 以曲柄转角不超过 0.5° 且时间不超过 1 ms 为子步
    const maxStep = Math.min(0.001, 0.0087 / Math.max(0.5, Math.abs(this.omega)));
    const n = Math.max(1, Math.ceil(dt / maxStep));
    const h = dt / n;
    for (let i = 0; i < n; i++) this._sub(h);
    this._post(dt);
  }

  _sub(h) {
    const th = this.theta;
    this.time += h;

    // ---------- 锅炉 ----------
    const pBg = this.pB - P_ATM;
    const err = (this.boilerSet - pBg) / 1e5;              // bar
    this.fireI = clamp(this.fireI + err * 0.04 * h, 0, 1);
    const fireCmd = clamp(this.fireI + err * 0.35, 0.03, 1);
    this.fire += (fireCmd - this.fire) * Math.min(1, h / 4);  // 燃烧滞后 ~4 s
    const gen = this.fire * G_MAX;
    const safety = this.pB > P_SAFETY ? (this.pB - P_SAFETY) * 4e-6 : 0;

    // ---------- 主汽阀 / 节流阀 ----------
    const stopTarget = this.running ? 1 : 0;
    this.stop += clamp(stopTarget - this.stop, -h * 0.6, h * 0.6);
    let thr;
    if (this.governorAuto) {
      thr = clamp((GOV.PHI_SHUT - this.phi) / (GOV.PHI_SHUT - GOV.PHI_OPEN), 0, 1);
    } else {
      thr = this.throttleManual;
    }
    this.throttle = thr;
    // 蝶阀：开度 → 面积（非线性）
    const aThr = A_PIPE * (1 - Math.cos(thr * Math.PI / 2)) * 1.0 + A_PIPE * 0.002;
    const aStop = A_PIPE * this.stop * this.stop;
    const aSupply = series(aStop, aThr);

    // ---------- 容腔 ----------
    const V = this.volumes(th);
    let pCh = this.mCh * C_GAS / V_CHEST;
    let pHE = this.mHE * C_GAS / V.he;
    let pCE = this.mCE * C_GAS / V.ce;
    const pB = this.pB;
    const pEx = this.pEx = this.condenser ? 0.2e5 : P_ATM * 1.06;

    const u = valveU(th);
    const op = portOpenings(u);
    const H = D.PORT_H;

    // 传质（带平衡钳位）
    const cV = (v) => (v === Infinity ? 0 : C_GAS / v);
    const transfer = (pU, vU, pD, vD, area) => {
      let md = orifice(pU, pD, area);
      if (md === 0) return 0;
      let dm = md * h;
      const eq = (pU - pD) / (cV(vU) + cV(vD));
      if (Math.abs(dm) > Math.abs(eq)) dm = eq;
      return dm;
    };

    // 锅炉 → 阀箱
    const dmS = transfer(pB, Infinity, pCh, V_CHEST, aSupply);
    this.mCh += dmS; pCh = this.mCh * C_GAS / V_CHEST;
    // 阀箱 → HE / CE
    const dmHE = transfer(pCh, V_CHEST, pHE, V.he, op.heSteam * H);
    this.mCh -= dmHE; this.mHE += dmHE;
    pCh = this.mCh * C_GAS / V_CHEST; pHE = this.mHE * C_GAS / V.he;
    const dmCE = transfer(pCh, V_CHEST, pCE, V.ce, op.ceSteam * H);
    this.mCh -= dmCE; this.mCE += dmCE;
    pCh = this.mCh * C_GAS / V_CHEST; pCE = this.mCE * C_GAS / V.ce;
    // HE / CE → 排汽
    const dxHE = transfer(pHE, V.he, pEx, Infinity, series(op.heExh * H, A_EXPIPE));
    this.mHE -= dxHE; pHE = this.mHE * C_GAS / V.he;
    const dxCE = transfer(pCE, V.ce, pEx, Infinity, series(op.ceExh * H, A_EXPIPE));
    this.mCE -= dxCE; pCE = this.mCE * C_GAS / V.ce;

    this.pB += (gen - dmS / h - safety) * h / C_BOILER;
    if (this.pB < P_ATM) this.pB = P_ATM;

    // ---------- 力 → 扭矩 → 飞轮 ----------
    // F_x：作用在活塞上沿 +x 的合力（CE 侧环形面积，活塞杆侧受大气压）
    const Fx = pCE * A_CE + P_ATM * A_ROD - pHE * A_HE;
    const dx = crossheadDX(th);
    const ddx = crossheadDDX(th);
    const w = this.omega;
    const Tgas = Fx * dx;
    const Tinert = -M_RECIP * ddx * dx * w * w;
    const Ieff = I_FLY + M_RECIP * dx * dx;
    const wr = 9.42;
    const Tload = this.loadSet * clamp(w / 2.5, 0, 1) * (0.85 + 0.15 * w / wr);
    const Tfric = (70 + 9 * Math.abs(w)) * clamp(w / 0.3, -1, 1);
    // 盘车：停在死点附近、蒸汽推不动时，用盘车装置把曲轴转过一个小角度
    if (this.running && this.stop > 0.8 && Math.abs(w) < 0.05) this.stuckT += h; else this.stuckT = 0;
    if (this.stuckT > 2.5) this.barring = true;                       // 锁定盘车，直到蒸汽能自己推动
    if (!this.running || Tgas + Tinert > 600 || w > 1.5) this.barring = false;
    const Tbar = this.barring ? 1500 : 0;
    const alpha = (Tgas + Tinert + Tbar - Tload - Tfric) / Ieff;
    let wNew = w + alpha * h;
    if (w >= 0 && wNew < 0 && Tgas + Tinert < 0) wNew = 0;  // 静摩擦：不倒转
    // 起步静摩擦
    // 静摩擦：低速且驱动力矩不足以克服静摩擦时停住
    if (Math.abs(wNew) < 0.02 && Math.abs(Tgas + Tinert + Tbar) < 120) wNew = 0;
    this.omega = wNew;
    const dTh = wNew * h;
    this.theta += dTh;

    // ---------- 调速器 ----------
    const wg = GOV.RATIO * wNew;
    const s = Math.sin(this.phi), c = Math.cos(this.phi);
    const phiAcc = wg * wg * s * c - GOV.K * s - GOV.DAMP * this.phiDot;
    this.phiDot += phiAcc * h;
    this.phi += this.phiDot * h;
    if (this.phi < GOV.PHI_MIN) { this.phi = GOV.PHI_MIN; if (this.phiDot < 0) this.phiDot = 0; }
    if (this.phi > GOV.PHI_MAX) { this.phi = GOV.PHI_MAX; if (this.phiDot > 0) this.phiDot = 0; }
    this.govAngle += wg * h;

    // ---------- 记录 ----------
    const V2 = this.volumes(this.theta);
    this.cycleWork += pHE * (V2.he - V.he) + pCE * (V2.ce - V.ce);
    this.cycleTime += h;
    this.cycleSteam += dmS;

    this.torque = Tgas + Tinert;
    this.force = Fx;
    this._last = { pCh, pHE, pCE, u, op, Tload, Tfric, Tgas, Tinert, V: V2, gen, safety };
    this.flow.supply = dmS / h;
    this.flow.heIn = dmHE / h; this.flow.ceIn = dmCE / h;
    this.flow.heOut = dxHE / h; this.flow.ceOut = dxCE / h;
    this.flow.safety = safety;

    const w1 = 1 - Math.exp(-h / 2);
    this._avg.brake += (Tload * wNew - this._avg.brake) * w1;
    this._avg.friction += (Tfric * wNew - this._avg.friction) * w1;
    this._avg.fuel += (gen * H_EVAP / ETA_BOILER - this._avg.fuel) * w1;

    // 1° 分格记录
    const deg = Math.floor(((this.theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) * 180 / Math.PI);
    const cb = this.cycle;
    cb.pHE[deg] = pHE; cb.pCE[deg] = pCE;
    cb.vHE[deg] = V2.he; cb.vCE[deg] = V2.ce;
    cb.torque[deg] = Tgas + Tinert;
    cb.load[deg] = Tload + Tfric;
    cb.u[deg] = u;
    cb.filled[deg] = 1;

    // 完成一整转
    const rev = Math.floor(this.theta / (2 * Math.PI));
    if (rev !== this.revs) {
      if (this.cycleTime > 0) {
        this.stats.ihp = this.cycleWork / this.cycleTime;
        this.stats.steamRate = this.cycleSteam / this.cycleTime;
        this.stats.rpmAvg = 60 / this.cycleTime;
      }
      this.cycleWork = 0; this.cycleTime = 0; this.cycleSteam = 0;
      const t = this.lastCycle; this.lastCycle = this.cycle; this.cycle = t;
      this.cycle.filled.fill(0);
      this.revs = rev;
    }
  }

  _post(dt) {
    const L = this._last;
    const st = this.stats;
    // 长时间低速时让指示功率衰减
    if (this.cycleTime > 4) { st.ihp *= 0.9; st.steamRate = this.flow.supply; st.rpmAvg = this.rpm; }
    st.brake = Math.max(0, this._avg.brake);
    st.friction = Math.max(0, this._avg.friction);
    st.fuelHeat = this._avg.fuel;
    st.eff = st.fuelHeat > 1 ? st.brake / st.fuelHeat : 0;
    st.cutoff = this.cutoffFraction();

    this.out = {
      theta: this.theta,
      omega: this.omega,
      rpm: this.rpm,
      pB: this.pB, pCh: L.pCh, pHE: L.pHE, pCE: L.pCE, pEx: this.pEx,
      u: L.u, op: L.op,
      force: this.force, torque: this.torque,
      Tload: L.Tload, Tfric: L.Tfric,
      throttle: this.throttle, stop: this.stop, phi: this.phi, govAngle: this.govAngle,
      fire: this.fire, safety: L.safety,
      xp: L.V.xp, barring: this.barring,
    };

    this._histT += dt;
    if (this._histT >= 0.1) {
      this._histT = 0;
      this.history.push({ t: this.time, rpm: this.rpm, load: this.loadSet, thr: this.throttle, pB: this.pB - P_ATM });
      if (this.history.length > 600) this.history.shift();
    }
  }

  get rpm() { return this.omega * 60 / (2 * Math.PI); }

  /** 截汽点：按阀几何求 HE 端进汽口关闭时的活塞行程百分比 */
  cutoffFraction() {
    if (this._cutoff !== undefined) return this._cutoff;
    let prev = portOpenings(valveU(0)).heSteam;
    for (let d = 1; d < 180; d++) {
      const th = d * Math.PI / 180;
      const o = portOpenings(valveU(th)).heSteam;
      if (prev > 0 && o <= 0) {
        const x0 = crossheadX(0), x1 = crossheadX(Math.PI);
        this._cutoff = (x0 - crossheadX(th)) / (x0 - x1);
        return this._cutoff;
      }
      prev = o;
    }
    return (this._cutoff = 1);
  }

  /** 从阀几何计算四个配汽事件（曲柄角，度） */
  valveEvents() {
    const ev = { he: {}, ce: {} };
    let p = portOpenings(valveU(-Math.PI / 180));
    for (let d = 0; d < 360; d++) {
      const o = portOpenings(valveU(d * Math.PI / 180));
      if (p.heSteam <= 0 && o.heSteam > 0) ev.he.admit = d;
      if (p.heSteam > 0 && o.heSteam <= 0) ev.he.cutoff = d;
      if (p.heExh <= 0 && o.heExh > 0) ev.he.release = d;
      if (p.heExh > 0 && o.heExh <= 0) ev.he.compress = d;
      if (p.ceSteam <= 0 && o.ceSteam > 0) ev.ce.admit = d;
      if (p.ceSteam > 0 && o.ceSteam <= 0) ev.ce.cutoff = d;
      if (p.ceExh <= 0 && o.ceExh > 0) ev.ce.release = d;
      if (p.ceExh > 0 && o.ceExh <= 0) ev.ce.compress = d;
      p = o;
    }
    return ev;
  }
}

function makeCycleBuffer() {
  return {
    pHE: new Float32Array(360), pCE: new Float32Array(360),
    vHE: new Float32Array(360), vCE: new Float32Array(360),
    torque: new Float32Array(360), load: new Float32Array(360),
    u: new Float32Array(360), filled: new Uint8Array(360),
  };
}
