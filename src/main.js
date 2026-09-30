// ---------------------------------------------------------------------------
// 入口：搭建场景 → 建模 → 仿真 → 界面 → 渲染循环
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { createStage } from './stage.js';
import { Parts } from './parts.js';
import { buildHouse } from './model/house.js';
import { buildEngine } from './model/engine.js';
import { buildBoiler } from './model/boiler.js';
import { createFX } from './fx.js';
import { SteamEngineSim } from './physics.js';
import { createUI, HOME_VIEW } from './ui/ui.js';

const fill = document.getElementById('load-fill');
const msg = document.getElementById('load-msg');
const progress = (text, pct) => new Promise((res) => {
  msg.textContent = text;
  fill.style.width = pct + '%';
  setTimeout(res, 30);
});

async function init() {
  const t0 = performance.now();
  await progress('初始化渲染器…', 8);
  const stage = createStage(document.getElementById('app'));
  stage.camera.position.set(9, 5, 9);
  stage.controls.target.set(...HOME_VIEW.target);

  await progress('砌筑机房…', 15);
  buildHouse(stage.scene);
  const parts = new Parts(stage.scene);

  await progress('铸造机座、气缸与汽道（布尔运算）…', 25);
  const engine = buildEngine(parts);

  await progress('铆接锅炉、安装火管…', 65);
  const boiler = buildBoiler(parts);

  await progress('装配与调试…', 85);
  parts.finalize();
  const fx = createFX(stage.scene, { engine, boiler });
  const sim = new SteamEngineSim();
  // 预热：先让机器在后台跑 30 秒进入稳定工况，打开页面即是运转状态
  for (let i = 0; i < 600; i++) sim.step(0.05);
  sim.history.length = 0;
  const ui = createUI({ stage, parts, engine, boiler, fx, sim });
  fx.setScale(stage.renderer.domElement.height, stage.camera.fov);
  window.addEventListener('resize', () => fx.setScale(stage.renderer.domElement.height, stage.camera.fov));

  // 首帧编译着色器，避免开场卡顿
  stage.renderer.compile(stage.scene, stage.camera);
  await progress('点火升汽…', 100);
  document.getElementById('loading').classList.add('done');
  stage.flyTo(HOME_VIEW.pos, HOME_VIEW.target, 3.2);

  let last = performance.now();
  let tReal = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    tReal += dt;
    const simDt = ui.state.paused ? 0 : dt * ui.state.timeScale;
    sim.step(simDt);
    engine.update(sim.out, simDt, sim.time);
    boiler.update(sim.out, simDt, tReal, sim);
    fx.update(sim, simDt, { effects: ui.state.effects });
    parts.updateExplode(ui.state.exploded ? 1 : 0, dt);
    stage.updateTween(dt);
    stage.controls.update();
    ui.update(dt);
    stage.composer.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // 调试入口
  window.__steam = { stage, parts, engine, boiler, sim, ui, THREE, buildMs: Math.round(performance.now() - t0) };
  window.__cam = (p, t) => stage.flyTo(p, t, 0.01);
  // 手动推进并渲染（浏览器页签隐藏时 rAF 暂停，用于截图检查）
  window.__shot = (p, t, frames = 30, dt = 1 / 30) => {
    if (p) { stage.camera.position.set(...p); stage.controls.target.set(...t); }
    stage.controls.update();
    for (let i = 0; i < frames; i++) {
      const sd = ui.state.paused ? 0 : dt * ui.state.timeScale;
      sim.step(sd); engine.update(sim.out, sd, sim.time); boiler.update(sim.out, sd, i * dt, sim);
      fx.update(sim, sd, { effects: ui.state.effects }); parts.updateExplode(ui.state.exploded ? 1 : 0, dt);
      stage.updateTween(dt);
    }
    stage.controls.update();
    ui.update(0.2);
    stage.composer.render();
    return 'ok';
  };
  window.__clean = () => {
    for (const id of ['left', 'right']) document.getElementById(id).classList.add('collapsed');
    for (const id of ['labels', 'dock', 'topbar', 'reopen-left', 'reopen-right', 'partcard', 'tour']) document.getElementById(id).style.display = 'none';
  };
}

init().catch((e) => {
  console.error(e);
  msg.textContent = '加载失败：' + e.message;
  msg.style.color = '#ff8a70';
});
