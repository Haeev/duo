'use strict';
// Petit moteur de dessin en perspective pour les planches de la bible de Cosy Café.
// Il projette des polygones 3D (mètres, Y en haut) avec la caméra subjective de la bible (champ vertical de 60 degrés,
// yeux à 1,65 m comme les plans du level designer, image de 1366 x 768 comme l'écran du PC de référence), les éclaire grossièrement comme le ferait
// la lumière cuite (ciel, vitrines, lampes, occlusion près du sol), les trie du plus loin au plus proche
// (algorithme du peintre) et écrit du SVG. Ce n'est pas le moteur du jeu: c'est un outil d'illustration à l'échelle.

const NEAR = 0.06;

// couleurs: sRGB hexadécimal <-> RGB linéaire
const toLin = (h) =>
  [1, 3, 5].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
const toHex = (l) =>
  '#' +
  l
    .map((c) => {
      const v = Math.min(Math.max(c, 0), 1);
      const s = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
      return Math.round(s * 255).toString(16).padStart(2, '0');
    })
    .join('')
    .toUpperCase();
const vadd = (a, b) => a.map((x, i) => x + b[i]);
const vsub = (a, b) => a.map((x, i) => x - b[i]);
const vscale = (a, k) => a.map((x) => x * k);
const vmul = (a, b) => a.map((x, i) => x * b[i]);
const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vlen = (a) => Math.hypot(a[0], a[1], a[2]);
const vnorm = (a) => vscale(a, 1 / (vlen(a) || 1));
const mixHex = (a, b, t) => toHex(toLin(a).map((x, i) => x * (1 - t) + toLin(b)[i] * t));
const shadeHex = (h, k) => toHex(toLin(h).map((x) => x * k));
const r1 = (x) => Math.round(x * 10) / 10;

class Camera {
  constructor({ x, y = 1.65, z, yaw = 0, pitch = 0, vfov = 60, width = 1366, height = 768 }) {
    Object.assign(this, { pos: [x, y, z], yaw, pitch, vfov, width, height });
    const ya = (yaw * Math.PI) / 180;
    const pa = (pitch * Math.PI) / 180;
    this.f = vnorm([Math.sin(ya) * Math.cos(pa), Math.sin(pa), Math.cos(ya) * Math.cos(pa)]);
    this.r = vnorm([Math.cos(ya), 0, -Math.sin(ya)]);
    this.u = vcross(this.f, this.r);
    this.focal = height / 2 / Math.tan(((vfov / 2) * Math.PI) / 180);
  }
  view(p) {
    const d = vsub(p, this.pos);
    return [vdot(d, this.r), vdot(d, this.u), vdot(d, this.f)];
  }
  project(c) {
    return [this.width / 2 + (this.focal * c[0]) / c[2], this.height / 2 - (this.focal * c[1]) / c[2]];
  }
  // pixels par mètre à la profondeur d'un point
  scaleAt(p) {
    const c = this.view(p);
    return c[2] > NEAR ? this.focal / c[2] : 0;
  }
}

// découpe d'un polygone (coordonnées caméra) par le plan proche
function clipNear(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const ain = a[2] >= NEAR;
    const bin = b[2] >= NEAR;
    if (ain) out.push(a);
    if (ain !== bin) {
      const t = (NEAR - a[2]) / (b[2] - a[2]);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]);
    }
  }
  return out;
}

class Scene {
  constructor(camera, light) {
    this.cam = camera;
    this.light = light; // { ambientColor, ambient, dayColor, windows: [{center, normal, power}], lamps: [{pos, color, power, radius}], exterior: {tint, sun} }
    this.layers = { exterior: [], shell: [], overlays: [], objects: [], fx: [], top: [] };
    this.defs = [];
    this.uid = 0;
  }
  id(prefix) {
    this.uid += 1;
    return `${prefix}${this.uid}`;
  }

