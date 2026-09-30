// ---------------------------------------------------------------------------
// 2D 图表：示功图、配汽剖面示意、曲轴扭矩、转速趋势、能量流
// ---------------------------------------------------------------------------
import { D, crossheadX, portOpenings } from '../dims.js';
import { P_ATM } from '../physics.js';
import { pressureColor } from '../model/engine.js';
import * as THREE from 'three';

const C = {
  grid: 'rgba(255,255,255,0.07)', axis: 'rgba(255,255,255,0.35)', text: '#a39d92', brass: '#f0cf8a',
  he: '#ff6a3d', ce: '#4cb4ff', load: '#d9ab52', good: '#5fd39a', bad: '#ff8a5a',
};
const FONT = '"Microsoft YaHei", "PingFang SC", sans-serif';
const col = new THREE.Color();
const cssColor = (p) => '#' + pressureColor(p, col).getHexString();

const X0 = crossheadX(0), X1 = crossheadX(Math.PI);
export const strokeFrac = (th) => (X0 - crossheadX(th)) / (X0 - X1);

function frame(ctx, w, h, m, xTicks, yTicks, xLab, yLab, fx, fy) {
  ctx.clearRect(0, 0, w, h);
  ctx.font = `23px ${FONT}`;
  ctx.lineWidth = 1;
  for (const t of yTicks) {
    const y = fy(t.v);
    ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(w - m.r, y); ctx.stroke();
    ctx.fillStyle = C.text; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(t.s, m.l - 6, y);
  }
  for (const t of xTicks) {
    const x = fx(t.v);
    ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(x, m.t); ctx.lineTo(x, h - m.b); ctx.stroke();
    ctx.fillStyle = C.text; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(t.s, x, h - m.b + 5);
  }
  ctx.strokeStyle = C.axis;
  ctx.beginPath(); ctx.moveTo(m.l, m.t); ctx.lineTo(m.l, h - m.b); ctx.lineTo(w - m.r, h - m.b); ctx.stroke();
  ctx.fillStyle = C.text; ctx.font = `22px ${FONT}`;
  if (xLab) { ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(xLab, w - m.r, h - 2); }
  if (yLab) { ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(yLab, m.l + 6, m.t - 2); }
}

