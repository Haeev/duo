'use strict';
// Vues subjectives des cinq adresses de Cosy Café pour les planches de la bible.
// Ce sont des intentions d'ambiance à l'échelle (caméra de la bible: yeux à 1,65 m, champ vertical de 60 degrés,
// 1366 x 768), pas des plans: les plans et les cotes sont ceux du level designer (docs/jeux/cosy-cafe/plans/).
// Repère de chaque salle: x de gauche à droite en regardant la rue, z du fond (0) vers la façade sur rue (D), y en haut.
const { Camera, Scene, mixHex, shadeHex, vnorm, r1 } = require('./scene3d.cjs');
const M = require('./mobilier.cjs');
const F = require('./figures.cjs');
const P = require('./palette.cjs');

const A = (addr, id) => [...P.addresses[addr].interior, ...P.addresses[addr].exterior].find((e) => e.id === id).hex;
const S = (style, id) => P.styles[style].colors.find((e) => e.id === id).hex;
const C = M.C;

// lumière d'un moment: couleurs du ciel et des rebonds, part des vitrines, des lampes, teinte de la rue
function lighting(momentId, lamps, windows) {
  const m = P.moments[momentId];
  const T = {
    morning: { amb: '#E6E8E6', day: '#EAF1F6', win: 0.75, lamp: 0.5, ext: '#E8EEF2', boost: 1.08 },
    noon: { amb: '#F4EFE7', day: '#FFF7EC', win: 0.95, lamp: 0.25, ext: '#FFFFFF', boost: 1.1 },
    afternoon: { amb: '#F3E3CD', day: '#FFE4C2', win: 0.8, lamp: 0.42, ext: '#FFE9CC', boost: 1.12 },
    evening: { amb: '#BFAF9E', day: '#5D6B93', win: 0.12, lamp: 0.95, ext: '#5F6F98', boost: 1 },
    rain: { amb: '#CDD0D2', day: '#C7D0D8', win: 0.42, lamp: 0.7, ext: '#A9B3BC', boost: 1 },
    winter: { amb: '#E3E6EA', day: '#EEF3F8', win: 0.7, lamp: 0.65, ext: '#EEF3F7', boost: 1.05 },
  }[momentId];
  return {
    ambientColor: T.amb,
    ambient: m.ambient * 0.78,
    dayColor: T.day,
    windows: windows.map((w) => ({ ...w, power: w.power * T.win })),
    lamps: lamps.map((l) => ({ pos: l.pos, color: '#FFC27A', power: (l.power || 0.55) * T.lamp, radius: l.radius || 1.3 })),
    exterior: { tint: T.ext, sunBoost: m.sun ? T.boost : 1 },
  };
}
// direction du soleil (du soleil vers la scène) selon le moment: entre par la façade sur rue (z décroissant)
function sunDir(momentId, fromRight = true) {
  const m = P.moments[momentId];
  if (!m.sun) return null;
  const el = (m.sunElevation * Math.PI) / 180;
  const az = { morning: fromRight ? 0.62 : -0.62, noon: 0.15, afternoon: fromRight ? -0.48 : 0.48, winter: fromRight ? 0.4 : -0.4 }[momentId] || 0;
  const hx = Math.sin(az);
  const hz = -Math.cos(az);
  return vnorm([hx * Math.cos(el), -Math.sin(el), hz * Math.cos(el)]);
}

// salle: sol, plafond, murs (avec baies sur la façade z = D), plinthes, solives éventuelles
function room(s, o) {
  const { W, D, H } = o;
  const g = { gradient: true };
  const floor = s.face([[0, 0, 0], [0, 0, D], [W, 0, D], [W, 0, 0]], o.floor, { noAo: true });
  const ceil = s.face([[0, H, 0], [W, H, 0], [W, H, D], [0, H, D]], o.ceiling, { noAo: true });
  if (floor) s.layers.shell.push(floor);
  if (ceil) s.layers.shell.push(ceil);
  // joints du sol en perspective
  if (o.floorLines) {
    const lines = [];
    const st = o.floorLines.step;
    const lc = o.floorLines.color;
    const seg = (a, b) => {
      const pa = s.cam.view(a);
      const pb = s.cam.view(b);
      if (pa[2] < 0.1 && pb[2] < 0.1) return;
      // découpe simple au plan proche
      const clipT = (p, q) => {
        const t = (0.1 - p[2]) / (q[2] - p[2]);
        return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, 0.1];
      };
      const A1 = pa[2] < 0.1 ? clipT(pa, pb) : pa;
      const B1 = pb[2] < 0.1 ? clipT(pb, pa) : pb;
      const sa = s.cam.project(A1);
      const sb = s.cam.project(B1);
      lines.push(`M${r1(sa[0])} ${r1(sa[1])}L${r1(sb[0])} ${r1(sb[1])}`);
    };
    if (o.floorLines.alongZ !== false) for (let x = st; x < W; x += st) seg([x, 0.002, 0], [x, 0.002, D]);
    if (o.floorLines.alongX !== false) for (let z = o.floorLines.stepZ || st; z < D; z += o.floorLines.stepZ || st) seg([0, 0.002, z], [W, 0.002, z]);
    s.layers.shell.push({ depth: 0, svg: `<path d="${lines.join('')}" stroke="${lc}" stroke-width="${o.floorLines.width || 1.2}" stroke-opacity="${o.floorLines.opacity || 0.5}" fill="none"/>` });
  }
  const walls = [
    s.wall('z', 0, 0, W, 0, H, o.backHoles || [], o.walls, { ...g, flip: false }),
    s.wall('z', D, 0, W, 0, H, o.frontHoles || [], o.frontWall || o.walls, { ...g, flip: true }),
    s.wall('x', 0, 0, D, 0, H, o.leftHoles || [], o.leftWall || o.walls, { ...g, flip: true }),
    s.wall('x', W, 0, D, 0, H, o.rightHoles || [], o.walls, { ...g, flip: false }),
  ];
  for (const w of walls) if (w) s.layers.shell.push(w);
  // soubassement ou lambris
  if (o.wainscot) {
    const { h, color } = o.wainscot;
    const parts = [
      s.face([[0.001, 0, 0], [0.001, h, 0], [0.001, h, D], [0.001, 0, D]].reverse(), color, { cull: false, gradient: true }),
      s.face([[W - 0.001, 0, 0], [W - 0.001, h, 0], [W - 0.001, h, D], [W - 0.001, 0, D]], color, { cull: false, gradient: true }),
    ];
    for (const p of parts) if (p) s.layers.shell.push(p);
  }
}

// personnages placés dans la scène (dessins à plat), avec leur ombre de contact
function figureAt(s, x, z, spec, o = {}) {
  const shadow = s.ellipseDecal(x, 0.004, z, 0.32, 0.22, '#2A1E18', 0.32);
  if (shadow) s.layers.overlays.push(shadow);
  const lightK = o.lightK || 1;
  const tint = (h) => (h ? shadeHex(h, lightK) : h);
  let svg = F.person({ ...spec, skin: tint(spec.skin), top: tint(spec.top), bottom: tint(spec.bottom), hair: tint(spec.hair), coat: tint(spec.coat) });
  // liseré de lumière (terme de Fresnel du shader des personnages): plus marqué sur un client qui attend
  // épaisseur constante à l'écran (environ 2,4 pixels), quelle que soit la distance
  const zc = s.cam.view([x, 1, z])[2];
  const rimW = Math.round(((2.4 * zc * 100) / s.cam.focal) * 100) / 100;
  if (o.rim && zc > 0.1) svg = `<g stroke="#FFF1D6" stroke-opacity="${o.rim}" stroke-width="${rimW * 2}" stroke-linejoin="round">${F.person({ ...spec, silhouette: '#FFF1D6' })}</g>` + svg;
  s.billboard(x, 0, z, svg, 'objects', o.depthBias || 0);
}

// vapeur peinte au-dessus d'une tasse (rubans, jamais de flou)
function steam(s, x, y, z, k = 1) {
  const c = s.cam.view([x, y, z]);
  if (c[2] < 0.1) return;
  const p = s.cam.project(c);
  const u = (s.cam.focal / c[2]) * 0.01 * k;
  const d = `M${r1(p[0])} ${r1(p[1])} c${r1(-3 * u)} ${r1(-4 * u)} ${r1(3 * u)} ${r1(-7 * u)} 0 ${r1(-11 * u)} s${r1(3 * u)} ${r1(-7 * u)} 0 ${r1(-11 * u)} M${r1(p[0] + 2.4 * u)} ${r1(p[1] - 1 * u)} c${r1(-2.4 * u)} ${r1(-3 * u)} ${r1(2.4 * u)} ${r1(-6 * u)} 0 ${r1(-9 * u)}`;
  s.layers.fx.push({ depth: c[2], svg: `<path d="${d}" stroke="#FFFFFF" stroke-opacity="0.75" stroke-width="${r1(Math.max(1.2, 1.1 * u))}" fill="none" stroke-linecap="round"/>` });
}

// marqueur numéroté (légende de la planche)
function marker(s, p, n) {
  const c = s.cam.view(p);
  if (c[2] < 0.1) return;
  const sc = s.cam.project(c);
  s.layers.top.push({ depth: 0, svg: `<g transform="translate(${r1(sc[0])} ${r1(sc[1])})"><circle r="15" fill="#2B211C" stroke="#F6EEDF" stroke-width="2"/><text y="6" text-anchor="middle" font-family="'Jost Variable', Jost, sans-serif" font-weight="500" font-size="17" fill="#F6EEDF">${n}</text></g>` });
}

// pluie sur la vitre: gouttes et filets peints sur le verre
function rainOnGlass(s, x0, x1, y0, y1, z, seed = 1) {
  let r = seed;
  const rnd = () => {
    r = (r * 16807) % 2147483647;
    return r / 2147483647;
  };
  const parts = [];
  for (let i = 0; i < 70; i++) {
    const x = x0 + rnd() * (x1 - x0);
    const y = y0 + rnd() * (y1 - y0);
    const c = s.cam.view([x, y, z]);
    if (c[2] < 0.2) continue;
    const p = s.cam.project(c);
    const k = s.cam.focal / c[2];
    const len = (0.02 + rnd() * 0.08) * k;
    parts.push(`<path d="M${r1(p[0])} ${r1(p[1])}l${r1(len * 0.06)} ${r1(len)}" stroke="#E8EEF2" stroke-opacity="0.55" stroke-width="${r1(Math.max(1, 0.006 * k))}" stroke-linecap="round"/>`);
  }
  s.layers.fx.push({ depth: 0, svg: parts.join('') });
}
function snowfall(s, x0, x1, z0, z1, seed = 3) {
  let r = seed;
  const rnd = () => {
    r = (r * 16807) % 2147483647;
    return r / 2147483647;
  };
  const parts = [];
  for (let i = 0; i < 160; i++) {
    const p3 = [x0 + rnd() * (x1 - x0), rnd() * 6, z0 + rnd() * (z1 - z0)];
    const c = s.cam.view(p3);
    if (c[2] < 0.5) continue;
    const p = s.cam.project(c);
    parts.push(`<circle cx="${r1(p[0])}" cy="${r1(p[1])}" r="${r1(Math.max(1, (s.cam.focal * 0.025) / c[2]))}" fill="#FFFFFF" fill-opacity="0.9"/>`);
  }
  s.layers.exterior.push({ depth: 0.01, svg: parts.join('') });
}

const PLAYER_A = { id: 'orb', top: '#2B2F45' }; // le plus clair des deux porte le haut sombre (bible, 7.1)
const PLAYER_B = { id: 'crescent', top: '#EEE6D6' };
const avatar = (pl, view, extra = {}) => ({ view, skin: extra.skin || '#CC9871', hair: extra.hair || '#2B2320', hairStyle: extra.hairStyle || 'short', top: pl.top, bottom: extra.bottom || '#3A3A40', shoes: '#2B2320', apron: { kind: 'player', color: F.PLAYER[pl.id].color, player: pl.id }, headscarf: pl.id, expr: extra.expr || 'content', pose: extra.pose, acc: extra.acc || [] });

