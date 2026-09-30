// ---------------------------------------------------------------------------
// 界面：工具栏、控制台、面板、部件列表/卡片、标签、拾取、读数与图表刷新
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { computeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { drawIndicator, drawValve, drawTorque, drawTrend, drawSankey } from './charts.js';
import { crossheadDX } from '../dims.js';
import { P_ATM } from '../physics.js';
import { createTour } from './tour.js';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const $ = (id) => document.getElementById(id);
export const HOME_VIEW = { pos: [5.5, 2.6, 4.8], target: [1.05, 0.3, -1.15] };

export function createUI(ctx) {
  const { stage, parts, engine, fx, sim } = ctx;
  const state = {
    paused: false, timeScale: 1,
    secEngine: false, secBoiler: false, exploded: false,
    labels: true, force: true, effects: true,
    selected: null, hover: null, solo: false,
  };

  // ------------------------------------------------------------------
  // 工具栏
  // ------------------------------------------------------------------
  const toggleBtn = (id, key, fn) => {
    const b = $(id);
    b.onclick = () => { set(key, !state[key]); };
    return b;
  };
  function set(key, v) {
    state[key] = v;
    const map = { secEngine: 'btn-sec-engine', secBoiler: 'btn-sec-boiler', exploded: 'btn-explode', labels: 'btn-labels', force: 'btn-force', effects: 'btn-fx' };
    if (map[key]) $(map[key]).classList.toggle('on', v);
    if (key === 'secEngine') { parts.setSection('engine', v); fx.setSection(state.secEngine, state.secBoiler); }
    if (key === 'secBoiler') { parts.setSection('boiler', v); fx.setSection(state.secEngine, state.secBoiler); }
    if (key === 'force') { engine.arrow.visible = v; forceLabel.style.display = v ? '' : 'none'; }
    if (key === 'effects') { fx.smoke.points.visible = v; fx.steam.points.visible = v; }
  }
  toggleBtn('btn-sec-engine', 'secEngine');
  toggleBtn('btn-sec-boiler', 'secBoiler');
  toggleBtn('btn-explode', 'exploded');
  toggleBtn('btn-labels', 'labels');
  toggleBtn('btn-force', 'force');
  toggleBtn('btn-fx', 'effects');
  $('btn-home').onclick = () => stage.flyTo(HOME_VIEW.pos, HOME_VIEW.target);

  // 面板收起
  document.querySelectorAll('[data-target]').forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.target;
      const panel = $(id);
      const col = !panel.classList.contains('collapsed');
      panel.classList.toggle('collapsed', col);
      $('reopen-' + id).classList.toggle('show', col);
      document.body.classList.toggle(id + '-collapsed', col);
    };
  });
  if (window.innerWidth < 1100) { $('left').classList.add('collapsed'); $('reopen-left').classList.add('show'); document.body.classList.add('left-collapsed'); }
  if (window.innerWidth < 700) { $('right').classList.add('collapsed'); $('reopen-right').classList.add('show'); document.body.classList.add('right-collapsed'); }
  let tourRef = null;
  function syncInsets() {
    if (window.innerWidth < 900) { stage.setInsets(0, 0); return; }
    let l = $('left').classList.contains('collapsed') ? 0 : $('left').offsetWidth + 12;
    if (tourRef && tourRef.active) l = Math.max(l, $('tour').offsetWidth + 12);
    const r = $('right').classList.contains('collapsed') ? 0 : $('right').offsetWidth + 12;
    stage.setInsets(l, r);
  }
  new MutationObserver(syncInsets).observe($('left'), { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(syncInsets).observe($('right'), { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', syncInsets);
  syncInsets();

  // 选项卡
  document.querySelectorAll('.tab').forEach((t) => {
    t.onclick = () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
      document.querySelectorAll('.tab-page').forEach((p) => p.classList.toggle('active', p.dataset.tab === t.dataset.tab));
    };
  });

  // ------------------------------------------------------------------
  // 控制台
  // ------------------------------------------------------------------
  const btnRun = $('btn-run');
  const syncRun = () => {
    btnRun.textContent = sim.running ? '■ 停车' : '▶ 开车';
    btnRun.classList.toggle('stop', sim.running);
    btnRun.classList.toggle('run', !sim.running);
  };
  btnRun.onclick = () => { sim.running = !sim.running; syncRun(); };
  syncRun();
  const btnPause = $('btn-pause');
  const setPaused = (p) => { state.paused = p; btnPause.textContent = p ? '▶' : '⏸'; btnPause.classList.toggle('on', p); };
  btnPause.onclick = () => setPaused(!state.paused);

  const slTime = $('sl-time');
  const setTime = (ts) => {
    state.timeScale = ts;
    slTime.value = String(Math.round(Math.log(ts / 0.02) / Math.log(50) * 100));
    $('lb-time').textContent = ts >= 0.995 ? '1×' : `${ts < 0.1 ? ts.toFixed(2) : ts.toFixed(1)}×`;
  };
  slTime.oninput = () => setTime(0.02 * Math.pow(50, slTime.value / 100));

  const slLoad = $('sl-load');
  const setLoad = (v) => { sim.loadSet = v; slLoad.value = v; $('lb-load').textContent = `${v} N·m`; };
  slLoad.oninput = () => setLoad(+slLoad.value);
  const slB = $('sl-boiler');
  const setBoiler = (v) => { sim.boilerSet = v * 1e5; slB.value = v; $('lb-boiler').textContent = `${(+v).toFixed(1)} bar`; };
  slB.oninput = () => setBoiler(+slB.value);
  const ckGov = $('ck-gov'), slThr = $('sl-thr');
  const setGov = (auto) => {
    sim.governorAuto = auto; ckGov.checked = auto; slThr.disabled = auto;
    if (!auto) { slThr.value = Math.round(sim.throttle * 100); sim.throttleManual = sim.throttle; }
  };
  ckGov.onchange = () => setGov(ckGov.checked);
  slThr.oninput = () => { sim.throttleManual = slThr.value / 100; };
  const btnCond = $('btn-cond');
  const setCond = (on) => { sim.condenser = on; btnCond.classList.toggle('on', on); btnCond.textContent = on ? '冷凝器：开' : '冷凝器：关'; };
  btnCond.onclick = () => setCond(!sim.condenser);

  // ------------------------------------------------------------------
  // 部件列表 / 卡片
  // ------------------------------------------------------------------
  const listEl = $('part-list');
  const cats = {};
  for (const p of parts.list) {
    if (p.label === false && !p.view) continue;
    (cats[p.cat] = cats[p.cat] || []).push(p);
  }
  const listBtns = {};
  for (const [cat, ps] of Object.entries(cats)) {
    const h = document.createElement('div'); h.className = 'cat'; h.textContent = cat; listEl.appendChild(h);
    for (const p of ps) {
      const b = document.createElement('button');
      b.textContent = p.name;
      b.onclick = () => { select(p); flyToPart(p); };
      listEl.appendChild(b);
      listBtns[p.id] = b;
    }
  }
  const card = $('partcard');
  function select(p) {
    if (state.selected && state.selected !== p) parts.setHighlight(state.selected, 0);
    state.selected = p;
    Object.values(listBtns).forEach((b) => b.classList.remove('sel'));
    if (!p) { card.classList.add('hidden'); if (state.solo) setSolo(false); return; }
    listBtns[p.id]?.classList.add('sel');
    parts.setHighlight(p, 2);
    $('pc-cat').textContent = p.cat;
    $('pc-name').textContent = p.name;
    $('pc-desc').textContent = p.desc;
    card.classList.remove('hidden');
    if (state.solo) parts.focus([p.id, ...(SOLO_EXTRA[p.id] || [])]);
  }
  function flyToPart(p) { if (p.view) stage.flyTo(p.view.pos, p.view.target); }
  const SOLO_EXTRA = { chest: ['chestCover'], valve: ['valveGuide'], governor: ['belt', 'throttle'], boiler: ['dome', 'chimney'] };
  function setSolo(on) {
    state.solo = on;
    $('pc-solo').classList.toggle('on', on);
    if (on && state.selected) parts.focus([state.selected.id, ...(SOLO_EXTRA[state.selected.id] || [])]);
    else parts.focus(null);
    if (state.selected) parts.setHighlight(state.selected, 2);
  }
  $('pc-x').onclick = () => select(null);
  $('pc-focus').onclick = () => state.selected && flyToPart(state.selected);
  $('pc-solo').onclick = () => setSolo(!state.solo);

  // ------------------------------------------------------------------
  // 拾取
  // ------------------------------------------------------------------
  for (const m of parts.pickables) {
    if (m.geometry.attributes.position.count > 600 && !m.isInstancedMesh) {
      try { m.geometry.computeBoundsTree(); } catch (e) { /* ignore */ }
    }
  }
  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const tooltip = $('tooltip');
  let pointer = null, downAt = null;
  const canvas = stage.renderer.domElement;
  canvas.addEventListener('pointermove', (e) => { pointer = e; });
  canvas.addEventListener('pointerleave', () => { pointer = null; tooltip.style.display = 'none'; });
  canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
    const p = pick(e);
    select(p);
  });
  const visible = (o) => { for (let x = o; x; x = x.parent) if (!x.visible) return false; return true; };
  function pick(e) {
    const r = canvas.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, stage.camera);
    const hits = ray.intersectObjects(parts.pickables, false);
    for (const h of hits) {
      if (!visible(h.object)) continue;
      const p = parts.byId[h.object.userData.partId];
      if (!p || p.state.ghost) continue;
      return p.label === false && !p.view ? parentPart(p) : p;
    }
    return null;
  }
  const parentPart = (p) => ({ chestCover: parts.byId.chest, valveGuide: parts.byId.valve, whistle: parts.byId.boiler, belt: parts.byId.governor }[p.id] || p);
  function updateHover() {
    if (!pointer) { if (state.hover) { if (state.hover !== state.selected) parts.setHighlight(state.hover, 0); state.hover = null; } return; }
    const p = pick(pointer);
    if (p !== state.hover) {
      if (state.hover && state.hover !== state.selected) parts.setHighlight(state.hover, 0);
      state.hover = p;
      if (p && p !== state.selected) parts.setHighlight(p, 1);
    }
    if (p) {
      tooltip.style.display = 'block';
      tooltip.textContent = p.name;
      tooltip.style.left = pointer.clientX + 14 + 'px';
      tooltip.style.top = pointer.clientY + 10 + 'px';
      canvas.style.cursor = 'pointer';
    } else { tooltip.style.display = 'none'; canvas.style.cursor = ''; }
  }

  // ------------------------------------------------------------------
  // 标签（按优先级避让）
  // ------------------------------------------------------------------
  const layer = $('labels');
  const labels = [];
  for (const p of parts.list) {
    if (p.label === false) continue;
    const el = document.createElement('div');
    el.className = 'lbl';
    el.textContent = p.name.replace(/（.*）/, '');
    el.onclick = () => { select(p); flyToPart(p); };
    layer.appendChild(el);
    labels.push({ p, el, w: el.textContent.length * 13 + 22 });
  }
  const forceLabel = document.createElement('div');
  forceLabel.className = 'flabel';
  layer.appendChild(forceLabel);
  const v = new THREE.Vector3();
  function updateLabels() {
    const W = window.innerWidth, H = window.innerHeight;
    const placed = [];
    const order = labels.slice().sort((a, b) => (b.p === state.selected) - (a.p === state.selected) || (b.p === state.hover) - (a.p === state.hover));
    for (const L of order) {
      const p = L.p;
      let show = state.labels && !p.state.ghost;
      if (show && p.onlyIn && !state[p.onlyIn]) show = false;
      if (show) {
        parts.anchorWorld(p, v);
        v.project(stage.camera);
        if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) show = false;
      }
      if (show) {
        const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H - 14;
        const r = [x - L.w / 2, y - 24, x + L.w / 2, y];
        const pri = p === state.selected || p === state.hover;
        if (!pri && placed.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])) show = false;
        if (show) {
          placed.push(r);
          L.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
          L.el.classList.toggle('sel', p === state.selected);
        }
      }
      L.el.style.display = show ? '' : 'none';
    }
    // 推力标签（活塞被虚化时隐藏）
    const pistonGhost = parts.byId.piston.state.ghost;
    engine.arrow.visible = state.force && !pistonGhost;
    if (!engine.arrow.visible) forceLabel.style.display = 'none';
    if (state.force && engine.arrow.visible) {
      const F = engine.arrow.userData.F || 0;
      engine.arrow.getWorldPosition(v);
      v.y += 0.12;
      v.project(stage.camera);
      if (v.z < 1) {
        forceLabel.style.display = '';
        forceLabel.style.left = (v.x * 0.5 + 0.5) * W + 'px';
        forceLabel.style.top = (-v.y * 0.5 + 0.5) * H + 'px';
        forceLabel.textContent = `推力 ${(Math.abs(F) / 1000).toFixed(1)} kN ${F < 0 ? '←' : '→'}`;
      } else forceLabel.style.display = 'none';
    }
  }
  // 运动部件的标签锚点跟随
  const anchorAt = (id, obj, x, y, z) => { const a = new THREE.Object3D(); a.position.set(x, y, z); obj.add(a); parts.byId[id].anchorObj = a; };
  anchorAt('piston', parts.byId.piston.group, 0, 0.32, 0);
  anchorAt('crosshead', parts.byId.crosshead.group, 0, 0.2, 0);
  anchorAt('conrod', parts.byId.conrod.group, 0.62, 0.1, 0);
  anchorAt('valve', parts.byId.valve.group, 2.25, 0.02, 0.33);

  // ------------------------------------------------------------------
  // 读数 / 图表
  // ------------------------------------------------------------------
  const events = sim.valveEvents();
  $('txt-cutoff').textContent = `${Math.round(sim.cutoffFraction() * 100)}%`;
  const R = {
    rpm: $('ro-rpm'), pb: $('ro-pb'), pch: $('ro-pch'), force: $('ro-force'), ihp: $('ro-ihp'),
    brake: $('ro-brake'), steam: $('ro-steam'), eff: $('ro-eff'), stroke: $('stroke-state'),
    indW: $('ind-w'), valveState: $('valve-state'), tq: $('tq-note'), thr: $('lb-thr'),
  };
  const cv = { ind: $('c-indicator'), valve: $('c-valve'), tq: $('c-torque'), trend: $('c-trend'), sankey: $('sankey') };
  let tRead = 0, tChart = 0, tSlow = 0;
  const fmt = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : '—');
  function stateText(o) {
    const vel = crossheadDX(o.theta) * o.omega;
    const side = (steam, exh, dV) => (steam > 0 ? ['进汽', 'h'] : exh > 0 ? ['排汽', 'c'] : dV > 0 ? ['膨胀', 'h'] : ['压缩', 'c']);
    const he = side(o.op.heSteam, o.op.heExh, -vel);
    const ce = side(o.op.ceSteam, o.op.ceExh, vel);
    if (o.barring) return '曲柄停在<b>死点</b>附近，蒸汽推力的力臂为零——正在<b>盘车</b>把它转出死点…';
    if (Math.abs(o.omega) < 0.05) return sim.running ? '主汽阀开启中…' : '— 停车 —';
    const dir = vel < 0 ? '← 活塞向曲轴方向运动' : '→ 活塞向缸盖方向运动';
    return `${dir}<br><span class="${he[1]}">缸盖端：${he[0]}</span> · <span class="${ce[1]}">曲轴端：${ce[0]}</span>`;
  }
  function updateReadouts(dt) {
    const o = sim.out, st = sim.stats;
    tRead += dt; tChart += dt; tSlow += dt;
    if (tRead > 0.1) {
      tRead = 0;
      R.rpm.textContent = fmt(sim.rpm);
      R.pb.textContent = fmt((o.pB - P_ATM) / 1e5, 2);
      R.pch.textContent = fmt((o.pCh - P_ATM) / 1e5, 2);
      R.force.textContent = fmt(Math.abs(o.force) / 1000, 1);
      R.ihp.textContent = fmt(st.ihp / 1000, 1);
      R.brake.textContent = fmt(st.brake / 1000, 1);
      R.steam.textContent = fmt(st.steamRate * 3600);
      R.eff.textContent = fmt(st.eff * 100, 1);
      R.stroke.innerHTML = stateText(o);
      R.thr.textContent = `节流 ${Math.round(sim.throttle * 100)}%`;
      if (!sim.governorAuto) $('sl-thr').value = Math.round(sim.throttleManual * 100);
      R.indW.textContent = `每转指示功 ${(st.ihp / Math.max(0.1, st.rpmAvg / 60) / 1000).toFixed(1)} kJ`;
      const op = o.op;
      R.valveState.textContent = `阀位移 ${(o.u * 1000).toFixed(0)} mm`;
      void op;
    }
    if (tChart > 0.05) {
      tChart = 0;
      if (!$('right').classList.contains('collapsed')) {
        drawIndicator(cv.ind, sim, events);
        drawValve(cv.valve, sim);
        const la = drawTorque(cv.tq, sim);
        R.tq.textContent = `平均阻力矩 ${la.toFixed(2)} kN·m`;
      }
    }
    if (tSlow > 0.25) {
      tSlow = 0;
      if (!$('right').classList.contains('collapsed')) drawTrend(cv.trend, sim);
      if (document.querySelector('.tab-page[data-tab="energy"]').classList.contains('active')) drawSankey(cv.sankey, sim);
    }
  }

  // 键盘
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); setPaused(!state.paused); }
    if (e.code === 'Escape') { if (tour.active) tour.exit(); else select(null); }
    if (tour.active && e.code === 'ArrowRight') tour.next();
    if (tour.active && e.code === 'ArrowLeft') tour.prev();
  });

  const api = {
    state, set, setTime, setLoad, setBoiler, setGov, setCond, setPaused, select, setSolo,
    syncRun, flyTo: stage.flyTo, parts, sim, syncInsets,
  };
  const tour = createTour(api);
  api.tour = tour;
  tourRef = tour;
  $('btn-tour').onclick = () => (tour.active ? tour.exit() : tour.start(0));
  document.querySelectorAll('.goto').forEach((b) => { b.onclick = () => tour.start(+b.dataset.step); });

  api.update = (dt) => {
    updateHover();
    updateLabels();
    updateReadouts(dt);
    tour.update(dt);
  };
  return api;
}