// ---------------------------------------------------------------------------
// 示功图
// ---------------------------------------------------------------------------
export function drawIndicator(cv, sim, events) {
  const ctx = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  const m = { l: 62, r: 14, t: 30, b: 44 };
  const pMax = 10;
  const fx = (f) => m.l + f * (w - m.l - m.r);
  const fy = (p) => h - m.b - (p / pMax) * (h - m.t - m.b);
  frame(ctx, w, h, m,
    [0, 0.25, 0.5, 0.75, 1].map((v) => ({ v, s: `${v * 100 | 0}%` })),
    [0, 2, 4, 6, 8, 10].map((v) => ({ v, s: String(v) })),
    '活塞位置（自缸盖端死点起）', 'p / bar(abs)', fx, fy);

  const c = sim.lastCycle;
  const cur = sim.cycle;
  const pick = (d) => (cur.filled[d] ? cur : c);
  // 大气压线、锅炉压力线
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.moveTo(fx(0), fy(P_ATM / 1e5)); ctx.lineTo(fx(1), fy(P_ATM / 1e5)); ctx.stroke();
  ctx.strokeStyle = 'rgba(240,207,138,0.5)';
  const pb = sim.pB / 1e5;
  ctx.beginPath(); ctx.moveTo(fx(0), fy(pb)); ctx.lineTo(fx(1), fy(pb)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = `21px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillText('大气压', fx(1) - 2, fy(P_ATM / 1e5) - 2);
  ctx.fillStyle = 'rgba(240,207,138,0.8)'; ctx.fillText('锅炉压力', fx(1) - 2, fy(pb) - 2);

  const loop = (key, color) => {
    ctx.beginPath();
    let first = true;
    for (let d = 0; d <= 360; d++) {
      const dd = d % 360;
      const src = pick(dd);
      const p = src[key][dd];
      if (!p) continue;
      const x = fx(strokeFrac(dd * Math.PI / 180)), y = fy(p / 1e5);
      if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = color + '2a';
    ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.lineWidth = 1;
  };
  loop('pCE', C.ce);
  loop('pHE', C.he);

  // 配汽事件（缸盖端）
  if (events) {
    const names = { admit: '进汽', cutoff: '截汽', release: '释放', compress: '压缩' };
    ctx.font = `bold 22px ${FONT}`;
    for (const [k, name] of Object.entries(names)) {
      const d = events.he[k];
      if (d === undefined) continue;
      const src = pick(d);
      const p = src.pHE[d];
      if (!p) continue;
      const x = fx(strokeFrac(d * Math.PI / 180)), y = fy(p / 1e5);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.brass;
      const dx = k === 'admit' ? 10 : k === 'compress' ? 10 : -10;
      ctx.textAlign = dx > 0 ? 'left' : 'right';
      ctx.textBaseline = k === 'cutoff' ? 'bottom' : 'middle';
      ctx.fillText(name, x + dx, y + (k === 'release' ? -12 : k === 'compress' ? -14 : -6));
    }
  }

  // 当前状态点
  const o = sim.out;
  const f = strokeFrac(o.theta);
  for (const [p, color] of [[o.pHE, C.he], [o.pCE, C.ce]]) {
    ctx.fillStyle = color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(fx(f), fy(p / 1e5), 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.lineWidth = 1;
  // 图例
  ctx.font = `21px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const lx = w - m.r - 250, ly = m.t + 8;
  ctx.fillStyle = C.he; ctx.fillRect(lx, ly - 4, 18, 8); ctx.fillStyle = C.text; ctx.fillText('缸盖端', lx + 24, ly);
  ctx.fillStyle = C.ce; ctx.fillRect(lx + 110, ly - 4, 18, 8); ctx.fillStyle = C.text; ctx.fillText('曲轴端', lx + 134, ly);
}

// ---------------------------------------------------------------------------
// 配汽剖面示意（与三维水平剖面一致的平面图）
// ---------------------------------------------------------------------------
export function drawValve(cv, sim) {
  const ctx = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  ctx.clearRect(0, 0, w, h);
  const o = sim.out;
  const s = 540;                           // px / m
  const xc = D.VX, zc = 0.12;
  const X = (x) => w / 2 + (x - xc) * s;
  const Y = (z) => h / 2 + 18 - (z - zc) * s;
  const rect = (x0, z0, x1, z1, fill) => { ctx.fillStyle = fill; ctx.fillRect(X(x0), Y(z1), (x1 - x0) * s, (z1 - z0) * s); };
  const poly = (pts, fill) => { ctx.fillStyle = fill; ctx.beginPath(); pts.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Y(z)) : ctx.moveTo(X(x), Y(z)))); ctx.closePath(); ctx.fill(); };

  const iron = '#4a4f55', ironL = '#5d636a';
  const fz = D.FACE_Z;
  // 气缸铸件 + 阀箱
  rect(1.87, -0.165, 2.63, fz, iron);
  rect(1.83, -0.2, 1.87, 0.2, ironL); rect(2.63, -0.2, 2.67, 0.2, ironL);
  rect(2.0, fz, 2.5, 0.38, iron);
  rect(1.99, 0.38, 2.51, 0.402, ironL);
  // 剖面线
  ctx.save();
  ctx.beginPath(); ctx.rect(X(1.83), Y(0.402), (2.67 - 1.83) * s, (0.402 + 0.2) * s); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
  for (let i = -40; i < 80; i++) { ctx.beginPath(); ctx.moveTo(i * 12, 0); ctx.lineTo(i * 12 + 300, 300); ctx.stroke(); }
  ctx.restore();

  const u = o.u;
  const xp = o.xp, t2 = D.PISTON_T / 2;
  const cHE = cssColor(o.pHE), cCE = cssColor(o.pCE), cCh = cssColor(o.pCh), cEx = cssColor(o.pEx);
  // 阀箱内部
  rect(2.03, fz, 2.47, 0.38, cCh);
  // 汽道
  const br = D.BORE_R;
  poly([[D.BORE_X0, 0.1], [D.BORE_X0 + 0.03, 0.1], [D.BORE_X0 + 0.03, 0.14], [D.CE_PORT_X1, 0.14], [D.CE_PORT_X1, fz], [D.CE_PORT_X0, fz], [D.CE_PORT_X0, 0.17], [D.BORE_X0, 0.17]], cCE);
  poly([[D.BORE_X1, 0.1], [D.BORE_X1 - 0.03, 0.1], [D.BORE_X1 - 0.03, 0.14], [D.HE_PORT_X0, 0.14], [D.HE_PORT_X0, fz], [D.HE_PORT_X1, fz], [D.HE_PORT_X1, 0.17], [D.BORE_X1, 0.17]], cHE);
  rect(D.EXH_X0, -0.02, D.EXH_X1, fz, cEx);
  // 缸膛
  rect(D.BORE_X0, -br, xp - t2, br, cCE);
  rect(xp + t2, -br, D.BORE_X1, br, cHE);
  // 活塞 + 活塞杆
  rect(1.6, -D.ROD_R, xp, D.ROD_R, '#b9c0c8');
  rect(xp - t2, -br + 0.002, xp + t2, br - 0.002, '#8b939c');
  ctx.strokeStyle = '#2b2f34'; ctx.lineWidth = 1.5;
  ctx.strokeRect(X(xp - t2), Y(br - 0.002), D.PISTON_T * s, (2 * br - 0.004) * s);
  // 滑阀
  rect(D.VALVE_X0 + u, fz, D.VALVE_X1 + u, 0.25, '#b0874a');
  rect(D.CAV_X0 + u, fz, D.CAV_X1 + u, 0.226, cEx);
  rect(D.VALVE_X0 - 0.2 + u, 0.255, D.VALVE_X0 + u, 0.269, '#c8ccd2');

  // 流动箭头
  const op = o.op;
  const arrow = (x0, z0, x1, z1, color, k) => {
    if (k <= 0) return;
    const a = Math.atan2(-(z1 - z0), x1 - x0);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2 + 3 * k;
    ctx.beginPath(); ctx.moveTo(X(x0), Y(z0)); ctx.lineTo(X(x1), Y(z1)); ctx.stroke();
    const hx = X(x1), hy = Y(z1), L = 9 + 6 * k;
    ctx.beginPath(); ctx.moveTo(hx + Math.cos(a) * 4, hy + Math.sin(a) * 4);
    ctx.lineTo(hx - Math.cos(a - 0.5) * L, hy - Math.sin(a - 0.5) * L);
    ctx.lineTo(hx - Math.cos(a + 0.5) * L, hy - Math.sin(a + 0.5) * L); ctx.closePath(); ctx.fill();
  };
  const W = D.PORT_W;
  const ceX = (D.CE_PORT_X0 + D.CE_PORT_X1) / 2, heX = (D.HE_PORT_X0 + D.HE_PORT_X1) / 2;
  arrow(ceX, 0.28, ceX, 0.2, '#fff4d6', op.ceSteam / W);
  arrow(heX, 0.28, heX, 0.2, '#fff4d6', op.heSteam / W);
  arrow(1.925, 0.13, 1.96, 0.02, '#fff4d6', op.ceSteam / W);
  arrow(2.575, 0.13, 2.54, 0.02, '#fff4d6', op.heSteam / W);
  arrow(ceX, 0.19, D.VX - 0.01, 0.2, '#d6f0ff', op.ceExh / W);
  arrow(heX, 0.19, D.VX + 0.01, 0.2, '#d6f0ff', op.heExh / W);
  if (op.ceExh + op.heExh > 0) arrow(D.VX, 0.1, D.VX, -0.08, '#d6f0ff', 0.6);

  // 文字
  ctx.font = `bold 23px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lab = (t, x, z, c = '#fff') => { ctx.fillStyle = 'rgba(0,0,0,0.55)'; const m = ctx.measureText(t); ctx.fillRect(X(x) - m.width / 2 - 5, Y(z) - 13, m.width + 10, 26); ctx.fillStyle = c; ctx.fillText(t, X(x), Y(z)); };
  const bar = (p) => `${((p - P_ATM) / 1e5).toFixed(1)} bar`;
  lab(`阀箱 ${bar(o.pCh)}`, 2.25, 0.33, '#ffe2a8');
  lab(bar(o.pCE), (D.BORE_X0 + xp - t2) / 2, 0.0);
  lab(bar(o.pHE), (xp + t2 + D.BORE_X1) / 2, 0.0);
  ctx.font = `21px ${FONT}`;
  ctx.fillStyle = C.text;
  ctx.fillText('曲轴端', X(1.95), Y(-0.19));
  ctx.fillText('缸盖端', X(2.55), Y(-0.19));
  ctx.fillText('↓排汽', X(D.VX), Y(-0.1));
  // 压力色标
  const gx = 12, gy = 14, gw = 150;
  for (let i = 0; i < gw; i++) { ctx.fillStyle = cssColor((0.15 + (i / gw) * 8.2) * 1e5); ctx.fillRect(gx + i, gy, 1, 10); }
  ctx.fillStyle = C.text; ctx.font = `19px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('低压', gx, gy + 12); ctx.textAlign = 'right'; ctx.fillText('高压', gx + gw, gy + 12);
}

