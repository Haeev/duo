'use strict';
// Géométrie des formes de l'identité B: symboles des joueurs, anneau du logo.
// Tout est calculé ici (aucun dessin à la main dans un éditeur): chaque forme se régénère et se retouche
// en changeant un paramètre. Sorties: chemins SVG (attribut d) à remplir en currentColor, utilisables
// tels quels dans un <path>, un Path2D (canvas des jeux) ou un chargeur SVG.
const clipping = require('polygon-clipping');

// polygon-clipping échoue parfois sur des coordonnées flottantes presque alignées: chaque sommet est
// aligné sur une grille de 1/100 000 d'unité avant chaque opération (écart invisible).
const snap = (m) => (typeof m[0] === 'number' ? [Math.round(m[0] * 1e5) / 1e5, Math.round(m[1] * 1e5) / 1e5] : m.map(snap));
const pc = {
  union: (...a) => clipping.union(...a.map(snap)),
  difference: (...a) => clipping.difference(...a.map(snap)),
  intersection: (...a) => clipping.intersection(...a.map(snap)),
};

const num = (v, d = 3) => {
  const s = v.toFixed(d).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
};
const pt = (x, y, d) => `${num(x, d)} ${num(y, d)}`;

// Disque complet en deux arcs (un seul sous-chemin, sens horaire).
function circle(cx, cy, r, d = 3) {
  return `M${pt(cx - r, cy, d)}A${num(r, d)} ${num(r, d)} 0 1 1 ${pt(cx + r, cy, d)}A${num(r, d)} ${num(r, d)} 0 1 1 ${pt(cx - r, cy, d)}Z`;
}

// Polygone qui approche une ellipse tournée (pour les opérations booléennes).
function ellipsePolygon(cx, cy, rx, ry, angleDeg = 0, n = 128) {
  const a = (angleDeg * Math.PI) / 180;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n;
    const x = rx * Math.cos(t);
    const y = ry * Math.sin(t);
    pts.push([cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)]);
  }
  pts.push(pts[0]);
  return [pts];
}

// Multipolygone (sortie de polygon-clipping) vers chemin SVG: contours extérieurs et trous sont
// orientés en sens opposés, donc la règle de remplissage par défaut (nonzero) convient.
function polygonsToPath(multi, d = 3) {
  let s = '';
  for (const poly of multi) {
    for (const ring of poly) {
      s += 'M' + ring.slice(0, -1).map(([x, y]) => pt(x, y, d)).join('L') + 'Z';
    }
  }
  return s;
}

// Croissant: disque (cx, cy, r) privé d'un disque de rayon ri décalé de (dx, dy).
// Intersections calculées exactement, puis deux arcs.
function crescent(cx, cy, r, ri, dx, dy, d = 3) {
  const dist = Math.hypot(dx, dy);
  const ux = dx / dist;
  const uy = dy / dist;
  const a = (r * r - ri * ri + dist * dist) / (2 * dist); // du centre à la corde commune
  const h = Math.sqrt(r * r - a * a);
  const mx = cx + a * ux;
  const my = cy + a * uy;
  const p1 = [mx - h * uy, my + h * ux];
  const p2 = [mx + h * uy, my - h * ux];
  return `M${pt(p1[0], p1[1], d)}A${num(r, d)} ${num(r, d)} 0 1 1 ${pt(p2[0], p2[1], d)}A${num(ri, d)} ${num(ri, d)} 0 1 0 ${pt(p1[0], p1[1], d)}Z`;
}

// Étoile à quatre branches aux flancs concaves (courbes quadratiques).
function star4(cx, cy, rTip, rInner, d = 3) {
  let s = '';
  for (let i = 0; i < 4; i++) {
    const a = (Math.PI / 2) * i - Math.PI / 2;
    const b = a + Math.PI / 4;
    const tip = [cx + rTip * Math.cos(a), cy + rTip * Math.sin(a)];
    const ctrl = [cx + rInner * Math.cos(b), cy + rInner * Math.sin(b)];
    const next = [cx + rTip * Math.cos(a + Math.PI / 2), cy + rTip * Math.sin(a + Math.PI / 2)];
    if (i === 0) s += `M${pt(tip[0], tip[1], d)}`;
    s += `Q${pt(ctrl[0], ctrl[1], d)} ${pt(next[0], next[1], d)}`;
  }
  return s + 'Z';
}

// Soleil: disque central et n rayons en capsules, séparés du disque par un jour.
function sun(cx, cy, rDisc, rStart, rEnd, width, n = 8, offsetDeg = 0, d = 3) {
  let s = circle(cx, cy, rDisc, d);
  const e = width / 2;
  for (let i = 0; i < n; i++) {
    const a = ((2 * Math.PI) / n) * i + (offsetDeg * Math.PI) / 180;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const nx = -uy;
    const ny = ux;
    const r0 = rStart + e;
    const r1 = rEnd - e;
    const A = [cx + ux * r0 + nx * e, cy + uy * r0 + ny * e];
    const B = [cx + ux * r1 + nx * e, cy + uy * r1 + ny * e];
    const C = [cx + ux * r1 - nx * e, cy + uy * r1 - ny * e];
    const D = [cx + ux * r0 - nx * e, cy + uy * r0 - ny * e];
    s += `M${pt(A[0], A[1], d)}L${pt(B[0], B[1], d)}A${num(e, d)} ${num(e, d)} 0 0 0 ${pt(C[0], C[1], d)}L${pt(D[0], D[1], d)}A${num(e, d)} ${num(e, d)} 0 0 0 ${pt(A[0], A[1], d)}Z`;
  }
  return s;
}