  // éclairage d'une face: ciel et rebonds, lumière des vitrines, lampes, occlusion près du sol
  lightAt(n, p, opts = {}) {
    const L = this.light;
    let c = vscale(toLin(L.ambientColor), L.ambient * (0.6 + 0.22 * n[1]));
    for (const w of L.windows || []) {
      const d = vsub(w.center, p);
      const dist = vlen(d);
      if (dist < 0.05) continue;
      const dir = vscale(d, 1 / dist);
      const ndl = Math.max(0, vdot(n, dir));
      const facing = Math.max(0, -vdot(w.normal, dir));
      c = vadd(c, vscale(toLin(L.dayColor), (w.power * ndl * facing) / (1 + (dist / 3.2) ** 2)));
    }
    for (const l of L.lamps || []) {
      const d = vsub(l.pos, p);
      const dist = Math.max(vlen(d), 0.05);
      const ndl = Math.max(0, vdot(n, vscale(d, 1 / dist)));
      c = vadd(c, vscale(toLin(l.color), (l.power * (0.25 + 0.75 * ndl)) / (1 + (dist / l.radius) ** 2)));
    }
    if (!opts.noAo && p[1] < 0.35 && Math.abs(n[1]) < 0.5) c = vscale(c, 0.78 + 0.22 * (p[1] / 0.35));
    return c;
  }
  shade(hex, n, p, opts = {}) {
    if (opts.emissive) return hex;
    if (opts.exterior) {
      const ex = this.light.exterior;
      const k = (0.82 + 0.18 * Math.max(0, n[1])) * (opts.sunlit ? ex.sunBoost || 1 : 1);
      return toHex(vscale(vmul(toLin(hex), toLin(ex.tint)), k));
    }
    return toHex(vmul(toLin(hex), this.lightAt(n, p, opts)));
  }

  // un polygone du monde vers un chemin SVG (null s'il est hors champ)
  path(pts) {
    const clipped = clipNear(pts.map((p) => this.cam.view(p)));
    if (clipped.length < 3) return null;
    const scr = clipped.map((c) => this.cam.project(c));
    return { d: 'M' + scr.map((s) => `${r1(s[0])} ${r1(s[1])}`).join('L') + 'Z', depth: clipped.reduce((a, c) => a + c[2], 0) / clipped.length, scr };
  }
  normalOf(pts) {
    return vnorm(vcross(vsub(pts[1], pts[0]), vsub(pts[2], pts[0])));
  }
  centroid(pts) {
    return vscale(pts.reduce((a, p) => vadd(a, p), [0, 0, 0]), 1 / pts.length);
  }
  facesCamera(pts) {
    const n = this.normalOf(pts);
    return vdot(n, vsub(this.cam.pos, pts[0])) > 0;
  }

  // face éclairée, prête à être triée; opts: cull, emissive, exterior, opacity, stroke, gradient, sunlit
  face(pts, color, opts = {}) {
    if (opts.cull !== false && !this.facesCamera(pts)) return null;
    const p = this.path(pts);
    if (!p) return null;
    const n = this.normalOf(pts);
    const ctr = this.centroid(pts);
    let fill = this.shade(color, n, ctr, opts);
    let gradient = '';
    if (opts.gradient && !opts.emissive) {
      // dégradé vertical cuit (comme une carte de lumière): haut et bas de la face
      const ys = pts.map((q) => q[1]);
      const top = [ctr[0], Math.max(...ys), ctr[2]];
      const bot = [ctr[0], Math.min(...ys), ctr[2]];
      const ct = this.shade(color, n, top, opts);
      const cb = this.shade(color, n, bot, opts);
      const vt = this.cam.view(top);
      const vb = this.cam.view(bot);
      if (vt[2] > NEAR && vb[2] > NEAR) {
        const st = this.cam.project(vt);
        const sb = this.cam.project(vb);
        const gid = this.id('g');
        this.defs.push(`<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${r1(st[0])}" y1="${r1(st[1])}" x2="${r1(sb[0])}" y2="${r1(sb[1])}"><stop offset="0" stop-color="${ct}"/><stop offset="1" stop-color="${cb}"/></linearGradient>`);
        gradient = `url(#${gid})`;
      }
    }
    const op = opts.opacity !== undefined ? ` fill-opacity="${opts.opacity}"` : '';
    const st = opts.stroke ? ` stroke="${opts.stroke}" stroke-width="${opts.strokeWidth || 1}" stroke-linejoin="round"` : '';
    return { depth: p.depth, svg: `<path d="${p.d}" fill="${gradient || fill}"${op}${st}/>` };
  }

