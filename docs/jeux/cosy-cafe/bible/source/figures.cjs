'use strict';
// Personnages des planches de Cosy Café, dessinés à plat (vue de face ou de dos), en centimètres,
// origine aux pieds, y vers le bas (SVG): un adulte de 180 cm va de y = 0 à y = -180.
// Proportions de la bible (section 7): tête d'environ 27 cm (6,6 têtes), épaules rondes, mains un peu grandes.
const players = require('../../../../../design/identite/b/joueurs.json').players;
const { mixHex, shadeHex } = require('./scene3d.cjs');

const PLAYER = Object.fromEntries(players.map((p) => [p.id, p]));
const INK = '#2B2622';
const PIPING = '#1C1A26';
const SYMBOL_ON = '#0E1126';

const n1 = (x) => Math.round(x * 10) / 10;
const rr = (x, y, w, h, r, fill, extra = '') => `<rect x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" rx="${n1(r)}" fill="${fill}"${extra}/>`;
const el = (cx, cy, rx, ry, fill, extra = '') => `<ellipse cx="${n1(cx)}" cy="${n1(cy)}" rx="${n1(rx)}" ry="${n1(ry)}" fill="${fill}"${extra}/>`;
const pth = (d, fill, extra = '') => `<path d="${d}" fill="${fill}"${extra}/>`;

// symbole du joueur (grille de 24) centré en (cx, cy), de taille s
function symbol(id, cx, cy, s, fill = SYMBOL_ON) {
  const p = PLAYER[id];
  return `<path transform="translate(${n1(cx - s / 2)} ${n1(cy - s / 2)}) scale(${n1((s / 24) * 1000) / 1000})" d="${p.path}" fill="${fill}"/>`;
}

// écusson: disque à la couleur du joueur, liseré sombre, symbole sombre
function patch(id, cx, cy, d) {
  return `<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(d / 2)}" fill="${PLAYER[id].color}" stroke="${PIPING}" stroke-width="${n1(d * 0.09)}"/>` + symbol(id, cx, cy, d * 0.62);
}

const HAIR = {
  short: (c, back) => (back ? el(0, -168, 12.5, 14.5, c) : pth('M-12 -166 Q-13 -182 0 -182.5 Q13 -182 12 -166 Q8 -175 0 -174.5 Q-8 -175 -12 -166Z', c)),
  bob: (c, back) => (back ? pth('M-13.5 -150 Q-15 -183 0 -183 Q15 -183 13.5 -150 Q0 -146 -13.5 -150Z', c) : pth('M-14 -151 Q-16 -183 0 -183 Q16 -183 14 -151 L10.5 -151 Q11 -170 0 -173 Q-11 -170 -10.5 -151Z', c)),
  bun: (c, back) => (back ? el(0, -168, 12.5, 14.5, c) + el(0, -177, 7, 6, c) : pth('M-12 -164 Q-13 -182 0 -182.5 Q13 -182 12 -164 Q9 -175 0 -175 Q-9 -175 -12 -164Z', c) + el(0, -186, 6.5, 5.5, c)),
  long: (c, back) => (back ? pth('M-13 -140 Q-16 -183 0 -183 Q16 -183 13 -140 Q0 -137 -13 -140Z', c) : pth('M-13.5 -141 Q-16 -183 0 -183 Q16 -183 13.5 -141 L10.8 -141 Q11 -171 0 -173 Q-11 -171 -10.8 -141Z', c)),
  curly: (c, back) => {
    const bumps = [-11, -5.5, 0, 5.5, 11].map((x, i) => el(x, -178 + Math.abs(x) * 0.35, 6.5, 6, c)).join('');
    return back ? el(0, -168, 13.5, 15, c) + bumps : bumps + el(-11.5, -168, 4, 6, c) + el(11.5, -168, 4, 6, c);
  },
  bald: () => '',
  grey_bun_pencil: (c, back) => HAIR.bun(c, back) + `<path d="M-4 -192 L6 -181" stroke="#C9A84A" stroke-width="1.6" stroke-linecap="round"/>`,
};

