'use strict';
// Géométrie des formes de l'identité B: symboles des joueurs, anneau du logo.
// Tout est calculé ici (aucun dessin à la main dans un éditeur), pour que chaque forme se régénère
// et se retouche en changeant un paramètre. Sorties: chemins SVG (attribut d) à remplir en currentColor,
// utilisables tels quels dans un <path>, un Path2D (canvas des jeux) ou un chargeur SVG.
const pcBrut = require('polygon-clipping');

// polygon-clipping échoue parfois sur des coordonnées flottantes presque alignées: on aligne
// chaque sommet sur une grille de 1/100 000 d'unité avant chaque opération (écart invisible).
const grille = (m) => (typeof m[0] === 'number' ? [Math.round(m[0] * 1e5) / 1e5, Math.round(m[1] * 1e5) / 1e5] : m.map(grille));
const pc = {
  union: (...a) => pcBrut.union(...a.map(grille)),
  difference: (...a) => pcBrut.difference(...a.map(grille)),
  intersection: (...a) => pcBrut.intersection(...a.map(grille)),
};

const nb = (v, d = 3) => {
  const s = v.toFixed(d).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
};
const pt = (x, y, d) => `${nb(x, d)} ${nb(y, d)}`;

// Disque complet en deux arcs (un seul sous-chemin, sens horaire).
function cercle(cx, cy, r, d = 3) {
  return `M${pt(cx - r, cy, d)}A${nb(r, d)} ${nb(r, d)} 0 1 1 ${pt(cx + r, cy, d)}A${nb(r, d)} ${nb(r, d)} 0 1 1 ${pt(cx - r, cy, d)}Z`;
}