// ------------------------------------------------------------------------------------------------
// 1. Village: le café de la place du Tilleul (plan village-arrivee du level designer, 7,00 x 5,40 m).
// Passage du plan à ce repère: x = 11,0 - x du plan, z = y du plan - 7,1 (on regarde la place).
// Vue « a »: point de vue « machine » du plan (derrière le comptoir, face à la place);
// vue « b »: point de vue « entrée » (face au comptoir, à l'ardoise et à la file).
function village(momentId = 'afternoon', opts = {}) {
  const W = 7.0;
  const D = 5.4;
  const H = 2.8;
  const view = opts.view || 'a';
  const cams = {
    a: { x: 3.25, z: 0.8, yaw: -9, pitch: -9 },
    b: { x: 2.3, z: 5.0, yaw: 196, pitch: -8 },
    c: { x: 2.05, z: 1.0, yaw: 2, pitch: -30 },
  };
  const cam = new Camera({ ...cams[view], width: opts.width || 1366, height: opts.height || 768 });
  const lamps = [{ pos: [0.9, 2.1, 2.15] }, { pos: [2.5, 2.1, 2.15] }, { pos: [3.6, 2.1, 5.1], power: 0.5 }, { pos: [5.2, 2.1, 5.1], power: 0.5 }, { pos: [6.6, 2.1, 2.9], power: 0.5 }];
  const windows = [{ center: [3.5, 1.5, D], normal: [0, 0, -1], power: 0.9 }, { center: [5.5, 1.5, D], normal: [0, 0, -1], power: 0.9 }, { center: [1.6, 1.4, D], normal: [0, 0, -1], power: 0.3 }];
  const s = new Scene(cam, lighting(momentId, lamps, windows));
  const m = P.moments[momentId];
  const night = momentId === 'evening';
  const winter = momentId === 'winter';
  const rain = momentId === 'rain';
  const roofC = winter ? '#EEF1F3' : A('village', 'village_roof');

  // dehors: la place du Tilleul (arrêt du car, mairie-école à gauche, église en face, boulangerie à côté)
  const pave = winter ? '#E9EDF0' : rain ? shadeHex(A('village', 'village_paving'), 0.62) : A('village', 'village_paving');
  M.ground(s, -16, 24, D + 0.5, 48, pave);
  M.ground(s, -16, 24, D + 0.5, D + 1.9, winter ? '#E3E7EA' : rain ? shadeHex('#B9AE9A', 0.65) : '#B9AE9A');
  M.facade(s, -14, -4.5, 13.5, 7.8, { wall: mixHex(A('village', 'village_stone'), '#D9C7A0', 0.3), roof: roofC, shutters: A('village', 'village_shutter'), floors: 2, perFloor: 3, lit: night || rain, seed: 1, sunlit: !!m.sun });
  M.facade(s, -4, 5.5, 22, 7.0, { wall: A('village', 'village_stone'), roof: roofC, shutters: '#8DA287', floors: 2, perFloor: 3, lit: night || rain, seed: 2, sunlit: !!m.sun });
  M.facade(s, 12.5, 22, 21, 6.6, { wall: A('village', 'village_stone_shade'), roof: roofC, shutters: A('village', 'village_shutter'), floors: 2, perFloor: 2, lit: night, seed: 0, sunlit: !!m.sun });
  // l'église au fond de la place (façade simple et clocher, aucun édifice réel)
  const church = [...s.box(5.8, 0, 26, 12, 8.5, 34, { front: A('village', 'village_stone'), left: A('village', 'village_stone_shade'), right: A('village', 'village_stone_shade'), top: roofC }, { exterior: true }), ...s.box(8.0, 8.5, 26.2, 9.8, 15.5, 28, { front: A('village', 'village_stone'), left: A('village', 'village_stone_shade'), right: A('village', 'village_stone_shade') }, { exterior: true })].filter(Boolean);
  const spire = s.face([[7.8, 15.5, 26.1], [8.9, 19.5, 27.1], [10.0, 15.5, 26.1]], winter ? '#EEF1F3' : '#7E8A93', { exterior: true, cull: false });
  const portal = s.face([[8.4, 0, 25.98], [8.4, 2.8, 25.98], [9.4, 2.8, 25.98], [9.4, 0, 25.98]], '#6B4B35', { exterior: true, cull: false });
  s.layers.exterior.push({ depth: 9000, svg: church.sort((a, b) => b.depth - a.depth).map((f) => f.svg).join('') + (spire ? spire.svg : '') + (portal ? portal.svg : '') });
  // la fontaine (à gauche) et le tilleul (à droite), comme sur le plan
  const fountain = [
    ...s.cylinder(-2.6, 0, 9.5, 0.8, 0.55, 14, A('village', 'village_stone'), { exterior: true }),
    ...s.cylinder(-2.6, 0.5, 9.5, 0.7, 0.02, 14, rain ? '#6F8C93' : winter ? '#DDE5EA' : A('village', 'village_water'), { exterior: true }),
    ...s.cylinder(-2.6, 0.5, 9.5, 0.12, 1.1, 8, A('village', 'village_stone_shade'), { exterior: true }),
    ...s.cylinder(-2.6, 1.6, 9.5, 0.3, 0.14, 10, A('village', 'village_stone'), { exterior: true, r1: 0.38 }),
  ].filter(Boolean);
  s.layers.exterior.push({ depth: s.cam.view([-2.6, 0.5, 9.5])[2], svg: fountain.sort((a, b) => b.depth - a.depth).map((f) => f.svg).join('') });
  M.tree(s, 8.4, 9.8, { h: 6.0, bark: A('village', 'village_bark'), leaves: [A('village', 'village_tree'), '#8AA35E'], bare: winter });
  // banc de la patronne sous la vitrine, ardoise de trottoir près de la porte (on en voit le dos)
  const bench = [...s.box(5.0, 0.42, 5.95, 6.2, 0.47, 6.35, '#6B4B35', { exterior: true }), ...s.box(5.0, 0.47, 6.3, 6.2, 0.85, 6.36, '#6B4B35', { exterior: true }), ...s.box(5.05, 0, 6.0, 5.12, 0.42, 6.3, '#3A3330', { exterior: true }), ...s.box(6.08, 0, 6.0, 6.15, 0.42, 6.3, '#3A3330', { exterior: true })].filter(Boolean);
  s.layers.exterior.push({ depth: s.cam.view([5.6, 0.5, 6.1])[2], svg: bench.sort((a, b) => b.depth - a.depth).map((f) => f.svg).join('') });
  const aframe = s.face([[2.25, 0, 6.15], [2.35, 1.0, 6.3], [2.75, 1.0, 6.3], [2.85, 0, 6.15]], '#6B4B35', { exterior: true, cull: false });
  if (aframe) s.layers.exterior.push({ depth: s.cam.view([2.5, 0.5, 6.2])[2], svg: aframe.svg });
  s.billboard(4.2, 0, 10.5, F.person({ view: 'front', skin: '#AD7852', hair: '#2B2320', hairStyle: 'curly', top: '#3F5E4A', bottom: '#8A8463', acc: ['backpack', 'cap'], expr: 'content' }), 'exterior');
  if (winter) snowfall(s, -6, 14, 6.5, 22);

  // la salle
  room(s, {
    W, D, H,
    floor: A('village', 'village_tomette'),
    ceiling: A('village', 'village_ceiling'),
    walls: A('village', 'village_lime'),
    frontHoles: [[0.2, 0.9, 0.9, 2.4], [1.1, 0, 2.1, 2.25], [2.5, 0.45, 4.45, 2.4], [4.55, 0.45, 6.5, 2.4]],
    backHoles: [[0.1, 0, 1.0, 2.1], [4.2, 0, 5.1, 2.1]],
    floorLines: { step: 0.22, color: A('village', 'village_tomette_joint'), opacity: 0.3 },
  });
  // portes du fond: réserve (personnel) et pièce du fond (fermée à l'arrivée)
  for (const [x0, x1, c2] of [[0.1, 1.0, '#7E937B'], [4.2, 5.1, '#6B4B35']]) {
    const leaf = s.face([[x0, 0, 0.03], [x1, 0, 0.03], [x1, 2.1, 0.03], [x0, 2.1, 0.03]], c2, { cull: false });
    if (leaf) s.layers.shell.push(leaf);
  }
  // solives et poutre maîtresse (elles portent le plancher du logement au-dessus)
  const beam = A('village', 'village_beam');
  const beams = [];
  for (let z = 0.35; z < D; z += 0.62) beams.push(...s.box(0, H - 0.15, z - 0.06, W, H, z + 0.06, beam));
  s.layers.shell.push({ depth: 0, svg: beams.filter(Boolean).sort((a, b) => b.depth - a.depth).map((f) => f.svg).join('') });
  const main = s.box(3.35, H - 0.37, 0, 3.65, H - 0.15, D, beam);
  s.layers.shell.push({ depth: 0, svg: main.sort((a, b) => b.depth - a.depth).map((f) => f.svg).join('') });
  // vitrines, porte et petite fenêtre
  const gOp = night ? 0.3 : 0.12;
  const gT = night ? '#3A4466' : '#DCE6E4';
  M.windowZ(s, 2.5, 4.45, 0.45, 2.4, D, 0.45, { frame: '#E6DDCB', reveal: A('village', 'village_lime'), cols: 3, rows: 3, glassOpacity: gOp, glassTint: gT });
  M.windowZ(s, 4.55, 6.5, 0.45, 2.4, D, 0.45, { frame: '#E6DDCB', reveal: A('village', 'village_lime'), cols: 3, rows: 3, glassOpacity: gOp, glassTint: gT });
  M.windowZ(s, 0.2, 0.9, 0.9, 2.4, D, 0.45, { frame: '#E6DDCB', reveal: A('village', 'village_lime'), cols: 1, rows: 3, glassOpacity: gOp, glassTint: gT });
  M.doorZ(s, 1.1, 2.1, D, 0.45, { frame: A('village', 'village_counter'), reveal: A('village', 'village_lime'), glassOpacity: night ? 0.3 : 0.14 });
  if (rain) {
    rainOnGlass(s, 2.55, 6.45, 0.5, 2.35, D + 0.2, 7);
    rainOnGlass(s, 1.25, 1.95, 0.95, 2.1, D + 0.22, 11);
  }

  // arrière-comptoir (0,90 m) contre la cloison du fond: plonge, frigo; carreaux sombres, étagères de tasses, ardoise
  const back = A('village', 'village_backbar');
  const tiles = s.face([[0.95, 0.9, 0.003], [3.4, 0.9, 0.003], [3.4, 1.95, 0.003], [0.95, 1.95, 0.003]], back, { cull: false, gradient: true });
  if (tiles) s.layers.shell.push(tiles);
  M.obj(s, [[1, s.box(1.0, 0, 0, 3.4, 0.9, 0.6, { top: C('walnut'), side: A('village', 'village_shelf') })], [2, s.box(1.1, 0.9, 0.1, 1.75, 0.92, 0.5, C('steel'))]]);
  M.obj(s, [[1, s.box(1.0, 1.32, 0, 2.1, 1.35, 0.28, A('village', 'village_shelf'))], [1, s.box(1.0, 1.68, 0, 2.1, 1.71, 0.28, A('village', 'village_shelf'))]]);
  M.cupRow(s, 1.05, 2.05, 1.35, 0.14, 'x', 8);
  M.cupRow(s, 1.05, 2.05, 1.71, 0.14, 'x', 8);
  M.slateBoard(s, [[3.35, 2.2, 0.02], [2.2, 2.2, 0.02], [3.35, 1.45, 0.02]], [
    { t: 'La carte du jour', size: 50, x: 300, anchor: 'middle', y: 64, color: '#E9C98A' },
    { t: 'Café  1,80', size: 40, x: 50, y: 130 },
    { t: 'Cappuccino  3,20', size: 40, x: 50, y: 182 },
    { t: 'Chocolat chaud  3,50', size: 40, x: 50, y: 234 },
    { t: 'Tarte aux pommes  4', size: 40, x: 50, y: 286 },
    { t: 'Croissant du boulanger  1,30', size: 40, x: 50, y: 338 },
  ], { w: 600, h: 380, frame: C('oak_dark') });

  // comptoir à deux niveaux: plan de travail à 0,95 m côté barista, tablette des clients à 1,10 m
  const cz0 = 1.7;
  const cz1 = 2.4;
  M.obj(s, [
    [0, s.box(0, 0, cz0, 3.1, 0.92, cz1, { front: A('village', 'village_counter'), back: A('village', 'village_counter'), right: A('village', 'village_counter'), top: C('walnut') })],
    [1, s.box(0, 0.92, cz0, 3.12, 0.95, cz0 + 0.42, C('walnut'))],
    [1, s.box(0, 0.92, cz0 + 0.42, 3.1, 1.06, cz1, A('village', 'village_counter'))],
    [1, s.box(0, 1.06, cz0 + 0.4, 3.14, 1.1, cz1 + 0.04, C('walnut'))],
  ]);
  M.espressoMachineZ(s, 1.9, 0.95, cz0 + 0.24, { body: C('copper'), facing: '-z' });
  M.grinder(s, 1.27, 0.95, cz0 + 0.2);
  // caisse et livre d'or près de la file, cloche à viennoiseries, passe à droite
  M.obj(s, [[1, s.box(0.15, 0.95, cz0 + 0.06, 0.65, 1.05, cz0 + 0.38, C('walnut'))], [2, s.box(0.2, 1.05, cz0 + 0.1, 0.6, 1.2, cz0 + 0.32, C('brass'))], [2, s.box(0.24, 1.12, cz0 + 0.09, 0.56, 1.19, cz0 + 0.1, '#2F3634', { emissive: true })]]);
  M.obj(s, [[1, s.box(0.75, 1.1, cz1 - 0.3, 1.15, 1.125, cz1 - 0.05, '#6E2E35')], [2, s.box(0.76, 1.125, cz1 - 0.29, 0.945, 1.13, cz1 - 0.06, '#F2E8D2')], [2, s.box(0.955, 1.125, cz1 - 0.29, 1.14, 1.13, cz1 - 0.06, '#F2E8D2')]]);
  M.pastryDome(s, 2.45, 1.1, cz1 - 0.15);
  M.cup(s, 2.85, 0.95, cz0 + 0.18, 'cappuccino', { rim: '#2F4F3E' });
  steam(s, 2.85, 1.04, cz0 + 0.18, 1.4);
  M.cup(s, 2.62, 0.95, cz0 + 0.12, 'espresso', { rim: '#2F4F3E' });
  M.ticketRail(s, 2.75, 1.9, cz0 + 0.1, cz0 + 0.1, []);
  // rail à tickets au-dessus de la passe (le long du comptoir)
  const railY = 1.88;
  M.obj(s, [[1, s.box(2.3, railY - 0.012, cz0 + 0.3, 3.1, railY + 0.012, cz0 + 0.32, C('steel'))]]);
  [[2.42, F.PLAYER.orb.color], [2.62, F.PLAYER.crescent.color], [2.82, null], [3.0, 'alert']].forEach(([x, clip]) => {
    const t = s.face([[x - 0.06, railY - 0.01, cz0 + 0.33], [x + 0.06, railY - 0.01, cz0 + 0.33], [x + 0.06, railY - 0.18, cz0 + 0.33], [x - 0.06, railY - 0.18, cz0 + 0.33]], '#FBF6EA', { cull: false });
    const l1 = s.face([[x - 0.045, railY - 0.07, cz0 + 0.328], [x + 0.03, railY - 0.07, cz0 + 0.328], [x + 0.03, railY - 0.08, cz0 + 0.328], [x - 0.045, railY - 0.08, cz0 + 0.328]], M.INK, { cull: false, emissive: true });
    const l2 = s.face([[x - 0.045, railY - 0.1, cz0 + 0.328], [x + 0.015, railY - 0.1, cz0 + 0.328], [x + 0.015, railY - 0.11, cz0 + 0.328], [x - 0.045, railY - 0.11, cz0 + 0.328]], M.INK, { cull: false, emissive: true });
    const extra = [];
    if (clip === 'alert') {
      extra.push(s.face([[x - 0.06, railY - 0.01, cz0 + 0.329], [x + 0.06, railY - 0.01, cz0 + 0.329], [x + 0.06, railY - 0.05, cz0 + 0.329], [x - 0.06, railY - 0.05, cz0 + 0.329]], '#E0A030', { cull: false, emissive: true }));
      extra.push(s.face([[x - 0.012, railY - 0.015, cz0 + 0.327], [x + 0.012, railY - 0.015, cz0 + 0.327], [x - 0.012, railY - 0.045, cz0 + 0.327], [x + 0.012, railY - 0.045, cz0 + 0.327]], '#5A3A10', { cull: false, emissive: true }));
    } else if (clip) {
      extra.push(s.face([[x - 0.03, railY + 0.025, cz0 + 0.327], [x + 0.03, railY + 0.025, cz0 + 0.327], [x + 0.03, railY - 0.03, cz0 + 0.327], [x - 0.03, railY - 0.03, cz0 + 0.327]], clip, { cull: false, emissive: true, stroke: '#1C1A26', strokeWidth: 1.5 }));
    }
    M.obj(s, [[2, [t, l1, l2, ...extra]]]);
  });
  for (const x of [0.9, 2.5]) M.pendant(s, x, 2.15, H, 2.12, { shade: '#3F5248', halo: 0.2 });

  // la file le long du mur de gauche, vers la caisse: clients qui attendent (liseré de lumière)
  figureAt(s, 0.55, 2.85, { view: 'front', skin: '#E4B897', hair: '#6E4A30', hairStyle: 'long', coat: '#A6927A', coatLength: 62, top: '#A6927A', bottom: '#3E4A66', acc: ['shoulderBag', 'phone'], expr: 'content' }, { rim: 0.8 });
  figureAt(s, 0.6, 3.5, { view: 'front', skin: '#87583A', hair: '#2B2320', hairStyle: 'short', coat: '#4E5258', coatLength: 60, top: '#4E5258', bottom: '#3E4A66', acc: ['takeaway'], expr: 'impatient' }, { rim: 0.8 });
  figureAt(s, 0.55, 4.15, { view: 'front', skin: '#F2D3BC', hair: '#B9B4AE', hairStyle: 'bun', top: '#707A86', bottom: '#4E5258', acc: ['scarf', 'newspaper'], expr: 'attend', pose: 'pockets' }, { rim: 0.8 });

  // salle: tables rondes le long de la vitrine, chaises paillées
  const chairOpts = { kind: 'paille', wood: S('campagne', 'campagne_oak'), seat: S('campagne', 'campagne_straw') };
  for (const [x, items] of [[3.15, [[0.08, -0.06, 'cappuccino']]], [4.75, []], [6.35, [[0, 0, 'tea']]]]) {
    M.chair(s, x, 5.0, '-z', chairOpts);
    M.roundTable(s, x, 4.6, { r: 0.3, items, rim: '#2F4F3E' });
  }
  M.chair(s, 3.15, 4.15, '+z', chairOpts);
  figureAt(s, 3.15, 5.0, { view: 'front', pose: 'sit', skin: '#CC9871', hair: '#A3663A', hairStyle: 'bob', top: '#9E4E63', bottom: '#4D5F7D', expr: 'ravi' }, { depthBias: -0.25 });
  figureAt(s, 4.75, 5.0, { view: 'front', pose: 'sitRead', skin: '#87583A', hair: '#2B2320', hairStyle: 'short', top: '#B39656', bottom: '#4D5F7D', acc: ['menuOpen'], expr: 'lit' }, { depthBias: -0.25 });
  // carte fermée posée, regard vers le comptoir: prêt à commander
  figureAt(s, 6.35, 5.0, { view: 'front', pose: 'sit', skin: '#E4B897', hair: '#4A3324', hairStyle: 'curly', top: '#7A5A44', bottom: '#4E5258', acc: ['scarf'], expr: 'attend' }, { depthBias: -0.25, rim: 0.8 });
  M.obj(s, [[2, s.box(6.2, 0.75, 4.45, 6.36, 0.758, 4.65, '#FBF6EA')]]);
  // petite table carrée contre le mur de droite
  M.chair(s, 6.6, 2.35, '+z', chairOpts);
  M.squareTable(s, 6.6, 2.85, { w: 0.65, d: 0.65, top: C('oak_dark'), leg: S('campagne', 'campagne_oak'), items: [[0, 0, 'espresso']], rim: '#2F4F3E' });
  M.chair(s, 6.6, 3.35, '-z', chairOpts);
  for (const [x, z] of [[3.15, 4.6], [4.75, 4.6], [6.35, 4.6], [6.6, 2.85]]) M.pendant(s, x, z, H, 2.12, { shade: '#A65A3D', r: 0.14, halo: night || rain ? 0.28 : 0.12 });
  // le partenaire, de dos, porte un plateau vers la vitrine: bretelles croisées, écusson, bandeau
  figureAt(s, 3.95, 3.45, avatar(PLAYER_A, 'back', { pose: 'tray', acc: ['tray'], hairStyle: 'short', hair: '#4A3324' }));
  M.plant(s, 5.6, 0, 0.35, { potH: 0.34, potR: 0.17 });

  // taches de soleil (cuites dans les états du jour de la coque) et flaques de lumière des lampes
  const sd = sunDir(momentId, false);
  if (sd) {
    const op = momentId === 'noon' ? 0.28 : momentId === 'winter' ? 0.26 : 0.36;
    for (const [x0, x1] of [[2.55, 3.2], [3.2, 3.85], [3.85, 4.4], [4.6, 5.25], [5.25, 5.9], [5.9, 6.45]]) M.sunPatch(s, x0, x1, 0.5, 2.35, D + 0.2, sd, { x0: 0, x1: W, z0: cz1, z1: D }, momentId === 'afternoon' ? '#FFD39A' : '#FFF0D6', op);
  }
  for (const [x, z] of [[3.15, 4.6], [4.75, 4.6], [6.35, 4.6], [1.6, 2.6], [6.6, 2.85]]) {
    const pool = s.ellipseDecal(x, 0.004, z, 0.8, 0.8, '#FFC27A', (night ? 0.36 : rain ? 0.22 : 0.1) * m.lamps);
    if (pool) s.layers.overlays.push(pool);
  }
  if (opts.markers && view === 'a') {
    marker(s, [2.45, 1.5, cz1 - 0.15], 1);
    marker(s, [2.42, 2.02, cz0 + 0.32], 2);
    marker(s, [0.6, 2.15, 3.5], 3);
    marker(s, [3.95, 2.0, 3.45], 4);
    marker(s, [6.35, 1.5, 5.0], 5);
    marker(s, [8.4, 4.6, 9.8], 6);
  }
  return s.toSVG({ sky: m.sky, clipId: `v-village-${view}-${momentId}` });
}

