'use strict';
// Meubles, postes, objets et éléments de rue des planches de Cosy Café, construits avec scene3d.cjs.
// Chaque fonction ajoute un objet trié à la scène. Dimensions en mètres, à l'échelle de la bible (section 4):
// table à 0,75 m, assise à 0,45 m, comptoir de service à 1,05 m, plan de travail à 0,90 m, vaisselle à 120 %.
const { mixHex, shadeHex, r1 } = require('./scene3d.cjs');
const P = require('./palette.cjs');

const col = (list, id) => {
  const e = list.find((x) => x.id === id);
  if (!e) throw new Error(`couleur inconnue: ${id}`);
  return e.hex;
};
const C = (id) => col(P.common, id);
const PORCELAIN = '#F5F0E6';
const INK = '#2B2622';

// parties d'un objet: ordre de dessin (0 dessous, 1 corps, 2 dessus) puis profondeur
function obj(s, parts) {
  const flat = [];
  parts.forEach(([order, faces]) => {
    const list = (faces || []).filter(Boolean);
    if (!list.length) return;
    list.sort((a, b) => b.depth - a.depth);
    flat.push({ order, depth: list.reduce((m, f) => m + f.depth, 0) / list.length, faces: list });
  });
  if (!flat.length) return;
  flat.sort((a, b) => a.order - b.order || b.depth - a.depth);
  const faces = flat.flatMap((p) => p.faces);
  const depth = Math.max(...faces.map((f) => f.depth));
  const mean = faces.reduce((m, f) => m + f.depth, 0) / faces.length;
  s.layers.objects.push({ depth: (depth + mean) / 2, svg: faces.map((f) => f.svg).join('') });
}

// tasse (tronc de cône) sur soucoupe; contenu: 'espresso' | 'cappuccino' | 'tea' | 'empty'
function cupParts(s, x, y, z, kind = 'cappuccino', opts = {}) {
  const big = kind === 'cappuccino' || kind === 'tea';
  const rb = big ? 0.038 : 0.026;
  const rt = big ? 0.054 : 0.036;
  const h = big ? 0.075 : 0.062;
  const parts = [];
  parts.push(s.cylinder(x, y, z, big ? 0.085 : 0.068, 0.012, 14, PORCELAIN, { r1: big ? 0.09 : 0.072 }));
  parts.push(s.cylinder(x, y + 0.012, z, rb, h, 12, PORCELAIN, { r1: rt, noTop: true }));
  // anse
  parts.push(s.box(x + rt * 0.92, y + 0.02, z - 0.006, x + rt + 0.022, y + h * 0.75, z + 0.006, PORCELAIN));
  // liseré à la couleur de la maison sous le bord
  if (opts.rim) parts.push(s.cylinder(x, y + 0.012 + h * 0.86, z, rt * 0.97, h * 0.1, 12, opts.rim, { r1: rt * 1.0, noTop: true }));
  // contenu: disque sous le bord
  const content = kind === 'espresso' ? '#B57844' : kind === 'tea' ? '#A65A2C' : kind === 'empty' ? '#E3DACB' : '#FAF4EA';
  parts.push(s.cylinder(x, y + 0.012 + h * 0.84, z, rt * 0.86, 0.001, 12, content, { noAo: true }));
  if (kind === 'cappuccino' && !opts.noArt) parts.push(s.cylinder(x, y + 0.014 + h * 0.84, z, rt * 0.45, 0.001, 10, '#C99060'));
  return parts;
}
function cup(s, x, y, z, kind, opts) {
  obj(s, [[2, cupParts(s, x, y, z, kind, opts).flat()]]);
}

// table ronde de bistrot (pied central)
function roundTable(s, x, z, o = {}) {
  const r = o.r || 0.36;
  const h = o.h || 0.75;
  const top = o.top || C('oak_dark');
  const leg = o.leg || C('steel_dark');
  const items = (o.items || []).map((it) => cupParts(s, x + it[0], h, z + it[1], it[2] || 'cappuccino', { rim: o.rim }).flat());
  obj(s, [
    [0, s.cylinder(x, 0, z, 0.24, 0.035, 10, leg, { r1: 0.2 })],
    [0, s.cylinder(x, 0.035, z, 0.035, h - 0.07, 6, leg)],
    [1, s.cylinder(x, h - 0.035, z, r, 0.035, 18, top)],
    [2, items.flat()],
  ]);
}
function squareTable(s, x, z, o = {}) {
  const w = (o.w || 0.7) / 2;
  const d = (o.d || 0.7) / 2;
  const h = o.h || 0.75;
  const top = o.top || C('oak_dark');
  const leg = o.leg || top;
  const legs = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => s.box(x + a * (w - 0.06) - 0.025, 0, z + b * (d - 0.06) - 0.025, x + a * (w - 0.06) + 0.025, h - 0.04, z + b * (d - 0.06) + 0.025, leg)).flat();
  const items = (o.items || []).map((it) => cupParts(s, x + it[0], h, z + it[1], it[2] || 'cappuccino', { rim: o.rim }).flat());
  obj(s, [
    [0, legs],
    [1, s.box(x - w, h - 0.04, z - d, x + w, h, z + d, top)],
    [2, items.flat()],
  ]);
}