// Polygone régulier approchant un cercle ou une ellipse tournée (pour les opérations booléennes).
function ellipsePoly(cx, cy, rx, ry, angleDeg = 0, n = 128) {
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

// Multipolygone (sortie de polygon-clipping) vers chemin SVG, règle de remplissage nonzero compatible:
// polygon-clipping oriente les contours extérieurs et les trous en sens opposés.
function polyVersChemin(multi, d = 3) {
  let s = '';
  for (const poly of multi) {
    for (const anneau of poly) {
      const pts = anneau.slice(0, -1);
      s += 'M' + pts.map(([x, y]) => pt(x, y, d)).join('L') + 'Z';
    }
  }
  return s;
}

// Croissant: disque (cx, cy, r) dont on retire un disque de rayon ri décalé de (dx, dy).
// Calcul exact des deux points d'intersection, puis deux arcs.
function croissant(cx, cy, r, ri, dx, dy, d = 3) {
  const D = Math.hypot(dx, dy);
  const ux = dx / D;
  const uy = dy / D;
  // distance du centre du grand disque à la corde commune
  const a = (r * r - ri * ri + D * D) / (2 * D);
  const h = Math.sqrt(r * r - a * a);
  const mx = cx + a * ux;
  const my = cy + a * uy;
  const p1 = [mx - h * uy, my + h * ux];
  const p2 = [mx + h * uy, my - h * ux];
  // grand arc extérieur de p1 à p2 (côté opposé au décalage), puis arc intérieur de retour
  return `M${pt(p1[0], p1[1], d)}A${nb(r, d)} ${nb(r, d)} 0 1 1 ${pt(p2[0], p2[1], d)}A${nb(ri, d)} ${nb(ri, d)} 0 1 0 ${pt(p1[0], p1[1], d)}Z`;
}

// Étoile à quatre branches aux flancs concaves (courbes quadratiques).
function etoile4(cx, cy, rPointe, rCreux, d = 3) {
  let s = '';
  for (let i = 0; i < 4; i++) {
    const a = (Math.PI / 2) * i - Math.PI / 2;
    const b = a + Math.PI / 4;
    const p = [cx + rPointe * Math.cos(a), cy + rPointe * Math.sin(a)];
    const c = [cx + rCreux * Math.cos(b), cy + rCreux * Math.sin(b)];
    const n = [cx + rPointe * Math.cos(a + Math.PI / 2), cy + rPointe * Math.sin(a + Math.PI / 2)];
    if (i === 0) s += `M${pt(p[0], p[1], d)}`;
    s += `Q${pt(c[0], c[1], d)} ${pt(n[0], n[1], d)}`;
  }
  return s + 'Z';
}

// Soleil: disque central et n rayons en capsules séparées du disque par un jour.
function soleil(cx, cy, rDisque, rDebut, rFin, largeur, n = 8, decalageDeg = 0, d = 3) {
  let s = cercle(cx, cy, rDisque, d);
  const e = largeur / 2;
  for (let i = 0; i < n; i++) {
    const a = ((2 * Math.PI) / n) * i + (decalageDeg * Math.PI) / 180;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const nx = -uy;
    const ny = ux;
    const r0 = rDebut + e;
    const r1 = rFin - e;
    const A = [cx + ux * r0 + nx * e, cy + uy * r0 + ny * e];
    const B = [cx + ux * r1 + nx * e, cy + uy * r1 + ny * e];
    const C = [cx + ux * r1 - nx * e, cy + uy * r1 - ny * e];
    const D = [cx + ux * r0 - nx * e, cy + uy * r0 - ny * e];
    s += `M${pt(A[0], A[1], d)}L${pt(B[0], B[1], d)}A${nb(e, d)} ${nb(e, d)} 0 0 0 ${pt(C[0], C[1], d)}L${pt(D[0], D[1], d)}A${nb(e, d)} ${nb(e, d)} 0 0 0 ${pt(A[0], A[1], d)}Z`;
  }
  return s;
}

// Comète: tête ronde et queue effilée vers la pointe, flancs légèrement creusés.
// Union obtenue par polygon-clipping pour un contour unique et propre.
function comete(tx, ty, rTete, px, py, creux = 0.18, d = 3) {
  const dx = px - tx;
  const dy = py - ty;
  const L = Math.hypot(dx, dy);
  const ux = dx / L;
  const uy = dy / L;
  // points de tangence depuis la pointe
  const alpha = Math.asin(rTete / L);
  const beta = Math.PI / 2 - alpha;
  const ang = Math.atan2(-uy, -ux);
  const t1 = [tx + rTete * Math.cos(Math.atan2(uy, ux) + beta), ty + rTete * Math.sin(Math.atan2(uy, ux) + beta)];
  const t2 = [tx + rTete * Math.cos(Math.atan2(uy, ux) - beta), ty + rTete * Math.sin(Math.atan2(uy, ux) - beta)];
  void ang;
  // queue: deux courbes quadratiques des tangentes vers la pointe, contrôles rapprochés de l'axe
  const queue = [];
  const n = 48;
  const ctrl = (t) => {
    const mx = (t[0] + px) / 2;
    const my = (t[1] + py) / 2;
    // rapproche le point milieu de l'axe tête-pointe pour creuser le flanc
    const ax = tx + ((mx - tx) * ux + (my - ty) * uy) * ux;
    const ay = ty + ((mx - tx) * ux + (my - ty) * uy) * uy;
    return [mx + (ax - mx) * creux * 2, my + (ay - my) * creux * 2];
  };
  const q = (a, c, b, t) => [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
  const c1 = ctrl(t1);
  const c2 = ctrl(t2);
  for (let i = 0; i <= n; i++) queue.push(q(t1, c1, [px, py], i / n));
  for (let i = n; i >= 0; i--) queue.push(q(t2, c2, [px, py], i / n));
  queue.push(queue[0]);
  const tete = ellipsePoly(tx, ty, rTete, rTete);
  return polyVersChemin(pc.union(tete, [queue]), d);
}

// Planète à anneau: disque, anneau elliptique incliné; l'anneau passe derrière le disque
// (masqué) et devant lui, séparé par un jour.
function planete(cx, cy, rDisque, rxAnneau, ryAnneau, epaisseur, angleDeg, jour, d = 3) {
  const disque = ellipsePoly(cx, cy, rDisque, rDisque);
  const disqueJour = ellipsePoly(cx, cy, rDisque + jour, rDisque + jour);
  const ext = ellipsePoly(cx, cy, rxAnneau, ryAnneau, angleDeg);
  const int = ellipsePoly(cx, cy, rxAnneau - epaisseur, ryAnneau - epaisseur, angleDeg);
  const anneau = pc.difference(ext, int);
  // moitié avant de l'anneau: celle qui passe sous le centre (y local > 0)
  const a = (angleDeg * Math.PI) / 180;
  const grand = 100;
  const demiPlan = [[
    [cx - grand * Math.cos(a), cy - grand * Math.sin(a)],
    [cx + grand * Math.cos(a), cy + grand * Math.sin(a)],
    [cx + grand * Math.cos(a) - grand * Math.sin(a), cy + grand * Math.sin(a) + grand * Math.cos(a)],
    [cx - grand * Math.cos(a) - grand * Math.sin(a), cy - grand * Math.sin(a) + grand * Math.cos(a)],
    [cx - grand * Math.cos(a), cy - grand * Math.sin(a)],
  ]];
  const avant = pc.intersection(anneau, demiPlan);
  const arriere = pc.difference(anneau, demiPlan);
  // l'avant de l'anneau est épaissi du jour pour creuser le disque
  const avantJour = pc.difference(
    ellipsePoly(cx, cy, rxAnneau + jour, ryAnneau + jour, angleDeg),
    ellipsePoly(cx, cy, rxAnneau - epaisseur - jour, ryAnneau - epaisseur - jour, angleDeg),
  );
  const avantJourDemi = pc.intersection(avantJour, demiPlan);
  const disqueVisible = pc.difference(disque, avantJourDemi);
  const arriereVisible = pc.difference(arriere, disqueJour);
  return polyVersChemin(pc.union(disqueVisible, avant, arriereVisible), d);
}

// Anneau du logo: couronne (rayon médian r, épaisseur e) interrompue par deux encoches circulaires
// (centres sur le cercle médian, rayon rEncoche) aux angles donnés. Le fond reste visible à travers.
function anneauEncoche(cx, cy, r, e, encoches, d = 3) {
  const ext = ellipsePoly(cx, cy, r + e / 2, r + e / 2, 0, 720);
  const int = ellipsePoly(cx, cy, r - e / 2, r - e / 2, 0, 720);
  let couronne = pc.difference(ext, int);
  for (const { angleDeg, rEncoche } of encoches) {
    const a = (angleDeg * Math.PI) / 180;
    couronne = pc.difference(couronne, ellipsePoly(cx + r * Math.cos(a), cy + r * Math.sin(a), rEncoche, rEncoche, 0, 720));
  }
  return polyVersChemin(couronne, d);
}

module.exports = { nb, cercle, croissant, etoile4, soleil, comete, planete, anneauEncoche, ellipsePoly, polyVersChemin };
