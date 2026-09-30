// ---------------------------------------------------------------------------
// 分步导览：每一步设定 视角 / 剖视 / 时间倍率 / 聚焦部件，并给出讲解与实时数值
// ---------------------------------------------------------------------------
import { P_ATM, PARAMS } from '../physics.js';
import { D, crossheadDX } from '../dims.js';

const $ = (id) => document.getElementById(id);
const bar = (p) => ((p - P_ATM) / 1e5).toFixed(2);
const kN = (f) => (Math.abs(f) / 1000).toFixed(1);

const OVERVIEW = { pos: [5.5, 2.6, 4.8], target: [1.05, 0.3, -1.15] };
const SEC_VIEW = { pos: [2.34, 1.9, 1.28], target: [2.2, -0.02, 0.1] };

export const STEPS = [
  {
    title: '一套完整的蒸汽动力装置',
    view: OVERVIEW, focus: null, time: 1,
    text: `眼前是一台 19 世纪末工厂里常见的<b>卧式单缸双作用蒸汽机</b>，后方是为它供汽的<b>机车式火管锅炉</b>。
      <br>能量沿着这条路走：<b>煤燃烧</b>放热 → <b>锅炉</b>把水烧成约 7 bar、170 °C 的蒸汽 → 蒸汽经<b>主汽管</b>进入<b>阀箱</b> →
      <b>滑阀</b>把蒸汽轮流送进<b>气缸</b>两端，推动<b>活塞</b>往复 → <b>连杆和曲柄</b>把往复变成旋转 → <b>飞轮</b>稳速后输出动力。
      <br>此刻转速 <span class="live" data-k="rpm"></span> r/min，输出 <span class="live" data-k="kw"></span> kW。`,
    live: (s) => ({ rpm: s.rpm.toFixed(0), kw: (s.stats.brake / 1000).toFixed(1) }),
  },
  {
    title: '锅炉：把热变成“有压力的蒸汽”',
    view: { pos: [0.95, 3.1, 1.6], target: [0.85, 0.05, -3.1] }, focus: ['boiler', 'firebox', 'dome', 'chimney', 'safety', 'instruments', 'stopValve'],
    secBoiler: true, time: 1,
    text: `锅炉已被剖开。左端<b>火箱</b>里煤在炉排上燃烧；高温烟气（<span class="h">橙色粒子</span>）穿过浸在水里的一排排<b>火管</b>，
      把热量传给周围的水，冷却后进入烟箱、从<b>烟囱</b>排出。
      <br>水被加热到约 170 °C 沸腾（压力越高沸点越高）。1 kg 水变成 7 bar 的蒸汽，体积膨胀约 <b>250 倍</b>——正是这种“挤在锅里想膨胀”的趋势，形成了压力。
      蒸汽聚集在水面上方，从最高处的<b>汽包</b>引出。
      <br>当前锅炉压力 <span class="live" data-k="pb"></span> bar，炉火强度 <span class="live" data-k="fire"></span>%。`,
    live: (s) => ({ pb: bar(s.pB), fire: (s.fire * 100).toFixed(0) }),
  },
  {
    title: '安全阀、压力表与水位计',
    view: { pos: [0.05, 1.45, -1.25], target: [-0.75, 0.55, -2.6] }, focus: ['safety', 'instruments', 'boiler', 'whistle'],
    time: 1,
    text: `锅炉是一个装满高温高压水和蒸汽的“炸弹”，历史上发生过大量爆炸事故。司炉工靠三样东西保证安全：
      <br>• <b>压力表</b>（波登管式）：实时读数 <span class="live" data-k="pb"></span> bar；表盘红区从 9 bar 开始。
      <br>• <b>安全阀</b>：弹簧压住阀芯，压力超过 9 bar 时自动顶开放汽。可以试试：把锅炉压力设定调到最高再“停车”，看它起跳。
      <br>• <b>玻璃水位计</b>：水位必须始终淹没火箱顶板，否则铜板过热会被烧穿。`,
    live: (s) => ({ pb: bar(s.pB) }),
    actions: [{ label: '停车并提高压力设定（观察安全阀起跳）', fn: (api) => { api.setBoiler(8.5); api.sim.running = false; api.syncRun(); } },
      { label: '恢复运行', fn: (api) => { api.setBoiler(7); api.sim.running = true; api.syncRun(); } }],
  },
  {
    title: '送汽：主汽阀 → 主蒸汽管 → 节流阀 → 阀箱',
    view: { pos: [4.6, 2.7, 1.6], target: [1.7, 0.6, -1.3] }, focus: ['stopValve', 'steamPipe', 'throttle', 'chest', 'governor'],
    time: 1,
    text: `汽包顶上的<b>主汽阀</b>是总开关，点控制台的“停车/开车”，可以看到它的手轮转动。
      <br>蒸汽沿紫铜<b>主蒸汽管</b>流到发动机，先经过<b>节流阀</b>（由上方的调速器自动控制开度），再进入紧贴气缸侧面的<b>阀箱</b>。
      阀箱里始终充满新鲜蒸汽，压力 <span class="live" data-k="pch"></span> bar——比锅炉略低，因为节流阀会“节流降压”。
      <br>节流阀开度：<span class="live" data-k="thr"></span>%。`,
    live: (s) => ({ pch: bar(s.out.pCh), thr: (s.throttle * 100).toFixed(0) }),
  },
  {
    title: '滑阀配汽：让蒸汽轮流进入两端',
    view: SEC_VIEW, focus: ['cylinder', 'covers', 'chest', 'chestCover', 'valve', 'piston'],
    secEngine: true, time: 0.06,
    text: `气缸和阀箱被<b>水平剖开</b>（时间放慢到 0.06×）。颜色表示压力：<span class="h">红/橙 = 高压新汽</span>，<span class="c">蓝 = 低压乏汽</span>。
      <br>阀箱里的 <b>D 形滑阀</b>贴着阀座左右滑动，阀座上有三个口：两侧的<b>进汽口</b>分别通向气缸两端，中间是<b>排汽口</b>。
      <br>• 滑阀向一侧移开，那一端的进汽口就暴露在阀箱的高压蒸汽中 → <span class="h">进汽</span>；
      <br>• 同时滑阀底部的 D 形空腔把另一端的汽口与排汽口连通 → <span class="c">排汽</span>。
      <br>右侧“配汽示意”是同一剖面的平面图。当前：<span class="live" data-k="st"></span>`,
    live: (s) => ({ st: stroke(s) }),
  },
  {
    title: '推力从哪来：活塞两侧的压力差',
    view: { pos: [2.05, 1.25, 1.05], target: [2.2, -0.02, 0.02] }, focus: ['cylinder', 'covers', 'chest', 'valve', 'piston', 'chestCover'],
    secEngine: true, time: 0.06,
    text: `活塞一侧是高压蒸汽，另一侧通排汽，两侧压力差作用在活塞面积上，就是推力：
      <div class="formula">F = p<sub>缸盖端</sub>·A − p<sub>曲轴端</sub>·(A − A<sub>杆</sub>)</div>
      活塞面积 A = ${(PARAMS.A_P * 1e4).toFixed(0)} cm²。此刻：缸盖端 <span class="live" data-k="phe"></span> bar，曲轴端 <span class="live" data-k="pce"></span> bar（表压），
      推力 <b><span class="live" data-k="f"></span> kN</b>（黄色箭头）。
      <br>“双作用”意味着活塞<b>来回都被推</b>：推力方向随冲程交替，每转两次做功。`,
    live: (s) => ({ phe: bar(s.out.pHE), pce: bar(s.out.pCE), f: kN(s.out.force) }),
  },
  {
    title: '截汽与膨胀：读懂示功图',
    view: SEC_VIEW, focus: ['cylinder', 'covers', 'chest', 'valve', 'piston', 'chestCover'],
    secEngine: true, time: 0.05, openRight: true,
    text: `看右侧<b>示功图</b>：横轴是活塞位置（≈ 缸内容积），纵轴是缸内压力，每一端每转画出一个闭合环。
      <br>① <b>进汽</b>：压力≈阀箱压力的水平线；② 约在行程 <b><span class="live" data-k="cut"></span>%</b> 处滑阀关闭进汽口——<b>截汽</b>；
      ③ 之后蒸汽靠自身弹性<b>膨胀</b>继续推活塞，压力沿 pV≈常数 的曲线下降；④ 接近行程终点时排汽口打开——<b>释放</b>，压力骤降；
      ⑤ 回程排汽，最后排汽口关闭，残汽被<b>压缩</b>成“汽垫”，让活塞平稳换向。
      <br>环所围的<b>面积 = 每转所做的功</b>（这就是“示功”的含义），本机每转约 <span class="live" data-k="w"></span> kJ。`,
    live: (s) => ({ cut: (s.cutoffFraction() * 100).toFixed(0), w: (s.stats.ihp / Math.max(0.1, s.stats.rpmAvg / 60) / 1000).toFixed(1) }),
  },
  {
    title: '排汽：一“噗”一“噗”的节拍',
    view: { pos: [5.4, 2.4, 3.2], target: [2.9, 1.1, -0.6] }, focus: ['exhaust', 'cylinder', 'chest', 'condenser', 'covers'],
    time: 0.5,
    text: `做完功的<b>乏汽</b>经滑阀空腔、缸底排汽道流入<b>排汽管</b>，由立管排入大气。
      每个冲程末“释放”时，缸内还有约 <span class="live" data-k="rel"></span> bar 的压力，突然放出便形成一团白汽——每转两“噗”，这就是蒸汽机特有的节拍声。
      <br>乏汽带走了大部分热量（见左侧“能量”页），这是蒸汽机效率不高的主要原因。`,
    live: (s) => ({ rel: releaseP(s) }),
  },
  {
    title: '直线变旋转：十字头、连杆与曲柄',
    view: { pos: [1.55, 0.75, 1.75], target: [0.72, -0.02, 0.0] }, focus: ['crosshead', 'conrod', 'crank', 'piston', 'bearings'],
    time: 0.15,
    text: `活塞杆的推拉力传到<b>十字头</b>。十字头在上下<b>导板</b>之间滑动，承受连杆倾斜带来的侧向力，让活塞杆只做纯直线运动。
      <br><b>连杆</b>小头随十字头往复，大头套在<b>曲柄销</b>上转圈——往复运动就这样变成了旋转。
      <br>曲轴扭矩 = 活塞力 × 等效力臂。此刻扭矩 <span class="live" data-k="tq"></span> kN·m。
      <br>注意活塞在两端时（<b>死点</b>），连杆与曲柄成一直线、力臂为零，推力再大也产生不了扭矩！看右侧扭矩曲线在 0° 和 180° 处降到零。`,
    live: (s) => ({ tq: (s.out.torque / 1000).toFixed(2) }),
  },
  {
    title: '飞轮：越过死点，稳定转速',
    view: { pos: [3.2, 1.3, 2.3], target: [0.1, 0.0, -0.8] }, focus: ['flywheel', 'crank', 'conrod', 'bearings'],
    time: 0.5, openRight: true,
    text: `一转之中，蒸汽产生的扭矩忽大忽小（右侧扭矩曲线），而负载需要的扭矩基本不变（虚线）。
      <br><span style="color:#5fd39a">绿色面积</span>：蒸汽扭矩大于负载，多余能量存进<b>飞轮</b>，飞轮略微加速；
      <span style="color:#ff8a5a">橙色面积</span>：扭矩不足（尤其在死点附近），飞轮释放动能补上。
      <br>这只约 1.2 吨、直径 2.1 m 的飞轮在 <span class="live" data-k="rpm"></span> r/min 时储存动能约 <span class="live" data-k="ke"></span> kJ，是每转做功的好几倍，所以转速波动很小。`,
    live: (s) => ({ rpm: s.rpm.toFixed(0), ke: (0.5 * PARAMS.I_FLY * s.omega * s.omega / 1000).toFixed(0) }),
  },
  {
    title: '偏心轮：让滑阀“提前一步”',
    view: { pos: [1.35, 0.55, 1.65], target: [0.55, -0.02, 0.26] }, focus: ['eccentric', 'valve', 'crank', 'chest', 'valveGuide'],
    time: 0.12,
    text: `滑阀由曲轴上的<b>偏心轮</b>驱动。偏心轮是一个圆盘，中心偏离轴心 ${D.ECC_R * 1000} mm，转动时就像一个“小曲柄”，经<b>偏心杆</b>、阀杆推动滑阀往复。
      <br>它的相位比曲柄<b>超前 90° + 超前角</b>（本机超前角 ${(D.ADVANCE * 180 / Math.PI).toFixed(1)}°）：
      90° 使滑阀在活塞行程中点时处于最大开度；再多出的超前角让滑阀在活塞到达死点<b>之前</b>就把进汽口打开一点（<b>导程</b> ${D.LEAD * 1000} mm），
      死点一过就有充足的蒸汽推动。
      <br>阀的外缘比汽口多出的“余面”（${D.LAP * 1000} mm）决定了何时截汽。`,
  },
  {
    title: '调速器：最早的自动控制',
    view: { pos: [3.05, 1.35, 1.75], target: [2.25, 0.72, 0.29] }, focus: ['governor', 'throttle', 'belt', 'chest'],
    time: 1, openRight: true,
    text: `调速器由皮带带动，转速与发动机成正比。转得越快，<b>飞球</b>被离心力甩得越开，带着套筒上升，经杠杆把<b>节流阀关小</b>；变慢时相反。
      <br>动手试试：突然<b>加大负载</b>，转速先下降 → 飞球收拢 → 节流阀开大 → 转速回升到新的平衡。看右侧“转速与节流阀”曲线的变化。
      <br>当前：<span class="live" data-k="rpm"></span> r/min，飞球张角 <span class="live" data-k="phi"></span>°，节流阀 <span class="live" data-k="thr"></span>%。`,
    live: (s) => ({ rpm: s.rpm.toFixed(1), phi: (s.phi * 180 / Math.PI).toFixed(1), thr: (s.throttle * 100).toFixed(0) }),
    actions: [
      { label: '负载 +50%', fn: (api) => api.setLoad(Math.min(6000, Math.round(api.sim.loadSet * 1.5 / 100) * 100)) },
      { label: '负载 −50%', fn: (api) => api.setLoad(Math.round(api.sim.loadSet * 0.5 / 100) * 100) },
      { label: '恢复 3800 N·m', fn: (api) => api.setLoad(3800) },
      { label: '关掉调速器试试', fn: (api) => api.setGov(false) },
      { label: '打开调速器', fn: (api) => api.setGov(true) },
    ],
  },
  {
    title: '冷凝器：瓦特的关键发明',
    view: { pos: [5.8, 1.5, 2.2], target: [3.7, -0.2, -0.3] }, focus: ['condenser', 'exhaust', 'cylinder', 'covers', 'chest'],
    time: 1, openRight: true,
    text: `1765 年瓦特意识到：在气缸里直接喷冷水冷凝蒸汽（纽科门机的做法），会把气缸本身也冷却，下一冲程的新汽大量浪费在重新加热缸壁上。
      他的办法是<b>分离冷凝器</b>：气缸保持热，乏汽引到单独的冷凝器中冷却成水。
      <br>蒸汽凝结后体积缩小上千倍，冷凝器内形成真空（约 0.2 bar 绝对压力），活塞背面的阻力大大减小。
      点下面的按钮切换，比较示功图底线的下移和蒸汽耗量：<span class="live" data-k="steam"></span> kg/h。`,
    live: (s) => ({ steam: (s.stats.steamRate * 3600).toFixed(0) }),
    actions: [
      { label: '打开冷凝器', fn: (api) => api.setCond(true) },
      { label: '改为排大气', fn: (api) => api.setCond(false) },
    ],
  },
  {
    title: '能量去哪儿了',
    view: OVERVIEW, focus: null, time: 1, energyTab: true,
    text: `左侧“能量”页实时显示每秒的能量流向。燃料热量约 28% 随烟气从烟囱散失；剩下的变成蒸汽，但发动机只把其中很小一部分变成功，
      绝大部分作为<b>汽化潜热</b>随乏汽排走。本机热效率约 <span class="live" data-k="eff"></span>%。
      <br>后来的工程师用<b>多级膨胀</b>、<b>过热蒸汽</b>、<b>高压</b>和<b>冷凝</b>不断提高效率，最终发展出汽轮机——今天大多数火电、核电站仍然是“烧水推动叶轮”，原理一脉相承。
      <br>导览结束。你可以自由拖动视角、点击任何部件查看说明，或在底部控制台调节负载、压力与时间倍率。`,
    live: (s) => ({ eff: (s.stats.eff * 100).toFixed(1) }),
  },
];

