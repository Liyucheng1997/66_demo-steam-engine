// ---------------------------------------------------------------------------
// 主尺寸（单位：米）。三维模型与物理仿真共用同一套尺寸，保证“所见即所算”。
//
// 坐标约定：x 轴沿气缸中心线，曲轴中心在原点，气缸在 +x 方向；
//          y 轴向上；z 轴指向观察者（机器“前侧”，阀箱与偏心轮都在前侧）。
// ---------------------------------------------------------------------------

export const D = {
  // 曲柄-连杆机构
  R: 0.25,            // 曲柄半径（行程 0.5 m）
  L: 1.25,            // 连杆长度（L/R = 5）
  ROD: 1.0,           // 十字头销 → 活塞中心 的距离（活塞杆长）

  // 气缸
  BORE_R: 0.125,      // 缸径 250 mm
  ROD_R: 0.025,       // 活塞杆直径 50 mm
  PISTON_T: 0.12,     // 活塞厚度
  BORE_X0: 1.91,      // 曲轴侧缸盖内端面
  BORE_X1: 2.59,      // 缸盖侧（后缸盖）内端面
  BARREL_R: 0.165,    // 缸筒外径
  CYL_FLANGE_R: 0.245,

  // 滑阀与汽口（阀座平面在 z = FACE_Z，汽口沿 x 排列）
  VX: 2.25,           // 阀座中心 x
  FACE_Z: 0.195,      // 阀座（汽口面）所在 z
  ZV: 0.262,          // 阀杆 / 偏心轮 所在 z 平面
  PORT_W: 0.032,      // 进汽口宽
  PORT_H: 0.12,       // 汽口高（沿 y）
  BRIDGE: 0.025,      // 汽口间“桥”宽
  EXH_W: 0.06,        // 排汽口宽
  LAP: 0.028,         // 进汽余面（外余面）
  EXLAP: 0.0,         // 排汽余面（内余面）
  LEAD: 0.003,        // 导程（死点时的预开度）
  ECC_R: 0.06,        // 偏心距（阀行程 = 2×偏心距）
  ECC_L: 1.2,         // 偏心杆长

  // 飞轮
  FLY_R: 1.0,         // 轮缘平均半径
  FLY_Z: -0.8,

  // 地坪
  FLOOR_Y: -0.8,
};

// 由基本尺寸推导的汽口 x 坐标（阀位于中位 u = 0 时）
const half = D.EXH_W / 2;
D.EXH_X0 = D.VX - half;
D.EXH_X1 = D.VX + half;
D.CE_PORT_X1 = D.EXH_X0 - D.BRIDGE;          // 曲轴端(CE)汽口 内缘
D.CE_PORT_X0 = D.CE_PORT_X1 - D.PORT_W;      //                外缘
D.HE_PORT_X0 = D.EXH_X1 + D.BRIDGE;          // 缸盖端(HE)汽口 内缘
D.HE_PORT_X1 = D.HE_PORT_X0 + D.PORT_W;      //                外缘
// D 形滑阀外缘 / 内腔（u = 0）
D.VALVE_X0 = D.CE_PORT_X0 - D.LAP;
D.VALVE_X1 = D.HE_PORT_X1 + D.LAP;
D.CAV_X0 = D.CE_PORT_X1 + D.EXLAP;
D.CAV_X1 = D.HE_PORT_X0 - D.EXLAP;

// 超前角 δ：偏心轮领先曲柄 90° + δ
D.ADVANCE = Math.asin((D.LAP + D.LEAD) / D.ECC_R);
D.ECC_PHASE = Math.PI / 2 + D.ADVANCE;

// ---- 运动学 ---------------------------------------------------------------
const R = D.R, L = D.L;

/** 十字头销 x 坐标 */
export function crossheadX(theta) {
  const s = R * Math.sin(theta);
  return R * Math.cos(theta) + Math.sqrt(L * L - s * s);
}
/** d x / d θ */
export function crossheadDX(theta) {
  const s = Math.sin(theta), c = Math.cos(theta);
  const k = Math.sqrt(L * L - R * R * s * s);
  return -R * s - (R * R * s * c) / k;
}
/** d² x / d θ² */
export function crossheadDDX(theta) {
  const s = Math.sin(theta), c = Math.cos(theta);
  const k2 = L * L - R * R * s * s;
  const k = Math.sqrt(k2);
  const R2 = R * R;
  return -R * c - (R2 * (c * c - s * s)) / k - (R2 * R2 * s * s * c * c) / (k2 * k);
}
/** 活塞中心 x */
export function pistonX(theta) { return crossheadX(theta) + D.ROD; }

/** 偏心轮中心 */
export function eccentricCenter(theta) {
  const a = theta + D.ECC_PHASE;
  return { x: D.ECC_R * Math.cos(a), y: D.ECC_R * Math.sin(a) };
}
const K0 = D.ECC_L - (D.ECC_R * D.ECC_R) / (4 * D.ECC_L);
/** 滑阀位移 u（相对中位，+x 为正），由偏心杆的真实几何求得 */
export function valveU(theta) {
  const e = eccentricCenter(theta);
  return e.x + Math.sqrt(D.ECC_L * D.ECC_L - e.y * e.y) - K0;
}
/** 偏心杆端（阀杆接头）x */
export function valveKnuckleX(theta) {
  const e = eccentricCenter(theta);
  return e.x + Math.sqrt(D.ECC_L * D.ECC_L - e.y * e.y);
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
/** 四个汽口开度（米）：he/ce 进汽，he/ce 排汽 */
export function portOpenings(u) {
  return {
    heSteam: clamp(-u - D.LAP, 0, D.PORT_W),
    heExh: clamp(u - D.EXLAP, 0, D.PORT_W),
    ceSteam: clamp(u - D.LAP, 0, D.PORT_W),
    ceExh: clamp(-u - D.EXLAP, 0, D.PORT_W),
  };
}