// chaise: facing = direction du regard de la personne assise ('+z', '-z', '+x', '-x')
function chair(s, x, z, facing, o = {}) {
  const wood = o.wood || C('oak_honey');
  const seat = o.seat || wood;
  const kind = o.kind || 'bistrot';
  const hw = 0.21;
  const parts = [];
  const legs = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => s.box(x + a * 0.17 - 0.017, 0, z + b * 0.17 - 0.017, x + a * 0.17 + 0.017, 0.44, z + b * 0.17 + 0.017, wood)).flat();
  parts.push([0, legs]);
  if (kind === 'bistrot') parts.push([1, s.cylinder(x, 0.42, z, hw, 0.035, 14, seat)]);
  else parts.push([1, s.box(x - hw, 0.42, z - hw, x + hw, 0.46, z + hw, seat)]);
  // dossier du côté opposé au regard
  const back = { '+z': [x - hw, z - hw - 0.02, x + hw, z - hw + 0.015], '-z': [x - hw, z + hw - 0.015, x + hw, z + hw + 0.02], '+x': [x - hw - 0.02, z - hw, x - hw + 0.015, z + hw], '-x': [x + hw - 0.015, z - hw, x + hw + 0.02, z + hw] }[facing];
  if (kind === 'paille') {
    // dossier à barreaux (chaise paillée): deux montants et trois traverses
    const [ax, az, bx, bz] = back;
    const alongX = facing === '+z' || facing === '-z';
    const posts = alongX ? [s.box(ax, 0.44, az, ax + 0.035, 0.95, bz, wood), s.box(bx - 0.035, 0.44, az, bx, 0.95, bz, wood)] : [s.box(ax, 0.44, az, bx, 0.95, az + 0.035, wood), s.box(ax, 0.44, bz - 0.035, bx, 0.95, bz, wood)];
    const rails = [0.62, 0.75, 0.88].map((yy) => s.box(ax, yy, az, bx, yy + 0.045, bz, wood));
    parts.push([1, [...posts.flat(), ...rails.flat()]]);
  } else {
    const [ax, az, bx, bz] = back;
    parts.push([1, s.box(ax, 0.46, az, bx, 0.86, bz, wood)]);
  }
  obj(s, parts);
}

function stool(s, x, z, o = {}) {
  const leg = o.leg || C('steel_dark');
  obj(s, [
    [0, [s.box(x - 0.15, 0, z - 0.012, x - 0.13, 0.72, z + 0.012, leg), s.box(x + 0.13, 0, z - 0.012, x + 0.15, 0.72, z + 0.012, leg), s.box(x - 0.012, 0, z - 0.15, x + 0.012, 0.72, z - 0.13, leg), s.box(x - 0.012, 0, z + 0.13, x + 0.012, 0.72, z + 0.15, leg)].flat()],
    [1, s.cylinder(x, 0.72, z, 0.17, 0.05, 12, o.seat || C('walnut'))],
  ]);
}

// suspension: cordon, abat-jour (tronc de cône) et ampoule; la lumière est ajoutée à scene.light.lamps à part
function pendant(s, x, z, yTop, yShade, o = {}) {
  const shade = o.shade || '#3F5248';
  const r = o.r || 0.17;
  const cord = s.box(x - 0.006, yShade + 0.18, z - 0.006, x + 0.006, yTop, z + 0.006, '#2B2622');
  const kind = o.kind || 'enamel';
  let body;
  if (kind === 'globe') body = s.cylinder(x, yShade, z, r * 0.7, 0.26, 12, '#FFE7C2', { r1: r * 0.55, emissive: true });
  else if (kind === 'cage') body = [...s.cylinder(x, yShade + 0.02, z, 0.06, 0.12, 8, '#FFD9A0', { emissive: true }), ...s.cylinder(x, yShade, z, 0.09, 0.16, 6, '#3D4346', { r1: 0.09, noTop: true, opacity: 0.35 })];
  else body = s.cylinder(x, yShade, z, r, 0.18, 14, shade, { r1: 0.045 });
  const bulb = kind === 'enamel' ? s.cylinder(x, yShade - 0.005, z, r * 0.8, 0.002, 12, o.glow || '#FFE0B0', { emissive: true }) : [];
  obj(s, [[0, cord], [1, body], [2, bulb]]);
  // halo peint autour de la lampe (carte de lueur, jamais un flou)
  const c = s.cam.view([x, yShade + 0.05, z]);
  if (c[2] > 0.1 && (o.halo || 0) > 0) {
    const sc = s.cam.project(c);
    const rad = (s.cam.focal * (o.haloR || 0.45)) / c[2];
    const gid = s.id('h');
    s.defs.push(`<radialGradient id="${gid}"><stop offset="0" stop-color="#FFD39A" stop-opacity="${o.halo}"/><stop offset="1" stop-color="#FFD39A" stop-opacity="0"/></radialGradient>`);
    s.layers.fx.push({ depth: c[2], svg: `<circle cx="${r1(sc[0])}" cy="${r1(sc[1])}" r="${r1(rad)}" fill="url(#${gid})"/>` });
  }
}