function stroke(s) {
  const o = s.out;
  const vel = crossheadDX(o.theta) * o.omega;
  const side = (st, ex, dV) => (st > 0 ? '<span class="h">进汽</span>' : ex > 0 ? '<span class="c">排汽</span>' : dV > 0 ? '<span class="h">膨胀</span>' : '<span class="c">压缩</span>');
  return `缸盖端 ${side(o.op.heSteam, o.op.heExh, -vel)}，曲轴端 ${side(o.op.ceSteam, o.op.ceExh, vel)}`;
}
function releaseP(s) {
  const ev = s.valveEvents();
  const d = ev.he.release;
  const p = s.lastCycle.pHE[d - 1] || s.out.pHE;
  return bar(p);
}

export function createTour(api) {
  const el = $('tour');
  const dots = $('tour-dots');
  let idx = -1, tLive = 0, leftWasOpen = false;
  STEPS.forEach((s, i) => {
    const d = document.createElement('i');
    d.title = s.title;
    d.onclick = () => go(i);
    dots.appendChild(d);
  });
  const tour = {
    active: false,
    start(i = 0) {
      if (!tour.active) {
        leftWasOpen = !$('left').classList.contains('collapsed');
        if (leftWasOpen) document.querySelector('#left .collapse').click();
      }
      tour.active = true; el.classList.remove('hidden'); $('btn-tour').textContent = '✕ 退出导览';
      api.syncInsets();
      go(i);
    },
    exit() {
      tour.active = false; el.classList.add('hidden'); $('btn-tour').textContent = '▶ 开始导览';
      api.parts.focus(null);
      api.set('secEngine', false); api.set('secBoiler', false);
      api.setTime(1);
      idx = -1;
      if (leftWasOpen) $('reopen-left').click();
      api.syncInsets();
    },
    next() { if (idx < STEPS.length - 1) go(idx + 1); else tour.exit(); },
    prev() { if (idx > 0) go(idx - 1); },
    update(dt) {
      if (!tour.active || idx < 0) return;
      tLive += dt;
      if (tLive < 0.2) return;
      tLive = 0;
      const s = STEPS[idx];
      if (!s.live) return;
      const vals = s.live(api.sim);
      el.querySelectorAll('.live').forEach((n) => { if (vals[n.dataset.k] !== undefined) n.innerHTML = vals[n.dataset.k]; });
    },
  };
  function go(i) {
    idx = i;
    const s = STEPS[i];
    api.select(null);
    $('tour-step').textContent = `${i + 1} / ${STEPS.length}`;
    [...dots.children].forEach((d, k) => { d.classList.toggle('on', k === i); d.classList.toggle('done', k < i); });
    $('tour-title').textContent = s.title;
    $('tour-text').innerHTML = s.text;
    const act = $('tour-actions');
    act.innerHTML = '';
    for (const a of s.actions || []) {
      const b = document.createElement('button');
      b.textContent = a.label;
      b.onclick = () => a.fn(api);
      act.appendChild(b);
    }
    $('tour-prev').disabled = i === 0;
    $('tour-next').textContent = i === STEPS.length - 1 ? '完成 ✓' : '下一步 ›';
    api.set('secEngine', !!s.secEngine);
    api.set('secBoiler', !!s.secBoiler);
    api.set('exploded', false);
    api.parts.focus(s.focus);
    api.setTime(s.time ?? 1);
    api.setPaused(false);
    if (!api.sim.running && i !== 2) { api.sim.running = true; api.syncRun(); }
    api.flyTo(s.view.pos, s.view.target, 1.8);
    if (s.openRight && document.getElementById('right').classList.contains('collapsed')) document.querySelector('#reopen-right').click();
    if (s.energyTab) document.querySelector('.tab[data-tab="energy"]').click();
    tLive = 1;
    tour.update(0);
  }
  $('tour-prev').onclick = () => tour.prev();
  $('tour-next').onclick = () => tour.next();
  $('tour-exit').onclick = () => tour.exit();
  return tour;
}