// rangée d'étal de marché sous la halle (jour de marché du bourg)
function stall(s, x, z, cloth) {
  const parts = [
    ...s.box(x - 0.9, 0.75, z - 0.45, x + 0.9, 0.82, z + 0.45, '#8E6B4A', { exterior: true }),
    ...s.box(x - 0.85, 0, z - 0.4, x - 0.8, 0.75, z - 0.35, '#5A4535', { exterior: true }),
    ...s.box(x + 0.8, 0, z - 0.4, x + 0.85, 0.75, z - 0.35, '#5A4535', { exterior: true }),
    ...s.box(x - 1.0, 2.0, z - 0.6, x + 1.0, 2.06, z + 0.5, cloth, { exterior: true }),
  ];
  const goods = ['#B0574D', '#E5AE38', '#97A866', '#9E3647'].flatMap((c2, i) => s.box(x - 0.8 + i * 0.42, 0.82, z - 0.35, x - 0.45 + i * 0.42, 0.95, z + 0.1, c2, { exterior: true }));
  const all = [...parts, ...goods].filter(Boolean).sort((a, b) => b.depth - a.depth);
  s.layers.exterior.push({ depth: s.cam.view([x, 0.8, z])[2], svg: all.map((f) => f.svg).join('') });
}

// ------------------------------------------------------------------------------------------------
// 2. Bourg: la boutique de la place de la Halle (plan bourg-maximum du level designer, salle de 7,00 x 6,80 m).
// Passage du plan à ce repère: x = 9,0 - x du plan, z = y du plan - 17,6. Le four est au laboratoire, derrière.
// Vue « a »: depuis l'entrée, face au comptoir (vitrine à gâteaux, ardoise, file); vue « b »: derrière le comptoir, face à la halle.
function bourg(momentId = 'morning', opts = {}) {
  const W = 7.0;
  const D = 6.8;
  const H = 3.3;
  const view = opts.view || 'a';
  const cam = view === 'a'
    ? new Camera({ x: 4.6, z: 6.25, yaw: 186, pitch: -9, width: opts.width || 1366, height: opts.height || 768 })
    : new Camera({ x: 3.85, z: 1.0, yaw: -6, pitch: -8, width: opts.width || 1366, height: opts.height || 768 });
  const lamps = [{ pos: [3.2, 2.35, 2.05] }, { pos: [5.4, 2.35, 2.05] }, { pos: [2.7, 2.35, 4.05], power: 0.5 }, { pos: [5.1, 2.35, 4.05], power: 0.5 }, { pos: [2.0, 2.35, 6.4], power: 0.5 }];
  const windows = [{ center: [3.5, 1.5, D], normal: [0, 0, -1], power: 0.8 }, { center: [1.3, 1.5, D], normal: [0, 0, -1], power: 0.8 }];
  const s = new Scene(cam, lighting(momentId, lamps, windows));
  const m = P.moments[momentId];
  const night = momentId === 'evening';
  // dehors: la place de la Halle un jeudi de marché, la halle aux grains en face
  M.ground(s, -14, 24, D + 0.5, 50, A('bourg', 'bourg_cobble'));
  M.ground(s, -14, 24, D + 0.5, D + 2.0, '#B5AC9C');
  const halle = [];
  for (let x = -6; x <= 14; x += 3.2) halle.push(...s.box(x - 0.2, 0, 15.5, x + 0.2, 4.4, 15.9, A('bourg', 'bourg_hall_timber'), { exterior: true }));
  halle.push(...s.box(-6.5, 4.2, 15.3, 14.5, 4.55, 16.2, A('bourg', 'bourg_hall_timber'), { exterior: true }));
  const roof = s.face([[-7.5, 4.45, 14.8], [-7.5, 8.6, 21.5], [15.5, 8.6, 21.5], [15.5, 4.45, 14.8]], A('bourg', 'bourg_hall_roof'), { exterior: true, cull: false, sunlit: true });
  s.layers.exterior.push({ depth: s.cam.view([4, 6, 19])[2] + 50, svg: roof ? roof.svg : '' });
  s.layers.exterior.push({ depth: s.cam.view([4, 2, 15.6])[2], svg: halle.filter(Boolean).sort((a, b) => b.depth - a.depth).map((f) => f.svg).join('') });
  for (const [x, c2] of [[-1.0, A('bourg', 'bourg_awning')], [2.3, '#C9A8A0'], [5.6, A('bourg', 'bourg_awning')]]) stall(s, x, 12.2, c2);
  M.facade(s, -16, -7, 15, 7.5, { wall: A('bourg', 'bourg_render_rose'), roof: A('bourg', 'bourg_hall_roof'), shutters: '#7F979B', floors: 2, perFloor: 2, lit: night, sunlit: !!m.sun });
  M.facade(s, 15, 24, 15, 8.2, { wall: A('bourg', 'bourg_render_ochre'), roof: A('bourg', 'bourg_hall_roof'), shutters: '#8DA287', floors: 2, perFloor: 2, lit: night, sunlit: !!m.sun });
  M.facade(s, -8, 16, 30, 9, { wall: mixHex(A('bourg', 'bourg_render_ochre'), '#D6CBB5', 0.5), roof: '#8F5A44', floors: 3, perFloor: 5, lit: night, sunlit: !!m.sun });
  s.billboard(1.6, 0, 11.4, F.person({ view: 'back', skin: '#E4B897', hair: '#CDAA6E', hairStyle: 'bob', top: '#BE9F55', bottom: '#4D5F7D', acc: ['basket'] }), 'exterior');
  s.billboard(4.6, 0, 11.0, F.person({ view: 'front', skin: '#5C3C29', hair: '#2B2320', hairStyle: 'short', top: '#6E3238', bottom: '#8A8463', acc: ['tote'], expr: 'content' }), 'exterior');
  // réverbère de la place (plan: x 10,4, y 26,6)
  const post = [...s.cylinder(-1.4, 0, 9.0, 0.07, 3.8, 6, '#2B3230', { exterior: true })].filter(Boolean);
  s.layers.exterior.push({ depth: s.cam.view([-1.4, 2, 9])[2], svg: post.map((f) => f.svg).join('') });

  room(s, {
    W, D, H,
    floor: A('bourg', 'bourg_parquet'),
    ceiling: A('bourg', 'bourg_moulding'),
    walls: A('bourg', 'bourg_wall'),
    frontHoles: [[0.3, 0.55, 2.35, 2.75], [2.45, 0.55, 4.5, 2.75], [4.8, 0, 6.0, 2.3]],
    backHoles: [[6.1, 0, 7.0, 2.1]],
    wainscot: { h: 1.1, color: A('bourg', 'bourg_panelling') },
    floorLines: { step: 0.17, color: shadeHex(A('bourg', 'bourg_parquet'), 0.75), opacity: 0.45, alongX: false },
  });
  const cornice = [...s.box(0, H - 0.12, 0, 0.12, H, D, A('bourg', 'bourg_moulding')), ...s.box(W - 0.12, H - 0.12, 0, W, H, D, A('bourg', 'bourg_moulding')), ...s.box(0, H - 0.12, D - 0.12, W, H, D, A('bourg', 'bourg_moulding')), ...s.box(0, H - 0.12, 0, W, H, 0.12, A('bourg', 'bourg_moulding'))];
  s.layers.shell.push({ depth: 0, svg: cornice.filter(Boolean).sort((a, b) => b.depth - a.depth).map((f) => f.svg).join('') });
  M.windowZ(s, 0.3, 2.35, 0.55, 2.75, D, 0.3, { frame: A('bourg', 'bourg_shopfront'), reveal: A('bourg', 'bourg_panelling'), cols: 2, rows: 2 });
  M.windowZ(s, 2.45, 4.5, 0.55, 2.75, D, 0.3, { frame: A('bourg', 'bourg_shopfront'), reveal: A('bourg', 'bourg_panelling'), cols: 2, rows: 2 });
  M.doorZ(s, 4.8, 6.0, D, 0.3, { frame: A('bourg', 'bourg_shopfront'), reveal: A('bourg', 'bourg_panelling') });
  // porte du laboratoire (au fond à droite), entrouverte sur la lueur du four
  const labGlow = s.face([[6.1, 0, 0.02], [7.0, 0, 0.02], [7.0, 2.1, 0.02], [6.1, 2.1, 0.02]], '#E9B27A', { cull: false, emissive: true });
  const labLeaf = s.face([[6.1, 0, 0.03], [6.55, 0, 0.45], [6.55, 2.1, 0.45], [6.1, 2.1, 0.03]], A('bourg', 'bourg_panelling'), { cull: false });
  s.layers.shell.push({ depth: 0, svg: (labGlow ? labGlow.svg : '') + (labLeaf ? labLeaf.svg : '') });

  // arrière-comptoir (0,90 m): plonge, frigo, thés; lambris, étagères de tasses, ardoise au-dessus
  M.obj(s, [[1, s.box(1.35, 0, 0, 6.1, 0.9, 0.6, { top: C('walnut'), side: S('nordique', 'nordique_ash') })]]);
  for (const y of [1.35, 1.72]) M.obj(s, [[1, s.box(1.4, y - 0.03, 0, 3.4, y, 0.3, S('nordique', 'nordique_ash'))]]);
  M.cupRow(s, 1.45, 3.35, 1.35, 0.15, 'x', 10);
  M.cupRow(s, 1.45, 3.35, 1.72, 0.15, 'x', 10);
  const jars = [];
  for (let k = 0; k < 6; k++) jars.push(...s.cylinder(5.3 + k * 0.13, 0.9, 0.3, 0.05, 0.16, 8, '#C9D6D3', { opacity: 0.85 }), ...s.cylinder(5.3 + k * 0.13, 0.9, 0.3, 0.045, 0.1, 8, k % 2 ? '#7D7F45' : '#A65A2C'));
  M.obj(s, [[2, jars]]);
  M.slateBoard(s, [[5.65, 2.55, 0.02], [3.75, 2.55, 0.02], [5.65, 1.45, 0.02]], [
    { t: 'Jour de marché', size: 54, x: 330, anchor: 'middle', y: 68, color: '#E9C98A' },
    { t: 'Fournée de 8 h: croissants, pains aux raisins', size: 36, x: 40, y: 130 },
    { t: 'Chausson aux pommes  2,20', size: 38, x: 40, y: 180 },
    { t: 'Café crème  2,90', size: 38, x: 40, y: 230 },
    { t: 'Thé des moissons  3,20', size: 38, x: 40, y: 280 },
    { t: 'Chocolat chaud  3,40', size: 38, x: 40, y: 330 },
  ], { w: 660, h: 380 });
  // comptoir de frêne (1,10 m côté clients): caisse, vitrine à gâteaux, machine, moulin, passe; portillon à gauche
  const cz0 = 1.7;
  const cz1 = 2.4;
  M.obj(s, [
    [0, s.box(2.25, 0, cz0, 7.0, 0.92, cz1, { side: S('nordique', 'nordique_ash'), top: C('walnut') })],
    [1, s.box(2.25, 0.92, cz0, 7.0, 0.95, cz0 + 0.42, C('walnut'))],
    [1, s.box(2.25, 0.92, cz0 + 0.42, 7.0, 1.06, cz1, S('nordique', 'nordique_ash'))],
    [1, s.box(2.21, 1.06, cz0 + 0.4, 7.0, 1.1, cz1 + 0.04, C('walnut'))],
  ]);
  M.espressoMachineZ(s, 3.85, 0.95, cz0 + 0.24, { body: C('steel'), facing: '-z' });
  M.grinder(s, 3.22, 0.95, cz0 + 0.2);
  M.pastryCase(s, 4.5, 0.95, cz0 + 0.04, 5.95, cz1 - 0.02, { glass: 0.14 });
  M.obj(s, [[1, s.box(6.1, 0.95, cz0 + 0.06, 6.8, 1.05, cz0 + 0.38, C('walnut'))], [2, s.box(6.2, 1.05, cz0 + 0.1, 6.7, 1.2, cz0 + 0.32, '#A3A8AC')], [2, s.box(6.24, 1.12, cz0 + 0.33, 6.66, 1.19, cz0 + 0.34, '#2F3634', { emissive: true })]]);
  M.obj(s, [[1, s.box(5.95, 1.1, cz1 - 0.28, 6.35, 1.125, cz1 - 0.04, '#2F5560')], [2, s.box(5.96, 1.125, cz1 - 0.27, 6.145, 1.13, cz1 - 0.05, '#F2E8D2')], [2, s.box(6.155, 1.125, cz1 - 0.27, 6.34, 1.13, cz1 - 0.05, '#F2E8D2')]]);
  M.cup(s, 2.6, 0.95, cz0 + 0.2, 'cappuccino', { rim: '#2F5560' });
  M.cup(s, 2.8, 0.95, cz0 + 0.14, 'tea', { rim: '#2F5560' });
  steam(s, 2.6, 1.04, cz0 + 0.2, 1.3);
  for (const x of [3.2, 5.4]) M.pendant(s, x, 2.05, H, 2.25, { kind: 'globe', r: 0.2, halo: 0.2 });
  // la partenaire derrière le comptoir, de face: bavette, poche au symbole, bandeau
  figureAt(s, 4.6, 1.05, avatar(PLAYER_B, 'front', { hairStyle: 'bob', hair: '#6E4A30', skin: '#E4B897', expr: 'content' }), { depthBias: 0.3 });

  // la file le long du mur de droite, de la porte à la caisse: un promeneur, une gourmande devant les gâteaux
  figureAt(s, 6.45, 2.9, { view: 'back', skin: '#CC9871', hair: '#4A3324', hairStyle: 'short', top: '#3F5E4A', bottom: '#8A8463', acc: ['backpack', 'cap'] }, { rim: 0.8 });
  figureAt(s, 6.5, 3.55, { view: 'back', skin: '#E4B897', hair: '#B9B4AE', hairStyle: 'bun', top: '#AF7A4D', bottom: '#4E5258', acc: [{ kind: 'shoulderBag', color: '#9E4E63' }] }, { rim: 0.8 });
  // salle nordique: plateaux de linoléum sapin sur piétement de frêne, coussins de laine
  const ash = S('nordique', 'nordique_ash');
  const fir = S('nordique', 'nordique_fir');
  const nchair = { kind: 'bistrot', wood: ash, seat: S('nordique', 'nordique_wool') };
  for (const [x, items, who] of [[5.1, [[0.1, 0.05, 'cappuccino'], [-0.12, -0.08, 'tea']], 'famille'], [3.5, [], 'lecture'], [1.9, [[0, 0, 'espresso']], null], [0.4, [], null]]) {
    M.chair(s, x, 3.55, '+z', nchair);
    M.squareTable(s, x, 4.05, { w: 0.6, d: 0.6, top: fir, leg: ash, items, rim: '#2F5560' });
    M.chair(s, x, 4.6, '-z', nchair);
    if (who === 'famille') {
      figureAt(s, x, 4.6, { view: 'front', pose: 'sit', skin: '#AD7852', hair: '#2B2320', hairStyle: 'curly', top: '#7E9CC0', bottom: '#4D5F7D', expr: 'ravi' }, { depthBias: 0.25 });
      s.billboard(x + 0.55, 0, 4.3, F.child({ view: 'front', skin: '#AD7852', hair: '#2B2320', hairStyle: 'curly', top: '#B0574D', bottom: '#97A866', expr: 'ravi' }), 'objects', 0.1);
    }
    if (who === 'lecture') figureAt(s, x, 4.6, { view: 'front', pose: 'sitRead', skin: '#F2D3BC', hair: '#CDAA6E', hairStyle: 'long', top: '#9E4E63', bottom: '#4E5258', acc: ['menuOpen'], expr: 'lit' }, { depthBias: 0.25 });
  }
  for (const x of [3.55, 1.95]) {
    M.chair(s, x - 0.4, 6.4, '+x', nchair);
    M.roundTable(s, x, 6.4, { r: 0.3, top: fir, leg: ash, items: [], rim: '#2F5560' });
  }
  s.billboard(5.75, 0, 4.9, F.stroller('#3F5E4A'), 'objects', 0);
  for (const [x, z] of [[5.1, 4.05], [3.5, 4.05], [1.9, 4.05], [3.55, 6.4]]) M.pendant(s, x, z, H, 2.25, { kind: 'globe', r: 0.18, halo: 0.14 });
  M.plant(s, 0.35, 0, 6.4, { potH: 0.4, potR: 0.2 });
  const sd = sunDir(momentId, false);
  if (sd) for (const [x0, x1] of [[0.35, 1.3], [1.35, 2.3], [2.5, 3.45], [3.5, 4.45]]) M.sunPatch(s, x0, x1, 0.6, 2.7, D + 0.15, sd, { x0: 0, x1: W, z0: cz1, z1: D }, momentId === 'morning' ? '#FFF0D6' : '#FFD39A', 0.24);
  for (const [x, z] of [[5.1, 4.05], [3.5, 4.05], [1.9, 4.05], [4.3, 2.0]]) {
    const pool = s.ellipseDecal(x, 0.004, z, 0.85, 0.85, '#FFC27A', (night ? 0.36 : 0.12) * m.lamps);
    if (pool) s.layers.overlays.push(pool);
  }
  if (opts.markers && view === 'a') {
    marker(s, [4.7, 2.75, 0.02], 1);
    marker(s, [5.2, 1.45, cz0 + 0.3], 2);
    marker(s, [4.6, 2.0, 1.05], 3);
    marker(s, [6.45, 1.95, 2.9], 4);
    marker(s, [6.55, 2.3, 0.02], 5);
    marker(s, [5.1, 1.55, 4.6], 6);
  }
  return s.toSVG({ sky: m.sky, clipId: `v-bourg-${view}-${momentId}` });
}