function face(expr, skin) {
  const eye = (x, dx = 0, dy = 0) => el(x + dx, -167.5 + dy, 1.5, 2.1, INK);
  const arcEye = (x) => `<path d="M${x - 2.2} -167 Q${x} -170 ${x + 2.2} -167" stroke="${INK}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
  const brow = (x, tilt) => `<path d="M${x - 2.6} ${-172 + tilt} L${x + 2.6} ${-172 - tilt}" stroke="${INK}" stroke-width="0.9" stroke-linecap="round"/>`;
  const mouth = (d, w = 1.1) => `<path d="${d}" stroke="${INK}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
  const cheeks = el(-7, -161.5, 2.4, 1.5, '#E39A8C', ' fill-opacity="0.55"') + el(7, -161.5, 2.4, 1.5, '#E39A8C', ' fill-opacity="0.55"');
  const nose = `<path d="M0 -165 Q1.2 -162.5 0 -162" stroke="${shadeHex(skin, 0.78)}" stroke-width="0.9" fill="none" stroke-linecap="round"/>`;
  switch (expr) {
    case 'ravi':
      return arcEye(-4.6) + arcEye(4.6) + mouth('M-4 -159.5 Q0 -155 4 -159.5') + cheeks + nose;
    case 'content':
      return eye(-4.6) + eye(4.6) + mouth('M-3 -159.2 Q0 -157 3 -159.2') + cheeks + nose;
    case 'attend':
      return eye(-4.6, 1.2) + eye(4.6, 1.2) + brow(-4.6, 0) + brow(4.6, 0) + mouth('M-2.2 -158.6 L2.2 -158.6') + nose;
    case 'impatient':
      return eye(-4.6) + eye(4.6) + brow(-4.6, -0.9) + brow(4.6, 0.9) + mouth('M-2.6 -158.4 L2.6 -158.8') + nose;
    case 'decu':
      return eye(-4.6, 0, 0.5) + eye(4.6, 0, 0.5) + brow(-4.6, 0.9) + brow(4.6, -0.9) + mouth('M-3 -157.6 Q0 -159.6 3 -157.6') + nose;
    case 'lit':
      return `<path d="M-6.6 -166.6 L-2.6 -166.6 M2.6 -166.6 L6.6 -166.6" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/>` + mouth('M-2 -158.6 L2 -158.6') + nose;
    case 'fatigue':
      return `<path d="M-6.6 -167 Q-4.6 -165.6 -2.6 -167 M2.6 -167 Q4.6 -165.6 6.6 -167" stroke="${INK}" stroke-width="1.2" fill="none" stroke-linecap="round"/>` + brow(-4.6, 0.9) + brow(4.6, -0.9) + mouth('M-2.2 -158.4 L2.2 -158.4') + nose;
    default:
      return eye(-4.6) + eye(4.6) + mouth('M-2.4 -158.8 Q0 -158 2.4 -158.8') + nose;
  }
}