// plante en pot: pot en tronc de cône, feuillage en boules facettées dessinées à plat
function plant(s, x, y, z, o = {}) {
  const potH = o.potH || 0.3;
  const potR = o.potR || 0.16;
  obj(s, [[0, s.cylinder(x, y, z, potR * 0.8, potH, 10, o.pot || C('pot'), { r1: potR })]]);
  const leaves = o.leaves || [C('leaf'), C('leaf_light')];
  const blobs = o.blobs || [[0, 0.25, 0, 0.2], [-0.12, 0.38, 0.02, 0.15], [0.13, 0.4, -0.02, 0.14], [0, 0.52, 0, 0.12]];
  for (const [dx, dy, dz, rr] of blobs) {
    const p = [x + dx, y + potH + dy, z + dz];
    const c = s.cam.view(p);
    if (c[2] < 0.1) continue;
    const sc = s.cam.project(c);
    const rad = (s.cam.focal * rr) / c[2];
    const base = s.shade(leaves[0], [0, 1, 0], p);
    const light = s.shade(leaves[1], [0, 1, 0], p);
    s.layers.objects.push({ depth: c[2] - 0.01, svg: `<circle cx="${r1(sc[0])}" cy="${r1(sc[1])}" r="${r1(rad)}" fill="${base}"/><circle cx="${r1(sc[0] - rad * 0.25)}" cy="${r1(sc[1] - rad * 0.3)}" r="${r1(rad * 0.6)}" fill="${light}"/>` });
  }
}

// rangée de tasses propres retournées sur une étagère (fond sombre derrière)
function cupRow(s, x0, x1, y, z, axis = 'x', n = 6) {
  const parts = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const px = axis === 'x' ? x0 + (x1 - x0) * t : x0;
    const pz = axis === 'x' ? z : x1 === x0 ? z : z + (x1 - x0) * t;
    parts.push(s.cylinder(px, y, pz, 0.052, 0.07, 10, PORCELAIN, { r1: 0.036 }));
  }
  obj(s, [[2, parts.flat()]]);
}
function cupColumn(s, x, y, z0, z1, n = 6, opts = {}) {
  const parts = [];
  for (let i = 0; i < n; i++) {
    const pz = z0 + ((z1 - z0) * (i + 0.5)) / n;
    for (let k = 0; k < (opts.stack || 1); k++) parts.push(s.cylinder(x, y + k * 0.05, pz, 0.052, 0.068, 10, PORCELAIN, { r1: 0.04 }));
  }
  obj(s, [[2, parts.flat()]]);
}

