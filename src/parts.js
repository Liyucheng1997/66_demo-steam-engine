// ---------------------------------------------------------------------------
// 部件注册表：统一管理 名称/说明、拾取、高亮、虚化、分解位移、剖切切换
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { sectionGeometry } from './geo.js';

const GHOST_COLOR = new THREE.Color('#a7b0ba');

export class Parts {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.byId = {};
    this.pickables = [];
    this.sectionSets = { engine: [], boiler: [] };
    this.sectionOnly = { engine: [], boiler: [] };
    this.explodeAmt = 0;
  }

  /**
   * id, name, desc, cat, explode: [x,y,z], anchor: [x,y,z]（世界坐标，标签/聚焦位置）
   * 返回 { root, group }：root 负责分解位移，group 放置几何体并由运动学驱动。
   */
  add(id, { name, desc = '', cat = '', explode = [0, 0, 0], anchor = [0, 0, 0], label = true, view }) {
    const root = new THREE.Group();
    root.name = id;
    const group = new THREE.Group();
    root.add(group);
    this.scene.add(root);
    const part = {
      id, name, desc, cat, root, group, label, view,
      explode: new THREE.Vector3(...explode),
      anchor: new THREE.Vector3(...anchor),
      anchorObj: null,
      mats: [],
      state: { ghost: false, hi: false },
    };
    this.list.push(part);
    this.byId[id] = part;
    return part;
  }

  /** 在部件内添加网格 */
  mesh(part, geometry, material, { cast = true, receive = true, parent, name, pick = true } = {}) {
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = cast;
    m.receiveShadow = receive;
    if (name) m.name = name;
    (parent || part.group).add(m);
    if (pick) m.userData.partId = part.id;
    return m;
  }

  /**
   * 为网格生成剖切版本（去掉平面正侧），并登记到剖切集合 set。
   * plane 为网格局部坐标下的平面。cutMat 为剖面材质。
   */
  sectionable(set, meshObj, plane, cutMat) {
    const g = sectionGeometry(meshObj.geometry, plane);
    const half = new THREE.Mesh(g, [meshObj.material, cutMat]);
    half.castShadow = meshObj.castShadow;
    half.receiveShadow = true;
    half.position.copy(meshObj.position);
    half.quaternion.copy(meshObj.quaternion);
    half.scale.copy(meshObj.scale);
    half.visible = false;
    half.userData.partId = meshObj.userData.partId;
    half.userData.isHalf = true;
    meshObj.parent.add(half);
    this.sectionSets[set].push({ full: meshObj, half });
    return half;
  }

  /** 只在剖视时显示的对象（内部构造、气体着色等） */
  sectionOnlyObj(set, obj) {
    obj.visible = false;
    this.sectionOnly[set].push(obj);
  }

  /** 剖视时隐藏（被剖掉的整体对象） */
  hideInSection(set, obj) {
    this.sectionSets[set].push({ full: obj, half: null });
  }

  setSection(set, on) {
    for (const s of this.sectionSets[set]) {
      s.full.visible = !on;
      if (s.half) s.half.visible = on;
    }
    for (const o of this.sectionOnly[set]) o.visible = on;
  }

  /** 完成注册：为每个部件克隆材质，收集可拾取网格 */
  finalize() {
    for (const part of this.list) {
      const cache = new Map();
      const cloneMat = (mat) => {
        if (!mat || mat.userData?.shared) return mat;
        if (!cache.has(mat)) {
          const c = mat.clone();
          c.userData.base = {
            transparent: c.transparent, opacity: c.opacity, depthWrite: c.depthWrite,
            emissive: c.emissive ? c.emissive.clone() : null,
            emissiveIntensity: c.emissiveIntensity,
          };
          cache.set(mat, c);
          part.mats.push(c);
        }
        return cache.get(mat);
      };
      part.root.traverse((o) => {
        if (!o.isMesh) return;
        if (Array.isArray(o.material)) {
          o.material = o.material.map((m, i) => (i === 0 ? cloneMat(m) : m));
        } else {
          o.material = cloneMat(o.material);
        }
        if (o.userData.partId === part.id) this.pickables.push(o);
      });
      // half 网格与 full 共享克隆后的材质
      for (const set of Object.values(this.sectionSets)) {
        for (const s of set) {
          if (s.half && Array.isArray(s.half.material) && s.full.material && !Array.isArray(s.full.material)) {
            s.half.material[0] = s.full.material;
          }
        }
      }
    }
  }

  setGhost(part, on) {
    if (part.state.ghost === on) return;
    part.state.ghost = on;
    for (const m of part.mats) {
      const b = m.userData.base;
      if (on && !b.color) { b.color = m.color ? m.color.clone() : null; b.map = m.map || null; }
      m.transparent = on ? true : b.transparent;
      m.opacity = on ? Math.min(b.opacity, 0.1) : b.opacity;
      m.depthWrite = on ? false : b.depthWrite;
      // 虚化时统一成淡灰色，避免贴图与鲜艳颜色喧宾夺主
      if (m.color && b.color) m.color.copy(on ? GHOST_COLOR : b.color);
      if ('map' in m) m.map = on ? null : b.map;
      m.needsUpdate = true;
    }
    part.root.traverse((o) => { if (o.isMesh) o.castShadow = !on && o.userData.cast !== false; });
  }

  setHighlight(part, level) {
    // level: 0 无；1 悬停；2 选中/聚焦
    if (part.state.hi === level) return;
    part.state.hi = level;
    for (const m of part.mats) {
      if (!m.emissive) continue;
      const b = m.userData.base;
      if (level) {
        m.emissive.set(level === 2 ? '#ffb347' : '#6fb7ff');
        m.emissiveIntensity = level === 2 ? 0.35 : 0.28;
      } else {
        m.emissive.copy(b.emissive);
        m.emissiveIntensity = b.emissiveIntensity;
      }
    }
  }

  /** 聚焦若干部件：其余虚化 */
  focus(ids) {
    const set = ids && ids.length ? new Set(ids) : null;
    for (const p of this.list) {
      this.setGhost(p, !!set && !set.has(p.id) && !p.noGhost);
      this.setHighlight(p, 0);
    }
  }

  updateExplode(target, dt) {
    this.explodeAmt += (target - this.explodeAmt) * Math.min(1, dt * 3.5);
    const e = this.explodeAmt;
    const ease = e * e * (3 - 2 * e);
    for (const p of this.list) p.root.position.copy(p.explode).multiplyScalar(ease);
  }

  /** 部件锚点的世界坐标（含分解位移、运动学） */
  anchorWorld(part, out) {
    if (part.anchorObj) return part.anchorObj.getWorldPosition(out);
    return out.copy(part.anchor).add(part.root.position);
  }
}