// ---------------------------------------------------------------------------
// 曲轴扭矩
// ---------------------------------------------------------------------------
export function drawTorque(cv, sim) {
  const ctx = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  const m = { l: 62, r: 14, t: 28, b: 42 };
  const c = sim.lastCycle, cur = sim.cycle;
  let tMax = 4, tMin = -1;
  for (let d = 0; d < 360; d++) { const v = (cur.filled[d] ? cur : c).torque[d] / 1000; if (v > tMax) tMax = v; if (v < tMin) tMin = v; }
  tMax = Math.ceil(tMax / 2) * 2; tMin = Math.floor(tMin / 2) * 2;
  const fx = (d) => m.l + (d / 360) * (w - m.l - m.r);
  const fy = (t) => h - m.b - ((t - tMin) / (tMax - tMin)) * (h - m.t - m.b);
  const yt = [];
  for (let v = tMin; v <= tMax; v += 2) yt.push({ v, s: String(v) });
  frame(ctx, w, h, m, [0, 90, 180, 270, 360].map((v) => ({ v, s: `${v}°` })), yt, '曲柄转角', '扭矩 kN·m', fx, fy);
  const pick = (d) => (cur.filled[d] ? cur : c);
  let loadAvg = 0, n = 0;
  for (let d = 0; d < 360; d++) { const s = pick(d); if (s.filled[d] || c.filled[d]) { loadAvg += s.load[d]; n++; } }
  loadAvg = n ? loadAvg / n / 1000 : 0;
  // 盈亏面积
  for (let d = 0; d < 359; d++) {
    const t0 = pick(d).torque[d] / 1000, t1 = pick(d + 1).torque[d + 1] / 1000;
    const above = (t0 + t1) / 2 > loadAvg;
    ctx.fillStyle = above ? 'rgba(95,211,154,0.22)' : 'rgba(255,138,90,0.22)';
    ctx.beginPath();
    ctx.moveTo(fx(d), fy(loadAvg)); ctx.lineTo(fx(d), fy(t0)); ctx.lineTo(fx(d + 1), fy(t1)); ctx.lineTo(fx(d + 1), fy(loadAvg));
    ctx.fill();
  }
  ctx.strokeStyle = C.brass; ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let d = 0; d < 360; d++) { const t = pick(d).torque[d] / 1000; d ? ctx.lineTo(fx(d), fy(t)) : ctx.moveTo(fx(d), fy(t)); }
  ctx.stroke();
  ctx.setLineDash([7, 5]); ctx.strokeStyle = '#ffffffaa'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(fx(0), fy(loadAvg)); ctx.lineTo(fx(360), fy(loadAvg)); ctx.stroke();
  ctx.setLineDash([]);
  // 死点
  ctx.font = `20px ${FONT}`; ctx.fillStyle = C.text; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (const d of [0, 180, 360]) { ctx.fillText('死点', fx(d) + (d === 0 ? 16 : d === 360 ? -16 : 0), m.t + 2); }
  // 当前角度
  const deg = ((sim.out.theta * 180 / Math.PI) % 360 + 360) % 360;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(fx(deg), m.t); ctx.lineTo(fx(deg), h - m.b); ctx.stroke();
  ctx.fillStyle = C.brass;
  ctx.beginPath(); ctx.arc(fx(deg), fy(sim.out.torque / 1000), 6, 0, Math.PI * 2); ctx.fill();
  ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillStyle = '#ffffffcc';
  ctx.fillText('负载 + 摩擦', w - m.r - 2, fy(loadAvg) - 3);
  return loadAvg;
}