// machine à expresso posée contre un mur (façade vers +x), deux groupes
function espressoMachine(s, x, y, z, o = {}) {
  const body = o.body || C('copper');
  const steel = C('steel');
  const dark = C('steel_dark');
  const w = 0.42;
  const parts = [
    [1, s.box(x, y, z - 0.38, x + w, y + 0.42, z + 0.38, { front: body, top: steel, left: body, right: body, back: body, side: body })],
    [1, s.box(x + 0.02, y + 0.42, z - 0.36, x + w - 0.04, y + 0.48, z + 0.36, steel)],
    // tasses chauffées sur le dessus
    [2, s.cylinder(x + 0.2, y + 0.48, z - 0.2, 0.05, 0.065, 10, PORCELAIN, { r1: 0.036 })],
    [2, s.cylinder(x + 0.2, y + 0.48, z - 0.05, 0.05, 0.065, 10, PORCELAIN, { r1: 0.036 })],
    [2, s.cylinder(x + 0.2, y + 0.48, z + 0.1, 0.05, 0.065, 10, PORCELAIN, { r1: 0.036 })],
    // groupes et porte-filtres
    [2, s.box(x + w, y + 0.24, z - 0.2, x + w + 0.07, y + 0.3, z - 0.12, steel)],
    [2, s.box(x + w, y + 0.24, z + 0.12, x + w + 0.07, y + 0.3, z + 0.2, steel)],
    [2, s.box(x + w + 0.04, y + 0.2, z - 0.18, x + w + 0.2, y + 0.23, z - 0.15, dark)],
    [2, s.box(x + w + 0.04, y + 0.2, z + 0.15, x + w + 0.2, y + 0.23, z + 0.18, dark)],
    // grille d'égouttage
    [2, s.box(x + w, y + 0.02, z - 0.34, x + w + 0.12, y + 0.05, z + 0.34, dark)],
    // buse vapeur
    [2, s.box(x + w + 0.02, y + 0.12, z + 0.3, x + w + 0.035, y + 0.36, z + 0.315, steel)],
  ];
  obj(s, parts);
}
function grinder(s, x, y, z) {
  obj(s, [
    [1, s.box(x, y, z - 0.1, x + 0.22, y + 0.3, z + 0.1, C('steel_dark'))],
    [2, s.cylinder(x + 0.11, y + 0.3, z, 0.07, 0.16, 10, '#C9D6D3', { r1: 0.1, opacity: 0.85 })],
    [2, s.cylinder(x + 0.11, y + 0.3, z, 0.065, 0.08, 10, '#3B2318')],
  ]);
}

// ardoise murale: panneau sombre et texte à la craie projeté par une transformation affine
function slateBoard(s, corners, lines, o = {}) {
  // corners: [hautGauche, hautDroite, basGauche] du monde; rien si un coin est trop près du plan de la caméra
  if (corners.some((p) => s.cam.view(p)[2] < 0.3)) return;
  const [tl, tr, bl] = corners.map((p) => s.cam.project(s.cam.view(p)));
  const br = [tr[0] + bl[0] - tl[0], tr[1] + bl[1] - tl[1]];
  const W = o.w || 600;
  const H = o.h || 400;
  const a = (tr[0] - tl[0]) / W;
  const b = (tr[1] - tl[1]) / W;
  const c2 = (bl[0] - tl[0]) / H;
  const d = (bl[1] - tl[1]) / H;
  const frame = o.frame || C('oak_dark');
  const text = lines
    .map((l, i) => `<text x="${l.x || 40}" y="${l.y || 70 + i * 52}" font-family="'Caveat Variable', Caveat, cursive" font-weight="${l.w || 600}" font-size="${l.size || 44}" fill="${l.color || '#F1EDE3'}"${l.anchor ? ` text-anchor="${l.anchor}"` : ''}>${l.t}</text>`)
    .join('');
  const svg = `<path d="M${r1(tl[0])} ${r1(tl[1])}L${r1(tr[0])} ${r1(tr[1])}L${r1(br[0])} ${r1(br[1])}L${r1(bl[0])} ${r1(bl[1])}Z" fill="${frame}" stroke="${frame}" stroke-width="${o.frameW || 6}" stroke-linejoin="round"/><g transform="matrix(${a} ${b} ${c2} ${d} ${r1(tl[0])} ${r1(tl[1])})"><rect width="${W}" height="${H}" fill="${o.bg || '#2F3634'}"/>${text}</g>`;
  const depth = s.cam.view(corners[0])[2];
  s.layers.objects.push({ depth: depth + (o.depthBias || 0), svg });
}