  // boîte alignée sur les axes; colors: couleur unique ou { top, bottom, front, back, left, right }
  box(x0, y0, z0, x1, y1, z1, colors, opts = {}) {
    const col = (k) => (typeof colors === 'string' ? colors : colors[k] || colors.side || colors.front || Object.values(colors)[0]);
    const F = [
      ['top', [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]]],
      ['bottom', [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]]],
      ['front', [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]]],
      ['back', [[x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z1]]],
      ['left', [[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]]],
      ['right', [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]]],
    ];
    const faces = [];
    for (const [k, pts] of F) {
      if (opts.skip && opts.skip.includes(k)) continue;
      const f = this.face(pts, col(k), opts);
      if (f) faces.push(f);
    }
    return faces;
  }

  // cylindre ou tronc de cône vertical à n pans (r0 en bas, r1 en haut)
  cylinder(cx, y0, cz, r0, h, n, color, opts = {}) {
    const r1v = opts.r1 !== undefined ? opts.r1 : r0;
    const faces = [];
    const ring = (y, r) => Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + (opts.phase || 0);
      return [cx + r * Math.cos(a), y, cz + r * Math.sin(a)];
    });
    const lo = ring(y0, r0);
    const hi = ring(y0 + h, r1v);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const f = this.face([lo[i], hi[i], hi[j], lo[j]], opts.sideColor || color, opts);
      if (f) faces.push(f);
    }
    if (!opts.noTop) {
      const f = this.face([...hi].reverse(), opts.topColor || color, opts);
      if (f) faces.push(f);
    }
    if (opts.bottom) {
      const f = this.face(lo, color, opts);
      if (f) faces.push(f);
    }
    return faces;
  }

  // mur plan percé de baies (coordonnées locales u, v dans le plan); axis: 'z' (mur à z constant) ou 'x'
  wall(axis, at, u0, u1, v0, v1, holes, color, opts = {}) {
    const P = (u, v) => (axis === 'z' ? [u, v, at] : [at, v, u]);
    const outer = [P(u0, v0), P(u0, v1), P(u1, v1), P(u1, v0)];
    const flip = opts.flip;
    const ring = (pts) => (flip ? [...pts].reverse() : pts);
    const rings = [ring(outer), ...holes.map(([a0, b0, a1, b1]) => ring([P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1)]))];
    const parts = rings.map((r) => this.path(r)).filter(Boolean);
    if (!parts.length) return null;
    const n = this.normalOf(ring(outer));
    const ctr = this.centroid(outer);
    let fill = this.shade(color, n, ctr, opts);
    if (opts.gradient) {
      const top = [ctr[0], v1, ctr[2]];
      const bot = [ctr[0], v0, ctr[2]];
      if (axis === 'z') {
        top[2] = at;
        bot[2] = at;
      } else {
        top[0] = at;
        bot[0] = at;
      }
      const vt = this.cam.view(top);
      const vb = this.cam.view(bot);
      if (vt[2] > NEAR && vb[2] > NEAR) {
        const st = this.cam.project(vt);
        const sb = this.cam.project(vb);
        const gid = this.id('g');
        this.defs.push(`<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${r1(st[0])}" y1="${r1(st[1])}" x2="${r1(sb[0])}" y2="${r1(sb[1])}"><stop offset="0" stop-color="${this.shade(color, n, top, opts)}"/><stop offset="1" stop-color="${this.shade(color, n, bot, opts)}"/></linearGradient>`);
        fill = `url(#${gid})`;
      }
    }
    return { depth: parts[0].depth, svg: `<path fill-rule="evenodd" d="${parts.map((p) => p.d).join('')}" fill="${fill}"/>` };
  }

  // décalque au sol (y donné): polygone du monde, couleur et opacité, éventuellement en dégradé radial
  decal(pts, color, opacity, radial) {
    const p = this.path(pts);
    if (!p) return null;
    if (radial) {
      const gid = this.id('r');
      this.defs.push(`<radialGradient id="${gid}"><stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/><stop offset="0.55" stop-color="${color}" stop-opacity="${r1(opacity * 6) / 10}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`);
      return { depth: p.depth, svg: `<path d="${p.d}" fill="url(#${gid})"/>` };
    }
    return { depth: p.depth, svg: `<path d="${p.d}" fill="${color}" fill-opacity="${opacity}"/>` };
  }
  ellipseDecal(cx, y, cz, rx, rz, color, opacity, radial = true) {
    const pts = Array.from({ length: 20 }, (_, i) => {
      const a = (i / 20) * Math.PI * 2;
      return [cx + rx * Math.cos(a), y, cz + rz * Math.sin(a)];
    });
    return this.decal(pts, color, opacity, radial);
  }

  // groupe d'objets trié: chaque élément { faces, depth?, after? } ; after = posé dessus (dessiné juste après)
  object(parts, layer = 'objects') {
    const all = parts.flat().filter(Boolean);
    if (!all.length) return;
    all.sort((a, b) => b.depth - a.depth);
    const depth = Math.max(...all.map((f) => f.depth));
    const mean = all.reduce((s, f) => s + f.depth, 0) / all.length;
    this.layers[layer].push({ depth: (depth + mean) / 2, svg: all.map((f) => f.svg).join('') });
  }
  // élément déjà mis en SVG (personnage, objet dessiné à plat) placé à une profondeur
  sprite(depth, svg, layer = 'objects') {
    this.layers[layer].push({ depth, svg });
  }
  // place un dessin à plat (unités: centimètres, origine aux pieds) à une position du monde
  billboard(x, y, z, svgCm, layer = 'objects', extraDepth = 0) {
    const c = this.cam.view([x, y, z]);
    if (c[2] < NEAR) return;
    const s = this.cam.project(c);
    const k = this.cam.focal / c[2] / 100;
    this.layers[layer].push({ depth: c[2] + extraDepth, svg: `<g transform="translate(${r1(s[0])} ${r1(s[1])}) scale(${Math.round(k * 10000) / 10000})">${svgCm}</g>` });
  }

  toSVG({ sky, extraDefs = '', clipId } = {}) {
    const W = this.cam.width;
    const H = this.cam.height;
    const byDepth = (arr) => [...arr].sort((a, b) => b.depth - a.depth).map((o) => o.svg).join('\n');
    const skyGrad = sky ? `<linearGradient id="${clipId}-ciel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="0.75" stop-color="${sky[1]}"/></linearGradient>` : '';
    return [
      `<defs>${skyGrad}${this.defs.join('')}${extraDefs}<clipPath id="${clipId}"><rect width="${W}" height="${H}"/></clipPath></defs>`,
      `<g clip-path="url(#${clipId})">`,
      sky ? `<rect width="${W}" height="${H}" fill="url(#${clipId}-ciel)"/>` : '',
      byDepth(this.layers.exterior),
      this.layers.shell.map((o) => o.svg).join('\n'),
      this.layers.overlays.map((o) => o.svg).join('\n'),
      byDepth(this.layers.objects),
      this.layers.fx.map((o) => o.svg).join('\n'),
      this.layers.top.map((o) => o.svg).join('\n'),
      '</g>',
    ].join('\n');
  }
}

module.exports = { Camera, Scene, toLin, toHex, mixHex, shadeHex, vadd, vsub, vscale, vdot, vnorm, vlen, r1 };