// ---------------------------------------------------------------------------
// 转速趋势
// ---------------------------------------------------------------------------
export function drawTrend(cv, sim) {
  const ctx = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  const m = { l: 62, r: 58, t: 26, b: 36 };
  const hist = sim.history;
  const T = 60;
  const tNow = sim.time;
  const fx = (t) => m.l + (1 - (tNow - t) / T) * (w - m.l - m.r);
  const fy = (r) => h - m.b - (r / 120) * (h - m.t - m.b);
  frame(ctx, w, h, m, [0, 15, 30, 45, 60].map((v) => ({ v: tNow - 60 + v, s: v === 60 ? '现在' : `-${60 - v}s` })), [0, 30, 60, 90, 120].map((v) => ({ v, s: String(v) })), '', 'r/min', fx, fy);
  ctx.font = `20px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  for (const v of [0, 50, 100]) { ctx.fillStyle = C.ce; ctx.fillText(`${v}%`, w - m.r + 6, h - m.b - (v / 100) * (h - m.t - m.b)); }
  const line = (key, color, map, width = 2.5) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
    let first = true;
    for (const p of hist) { if (tNow - p.t > T) continue; const x = fx(p.t), y = map(p[key]); first ? ctx.moveTo(x, y) : ctx.lineTo(x, y); first = false; }
    ctx.stroke();
  };
  line('thr', C.ce, (v) => h - m.b - v * (h - m.t - m.b), 2);
  line('rpm', C.brass, fy, 2.5);
  ctx.lineWidth = 1;
  ctx.fillStyle = C.brass; ctx.fillText('转速', m.l + 8, m.t + 8);
  ctx.fillStyle = C.ce; ctx.fillText('节流阀开度', m.l + 60, m.t + 8);
}

// ---------------------------------------------------------------------------
// 能量流（桑基图）
// ---------------------------------------------------------------------------
export function drawSankey(cv, sim) {
  const ctx = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  ctx.clearRect(0, 0, w, h);
  const st = sim.stats;
  const Q = Math.max(1, st.fuelHeat);
  const flue = Q * 0.28;
  const steamE = Q - flue;
  const Wi = Math.max(0, Math.min(steamE, st.ihp));
  const exh = steamE - Wi;
  const Wf = Math.max(0, Math.min(Wi, st.friction));
  const Wb = Math.max(0, Wi - Wf);
  const top = 70, H = h - top - 185;
  const k = H / Q;
  const bw = 18;
  const X = [16, 190, 360, 520];
  const node = (x, y, v, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, bw, Math.max(3, v * k)); };
  const band = (x0, y0, x1, y1, v, color) => {
    const t = Math.max(3, v * k);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x0 + bw, y0);
    ctx.bezierCurveTo((x0 + x1) / 2, y0, (x0 + x1) / 2, y1, x1, y1);
    ctx.lineTo(x1, y1 + t);
    ctx.bezierCurveTo((x0 + x1) / 2, y1 + t, (x0 + x1) / 2, y0 + t, x0 + bw, y0 + t);
    ctx.closePath(); ctx.fill();
  };
  const kw = (v) => `${(v / 1000).toFixed(v < 10000 ? 1 : 0)} kW`;
  const pct = (v) => `${(v / Q * 100).toFixed(v / Q < 0.1 ? 1 : 0)}%`;
  const label = (x, y, title, sub, color, align = 'left') => {
    ctx.textAlign = align; ctx.textBaseline = 'top';
    ctx.font = `bold 25px ${FONT}`; ctx.fillStyle = color; ctx.fillText(title, x, y);
    ctx.font = `22px ${FONT}`; ctx.fillStyle = C.text; ctx.fillText(sub, x, y + 30);
  };
  // 燃料 → 烟气 + 蒸汽
  node(X[0], top, Q, '#c46a2c');
  const yS = top + flue * k + 40;
  band(X[0], top, X[1], top, flue, 'rgba(130,120,110,0.45)');
  band(X[0], top + flue * k, X[1], yS, steamE, 'rgba(240,207,138,0.32)');
  node(X[1], top, flue, '#7a7068');
  node(X[1], yS, steamE, '#e0b45a');
  // 蒸汽 → 乏汽 + 指示功
  const yW = yS + exh * k + 40;
  band(X[1], yS, X[2], yS, exh, 'rgba(76,180,255,0.3)');
  band(X[1], yS + exh * k, X[2], yW, Wi, 'rgba(95,211,154,0.5)');
  node(X[2], yS, exh, '#4cb4ff');
  node(X[2], yW, Wi, '#5fd39a');
  // 指示功 → 摩擦 + 有用功
  const yF = yW - 6, yB = yW + Wf * k + 30;
  band(X[2], yW, X[3], yF, Wf, 'rgba(255,138,90,0.5)');
  band(X[2], yW + Wf * k, X[3], yB, Wb, 'rgba(95,211,154,0.75)');
  node(X[3], yF, Wf, '#ff8a5a');
  node(X[3], yB, Wb, '#5fd39a');

  label(X[0], 10, '燃料', `${kw(Q)} · 耗煤≈${(Q / 29e6 * 3600).toFixed(0)} kg/h`, '#f0a060');
  label(X[1] + bw + 8, top + 2, '烟囱损失', pct(flue), '#b8aea4');
  label(X[1] + bw + 8, yS + Math.min(steamE * k * 0.5, 80), '蒸汽', pct(steamE), '#f0cf8a');
  label(X[2] + bw + 8, yS + Math.min(exh * k * 0.3, 90), '随乏汽排走', pct(exh), '#8fd0ff');
  label(X[2] - 8, yW + Math.max(8, Wi * k) + 10, '指示功', `${kw(Wi)} · ${pct(Wi)}`, '#8fe8b8', 'right');
  label(w - 6, yF - 64, '摩擦', kw(Wf), '#ffb08a', 'right');
  label(w - 6, yB + Math.max(6, Wb * k) + 8, '有用功', `${kw(Wb)} · 效率 ${(Wb / Q * 100).toFixed(1)}%`, '#8fe8b8', 'right');
}