// rail à tickets: barre et tickets de papier, la pince du ticket pris à la couleur et au symbole du joueur
function ticketRail(s, x, y, z0, z1, tickets) {
  obj(s, [[1, s.box(x - 0.012, y - 0.012, z0, x + 0.012, y + 0.012, z1, C('steel'))]]);
  const n = tickets.length;
  tickets.forEach((t, i) => {
    const zc = z0 + ((z1 - z0) * (i + 0.6)) / (n + 0.4);
    const pts = [[x + 0.01, y - 0.005, zc - 0.05], [x + 0.01, y - 0.005, zc + 0.05], [x + 0.01, y - 0.15, zc + 0.05], [x + 0.01, y - 0.15, zc - 0.05]];
    const f = s.face(pts, '#FBF6EA', { cull: false, emissive: false });
    const lines = s.face([[x + 0.012, y - 0.05, zc - 0.035], [x + 0.012, y - 0.05, zc + 0.03], [x + 0.012, y - 0.06, zc + 0.03], [x + 0.012, y - 0.06, zc - 0.035]], INK, { cull: false, emissive: true });
    const lines2 = s.face([[x + 0.012, y - 0.08, zc - 0.035], [x + 0.012, y - 0.08, zc + 0.015], [x + 0.012, y - 0.09, zc + 0.015], [x + 0.012, y - 0.09, zc - 0.035]], INK, { cull: false, emissive: true });
    const clip = t.clip ? s.face([[x + 0.014, y + 0.02, zc - 0.03], [x + 0.014, y + 0.02, zc + 0.03], [x + 0.014, y - 0.03, zc + 0.03], [x + 0.014, y - 0.03, zc - 0.03]], t.clip, { cull: false, emissive: true, stroke: '#1C1A26', strokeWidth: 1.2 }) : null;
    // ticket qui attend: bandeau ambre en tête et sablier (alerte douce, jamais la couleur seule)
    const wait = t.alert ? s.face([[x + 0.012, y - 0.005, zc - 0.05], [x + 0.012, y - 0.005, zc + 0.05], [x + 0.012, y - 0.042, zc + 0.05], [x + 0.012, y - 0.042, zc - 0.05]], '#E0A030', { cull: false, emissive: true }) : null;
    const glass = t.alert ? s.face([[x + 0.014, y - 0.01, zc - 0.012], [x + 0.014, y - 0.01, zc + 0.012], [x + 0.014, y - 0.036, zc - 0.012], [x + 0.014, y - 0.036, zc + 0.012]], '#5A3A10', { cull: false, emissive: true }) : null;
    obj(s, [[2, [f, wait, glass, lines, lines2, clip]]]);
  });
}

// vitrine à pâtisseries posée sur le comptoir (verre peint, gâteaux dedans)
function pastryCase(s, x0, y, z0, x1, z1, o = {}) {
  const parts = [];
  parts.push([1, s.box(x0, y, z0, x1, y + 0.05, z1, C('walnut'))]);
  // gâteaux et viennoiseries: petites formes dorées sur deux étages
  const goods = [];
  const nz = 4;
  for (let i = 0; i < nz; i++) {
    const zc = z0 + ((z1 - z0) * (i + 0.5)) / nz;
    goods.push(s.box((x0 + x1) / 2 - 0.08, y + 0.05, zc - 0.06, (x0 + x1) / 2 + 0.08, y + 0.1, zc + 0.06, i % 2 ? C('crust') : '#9E3647'));
    goods.push(s.box((x0 + x1) / 2 - 0.07, y + 0.21, zc - 0.05, (x0 + x1) / 2 + 0.07, y + 0.25, zc + 0.05, i % 2 ? C('crumb') : C('crust')));
  }
  parts.push([2, s.box(x0 + 0.02, y + 0.2, z0 + 0.02, x1 - 0.02, y + 0.205, z1 - 0.02, '#C9D6D3', { opacity: 0.5 })]);
  parts.push([2, goods.flat()]);
  parts.push([3, s.box(x0, y + 0.05, z0, x1, y + 0.36, z1, '#DCE6E4', { opacity: o.glass || 0.16, skip: ['bottom'] })]);
  obj(s, parts);
}

function register(s, x, y, z, o = {}) {
  obj(s, [
    [1, s.box(x, y, z - 0.17, x + 0.32, y + 0.1, z + 0.17, o.body || C('walnut'))],
    [2, s.box(x + 0.06, y + 0.1, z - 0.12, x + 0.26, y + 0.24, z + 0.12, o.top || C('brass'))],
    [2, s.box(x + 0.27, y + 0.18, z - 0.1, x + 0.28, y + 0.24, z + 0.1, '#2F3634', { emissive: true })],
  ]);
}
function guestbook(s, x, y, z) {
  obj(s, [
    [1, s.box(x, y, z - 0.17, x + 0.25, y + 0.025, z + 0.17, '#6E2E35')],
    [2, s.box(x + 0.012, y + 0.025, z - 0.16, x + 0.238, y + 0.03, z - 0.004, '#F2E8D2')],
    [2, s.box(x + 0.012, y + 0.025, z + 0.004, x + 0.238, y + 0.03, z + 0.16, '#F2E8D2')],
  ]);
}