// ------------------------------------------------------------------------------------------------
// 3. Ville: l'ancien atelier (grande salle de 11 x 9 m sur 4,6 m de haut, brique, acier, béton, sheds)
function ville(momentId = 'noon', opts = {}) {
  const W = 11;
  const D = 9;
  const H = 4.6;
  const cam = new Camera({ x: 10.4, z: 0.4, yaw: -40, pitch: -6, width: opts.width || 1366, height: opts.height || 768 });
  const lamps = [{ pos: [2.0, 2.4, 3.0] }, { pos: [2.0, 2.4, 5.0] }, { pos: [2.0, 2.4, 7.0] }, { pos: [5.5, 2.4, 6.6], power: 0.6 }, { pos: [5.0, 2.4, 3.4], power: 0.5 }];
  const windows = [{ center: [3.0, 2.4, D], normal: [0, 0, -1], power: 1.0 }, { center: [8.2, 2.4, D], normal: [0, 0, -1], power: 1.0 }, { center: [5.5, H, 4.5], normal: [0, -1, 0], power: 0.6 }];
  const s = new Scene(cam, lighting(momentId, lamps, windows));
  const m = P.moments[momentId];
  const night = momentId === 'evening';
  // dehors: rue de l'université, tilleuls, tramway, façades de brique
  M.ground(s, -14, 26, D + 0.4, 50, A('ville', 'ville_asphalt'));
  M.ground(s, -14, 26, D + 0.4, D + 3.0, A('ville', 'ville_sidewalk'));
  M.ground(s, -14, 26, 18.5, 50, A('ville', 'ville_sidewalk'));
  const rail = s.face([[-14, 0.01, 14.2], [-14, 0.01, 14.4], [26, 0.01, 14.4], [26, 0.01, 14.2]], '#4A4C4F', { exterior: true, cull: false });
  if (rail) s.layers.exterior.push({ depth: 1e4 - 14, svg: rail.svg });
  M.facade(s, -10, -1, 20, 13, { wall: A('ville', 'ville_facade_brick'), roofKind: 'flat', floors: 4, perFloor: 3, lit: night, sunlit: !!m.sun, glassC: '#55616C' });
  M.facade(s, -0.8, 9, 19.5, 15, { wall: A('ville', 'ville_facade_render'), roofKind: 'flat', floors: 5, perFloor: 4, lit: night, sunlit: !!m.sun, glassC: '#55616C' });
  M.facade(s, 9.2, 22, 20, 12, { wall: A('ville', 'ville_facade_brick'), roofKind: 'flat', floors: 4, perFloor: 4, lit: night, sunlit: !!m.sun, glassC: '#55616C' });
  // le tramway (livrée inventée, bleu pétrole et crème) qui passe
  const tram = [...s.box(-2, 0.35, 13.6, 9.5, 3.3, 15.9, { front: A('ville', 'ville_tram'), top: '#E3DCCB', left: A('ville', 'ville_tram'), right: A('ville', 'ville_tram') }, { exterior: true })];
  const tramWin = [];
  for (let x = -1.4; x < 9; x += 1.6) tramWin.push(s.face([[x, 1.5, 13.58], [x, 2.6, 13.58], [x + 1.2, 2.6, 13.58], [x + 1.2, 1.5, 13.58]], night ? '#FFD08A' : '#3C4750', { exterior: true, emissive: night, cull: false }));
  tramWin.push(s.face([[-2, 1.1, 13.57], [-2, 1.25, 13.57], [9.5, 1.25, 13.57], [9.5, 1.1, 13.57]], '#E3DCCB', { exterior: true, cull: false }));
  s.layers.exterior.push({ depth: s.cam.view([4, 1.5, 13.6])[2], svg: [...tram, ...tramWin].filter(Boolean).map((f) => f.svg).join('') });
  M.tree(s, 1.5, 11.6, { h: 6, bark: '#7A6A58', leaves: [A('ville', 'ville_tree'), '#86A066'] });
  M.tree(s, 8.0, 11.6, { h: 6.4, bark: '#7A6A58', leaves: [A('ville', 'ville_tree'), '#86A066'] });
  // vélos garés le long du trottoir (traits)
  const bikes = [];
  for (const x of [3.6, 4.4, 5.2]) {
    const b = s.cam.project(s.cam.view([x, 0.35, 10.3]));
    const k = s.cam.scaleAt([x, 0.35, 10.3]);
    bikes.push(`<g stroke="#2E2E33" stroke-width="${r1(k * 0.035)}" fill="none"><circle cx="${r1(b[0] - k * 0.32)}" cy="${r1(b[1])}" r="${r1(k * 0.33)}"/><circle cx="${r1(b[0] + k * 0.32)}" cy="${r1(b[1])}" r="${r1(k * 0.33)}"/><path d="M${r1(b[0] - k * 0.32)} ${r1(b[1])}L${r1(b[0])} ${r1(b[1] - k * 0.45)}L${r1(b[0] + k * 0.32)} ${r1(b[1])}"/></g>`);
  }
  s.layers.exterior.push({ depth: s.cam.view([4.4, 0.4, 10.3])[2], svg: bikes.join('') });

  room(s, {
    W, D, H,
    floor: A('ville', 'ville_concrete'),
    ceiling: A('ville', 'ville_paint'),
    walls: A('ville', 'ville_paint'),
    leftWall: A('ville', 'ville_brick'),
    frontWall: A('ville', 'ville_brick'),
    frontHoles: [[0.6, 0.9, 5.3, 3.9], [5.7, 0.9, 10.4, 3.9]],
    floorLines: { step: 1.5, color: '#86817A', opacity: 0.5 },
  });
  // joints de brique suggérés sur le mur de gauche
  const brickLines = [];
  for (let y = 0.3; y < H; y += 0.3) {
    const a = s.cam.view([0.005, y, 0.5]);
    const b = s.cam.view([0.005, y, D]);
    if (a[2] > 0.1 && b[2] > 0.1) {
      const pa = s.cam.project(a);
      const pb = s.cam.project(b);
      brickLines.push(`M${r1(pa[0])} ${r1(pa[1])}L${r1(pb[0])} ${r1(pb[1])}`);
    }
  }
  s.layers.shell.push({ depth: 0, svg: `<path d="${brickLines.join('')}" stroke="${A('ville', 'ville_mortar')}" stroke-opacity="0.35" stroke-width="1.2" fill="none"/>` });
  // sheds: verrières en dents de scie (bandes de ciel) et fermes d'acier
  const sky = mixHex(m.sky[1], '#FFFFFF', night ? 0 : 0.35);
  for (let z = 1.2; z < D - 0.5; z += 2.2) {
    const f = s.face([[0, H - 0.01, z], [W, H - 0.01, z], [W, H - 0.01, z + 0.9], [0, H - 0.01, z + 0.9]], night ? '#2A3352' : sky, { emissive: true, cull: false });
    if (f) s.layers.shell.push(f);
  }
  const truss = [];
  for (let z = 1.0; z < D; z += 2.2) truss.push(...s.box(0, H - 0.5, z, W, H - 0.3, z + 0.14, A('ville', 'ville_steel')));
  for (let z = 1.0; z < D; z += 2.2) truss.push(...s.box(0, H - 0.3, z + 0.02, W, H - 0.26, z + 1.1, A('ville', 'ville_steel'), { opacity: 0.0 }));
  s.layers.shell.push({ depth: 0, svg: truss.filter(Boolean).sort((a, b) => b.depth - a.depth).map((f) => f.svg).join('') });
  M.windowZ(s, 0.6, 5.3, 0.9, 3.9, D, 0.35, { frame: A('ville', 'ville_steel'), reveal: A('ville', 'ville_brick'), cols: 6, rows: 4, sill: A('ville', 'ville_concrete') });
  M.windowZ(s, 5.7, 10.4, 0.9, 3.9, D, 0.35, { frame: A('ville', 'ville_steel'), reveal: A('ville', 'ville_brick'), cols: 6, rows: 4, sill: A('ville', 'ville_concrete') });
  // poteaux d'acier qui portent les fermes
  for (const [x, z] of [[5.6, 5.5]]) M.obj(s, [[1, s.box(x - 0.1, 0, z - 0.1, x + 0.1, H - 0.3, z + 0.1, A('ville', 'ville_steel'))]]);

  // étagère tubulaire sur le mur de brique: tasses, bocaux de grains, plantes
  const shelfParts = [];
  for (const y of [1.3, 1.75, 2.2]) shelfParts.push(...s.box(0, y - 0.035, 2.0, 0.34, y, 7.6, A('ville', 'ville_wood')));
  for (const z of [2.05, 4.8, 7.55]) shelfParts.push(...s.box(0.3, 0.9, z - 0.02, 0.34, 2.3, z + 0.02, A('ville', 'ville_steel')));
  M.obj(s, [[1, shelfParts]]);
  M.cupColumn(s, 0.16, 1.3, 2.1, 4.6, 10);
  M.cupColumn(s, 0.16, 1.75, 2.1, 4.6, 10);
  const jars = [];
  for (let k = 0; k < 7; k++) jars.push(...s.cylinder(0.16, 2.2, 5.0 + k * 0.35, 0.08, 0.2, 8, '#C9D6D3', { opacity: 0.8 }), ...s.cylinder(0.16, 2.2, 5.0 + k * 0.35, 0.075, 0.13, 8, k % 2 ? '#3B2318' : '#6B4430'));
  M.obj(s, [[2, jars]]);
  M.slateBoard(s, [[0.02, 3.3, 2.2], [0.02, 3.3, 4.6], [0.02, 2.55, 2.2]], [
    { t: 'Café de spécialité', size: 50, x: 330, anchor: 'middle', y: 66, color: '#E9C98A' },
    { t: 'Filtre du jour: Huila, 3,90', size: 40, x: 50, y: 132 },
    { t: 'Brunch le dimanche', size: 40, x: 50, y: 184 },
    { t: 'Prises au comptoir', size: 40, x: 50, y: 236 },
  ], { w: 660, h: 290 });
  M.obj(s, [[1, s.box(0, 0, 2.0, 0.6, 0.92, 7.6, { top: shadeHex(A('ville', 'ville_wood'), 0.75), side: A('ville', 'ville_wood') })]]);
  M.espressoMachine(s, 0.05, 0.92, 5.6, { body: A('ville', 'ville_steel') });
  M.grinder(s, 0.08, 0.92, 4.9);
  M.grinder(s, 0.08, 0.92, 6.4);
  // établi devenu comptoir: dessus de bois brut (surface de travail), piétement d'acier
  const cx0 = 1.6;
  const cx1 = 2.45;
  M.obj(s, [
    [0, s.box(cx0, 0, 1.6, cx1, 1.0, 7.8, { right: A('ville', 'ville_wood'), front: A('ville', 'ville_wood'), back: A('ville', 'ville_wood'), top: A('ville', 'ville_wood') })],
    [1, s.box(cx0 - 0.04, 1.0, 1.55, cx1 + 0.06, 1.06, 7.85, shadeHex(A('ville', 'ville_wood'), 0.8))],
    [0, s.box(cx1, 0, 1.6, cx1 + 0.01, 1.0, 1.7, A('ville', 'ville_steel'))],
  ]);
  M.pastryCase(s, cx0 + 0.05, 1.06, 6.2, cx1 - 0.03, 7.4);
  M.register(s, cx0 + 0.12, 1.06, 7.55, { top: A('ville', 'ville_steel') });
  M.cup(s, cx0 + 0.5, 1.06, 3.0, 'cappuccino', { rim: '#2E3A57' });
  M.cup(s, cx0 + 0.5, 1.06, 3.35, 'espresso', { rim: '#2E3A57' });
  steam(s, cx0 + 0.5, 1.15, 3.0, 1.3);
  for (const z of [3.0, 5.0, 7.0]) M.pendant(s, 2.0, z, H - 0.3, 2.45, { kind: 'cage', halo: 0.26, haloR: 0.35 });
  // tabourets de comptoir et connaisseur accoudé
  for (const z of [2.6, 3.6, 4.6, 5.6]) M.stool(s, 2.85, z, { seat: A('ville', 'ville_wood') });
  figureAt(s, 2.95, 4.1, { view: 'back', skin: '#87583A', hair: '#2B2320', hairStyle: 'short', top: '#414449', bottom: '#4D5F7D', turtleneck: '#414449', acc: [{ kind: 'tote', color: '#B48F60' }] }, { rim: 0.85 });
  // grande table d'atelier commune (bois brut, piétement d'acier), étudiants et télétravail
  const wood = A('ville', 'ville_wood');
  M.squareTable(s, 5.6, 6.6, { w: 2.6, d: 0.9, top: shadeHex(wood, 0.75), leg: A('ville', 'ville_steel'), items: [[-0.8, 0.1, 'cappuccino'], [0.5, -0.1, 'espresso'], [0.9, 0.15, 'tea']], rim: '#2E3A57' });
  figureAt(s, 4.9, 7.25, { view: 'front', pose: 'sit', skin: '#E4B897', hair: '#A3663A', hairStyle: 'curly', top: '#6E3238', bottom: '#4D5F7D', acc: ['headset'], expr: 'content' }, { depthBias: -0.4 });
  figureAt(s, 6.3, 7.25, { view: 'front', pose: 'sit', skin: '#5C3C29', hair: '#2B2320', hairStyle: 'bun', top: '#A6B6C8', bottom: '#4E5258', acc: ['cardigan'], expr: 'lit' }, { depthBias: -0.4 });
  M.obj(s, [[2, s.box(6.05, 0.75, 6.55, 6.45, 0.77, 6.8, '#6F7379'), s.box(6.05, 0.77, 6.78, 6.45, 1.0, 6.8, '#3A3E44')]]);
  figureAt(s, 5.6, 5.95, { view: 'back', pose: 'sit', skin: '#CC9871', hair: '#4A3324', hairStyle: 'long', top: '#B3A887', bottom: '#4D5F7D', acc: ['headset'] }, { depthBias: 0.2 });
  for (const x of [4.9, 6.3]) M.stool(s, x, 7.2, { seat: wood });
  M.roundTable(s, 5.0, 3.6, { r: 0.4, top: shadeHex(wood, 0.7), items: [[0.1, 0.1, 'tea']], rim: '#2E3A57' });
  M.chair(s, 5.0, 4.15, '-z', { wood: A('ville', 'ville_steel'), seat: A('ville', 'ville_steel') });
  // le partenaire de dos, haut clair: le liseré sombre dessine le X
  figureAt(s, 7.9, 4.6, avatar(PLAYER_B, 'back', { hairStyle: 'bob', hair: '#6E4A30', skin: '#E4B897', pose: 'tray', acc: ['tray'] }));
  M.plant(s, 10.4, 0, 7.6, { potH: 0.5, potR: 0.25, blobs: [[0, 0.4, 0, 0.32], [-0.2, 0.75, 0, 0.25], [0.2, 0.8, 0, 0.24], [0, 1.05, 0, 0.2]] });
  // coin salon au premier plan: canapé de cuir, table basse, tapis
  const rug = s.face([[6.6, 0.003, 1.6], [6.6, 0.003, 3.6], [9.4, 0.003, 3.6], [9.4, 0.003, 1.6]], S('atelier', 'atelier_workblue'), { cull: false, noAo: true });
  if (rug) s.layers.overlays.push(rug);
  const leather = S('atelier', 'atelier_leather');
  M.obj(s, [[1, s.box(6.8, 0, 3.0, 9.2, 0.45, 3.85, { top: leather, front: shadeHex(leather, 0.85), side: leather })], [1, s.box(6.8, 0.45, 3.5, 9.2, 0.9, 3.85, leather)], [1, s.box(6.65, 0, 3.0, 6.85, 0.62, 3.85, leather)], [1, s.box(9.15, 0, 3.0, 9.35, 0.62, 3.85, leather)]]);
  M.squareTable(s, 8.0, 2.2, { w: 1.1, d: 0.6, h: 0.42, top: shadeHex(wood, 0.6), items: [[0.2, 0, 'cappuccino'], [-0.25, 0.05, 'cappuccino']], rim: '#2E3A57' });
  // une personne assise se pose au bord avant de l'assise (ses pieds sont devant le canapé) et se dessine après lui
  figureAt(s, 7.6, 2.95, { view: 'front', pose: 'sit', skin: '#F2D3BC', hair: '#4A3324', hairStyle: 'bob', top: '#9E4E63', bottom: '#4D5F7D', acc: ['notebook'], expr: 'content' }, { depthBias: -0.6 });
  const sd = sunDir(momentId, true);
  if (sd) {
    for (const [x0, x1] of [[0.65, 5.25], [5.75, 10.35]]) M.sunPatch(s, x0, x1, 0.9, 3.9, D + 0.18, sd, { x0: 2.0, x1: W, z0: 0, z1: D }, '#FFF0D6', 0.3);
  }
  for (const [x, z] of [[5.5, 6.6], [5.0, 3.6]]) {
    const pool = s.ellipseDecal(x, 0.004, z, 1.1, 0.9, '#FFC27A', (night ? 0.36 : 0.1) * m.lamps);
    if (pool) s.layers.overlays.push(pool);
  }
  if (opts.markers) {
    marker(s, [5.5, H - 0.1, 4.0], 1);
    marker(s, [0.02, 3.45, 3.4], 2);
    marker(s, [2.95, 2.0, 4.1], 3);
    marker(s, [7.9, 2.0, 4.6], 4);
    marker(s, [4.0, 2.4, 14.5], 5);
    marker(s, [6.3, 1.6, 7.25], 6);
  }
  return s.toSVG({ sky: m.sky, clipId: `v-ville-${momentId}` });
}

