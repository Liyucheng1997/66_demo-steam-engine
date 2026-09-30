// ---------------------------------------------------------------------------
// 渲染舞台：渲染器、环境光照、阴影、后期泛光、相机与平滑过渡
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function createStage(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  const dpr = Math.min(window.devicePixelRatio, 1.75);
  renderer.setPixelRatio(dpr);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const bg = new THREE.Color('#15181c');
  scene.background = bg;
  scene.fog = new THREE.Fog(bg, 11, 30);

  // 环境反射（金属质感的关键）
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(38, container.clientWidth / container.clientHeight, 0.05, 120);
  camera.position.set(4.6, 2.6, 6.2);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.target.set(1.0, 0.1, -0.6);
  controls.maxDistance = 22;
  controls.minDistance = 0.6;
  controls.maxPolarAngle = Math.PI * 0.53;
  controls.screenSpacePanning = true;

  // ---- 灯光：暖色主光 + 冷色天光 + 轮廓光 ----
  const hemi = new THREE.HemisphereLight('#c9d8ea', '#3a2c22', 0.55);
  scene.add(hemi);

  const key = new THREE.DirectionalLight('#fff1dc', 2.4);
  key.position.set(5, 9, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera;
  sc.left = -5.5; sc.right = 5.5; sc.top = 5; sc.bottom = -5; sc.near = 2; sc.far = 24;
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 3;
  key.target.position.set(1, 0, -1.2);
  scene.add(key, key.target);

  const fill = new THREE.DirectionalLight('#9fc0ff', 0.55);
  fill.position.set(-6, 4, 5);
  scene.add(fill);
  const rim = new THREE.DirectionalLight('#ffd7a8', 0.9);
  rim.position.set(-3, 5, -8);
  scene.add(rim);

  // ---- 后期：泛光（炉火、指示灯） ----
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(dpr);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(container.clientWidth, container.clientHeight), 0.5, 0.45, 1.6);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
  }
  window.addEventListener('resize', resize);

  // ---- 相机平滑过渡 ----
  let tween = null;
  function flyTo(pos, target, duration = 1.6) {
    // 可视区域较窄时（面板占位），自动拉远镜头，保证目标完整入画
    const freeW = container.clientWidth - insets.l - insets.r;
    const k = THREE.MathUtils.clamp(980 / Math.max(300, freeW), 1, 1.9);
    const t1 = new THREE.Vector3(...target);
    const p1 = new THREE.Vector3(...pos).sub(t1).multiplyScalar(k).add(t1);
    tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1, t1, t: 0, d: duration };
  }
  // 视图中心偏移：让场景居中于左右面板之间的可见区域
  const insets = { l: 0, r: 0, cur: 0 };
  function setInsets(l, r) { insets.l = l; insets.r = r; }
  function updateOffset(dt) {
    const w = container.clientWidth;
    const target = (insets.l - insets.r) / 2;
    insets.cur += (target - insets.cur) * Math.min(1, dt * 6);
    const skew = -insets.cur / w * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * camera.getFilmWidth();
    if (Math.abs(skew - camera.filmOffset) > 1e-4) { camera.filmOffset = skew; camera.updateProjectionMatrix(); }
  }
  function updateTween(dt) {
    updateOffset(dt);
    if (!tween) return;
    tween.t += dt;
    const k = Math.min(1, tween.t / tween.d);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    // 沿弧线插值：避免穿过机体
    const p = tween.p0.clone().lerp(tween.p1, e);
    const lift = Math.sin(Math.PI * e) * tween.p0.distanceTo(tween.p1) * 0.12;
    p.y += lift;
    camera.position.copy(p);
    controls.target.copy(tween.t0.clone().lerp(tween.t1, e));
    if (k >= 1) tween = null;
  }
  controls.addEventListener('start', () => { tween = null; });

  return { renderer, scene, camera, controls, composer, bloom, key, flyTo, updateTween, resize, setInsets };
}