// fenêtre à petits bois dans un mur à z constant (ébrasement, châssis au milieu de l'épaisseur, verre peint)
function windowZ(s, x0, x1, y0, y1, zIn, depth, o = {}) {
  const frame = o.frame || '#E3D9C6';
  const reveal = o.reveal || C('plaster');
  const zf = zIn + depth * 0.45;
  const parts = [];
  // ébrasements (vus de l'intérieur)
  parts.push(s.face([[x0, y0, zIn], [x0, y1, zIn], [x0, y1, zf], [x0, y0, zf]], reveal, { cull: false }));
  parts.push(s.face([[x1, y0, zf], [x1, y1, zf], [x1, y1, zIn], [x1, y0, zIn]], reveal, { cull: false }));
  parts.push(s.face([[x0, y1, zIn], [x1, y1, zIn], [x1, y1, zf], [x0, y1, zf]], shadeHex(reveal, 0.85), { cull: false }));
  parts.push(s.face([[x0, y0, zf], [x1, y0, zf], [x1, y0, zIn], [x0, y0, zIn]], o.sill || shadeHex(reveal, 1.05), { cull: false }));
  // verre peint: légère teinte et deux reflets en biais
  const glassOp = o.glassOpacity !== undefined ? o.glassOpacity : 0.12;
  parts.push(s.face([[x0, y0, zf], [x0, y1, zf], [x1, y1, zf], [x1, y0, zf]], o.glassTint || '#DCE6E4', { cull: false, emissive: true, opacity: glassOp }));
  const w = x1 - x0;
  const hgt = y1 - y0;
  for (const [t0, t1, op] of [[0.15, 0.22, 0.18], [0.27, 0.3, 0.12]]) {
    parts.push(s.face([[x0 + w * t0, y0, zf - 0.002], [x0 + w * (t0 + 0.25), y0 + hgt, zf - 0.002], [x0 + w * (t1 + 0.25), y0 + hgt, zf - 0.002], [x0 + w * t1, y0, zf - 0.002]], '#FFFFFF', { cull: false, emissive: true, opacity: op * (o.reflect || 1) }));
  }
  // châssis et petits bois
  const fw = 0.05;
  const bars = [s.box(x0, y0, zf - 0.03, x1, y0 + fw, zf + 0.02, frame), s.box(x0, y1 - fw, zf - 0.03, x1, y1, zf + 0.02, frame), s.box(x0, y0, zf - 0.03, x0 + fw, y1, zf + 0.02, frame), s.box(x1 - fw, y0, zf - 0.03, x1, y1, zf + 0.02, frame)];
  const cols = o.cols || 3;
  const rows = o.rows || 3;
  for (let i = 1; i < cols; i++) {
    const xx = x0 + (w * i) / cols;
    bars.push(s.box(xx - 0.018, y0, zf - 0.02, xx + 0.018, y1, zf + 0.01, frame));
  }
  for (let j = 1; j < rows; j++) {
    const yy = y0 + (hgt * j) / rows;
    bars.push(s.box(x0, yy - 0.018, zf - 0.02, x1, yy + 0.018, zf + 0.01, frame));
  }
  obj(s, [[0, parts], [1, bars.flat()]]);
}

// porte vitrée dans un mur à z constant
function doorZ(s, x0, x1, zIn, depth, o = {}) {
  const frame = o.frame || '#7E937B';
  const zf = zIn + depth * 0.5;
  const parts = [];
  const reveal = o.reveal || C('plaster');
  parts.push(s.face([[x0, 0, zIn], [x0, 2.25, zIn], [x0, 2.25, zf], [x0, 0, zf]], reveal, { cull: false }));
  parts.push(s.face([[x1, 0, zf], [x1, 2.25, zf], [x1, 2.25, zIn], [x1, 0, zIn]], reveal, { cull: false }));
  parts.push(s.face([[x0, 2.25, zIn], [x1, 2.25, zIn], [x1, 2.25, zf], [x0, 2.25, zf]], shadeHex(reveal, 0.85), { cull: false }));
  const leaf = [
    s.box(x0 + 0.04, 0, zf - 0.02, x1 - 0.04, 0.95, zf + 0.02, frame),
    s.box(x0 + 0.04, 0.95, zf - 0.02, x0 + 0.12, 2.2, zf + 0.02, frame),
    s.box(x1 - 0.12, 0.95, zf - 0.02, x1 - 0.04, 2.2, zf + 0.02, frame),
    s.box(x0 + 0.04, 2.12, zf - 0.02, x1 - 0.04, 2.2, zf + 0.02, frame),
    s.box(x0 + 0.04, 1.52, zf - 0.02, x1 - 0.04, 1.57, zf + 0.02, frame),
  ];
  const glass = s.face([[x0 + 0.12, 0.95, zf], [x0 + 0.12, 2.12, zf], [x1 - 0.12, 2.12, zf], [x1 - 0.12, 0.95, zf]], '#DCE6E4', { cull: false, emissive: true, opacity: o.glassOpacity !== undefined ? o.glassOpacity : 0.14 });
  const handle = s.box(x1 - 0.2, 1.0, zf - 0.07, x1 - 0.17, 1.12, zf - 0.03, C('brass'));
  obj(s, [[0, parts], [1, [glass, ...leaf.flat()]], [2, handle]]);
}