// ------------------------------------------------------------------------------------------------
// 4. Paris, quartier: le café d'angle (85 m², mosaïque, zinc, boiseries, banquettes, terrasse sur le trottoir)
function parisQuartier(momentId = 'evening', opts = {}) {
  const W = 9.0;
  const D = 8.4;
  const H = 3.7;
  const cam = new Camera({ x: 6.6, z: 0.45, yaw: -20, pitch: -7, width: opts.width || 1366, height: opts.height || 768 });
  const lamps = [{ pos: [1.85, 2.5, 3.0] }, { pos: [1.85, 2.5, 5.4] }, { pos: [4.2, 2.5, 4.4], power: 0.55 }, { pos: [6.0, 2.5, 6.8], power: 0.55 }, { pos: [8.0, 2.4, 3.6], power: 0.5 }];
  const windows = [{ center: [4.5, 1.8, D], normal: [0, 0, -1], power: 1.0 }, { center: [W, 1.8, 5.0], normal: [-1, 0, 0], power: 0.7 }];
  const s = new Scene(cam, lighting(momentId, lamps, windows));
  const m = P.moments[momentId];
  const night = momentId === 'evening';
  // dehors: trottoir et terrasse, chaussée, immeubles de pierre aux balcons filants, toits de zinc, kiosque, platanes
  M.ground(s, -12, 30, D + 0.35, 60, A('paris-quartier', 'pq_asphalt'));
  M.ground(s, -12, W + 0.35, D + 0.35, D + 4.2, A('paris-quartier', 'pq_sidewalk'));
  M.ground(s, -12, 30, 19.2, 60, A('paris-quartier', 'pq_sidewalk'));
  const side = s.face([[W + 0.35, 0.002, -5], [W + 0.35, 0.002, D + 4.2], [W + 4.2, 0.002, D + 4.2], [W + 4.2, 0.002, -5]], A('paris-quartier', 'pq_sidewalk'), { exterior: true, cull: false });
  if (side) s.layers.exterior.push({ depth: 9e3, svg: side.svg });
  for (const [x0, x1, h, sd] of [[-12, -1, 19, 1], [-0.8, 9.5, 20, 2], [9.7, 22, 19.5, 3]]) {
    M.facade(s, x0, x1, 21, h, { wall: A('paris-quartier', 'pq_stone'), roof: A('paris-quartier', 'pq_roof'), roofH: 3.2, floors: 6, perFloor: 3, ground: 3.6, lit: night, seed: sd, balcony: A('paris-quartier', 'pq_ironwork'), winW: 0.5, sunlit: !!m.sun, glassC: '#56606A', shop: '#3E5B4A', shopLit: night });
  }
  // immeuble de l'autre rue, à droite (l'angle)
  M.facade(s, W + 6, W + 7, -6, 19, { wall: A('paris-quartier', 'pq_stone_shade'), roof: A('paris-quartier', 'pq_roof'), floors: 6, perFloor: 1, ground: 3.6, lit: night, sunlit: false });
  const kiosk = [...s.cylinder(13.5, 0, 17.5, 1.0, 2.6, 8, A('paris-quartier', 'pq_kiosk'), { exterior: true }), ...s.cylinder(13.5, 2.6, 17.5, 1.25, 0.5, 8, A('paris-quartier', 'pq_kiosk'), { exterior: true, r1: 0.2 })].filter(Boolean);
  s.layers.exterior.push({ depth: s.cam.view([13.5, 1, 17.5])[2], svg: kiosk.sort((a, b) => b.depth - a.depth).map((f) => f.svg).join('') });
  M.tree(s, -1.5, 17.5, { h: 7.5, bark: '#9E9580', leaves: [A('paris-quartier', 'pq_plane'), '#8AA35E'] });
  M.tree(s, 8.5, 17.8, { h: 7.8, bark: '#9E9580', leaves: [A('paris-quartier', 'pq_plane'), '#8AA35E'] });
  // réverbères allumés le soir
  if (night) {
    for (const x of [2.0, 11.5]) {
      const lp = [...s.cylinder(x, 0, 18.6, 0.07, 3.8, 6, '#2B3230', { exterior: true })].filter(Boolean);
      const c = s.cam.view([x, 3.9, 18.6]);
      const sc = s.cam.project(c);
      const rad = (s.cam.focal * 0.5) / c[2];
      s.layers.exterior.push({ depth: c[2] - 0.2, svg: lp.map((f) => f.svg).join('') + `<circle cx="${r1(sc[0])}" cy="${r1(sc[1])}" r="${r1(rad * 0.35)}" fill="#FFD08A"/>` });
      const pool = s.ellipseDecal(x, 0.01, 18.6, 2.2, 1.6, '#FFC27A', 0.35);
      if (pool) s.layers.exterior.push({ depth: c[2] + 0.5, svg: pool.svg });
    }
  }
  // terrasse: chaises tournées vers la rue, petites tables, clients
  for (const x of [1.2, 3.0, 6.0, 7.8]) {
    const parts = [...s.cylinder(x, 0, D + 1.4, 0.3, 0.73, 12, A('paris-quartier', 'pq_ironwork'), { exterior: true, r1: 0.04 }), ...s.cylinder(x, 0.73, D + 1.4, 0.32, 0.03, 14, '#4F5A55', { exterior: true })].filter(Boolean);
    s.layers.exterior.push({ depth: s.cam.view([x, 0.7, D + 1.4])[2], svg: parts.sort((a, b) => b.depth - a.depth).map((f) => f.svg).join('') });
  }
  const tourist = F.person({ view: 'back', pose: 'sit', skin: '#F2D3BC', hair: '#CDAA6E', hairStyle: 'long', top: '#3F5E4A', bottom: '#8A8463', acc: ['backpack'] });
  s.billboard(3.0, 0, D + 1.9, tourist, 'exterior');
  const flaneur = F.person({ view: 'back', pose: 'sit', skin: '#87583A', hair: '#B9B4AE', hairStyle: 'short', top: '#7A5A44', bottom: '#4E5258', acc: ['scarf'] });
  s.billboard(6.0, 0, D + 1.9, flaneur, 'exterior');
  // store de la terrasse (couleur de la maison), vu par en dessous au-dessus des vitrines
  const awn = s.face([[-0.3, 3.15, D + 0.35], [-0.3, 2.75, D + 2.6], [W + 0.3, 2.75, D + 2.6], [W + 0.3, 3.15, D + 0.35]], '#6E2E35', { exterior: true, cull: false });
  if (awn) s.layers.exterior.push({ depth: 1, svg: awn.svg });

  room(s, {
    W, D, H,
    floor: A('paris-quartier', 'pq_mosaic'),
    ceiling: A('paris-quartier', 'pq_ceiling'),
    walls: '#D6C7A8',
    frontHoles: [[0.6, 0.6, 2.9, 3.0], [3.3, 0, 4.5, 2.6], [4.9, 0.6, 8.6, 3.0]],
    rightHoles: [[1.4, 0.6, 3.9, 3.0], [4.3, 0.6, 7.9, 3.0]],
    wainscot: { h: 1.15, color: A('paris-quartier', 'pq_woodwork') },
    floorLines: { step: 0.3, color: '#B7A68A', opacity: 0.35 },
  });
  // frise de mosaïque le long des murs
  for (const pts of [[[0.3, 0.003, 0.3], [0.3, 0.003, D - 0.3], [0.45, 0.003, D - 0.3], [0.45, 0.003, 0.3]], [[0.3, 0.003, D - 0.45], [0.3, 0.003, D - 0.3], [W - 0.3, 0.003, D - 0.3], [W - 0.3, 0.003, D - 0.45]], [[W - 0.45, 0.003, 0.3], [W - 0.45, 0.003, D - 0.3], [W - 0.3, 0.003, D - 0.3], [W - 0.3, 0.003, 0.3]]]) {
    const f = s.face(pts, A('paris-quartier', 'pq_mosaic_motif'), { cull: false, noAo: true });
    if (f) s.layers.overlays.push(f);
  }
  M.windowZ(s, 0.6, 2.9, 0.6, 3.0, D, 0.3, { frame: '#2B3230', reveal: A('paris-quartier', 'pq_woodwork'), cols: 1, rows: 2, glassOpacity: night ? 0.25 : 0.12, glassTint: night ? '#3A4466' : '#DCE6E4' });
  M.windowZ(s, 4.9, 8.6, 0.6, 3.0, D, 0.3, { frame: '#2B3230', reveal: A('paris-quartier', 'pq_woodwork'), cols: 2, rows: 2, glassOpacity: night ? 0.25 : 0.12, glassTint: night ? '#3A4466' : '#DCE6E4' });
  M.doorZ(s, 3.3, 4.5, D, 0.3, { frame: '#2B3230', reveal: A('paris-quartier', 'pq_woodwork') });
  // vitrines de l'angle (mur de droite): verre peint et montants
  for (const [z0, z1] of [[1.4, 3.9], [4.3, 7.9]]) {
    const g = s.face([[W - 0.12, 0.6, z0], [W - 0.12, 3.0, z0], [W - 0.12, 3.0, z1], [W - 0.12, 0.6, z1]], night ? '#3A4466' : '#DCE6E4', { cull: false, emissive: true, opacity: night ? 0.25 : 0.12 });
    const fr = [...s.box(W - 0.16, 0.55, z0, W - 0.08, 0.62, z1, '#2B3230'), ...s.box(W - 0.16, 2.98, z0, W - 0.08, 3.05, z1, '#2B3230'), ...s.box(W - 0.16, 0.6, (z0 + z1) / 2 - 0.03, W - 0.08, 3.0, (z0 + z1) / 2 + 0.03, '#2B3230')];
    M.obj(s, [[0, [g]], [1, fr]]);
  }
  // banquettes de moleskine sous les vitrines de l'angle (couleur de la maison)
  M.obj(s, [[1, s.box(W - 0.65, 0, 1.3, W - 0.15, 0.45, 8.0, { top: A('paris-quartier', 'pq_banquette'), left: shadeHex(A('paris-quartier', 'pq_banquette'), 0.85), front: A('paris-quartier', 'pq_banquette') })], [1, s.box(W - 0.25, 0.45, 1.3, W - 0.15, 0.95, 8.0, A('paris-quartier', 'pq_banquette'))]]);
  // comptoir de zinc, façade de boiseries, rampe de laiton; arrière-bar et miroir peint
  const cx0 = 1.5;
  const cx1 = 2.2;
  const mirror = s.face([[0.003, 1.55, 1.6], [0.003, 2.85, 1.6], [0.003, 2.85, 6.2], [0.003, 1.55, 6.2]].reverse(), A('paris-quartier', 'pq_mirror'), { cull: false, gradient: true });
  if (mirror) s.layers.shell.push(mirror);
  M.obj(s, [[1, s.box(0, 0, 1.0, 0.55, 0.95, 6.8, { top: C('walnut'), right: A('paris-quartier', 'pq_woodwork') })]]);
  for (const y of [1.3]) M.obj(s, [[1, s.box(0, y - 0.03, 1.6, 0.3, y, 6.2, A('paris-quartier', 'pq_woodwork'))]]);
  M.cupColumn(s, 0.15, 1.3, 3.8, 6.1, 9);
  M.obj(s, [
    [0, s.box(cx0, 0, 1.2, cx1, 1.02, 6.6, { right: A('paris-quartier', 'pq_woodwork'), front: A('paris-quartier', 'pq_woodwork'), back: A('paris-quartier', 'pq_woodwork'), top: C('zinc') })],
    [1, s.box(cx0 - 0.03, 1.02, 1.17, cx1 + 0.07, 1.07, 6.65, C('zinc'))],
    [1, s.box(cx1 + 0.12, 0.15, 1.2, cx1 + 0.16, 0.19, 6.6, C('brass'))],
  ]);
  M.espressoMachine(s, 0.05, 0.95, 2.5, { body: C('brass') });
  M.slateBoard(s, [[0.02, 3.4, 3.9], [0.02, 3.4, 6.5], [0.02, 2.95, 3.9]], [
    { t: 'Le café de l\'angle', size: 48, x: 330, anchor: 'middle', y: 60, color: '#E9C98A' },
    { t: 'Croque du soir, soupe, tarte fine', size: 38, x: 40, y: 120 },
    { t: 'Chocolat à l\'ancienne  4,50', size: 38, x: 40, y: 168 },
  ], { w: 660, h: 200 });
  M.cup(s, cx0 + 0.4, 1.07, 3.3, 'espresso', { rim: '#6E2E35' });
  M.cup(s, cx0 + 0.4, 1.07, 3.6, 'espresso', { rim: '#6E2E35' });
  M.cup(s, cx0 + 0.42, 1.07, 4.3, 'cappuccino', { rim: '#6E2E35' });
  steam(s, cx0 + 0.42, 1.16, 4.3, 1.3);
  M.register(s, cx0 + 0.12, 1.07, 6.2, { top: C('brass') });
  M.guestbook(s, cx0 + 0.15, 1.07, 5.6);
  M.ticketRail(s, cx0 + 0.32, 2.05, 2.4, 4.0, [{ clip: F.PLAYER.orb.color }, {}, { clip: F.PLAYER.crescent.color }]);
  for (const z of [3.0, 5.4]) M.pendant(s, 1.85, z, H, 2.35, { kind: 'globe', r: 0.18, halo: night ? 0.3 : 0.15 });
  // pressés au comptoir, debout, gobelet et sacoche
  figureAt(s, 2.7, 3.4, { view: 'back', skin: '#E4B897', hair: '#2B2320', hairStyle: 'short', coat: '#3E4A66', coatLength: 60, top: '#3E4A66', bottom: '#4E5258', acc: ['shoulderBag'] }, { rim: 0.85 });
  figureAt(s, 2.75, 4.7, { view: 'back', skin: '#AD7852', hair: '#4A3324', hairStyle: 'bun', coat: '#A6927A', coatLength: 58, top: '#A6927A', bottom: '#3E4A66', acc: [] });
  // guéridons de marbre vert-gris, chaises de bistrot, clients
  const bchair = { kind: 'bistrot', wood: '#4F3426', seat: '#C9A26C' };
  M.chair(s, 4.4, 6.9, '-z', bchair);
  figureAt(s, 4.4, 6.95, { view: 'front', pose: 'sit', skin: '#CC9871', hair: '#6E4A30', hairStyle: 'long', top: '#CF9A80', bottom: '#4D5F7D', acc: ['sunglasses'], expr: 'ravi' }, { depthBias: -0.25 });
  M.roundTable(s, 4.4, 6.45, { r: 0.32, top: C('marble_dark'), leg: '#2B3230', items: [[0.08, -0.05, 'cappuccino'], [-0.1, 0.06, 'tea']], rim: '#6E2E35' });
  M.chair(s, 4.4, 6.0, '+z', bchair);
  figureAt(s, 8.3, 3.4, { view: 'front', pose: 'sitRead', skin: '#F2D3BC', hair: '#B9B4AE', hairStyle: 'short', top: '#7A5A44', bottom: '#4E5258', acc: ['menuOpen', 'scarf'], expr: 'lit' }, { depthBias: -0.15 });
  M.roundTable(s, 7.4, 3.4, { r: 0.3, top: C('marble_dark'), leg: '#2B3230', items: [], rim: '#6E2E35' });
  M.roundTable(s, 7.4, 5.6, { r: 0.3, top: C('marble_dark'), leg: '#2B3230', items: [[0, 0, 'espresso']], rim: '#6E2E35' });
  M.chair(s, 6.85, 5.6, '+x', bchair);
  // le partenaire de dos sort vers la terrasse avec un plateau
  figureAt(s, 5.6, 4.6, avatar(PLAYER_A, 'back', { pose: 'tray', acc: ['tray'], hairStyle: 'curly', hair: '#2B2320', skin: '#87583A' }));
  for (const [x, z] of [[4.4, 6.45], [7.4, 3.4], [7.4, 5.6]]) M.pendant(s, x, z, H, 2.35, { kind: 'globe', r: 0.17, halo: night ? 0.3 : 0.14 });
  for (const [x, z] of [[4.4, 6.45], [7.4, 3.4], [7.4, 5.6], [2.0, 4.2]]) {
    const pool = s.ellipseDecal(x, 0.004, z, 1.0, 1.0, '#FFC27A', (night ? 0.34 : 0.1) * m.lamps);
    if (pool) s.layers.overlays.push(pool);
  }
  if (opts.markers) {
    marker(s, [0.02, 3.52, 5.2], 1);
    marker(s, [1.85, 1.3, 5.9], 2);
    marker(s, [2.7, 1.95, 3.4], 3);
    marker(s, [5.6, 2.05, 4.6], 4);
    marker(s, [4.0, 2.7, D + 2.4], 5);
    marker(s, [W - 0.2, 1.1, 2.4], 6);
  }
  return s.toSVG({ sky: m.sky, clipId: `v-pq-${momentId}` });
}

