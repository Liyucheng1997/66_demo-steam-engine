// ---------------------------------------------------------------------------
// 材质库：PBR 材质 + 程序化贴图（木纹、耐火砖、地砖、剖面线）
// ---------------------------------------------------------------------------
import * as THREE from 'three';

function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// 简单伪随机
let seed = 1337;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** 柚木板条（气缸保温层） */
function woodTexture() {
  return canvas(512, 512, (g, w, h) => {
    const planks = 16;
    const pw = w / planks;
    for (let i = 0; i < planks; i++) {
      const base = 0.85 + rnd() * 0.3;
      const r = 118 * base, gg = 64 * base, b = 34 * base;
      g.fillStyle = `rgb(${r | 0},${gg | 0},${b | 0})`;
      g.fillRect(i * pw, 0, pw, h);
      // 木纹
      for (let k = 0; k < 26; k++) {
        const x = i * pw + rnd() * pw;
        g.strokeStyle = `rgba(${40 + rnd() * 30 | 0},${18 + rnd() * 15 | 0},8,${0.12 + rnd() * 0.2})`;
        g.lineWidth = 0.5 + rnd() * 1.5;
        g.beginPath();
        g.moveTo(x, 0);
        for (let y = 0; y <= h; y += 16) g.lineTo(x + Math.sin(y * 0.02 + k) * 2 * rnd(), y);
        g.stroke();
      }
      // 板缝
      g.fillStyle = 'rgba(20,10,4,0.75)';
      g.fillRect(i * pw, 0, 1.5, h);
      g.fillStyle = 'rgba(255,220,180,0.10)';
      g.fillRect(i * pw + 1.5, 0, 1, h);
    }
  });
}

/** 耐火砖 / 红砖 */
function brickTexture(hue = 'red') {
  return canvas(512, 512, (g, w, h) => {
    g.fillStyle = hue === 'red' ? '#6e4a3d' : '#8a7e70';
    g.fillRect(0, 0, w, h);
    const rows = 16, bw = w / 4, bh = h / rows;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * bw / 2;
      for (let c = -1; c < 5; c++) {
        const k = 0.8 + rnd() * 0.35;
        const col = hue === 'red' ? [150 * k, 62 * k, 40 * k] : [196 * k, 170 * k, 130 * k];
        g.fillStyle = `rgb(${col.map((v) => v | 0).join(',')})`;
        g.fillRect(c * bw + off + 3, r * bh + 3, bw - 6, bh - 6);
        for (let n = 0; n < 40; n++) {
          g.fillStyle = `rgba(0,0,0,${rnd() * 0.12})`;
          g.fillRect(c * bw + off + 3 + rnd() * (bw - 8), r * bh + 3 + rnd() * (bh - 8), 2, 2);
        }
      }
    }
  });
}

/** 机房石板地面（错缝大石板，带磨损与污渍） */
function floorTexture() {
  return canvas(1024, 1024, (g, w, h) => {
    g.fillStyle = '#2b2622';
    g.fillRect(0, 0, w, h);
    const rows = 5, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = -((r * 173) % 260);
      while (x < w) {
        const sw = 180 + rnd() * 160;
        const k = 0.78 + rnd() * 0.22;
        const base = [118 * k, 108 * k, 96 * k];
        const x0 = x + 3, y0 = r * rh + 3, ww = sw - 6, hh = rh - 6;
        const grd = g.createLinearGradient(x0, y0, x0 + ww, y0 + hh);
        grd.addColorStop(0, `rgb(${base.map((v) => v | 0).join(',')})`);
        grd.addColorStop(1, `rgb(${base.map((v) => (v * 0.88) | 0).join(',')})`);
        g.fillStyle = grd;
        g.fillRect(x0, y0, ww, hh);
        for (let m = 0; m < 260; m++) {
          g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,245,230'},${rnd() * 0.05})`;
          const s = 2 + rnd() * 10;
          g.fillRect(x0 + rnd() * ww, y0 + rnd() * hh, s, s);
        }
        // 油污
        if (rnd() < 0.3) {
          const cx = x0 + rnd() * ww, cy = y0 + rnd() * hh, rr = 20 + rnd() * 60;
          const og = g.createRadialGradient(cx, cy, 0, cx, cy, rr);
          og.addColorStop(0, 'rgba(20,14,8,0.28)'); og.addColorStop(1, 'rgba(20,14,8,0)');
          g.fillStyle = og; g.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
        }
        x += sw;
      }
    }
  });
}