// façade simple de la rue: corps, fenêtres (sombres ou allumées), volets, toit
function facade(s, x0, x1, z, h, o = {}) {
  const wall = o.wall || '#CDB892';
  const ext = { exterior: true, sunlit: o.sunlit };
  const parts = [s.box(x0, 0, z, x1, h, z + 6, { front: wall, left: shadeHex(wall, 0.85), right: shadeHex(wall, 0.85), top: wall }, ext)];
  const roofC = o.roof || '#A9674A';
  if (o.roofKind !== 'flat') {
    parts.push(s.face([[x0 - 0.2, h, z - 0.3], [x0 - 0.2, h + (o.roofH || 2.2), z + 2.6], [x1 + 0.2, h + (o.roofH || 2.2), z + 2.6], [x1 + 0.2, h, z - 0.3]], roofC, { ...ext, cull: false }));
  }
  const win = [];
  const floors = o.floors || 2;
  const perFloor = o.perFloor || 2;
  const fh = (h - (o.ground || 0)) / floors;
  for (let f = 0; f < floors; f++) {
    for (let i = 0; i < perFloor; i++) {
      const cx = x0 + ((x1 - x0) * (i + 0.5)) / perFloor;
      const y0 = (o.ground || 0) + f * fh + fh * 0.28;
      const y1 = y0 + fh * 0.5;
      const ww = o.winW || 0.55;
      const lit = o.lit && (f + i + (o.seed || 0)) % 3 !== 1;
      win.push(s.face([[cx - ww, y0, z - 0.01], [cx - ww, y1, z - 0.01], [cx + ww, y1, z - 0.01], [cx + ww, y0, z - 0.01]], lit ? '#FFC874' : o.glassC || '#4A5560', { ...ext, emissive: lit, cull: false }));
      if (o.shutters) {
        win.push(s.face([[cx - ww - 0.42, y0 - 0.05, z - 0.02], [cx - ww - 0.42, y1 + 0.05, z - 0.02], [cx - ww - 0.04, y1 + 0.05, z - 0.02], [cx - ww - 0.04, y0 - 0.05, z - 0.02]], o.shutters, { ...ext, cull: false }));
        win.push(s.face([[cx + ww + 0.04, y0 - 0.05, z - 0.02], [cx + ww + 0.04, y1 + 0.05, z - 0.02], [cx + ww + 0.42, y1 + 0.05, z - 0.02], [cx + ww + 0.42, y0 - 0.05, z - 0.02]], o.shutters, { ...ext, cull: false }));
      }
      if (o.balcony && f >= 1) {
        win.push(s.face([[cx - ww - 0.3, y0 - 0.02, z - 0.35], [cx - ww - 0.3, y0 + 0.28, z - 0.35], [cx + ww + 0.3, y0 + 0.28, z - 0.35], [cx + ww + 0.3, y0 - 0.02, z - 0.35]], o.balcony, { ...ext, cull: false, opacity: 0.85 }));
      }
    }
  }
  if (o.shop) {
    win.push(s.face([[x0 + 0.5, 0.3, z - 0.02], [x0 + 0.5, 2.6, z - 0.02], [x1 - 0.5, 2.6, z - 0.02], [x1 - 0.5, 0.3, z - 0.02]], o.shop, { ...ext, cull: false }));
    win.push(s.face([[x0 + 0.8, 0.5, z - 0.03], [x0 + 0.8, 2.2, z - 0.03], [x1 - 0.8, 2.2, z - 0.03], [x1 - 0.8, 0.5, z - 0.03]], o.shopLit ? '#FFD08A' : '#4A5560', { ...ext, emissive: !!o.shopLit, cull: false }));
  }
  const all = [...parts.flat(), ...win].filter(Boolean);
  all.sort((a, b) => b.depth - a.depth);
  const winSvg = win.filter(Boolean).map((f) => f.svg).join('');
  s.layers.exterior.push({ depth: Math.max(...all.map((f) => f.depth)), svg: parts.flat().filter(Boolean).sort((a, b) => b.depth - a.depth).map((f) => f.svg).join('') + winSvg });
}