// ------------------------------------------------------------------------------------------------
// 5. Paris, la maison: sous la verrière (grande halle de 14 x 14 m sur 7 m, mezzanine, torréfacteur, laboratoire vitré)
function parisMaison(momentId = 'winter', opts = {}) {
  const W = 14;
  const D = 14;
  const H = 7.0;
  const MZ = 3.4;
  const cam = new Camera({ x: 12.6, z: 1.2, yaw: -38, pitch: 1, width: opts.width || 1366, height: opts.height || 768 });
  const lamps = [{ pos: [6.5, 3.2, 6.0], power: 0.6, radius: 2.2 }, { pos: [9.5, 3.2, 9.5], power: 0.6, radius: 2.2 }, { pos: [4.95, 2.6, 2.5], power: 0.6 }, { pos: [4.95, 2.6, 5.5], power: 0.6 }];
  const windows = [{ center: [7, 2.5, D], normal: [0, 0, -1], power: 0.9 }, { center: [8, H, 7], normal: [0, -1, 0], power: 0.9 }];
  const s = new Scene(cam, lighting(momentId, lamps, windows));
  const m = P.moments[momentId];
  const winter = momentId === 'winter';
  const night = momentId === 'evening';
  // dehors: la cour pavée, ses deux arbres, les immeubles qui l'entourent
  M.ground(s, -14, 30, D + 0.3, 40, winter ? '#E8ECEF' : A('paris-maison', 'pm_gallery_floor'));
  M.facade(s, -10, 24, 26, 18, { wall: A('paris-maison', 'pm_gallery_stone'), roof: winter ? '#EEF1F3' : A('paris-quartier', 'pq_roof'), roofH: 3, floors: 5, perFloor: 8, ground: 3.6, lit: winter || night, seed: 2, balcony: A('paris-quartier', 'pq_ironwork'), sunlit: !!m.sun, glassC: '#56606A', shop: A('paris-maison', 'pm_gallery_wood'), shopLit: winter || night });
  M.tree(s, 3, 20, { h: 7, bark: '#9E9580', bare: winter, leaves: ['#708D50', '#8AA35E'] });
  M.tree(s, 11, 20.5, { h: 7.5, bark: '#9E9580', bare: winter, leaves: ['#708D50', '#8AA35E'] });
  if (winter) snowfall(s, -4, 20, D + 1, 25, 9);

  room(s, {
    W, D, H,
    floor: A('paris-maison', 'pm_parquet'),
    ceiling: m.sky[1],
    walls: A('paris-maison', 'pm_wall'),
    frontHoles: [[1.0, 0.4, 13.0, 5.8]],
    floorLines: { step: 0.45, color: shadeHex(A('paris-maison', 'pm_parquet'), 0.72), opacity: 0.4 },
  });
  // la verrière: ciel à travers les vitres, résille de fer peint, neige au bas des carreaux en hiver
  const roofLines = [];
  const seg = (a, b) => {
    const pa = s.cam.view(a);
    const pb = s.cam.view(b);
    if (pa[2] > 0.2 && pb[2] > 0.2) {
      const A1 = s.cam.project(pa);
      const B1 = s.cam.project(pb);
      roofLines.push(`M${r1(A1[0])} ${r1(A1[1])}L${r1(B1[0])} ${r1(B1[1])}`);
    }
  };
  for (let x = 0; x <= W; x += 1.4) seg([x, H - 0.01, 0.2], [x, H - 0.01, D]);
  for (let z = 0; z <= D; z += 1.1) seg([0, H - 0.01, z], [W, H - 0.01, z]);
  s.layers.shell.push({ depth: 0, svg: `<path d="${roofLines.join('')}" stroke="${A('paris-maison', 'pm_iron')}" stroke-width="3" fill="none"/>` });
  if (winter) {
    const snow = [];
    for (let x = 0; x < W; x += 1.4) {
      for (let z = 1.1; z <= D; z += 1.1) {
        const f = s.face([[x + 0.05, H - 0.015, z - 0.2], [x + 1.35, H - 0.015, z - 0.2], [x + 1.35, H - 0.015, z - 0.02], [x + 0.05, H - 0.015, z - 0.02]], '#F4F6F7', { emissive: true, cull: false, opacity: 0.85 });
        if (f) snow.push(f.svg);
      }
    }
    s.layers.shell.push({ depth: 0, svg: snow.join('') });
  }
  // grandes fermes de fer qui portent la verrière
  const iron = A('paris-maison', 'pm_iron');
  const truss = [];
  for (let z = 2.8; z < D; z += 2.8) truss.push(...s.box(0, H - 0.45, z - 0.08, W, H - 0.3, z + 0.08, iron));
  for (const [x, z] of [[3.6, 2.8], [3.6, 5.6], [3.6, 8.4], [3.6, 11.2]]) truss.push(...s.box(x - 0.11, 0, z - 0.11, x + 0.11, H - 0.3, z + 0.11, iron));
  // la façade vitrée sur la cour
  M.windowZ(s, 1.0, 13.0, 0.4, 5.8, D, 0.3, { frame: iron, reveal: A('paris-maison', 'pm_wall'), cols: 8, rows: 4, glassOpacity: 0.14 });
  // mezzanine le long du mur de gauche, garde-corps de fer et escalier droit (marches de 17 cm sur 28 cm)
  const mezz = [...s.box(0, MZ, 0, 3.6, MZ + 0.28, D - 0.4, { bottom: shadeHex(A('paris-maison', 'pm_wall'), 0.85), right: A('paris-maison', 'pm_stair'), top: A('paris-maison', 'pm_parquet') })];
  M.obj(s, [[1, mezz]]);
  const rail = [];
  for (let z = 0.3; z < D - 0.4; z += 0.5) if (z < 6.95 || z > 7.65) rail.push(...s.box(3.5, MZ + 0.28, z - 0.012, 3.53, MZ + 1.3, z + 0.012, iron));
  rail.push(...s.box(3.47, MZ + 1.3, 0, 3.58, MZ + 1.36, 6.95, A('paris-maison', 'pm_stair')), ...s.box(3.47, MZ + 1.3, 7.65, 3.58, MZ + 1.36, D - 0.4, A('paris-maison', 'pm_stair')));
  M.obj(s, [[2, rail]]);
  s.layers.objects.push({ depth: 1e3, svg: truss.filter(Boolean).sort((a, b) => b.depth - a.depth).map((f) => f.svg).join('') });
  const steps = [];
  const nSteps = Math.round(MZ / 0.17);
  for (let i = 0; i < nSteps; i++) {
    const y1 = (i + 1) * (MZ / nSteps);
    const z1 = 13.2 - i * 0.28;
    steps.push(...s.box(3.75, 0, z1 - 0.28, 4.85, y1, z1, { top: A('paris-maison', 'pm_stair'), front: shadeHex(A('paris-maison', 'pm_stair'), 0.8), back: shadeHex(A('paris-maison', 'pm_stair'), 0.8), right: shadeHex(A('paris-maison', 'pm_stair'), 0.9) }));
  }
  M.obj(s, [[1, steps]]);
  // palier en haut de l'escalier, relié à la mezzanine (le garde-corps s'ouvre là)
  M.obj(s, [[1, s.box(3.6, MZ, 7.0, 4.85, MZ + 0.28, 7.62, { top: A('paris-maison', 'pm_parquet'), side: A('paris-maison', 'pm_stair') })]]);
  // clients sur la mezzanine (on les voit au-dessus du garde-corps)
  figureAt(s, 2.6, 6.0, { view: 'front', skin: '#E4B897', hair: '#CDAA6E', hairStyle: 'long', top: '#8E9F7B', bottom: '#4D5F7D', acc: ['sunglasses'], expr: 'content' }, { lightK: 1 });
  // le torréfacteur: émail vert sombre, façade de cuivre, trémie, bac de refroidissement, conduit jusqu'au toit
  const rx = 9.6;
  const rz = 10.4;
  M.obj(s, [
    [0, s.box(rx - 0.6, 0, rz - 0.55, rx + 0.6, 0.18, rz + 0.55, '#2B2622')],
    [1, s.box(rx - 0.55, 0.18, rz - 0.5, rx + 0.55, 1.45, rz + 0.5, A('paris-maison', 'pm_roaster'))],
    [2, s.box(rx - 0.45, 0.55, rz - 0.52, rx + 0.45, 1.3, rz - 0.5, C('copper'))],
    [2, s.cylinder(rx, 1.45, rz, 0.16, 0.5, 10, C('steel'), { r1: 0.34 })],
    [2, s.cylinder(rx + 0.25, 1.45, rz + 0.3, 0.09, H - 1.6, 8, C('steel_dark'))],
    [3, s.cylinder(rx - 0.2, 0, rz - 1.1, 0.12, 0.62, 8, A('paris-maison', 'pm_roaster'))],
    [3, s.cylinder(rx - 0.2, 0.62, rz - 1.1, 0.62, 0.16, 16, C('steel'), { topColor: '#5A3A28' })],
  ]);
  figureAt(s, 8.4, 9.4, avatar(PLAYER_B, 'front', { hairStyle: 'bob', hair: '#6E4A30', skin: '#E4B897', expr: 'content' }), { depthBias: 0.1 });
  figureAt(s, 10.6, 8.9, { view: 'back', skin: '#87583A', hair: '#2B2320', hairStyle: 'short', top: '#6E6A45', bottom: '#4E5258', acc: ['notebook', { kind: 'tote', color: '#B48F60' }] }, { rim: 0.85 });
  // comptoir sous la mezzanine
  const cx0 = 4.6;
  M.obj(s, [
    [0, s.box(cx0, 0, 1.0, cx0 + 0.7, 1.0, 6.8, { right: '#2F3E3A', front: '#2F3E3A', back: '#2F3E3A', top: C('marble_dark') })],
    [1, s.box(cx0 - 0.03, 1.0, 0.97, cx0 + 0.75, 1.05, 6.85, C('marble_dark'))],
  ]);
  M.pastryCase(s, cx0 + 0.05, 1.05, 4.6, cx0 + 0.68, 6.0);
  M.register(s, cx0 + 0.1, 1.05, 6.4, { top: C('brass') });
  M.cup(s, cx0 + 0.4, 1.05, 3.4, 'cappuccino', { rim: '#2F4F3E' });
  steam(s, cx0 + 0.4, 1.14, 3.4, 1.3);
  // jardin: fauteuils de rotin, tables de fer peint, grandes plantes en pots
  const rattan = S('jardin', 'jardin_rattan');
  for (const [x, z, it] of [[7.0, 6.4, [[0.1, 0.05, 'cappuccino'], [-0.12, -0.05, 'tea']]], [9.5, 5.2, [[0, 0, 'espresso']]], [6.6, 10.6, []]]) {
    M.chair(s, x - 0.5, z, '+x', { wood: rattan, seat: S('jardin', 'jardin_water') });
    M.roundTable(s, x, z, { r: 0.36, top: S('jardin', 'jardin_iron'), leg: S('jardin', 'jardin_iron'), items: it, rim: '#2F4F3E' });
    M.chair(s, x + 0.5, z, '-x', { wood: rattan, seat: S('jardin', 'jardin_water') });
  }
  figureAt(s, 7.5, 6.45, { view: 'front', pose: 'sit', skin: '#5C3C29', hair: '#2B2320', hairStyle: 'curly', top: '#CF9A80', bottom: '#5B6E86', acc: ['sunglasses'], expr: 'ravi' }, { depthBias: -0.2 });
  figureAt(s, 6.5, 6.35, { view: 'back', pose: 'sit', skin: '#F2D3BC', hair: '#A3663A', hairStyle: 'bun', top: '#8E9F7B', bottom: '#4D5F7D' }, { depthBias: 0.2 });
  for (const [x, z, hgt] of [[12.5, 12.8, 1.4], [8.2, 12.6, 1.2], [12.7, 6.5, 1.0], [5.6, 12.5, 0.9]]) M.plant(s, x, 0, z, { potH: 0.5, potR: 0.3, blobs: [[0, hgt * 0.4, 0, 0.45], [-0.3, hgt * 0.7, 0, 0.35], [0.3, hgt * 0.75, 0, 0.35], [0, hgt, 0, 0.3]] });
  for (const [x, z] of [[6.5, 6.0], [9.5, 9.5]]) M.pendant(s, x, z, H - 0.4, 3.2, { kind: 'globe', r: 0.32, halo: 0.22, haloR: 0.8 });
  for (const [x, z] of [[7.0, 6.4], [9.5, 5.2], [6.6, 10.6]]) {
    const pool = s.ellipseDecal(x, 0.004, z, 1.2, 1.2, '#FFC27A', (night ? 0.34 : 0.12) * m.lamps);
    if (pool) s.layers.overlays.push(pool);
  }
  const sd = sunDir(momentId, true);
  if (sd) M.sunPatch(s, 1.0, 13.0, 0.4, 5.8, D + 0.15, sd, { x0: 3.7, x1: W, z0: 0, z1: D }, '#FFF0D6', 0.22);
  if (opts.markers) {
    marker(s, [7, H - 0.2, 5], 1);
    marker(s, [3.55, MZ + 1.5, 6.5], 2);
    marker(s, [rx, 1.9, rz], 3);
    marker(s, [8.4, 1.95, 9.4], 4);
    marker(s, [7, 4.5, D + 4], 5);
    marker(s, [4.95, 1.45, 5.4], 6);
  }
  return s.toSVG({ sky: m.sky, clipId: `v-pm-${momentId}` });
}

module.exports = { village, bourg, ville, parisQuartier, parisMaison, lighting, sunDir, room, figureAt, steam, marker, rainOnGlass, snowfall, avatar, PLAYER_A, PLAYER_B, A, S };