// Comète: tête ronde et queue effilée jusqu'à la pointe, flancs légèrement creusés.
// Union calculée par polygon-clipping pour un contour unique.
function comet(hx, hy, rHead, tipX, tipY, hollow = 0.2, d = 3) {
  const len = Math.hypot(tipX - hx, tipY - hy);
  const ux = (tipX - hx) / len;
  const uy = (tipY - hy) / len;
  // points de tangence vus depuis la pointe
  const beta = Math.PI / 2 - Math.asin(rHead / len);
  const axis = Math.atan2(uy, ux);
  const t1 = [hx + rHead * Math.cos(axis + beta), hy + rHead * Math.sin(axis + beta)];
  const t2 = [hx + rHead * Math.cos(axis - beta), hy + rHead * Math.sin(axis - beta)];
  // point de contrôle: milieu du flanc rapproché de l'axe tête-pointe
  const control = (t) => {
    const mx = (t[0] + tipX) / 2;
    const my = (t[1] + tipY) / 2;
    const proj = (mx - hx) * ux + (my - hy) * uy;
    const ax = hx + proj * ux;
    const ay = hy + proj * uy;
    return [mx + (ax - mx) * hollow * 2, my + (ay - my) * hollow * 2];
  };
  const quad = (a, c, b, t) => [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
  const c1 = control(t1);
  const c2 = control(t2);
  const n = 48;
  const tail = [];
  for (let i = 0; i <= n; i++) tail.push(quad(t1, c1, [tipX, tipY], i / n));
  for (let i = n; i >= 0; i--) tail.push(quad(t2, c2, [tipX, tipY], i / n));
  tail.push(tail[0]);
  return polygonsToPath(pc.union(ellipsePolygon(hx, hy, rHead, rHead), [tail]), d);
}

// Planète à anneau: disque et anneau elliptique incliné; l'anneau passe derrière le disque (masqué)
// puis devant lui, séparé par un jour.
function planet(cx, cy, rDisc, rxRing, ryRing, thickness, angleDeg, gap, d = 3) {
  const disc = ellipsePolygon(cx, cy, rDisc, rDisc);
  const discGap = ellipsePolygon(cx, cy, rDisc + gap, rDisc + gap);
  const ring = pc.difference(ellipsePolygon(cx, cy, rxRing, ryRing, angleDeg), ellipsePolygon(cx, cy, rxRing - thickness, ryRing - thickness, angleDeg));
  // demi-plan de l'avant: la moitié de l'anneau qui passe sous le centre (y local positif)
  const a = (angleDeg * Math.PI) / 180;
  const big = 100;
  const front = [[
    [cx - big * Math.cos(a), cy - big * Math.sin(a)],
    [cx + big * Math.cos(a), cy + big * Math.sin(a)],
    [cx + big * Math.cos(a) - big * Math.sin(a), cy + big * Math.sin(a) + big * Math.cos(a)],
    [cx - big * Math.cos(a) - big * Math.sin(a), cy - big * Math.sin(a) + big * Math.cos(a)],
    [cx - big * Math.cos(a), cy - big * Math.sin(a)],
  ]];
  const ringFront = pc.intersection(ring, front);
  const ringBack = pc.difference(ring, front);
  // l'avant de l'anneau, épaissi du jour, creuse le disque
  const ringFrontGap = pc.intersection(
    pc.difference(ellipsePolygon(cx, cy, rxRing + gap, ryRing + gap, angleDeg), ellipsePolygon(cx, cy, rxRing - thickness - gap, ryRing - thickness - gap, angleDeg)),
    front,
  );
  const discVisible = pc.difference(disc, ringFrontGap);
  const backVisible = pc.difference(ringBack, discGap);
  return polygonsToPath(pc.union(discVisible, ringFront, backVisible), d);
}

// Anneau du logo: couronne (rayon médian r, épaisseur e) interrompue par des encoches circulaires
// centrées sur le cercle médian. Le fond reste visible à travers: le logo marche sur tout fond de nuit.
function notchedRing(cx, cy, r, e, notches, d = 3) {
  let ring = pc.difference(ellipsePolygon(cx, cy, r + e / 2, r + e / 2, 0, 720), ellipsePolygon(cx, cy, r - e / 2, r - e / 2, 0, 720));
  for (const { angleDeg, radius } of notches) {
    const a = (angleDeg * Math.PI) / 180;
    ring = pc.difference(ring, ellipsePolygon(cx + r * Math.cos(a), cy + r * Math.sin(a), radius, radius, 0, 720));
  }
  return polygonsToPath(ring, d);
}

module.exports = { num, circle, crescent, star4, sun, comet, planet, notchedRing, ellipsePolygon, polygonsToPath };