// arbre: tronc en cylindre, houppier en boules (vues à plat), saison
function tree(s, x, z, o = {}) {
  const h = o.h || 4.5;
  const trunk = s.cylinder(x, 0, z, 0.2, h * 0.55, 7, o.bark || '#BDB39A', { exterior: true, r1: 0.14 });
  const parts = [...trunk];
  const fl = (o.leaves || ['#6E8A4C', '#8AA35E']).map((c2) => (o.tint ? mixHex(c2, o.tint, 0.15) : c2));
  const blobs = [[0, h * 0.75, 0, 1.5], [-1.0, h * 0.62, 0.2, 1.1], [1.1, h * 0.66, -0.2, 1.15], [0.2, h * 0.95, 0, 1.0]];
  let svg = parts.filter(Boolean).sort((a, b) => b.depth - a.depth).map((f) => f.svg).join('');
  if (!o.bare) {
    for (const [dx, dy, dz, rr] of blobs) {
      const p = [x + dx, dy, z + dz];
      const c = s.cam.view(p);
      if (c[2] < 0.2) continue;
      const sc = s.cam.project(c);
      const rad = (s.cam.focal * rr) / c[2];
      const base = s.shade(fl[0], [0, 1, 0], p, { exterior: true });
      const light = s.shade(fl[1], [0, 1, 0], p, { exterior: true, sunlit: true });
      svg += `<circle cx="${r1(sc[0])}" cy="${r1(sc[1])}" r="${r1(rad)}" fill="${base}"/><circle cx="${r1(sc[0] + rad * 0.2)}" cy="${r1(sc[1] - rad * 0.28)}" r="${r1(rad * 0.62)}" fill="${light}"/>`;
    }
  } else {
    // hiver: branches nues
    const b = s.cam.project(s.cam.view([x, h * 0.55, z]));
    const k = s.scale ? 1 : 1;
    const sc = s.cam.scaleAt([x, h * 0.55, z]) * k;
    svg += `<g stroke="${s.shade(o.bark || '#BDB39A', [0, 0, -1], [x, h, z], { exterior: true })}" stroke-width="${r1(sc * 0.06)}" stroke-linecap="round" fill="none"><path d="M${r1(b[0])} ${r1(b[1])} l${r1(-sc * 0.9)} ${r1(-sc * 1.4)} M${r1(b[0])} ${r1(b[1])} l${r1(sc * 1.0)} ${r1(-sc * 1.3)} M${r1(b[0])} ${r1(b[1])} l${r1(sc * 0.1)} ${r1(-sc * 1.9)} M${r1(b[0] - sc * 0.5)} ${r1(b[1] - sc * 0.8)} l${r1(-sc * 0.6)} ${r1(-sc * 0.3)} M${r1(b[0] + sc * 0.6)} ${r1(b[1] - sc * 0.8)} l${r1(sc * 0.5)} ${r1(-sc * 0.5)}"/></g>`;
  }
  s.layers.exterior.push({ depth: s.cam.view([x, 1, z])[2] - 0.5, svg });
}

// sol extérieur (rue, place) en grands aplats
function ground(s, x0, x1, z0, z1, color, o = {}) {
  const f = s.face([[x0, o.y || 0, z0], [x0, o.y || 0, z1], [x1, o.y || 0, z1], [x1, o.y || 0, z0]], color, { exterior: true, cull: false });
  if (f) s.layers.exterior.push({ depth: 1e4 - z0, svg: f.svg });
}

// tache de soleil: projection d'une baie (à z constant) au sol, découpée sur l'emprise de la pièce
function sunPatch(s, x0, x1, y0, y1, zw, dir, room, color = '#FFD9A0', opacity = 0.42) {
  const proj = (x, y) => {
    const t = -y / dir[1];
    return [x + dir[0] * t, 0.003, zw + dir[2] * t];
  };
  let poly = [proj(x0, y0), proj(x1, y0), proj(x1, y1), proj(x0, y1)].map((p) => [p[0], p[2]]);
  // découpe par le rectangle de la pièce (Sutherland-Hodgman)
  const clip = (pts, inside, inter) => {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if (inside(a)) out.push(a);
      if (inside(a) !== inside(b)) out.push(inter(a, b));
    }
    return out;
  };
  const lerpAt = (a, b, k, v) => {
    const t = (v - a[k]) / (b[k] - a[k]);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
  poly = clip(poly, (p) => p[0] >= room.x0, (a, b) => lerpAt(a, b, 0, room.x0));
  poly = clip(poly, (p) => p[0] <= room.x1, (a, b) => lerpAt(a, b, 0, room.x1));
  poly = clip(poly, (p) => p[1] >= room.z0, (a, b) => lerpAt(a, b, 1, room.z0));
  poly = clip(poly, (p) => p[1] <= room.z1, (a, b) => lerpAt(a, b, 1, room.z1));
  if (poly.length < 3) return;
  const d = s.decal(poly.map(([x, z]) => [x, 0.003, z]), color, opacity);
  if (d) s.layers.overlays.push(d);
}

module.exports = { obj, cup, cupParts, roundTable, squareTable, chair, stool, pendant, plant, cupRow, cupColumn, espressoMachine, grinder, slateBoard, ticketRail, pastryCase, register, guestbook, windowZ, doorZ, facade, tree, ground, sunPatch, C, PORCELAIN, INK };