// silhouette commune: jambes, chaussures, torse, bras, cou, tête; options de tenue et d'accessoires
// o: { view: 'front'|'back', skin, hair, hairStyle, top, bottom, shoes, coat, coatLength, scarf, expr, pose,
//      apron: { color, kind: 'player'|'staff', player }, headscarf: playerId, acc: [..], scale, silhouette }
function person(o) {
  const v = o.view || 'front';
  const back = v === 'back';
  const sil = o.silhouette;
  const C = (c) => (sil ? sil : c);
  const skin = C(o.skin || '#E4B897');
  const top = C(o.top || '#8E8B86');
  const bottom = C(o.bottom || '#4D5F7D');
  const shoes = C(o.shoes || '#3A2C25');
  const hairC = C(o.hair || '#4A3324');
  const pose = o.pose || 'stand';
  const parts = [];
  const seated = pose === 'sit' || pose === 'sitRead';
  // décalage vertical du haut du corps quand on est assis (hanches à 45 cm au lieu de 92)
  const dy = seated ? 47 : 0;
  const T = (s) => (dy ? `<g transform="translate(0 ${dy})">${s}</g>` : s);

  // jambes
  if (!seated) {
    const lean = pose === 'hip' ? 3 : 0;
    parts.push(rr(-14 + lean, -94, 12.5, 90, 6, bottom), rr(1.5 + lean, -94, 12.5, 90, 6, bottom));
    parts.push(el(-8 + lean, -3.5, 8.5, 4, shoes), el(8 + lean, -3.5, 8.5, 4, shoes));
  } else {
    // tibias seulement (les cuisses viennent vers nous)
    parts.push(rr(-14, -46, 12, 43, 6, bottom), rr(2, -46, 12, 43, 6, bottom));
    parts.push(el(-8, -3.5, 8.5, 4, shoes), el(8, -3.5, 8.5, 4, shoes));
    parts.push(rr(-18, -52, 36, 12, 6, bottom));
  }
  // manteau long (sous le torse)
  const coat = o.coat ? C(o.coat) : null;
  if (coat) {
    const len = o.coatLength || 58;
    parts.push(T(pth(`M-23 -146 Q-24 -120 -25 ${-len} Q0 ${-len + 3} 25 ${-len} Q24 -120 23 -146Z`, coat)));
  }
  // dos: sac à dos sous les bras
  const acc = o.acc || [];
  // bras (derrière le torse de face, devant de dos: même dessin)
  const sleeve = coat || top;
  const armL = pose === 'pockets' ? rr(-24, -146, 10, 52, 5, sleeve) : pose === 'watch' ? rr(-25, -146, 10, 58, 5, sleeve) : rr(-27, -146, 10, 64, 5, sleeve);
  let armR = pose === 'pockets' ? rr(14, -146, 10, 52, 5, sleeve) : rr(17, -146, 10, 64, 5, sleeve);
  let handR = el(22, -80, 6, 6.2, skin);
  let handL = pose === 'pockets' ? '' : pose === 'watch' ? '' : el(-22, -80, 6, 6.2, skin);
  if (pose === 'tray') {
    // plateau porté à l'épaule, main droite à plat sous le plateau
    armR = pth('M17 -144 Q27 -142 30 -128 L36 -152 Q38 -158 32 -159 L29 -158 L24 -133 Q22 -140 17 -140Z', sleeve);
    handR = el(33, -160, 6, 4, skin);
  }
  if (pose === 'hold') {
    // les deux mains devant, à hauteur de poitrine (carte, carnet, tasse)
    parts.push(T(rr(-27, -146, 10, 40, 5, sleeve) + rr(17, -146, 10, 40, 5, sleeve)));
  } else if (pose === 'sit') {
    parts.push(T(rr(-27, -146, 10, 30, 5, sleeve) + rr(17, -146, 10, 30, 5, sleeve)));
  } else if (pose === 'sitRead') {
    parts.push(T(pth('M-27 -144 L-17 -144 L-15 -128 L-24 -126Z', sleeve) + pth('M27 -144 L17 -144 L15 -128 L24 -126Z', sleeve)));
  } else {
    parts.push(T(armL + armR));
  }
  // torse
  const torso = pth('M-21 -148 Q-23 -148 -23 -144 L-20 -96 Q-19 -92 -15 -92 L15 -92 Q19 -92 20 -96 L23 -144 Q23 -148 21 -148 Q0 -151 -21 -148Z', coat || top);
  parts.push(T(torso));
  if (o.turtleneck) parts.push(T(rr(-6.5, -154, 13, 8, 3, C(o.turtleneck))));
  // cou et tête
  parts.push(T(rr(-4.5, -154, 9, 9, 3, skin)));
  parts.push(T(el(0, -166.5, 11.5, 13.5, skin)));
  if (!back && !sil) parts.push(T(el(-11.3, -166, 1.8, 3, shadeHex(skin, 0.92)) + el(11.3, -166, 1.8, 3, shadeHex(skin, 0.92))));
  // visage
  if (!back && !sil) parts.push(T(face(o.expr, o.skin || '#E4B897')));
  // cheveux
  const hs = HAIR[o.hairStyle || 'short'];
  parts.push(T(hs(hairC, back)));

  // tablier
  if (o.apron) {
    const ap = C(o.apron.color);
    if (o.apron.kind === 'player') {
      if (!back) {
        // bavette, poche avec le symbole, jupe jusqu'aux genoux, liseré sombre
        parts.push(T(pth('M-12 -140 L12 -140 L13 -112 Q22 -110 22 -104 L23 -52 Q0 -49 -23 -52 L-22 -104 Q-22 -110 -13 -112Z', ap, ` stroke="${C(PIPING)}" stroke-width="1.6"`)));
        parts.push(T(`<path d="M-11 -140 L-17 -149 M11 -140 L17 -149" stroke="${C(PIPING)}" stroke-width="4.4" stroke-linecap="round"/><path d="M-11 -140 L-17 -149 M11 -140 L17 -149" stroke="${ap}" stroke-width="2.6" stroke-linecap="round"/>`));
        if (!sil) parts.push(T(patch(o.apron.player, 0, -126, 13)));
      } else {
        // dos: bretelles croisées en X, écusson au croisement, liens à la taille
        const strap = (d) => `<path d="${d}" stroke="${C(PIPING)}" stroke-width="7.4" stroke-linecap="round" fill="none"/><path d="${d}" stroke="${ap}" stroke-width="5" stroke-linecap="round" fill="none"/>`;
        parts.push(T(strap('M-16 -146 L15 -100') + strap('M16 -146 L-15 -100')));
        parts.push(T(rr(-21, -101, 42, 6, 3, C(PIPING)) + rr(-20.3, -100.3, 40.6, 4.6, 2.3, ap)));
        parts.push(T(pth('M-3 -97 Q-7 -86 -9 -78 L-5 -78 Q-3 -86 0 -95 Q3 -86 5 -78 L9 -78 Q7 -86 3 -97Z', ap, ` stroke="${C(PIPING)}" stroke-width="1"`)));
        if (!sil) parts.push(T(patch(o.apron.player, 0, -128, 20)));
        else parts.push(T(`<circle cx="0" cy="-128" r="10" fill="${C(PIPING)}"/>`));
      }
    } else if (!back) {
      // tablier d'employé à la couleur de la maison: bavette simple, emblème clair
      parts.push(T(pth('M-12 -142 L12 -142 L13 -112 Q21 -110 21 -104 L22 -58 Q0 -55 -22 -58 L-21 -104 Q-21 -110 -13 -112Z', ap)));
      parts.push(T(`<path d="M-11 -142 Q0 -158 11 -142" stroke="${ap}" stroke-width="2.6" fill="none"/>`));
      if (!sil) parts.push(T(`<circle cx="0" cy="-127" r="4.2" fill="none" stroke="#E9DCC3" stroke-width="1.4"/><path d="M-2 -126 Q0 -130 2 -126" stroke="#E9DCC3" stroke-width="1.2" fill="none"/>`));
    } else {
      // dos d'employé: lien du cou et nœud à la taille, rien qui ressemble à un X
      parts.push(T(`<path d="M-10 -150 Q0 -146 10 -150" stroke="${ap}" stroke-width="2.6" fill="none"/>` + rr(-21, -100, 42, 4.5, 2.2, ap) + pth('M-2 -98 L-8 -86 L-4 -85 L0 -95 L4 -85 L8 -86 L2 -98Z', ap)));
    }
  }
  // foulard de tête du joueur noué en bandeau: à la couleur du joueur, liseré sombre, nœud et pans dans le dos
  if (o.headscarf) {
    const hc = C(PLAYER[o.headscarf].color);
    const pip = C(PIPING);
    if (!back) {
      parts.push(T(pth('M-12.6 -171 Q-13 -180.5 -9 -181.5 Q0 -184.5 9 -181.5 Q13 -180.5 12.6 -171 Q0 -175.5 -12.6 -171Z', hc, ` stroke="${pip}" stroke-width="1.3"`)));
    } else {
      parts.push(T(pth('M-12.8 -169 Q-13.5 -180 -9 -182 Q0 -185 9 -182 Q13.5 -180 12.8 -169 Q0 -173 -12.8 -169Z', hc, ` stroke="${pip}" stroke-width="1.3"`)));
      parts.push(T(el(0, -170, 4.4, 3.6, hc, ` stroke="${pip}" stroke-width="1.2"`) + pth('M-2 -168 L-7.5 -151 L-3.2 -150 L0 -166Z', hc, ` stroke="${pip}" stroke-width="1"`) + pth('M2 -168 L7.5 -150.5 L3.2 -149.5 L0 -166Z', hc, ` stroke="${pip}" stroke-width="1"`)));
    }
  }
  // accessoires
  for (const a of acc) parts.push(T(accessory(a, back, C, skin, o)));
  // mains par-dessus
  if (pose !== 'hold' && pose !== 'sit' && pose !== 'sitRead') parts.push(T(handL + handR));
  if (pose === 'sitRead') parts.push(T(el(-21, -131, 5.6, 5.6, skin) + el(21, -131, 5.6, 5.6, skin)));
  if (pose === 'hold' || pose === 'sit') {
    const hy = pose === 'sit' ? -120 : -108;
    parts.push(T(el(-19, hy, 6, 6, skin) + el(19, hy, 6, 6, skin)));
  }
  const s = o.scale || 1;
  const body = parts.join('');
  return s === 1 ? body : `<g transform="scale(${s})">${body}</g>`;
}