/** 细微噪声粗糙度贴图（铸铁漆面） */
function noiseTexture() {
  const t = canvas(256, 256, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const v = 150 + rnd() * 70;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/** 压力表盘 */
export function gaugeFaceTexture(label = 'bar', max = 12, red = 9) {
  return canvas(256, 256, (g, w) => {
    const c = w / 2;
    g.fillStyle = '#f3ecd8'; g.beginPath(); g.arc(c, c, c, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#222'; g.lineWidth = 3;
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    // 红区
    g.strokeStyle = '#c0392b'; g.lineWidth = 10;
    g.beginPath(); g.arc(c, c, c * 0.78, a0 + (a1 - a0) * red / max, a1); g.stroke();
    g.strokeStyle = '#222'; g.fillStyle = '#222';
    g.font = 'bold 22px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i <= max; i++) {
      const a = a0 + (a1 - a0) * i / max;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(c + Math.cos(a) * c * 0.7, c + Math.sin(a) * c * 0.7);
      g.lineTo(c + Math.cos(a) * c * 0.86, c + Math.sin(a) * c * 0.86);
      g.stroke();
      if (i % 2 === 0) g.fillText(String(i), c + Math.cos(a) * c * 0.55, c + Math.sin(a) * c * 0.55);
    }
    g.font = 'italic 20px serif';
    g.fillText(label, c, c * 1.45);
  });
}

// ---------------------------------------------------------------------------
const wood = woodTexture();
const brick = brickTexture('red');
const firebrick = brickTexture('fire');
const floorTex = floorTexture();
const noise = noiseTexture();

function paint(color, extra = {}) {
  return new THREE.MeshPhysicalMaterial({
    color, metalness: 0.1, roughness: 0.5, roughnessMap: noise,
    clearcoat: 0.35, clearcoatRoughness: 0.35, ...extra,
  });
}
const metal = (color, roughness, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, metalness: 1, roughness, ...extra });

export const M = {
  green: paint('#2d4c3b'),               // 机体铸件：勃朗宁绿
  greenDark: paint('#22392c'),
  maroon: paint('#6b2219'),              // 锅炉包皮：印度红
  black: paint('#1b1c1e', { roughness: 0.55, clearcoat: 0.15 }),
  soot: new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.85, metalness: 0.2 }),
  steel: metal('#aeb4bb', 0.24),         // 抛光钢
  steelDark: metal('#80878f', 0.36),
  iron: metal('#6d7278', 0.45),
  brass: metal('#c99a45', 0.26),
  bronze: metal('#b0874a', 0.35),
  copper: metal('#c8764a', 0.28),
  whiteMetal: metal('#c9c6bc', 0.3),
  wood: new THREE.MeshStandardMaterial({ map: wood, roughness: 0.55, metalness: 0 }),
  brick: new THREE.MeshStandardMaterial({ map: brick, roughness: 0.9 }),
  firebrick: new THREE.MeshStandardMaterial({ map: firebrick, roughness: 0.9 }),
  floor: new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.62, metalness: 0.0 }),
  concrete: new THREE.MeshStandardMaterial({ color: '#57534d', roughness: 0.95 }),
  leather: new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.7 }),
  glass: new THREE.MeshPhysicalMaterial({
    color: '#cfe8ff', metalness: 0, roughness: 0.05, transparent: true, opacity: 0.28,
    clearcoat: 1, depthWrite: false,
  }),
  water: new THREE.MeshStandardMaterial({
    color: '#2f86d6', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.5,
    depthWrite: false, side: THREE.DoubleSide,
  }),
  coal: new THREE.MeshStandardMaterial({ color: '#141312', roughness: 0.6, metalness: 0.3, flatShading: true }),
};
M.wood.map.repeat.set(1, 1);
M.brick.map.repeat.set(2, 1);
M.firebrick.map.repeat.set(2, 2);

/** 剖面材质：世界坐标对角剖面线 */
export function makeCutMaterial(color = '#d4553f', lineColor = '#7a2418') {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.lineColor = { value: new THREE.Color(lineColor) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHatchW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvHatchW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHatchW;\nuniform vec3 lineColor;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float hq = (vHatchW.x + vHatchW.y + vHatchW.z) * 55.0;
        float hl = smoothstep(0.78, 0.86, abs(fract(hq) - 0.5) * 2.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, lineColor, hl * 0.85);`);
  };
  return m;
}
export const CUT = {
  iron: makeCutMaterial('#8e949b', '#3c4148'),
  steel: makeCutMaterial('#c3ccd6', '#5b6673'),
  brass: makeCutMaterial('#d9b060', '#7a5316'),
  wood: makeCutMaterial('#a06a3e', '#5a3316'),
  plate: makeCutMaterial('#b8bec6', '#4c535b'),
};