function accessory(a, back, C, skin, o) {
  const k = typeof a === 'string' ? a : a.kind;
  const col = (def) => C((a && a.color) || def);
  switch (k) {
    case 'shoulderBag':
      return back
        ? `<path d="M17 -146 L-18 -96" stroke="${col('#8A5A38')}" stroke-width="3" />` + rr(-26, -104, 16, 13, 3, col('#8A5A38'))
        : `<path d="M-17 -146 L18 -96" stroke="${col('#8A5A38')}" stroke-width="3" />` + rr(12, -104, 16, 13, 3, col('#8A5A38'));
    case 'backpack':
      return back
        ? rr(-17, -150, 34, 50, 9, col('#A15A3B')) + rr(-13, -132, 26, 14, 5, shadeHex(col('#A15A3B'), 0.85)) + rr(-15, -156, 30, 9, 4, col('#C9B794'))
        : rr(-23, -156, 8, 13, 4, col('#A15A3B')) + rr(15, -156, 8, 13, 4, col('#A15A3B')) + `<path d="M-13 -148 L-14 -104 M13 -148 L14 -104" stroke="${col('#A15A3B')}" stroke-width="3.2"/>`;
    case 'cap':
      return back ? pth('M-12.5 -172 Q-13 -186 0 -186.5 Q13 -186 12.5 -172Z', col('#C9B794')) : pth('M-12.5 -172 Q-13 -186 0 -186.5 Q13 -186 12.5 -172Z', col('#C9B794')) + rr(-15, -174, 30, 3.6, 1.8, shadeHex(col('#C9B794'), 0.8));
    case 'scarf':
      return rr(-12, -153, 24, 8, 4, col('#B39656')) + (back ? '' : rr(4, -149, 7, 34, 3.5, col('#B39656')));
    case 'newspaper':
      return back ? '' : pth('M-30 -118 L-19 -121 L-17 -96 L-28 -93Z', col('#D9D0BE')) + `<path d="M-27 -113 L-21 -114.5 M-26.5 -109 L-20.5 -110.5" stroke="${INK}" stroke-width="0.8"/>`;
    case 'menuOpen': {
      // carte de menu ouverte tenue à deux mains: un rectangle clair à hauteur de poitrine
      const y0 = o.pose === 'sitRead' ? -146 : -128;
      return back ? '' : rr(-21, y0, 42, 26, 1.5, col('#FBF6EA')) + `<path d="M0 ${y0} L0 ${y0 + 26}" stroke="#D7CCB6" stroke-width="1"/><path d="M-17 ${y0 + 6} L-5 ${y0 + 6} M-17 ${y0 + 11} L-7 ${y0 + 11} M4 ${y0 + 6} L16 ${y0 + 6} M4 ${y0 + 11} L14 ${y0 + 11}" stroke="${INK}" stroke-width="0.9"/>`;
    }
    case 'cup':
      return back ? '' : pth('M14 -92 L24 -92 L23 -82 Q19 -80 15 -82Z', col('#F5F0E6'), ` stroke="${INK}" stroke-width="0.6"`);
    case 'takeaway':
      return back ? '' : pth('M17 -94 L27 -94 L25.5 -78 L18.5 -78Z', col('#B48C5E')) + rr(16.5, -96, 11, 2.6, 1, '#F5F0E6');
    case 'phone':
      return back ? '' : rr(-27.5, -112, 6, 10, 1.2, col('#2E2E33'));
    case 'headset':
      return back ? `<path d="M-11 -156 Q0 -152 11 -156" stroke="${col('#2E2E33')}" stroke-width="2.6" fill="none"/>` : `<path d="M-11 -150 Q0 -141 11 -150" stroke="${col('#2E2E33')}" stroke-width="2.6" fill="none"/>` + el(-11, -150, 3.6, 4.4, col('#2E2E33')) + el(11, -150, 3.6, 4.4, col('#2E2E33'));
    case 'tote':
      return back ? `<path d="M-15 -146 L-20 -112" stroke="${col('#B3A887')}" stroke-width="2.4"/>` + rr(-30, -114, 18, 22, 2, col('#B3A887')) : `<path d="M15 -146 L20 -112" stroke="${col('#B3A887')}" stroke-width="2.4"/>` + rr(12, -114, 18, 22, 2, col('#B3A887'));
    case 'laptop':
      return back ? '' : rr(-31, -112, 5, 26, 1.2, col('#6F7379'));
    case 'cardigan':
      return back ? '' : `<path d="M-3 -148 L-6 -96 M3 -148 L6 -96" stroke="${col('#8E8B86')}" stroke-width="5"/>`;
    case 'sunglasses':
      return back ? rr(-12, -181, 24, 3.4, 1.6, col('#2A2A2E')) : rr(-11, -181, 9, 4.2, 2, col('#2A2A2E')) + rr(2, -181, 9, 4.2, 2, col('#2A2A2E'));
    case 'notebook':
      return back ? '' : rr(-25, -106, 11, 14, 1.4, col('#6B4430'));
    case 'cakeBox':
      return back ? '' : `<path d="M22 -80 L22 -72" stroke="#E8D9C2" stroke-width="0.8"/>` + rr(14, -72, 17, 13, 1.4, col('#C9A8A0')) + `<path d="M22.5 -72 L22.5 -59" stroke="#9E4E63" stroke-width="1.2"/>`;
    case 'glassesChain':
      return back ? '' : `<circle cx="-4.6" cy="-167.5" r="3.4" fill="none" stroke="${col('#6B4430')}" stroke-width="0.9"/><circle cx="4.6" cy="-167.5" r="3.4" fill="none" stroke="${col('#6B4430')}" stroke-width="0.9"/><path d="M-8 -167 Q-12 -150 -6 -142 M8 -167 Q12 -150 6 -142" stroke="#C9A84A" stroke-width="0.6" fill="none"/>`;
    case 'basket':
      return back ? '' : `<path d="M-30 -96 Q-22 -110 -14 -96" stroke="${col('#B48C5E')}" stroke-width="1.8" fill="none"/>` + pth('M-33 -96 L-11 -96 L-13 -80 Q-22 -78 -31 -80Z', col('#B48C5E'));
    case 'longCardigan':
      return pth('M-22 -146 L-25 -70 Q-15 -68 -8 -70 L-7 -146Z', col('#5A3450')) + pth('M22 -146 L25 -70 Q15 -68 8 -70 L7 -146Z', col('#5A3450'));
    case 'tray': {
      // plateau à l'épaule avec deux tasses
      const t = col('#4A3A31');
      return rr(14, -166, 40, 4, 2, t) + pth('M20 -166 L27 -166 L26.3 -172 L20.7 -172Z', '#F5F0E6', ` stroke="${INK}" stroke-width="0.5"`) + pth('M34 -166 L41 -166 L40.3 -173 L34.7 -173Z', '#F5F0E6', ` stroke="${INK}" stroke-width="0.5"`);
    }
    default:
      return '';
  }
}

// enfant: même dessin, plus petit (environ 1,12 m), tête proportionnellement plus grande
function child(o) {
  const inner = person({ ...o, scale: 1 });
  return `<g transform="scale(0.62)">${inner}</g>`;
}

// poussette de profil simplifié (vue de face, elle se lit par ses roues et sa capote)
function stroller(color = '#3F5E4A', sil) {
  const c = sil || color;
  return pth('M-20 -92 Q-22 -60 -14 -48 L18 -48 Q22 -60 16 -70 Q2 -94 -20 -92Z', c) + `<path d="M-14 -48 L-16 -12 M14 -48 L16 -12 M-20 -92 L-28 -110" stroke="${sil || '#2E2E33'}" stroke-width="3" stroke-linecap="round"/>` + `<circle cx="-16" cy="-8" r="7" fill="${sil || '#2E2E33'}"/><circle cx="16" cy="-8" r="7" fill="${sil || '#2E2E33'}"/>`;
}

module.exports = { person, child, stroller, symbol, patch, PLAYER, PIPING, INK };
