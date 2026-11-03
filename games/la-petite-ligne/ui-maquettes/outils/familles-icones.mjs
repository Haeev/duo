// Familles d'icônes dessinées par paramètres (0.12.2): les 22 poissons, les cadres des raretés et les
// portraits des robes de poule. Le script réécrit, dans outils/icones-source.svg, le bloc compris
// entre les deux marqueurs « Familles générées »; generer-icones.mjs fait ensuite le sprite.
// Usage, depuis la racine du dépôt:
//   node games/la-petite-ligne/ui-maquettes/outils/familles-icones.mjs
//   node games/la-petite-ligne/ui-maquettes/outils/generer-icones.mjs
// Retoucher un poisson ici (ses paramètres), jamais dans le bloc généré.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const fichierSource = path.join(ici, 'icones-source.svg');
const DEBUT =
  '  <!-- Familles générées: début (outils/familles-icones.mjs, ne pas retoucher à la main) -->';
const FIN = '  <!-- Familles générées: fin -->';

/** Couleurs de palette.py utilisées par les familles (nom de la case: valeur). */
const C = {
  ink: '#2a2522',
  fishBack: '#6e807b',
  fishSilver: '#bac4c7',
  fishBelly: '#eae6d7',
  fishOlive: '#7e8553',
  troutSpot: '#c3473d',
  black: '#2c2e31',
  bark: '#6e5743',
  barkDark: '#554230',
  sepia: '#b59c79',
  sepiaDark: '#6f5b45',
  rock: '#a09c92',
  rockLight: '#beb9ad',
  rockDark: '#7f7b73',
  strawDark: '#c5a45f',
  straw: '#e2c47c',
  flowerRed: '#d9584f',
  flowerPink: '#e89cb6',
  flowerViolet: '#a685d0',
  combRed: '#d3423c',
  foxRed: '#c7652f',
  leafFir: '#3f6c4d',
  moss: '#809b4f',
  grassDry: '#c9be78',
  grassLight: '#aec874',
  plasterOchre: '#deba80',
  paintYellow: '#d9b65b',
  titYellow: '#efcb45',
  brass: '#c8a150',
  rust: '#8f5c40',
  copper: '#b8693a',
  copperLight: '#de9a62',
  logEnd: '#e3c18a',
  lauze: '#737b86',
  lauzeDark: '#5d646f',
  glass: '#5f7d8c',
  glassLamp: '#f2e4b6',
  flame: '#ffd27a',
  heronGrey: '#7f888e',
  heronGreyDark: '#5f676d',
  featherWhite: '#eeece4',
  stoneLight: '#dad0be',
  stoneDark: '#9b907f',
  water: '#6caab9',
  waterDeep: '#4c899a',
  waterFoam: '#d4eceb',
  kingfisher: '#2bb5c8',
  radishTip: '#f2dcdf',
  woodOldDark: '#6f685e',
  chickenWhite: '#f2ede1',
  chickenRusset: '#b5693c',
  chickenBlack: '#3d3b3b',
  owlBuff: '#d8ae72',
  gooseGrey: '#8f887c',
  gooseGreyDark: '#625b52',
  beak: '#e9b13f',
  loco: '#3f6453',
  paper: '#f3ebd4',
};

const r1 = (n) => {
  const v = Math.round(n * 100) / 100;
  return Object.is(v, -0) ? '0' : String(v);
};
const pt = (p) => `${r1(p[0])} ${r1(p[1])}`;

function bezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}

/**
 * Corps d'un poisson tourné vers la droite: museau `nose`, pédoncule de la queue en `ped` (x) de
 * demi-hauteur `ph`, dos et ventre par deux courbes de Bézier (hauteur des points de contrôle).
 */
function body(s) {
  const nose = s.nose;
  const cy = s.cy;
  const top = [nose, [nose[0] - s.top.a, s.top.y], [s.ped + s.top.b, s.top.y], [s.ped, cy - s.ph]];
  const bot = [[s.ped, cy + s.ph], [s.ped + s.bot.b, s.bot.y], [nose[0] - s.bot.a, s.bot.y], nose];
  const at = (curve, x) => {
    let best = curve[0];
    for (let i = 0; i <= 400; i += 1) {
      const p = bezier(...curve, i / 400);
      if (Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p;
    }
    return best[1];
  };
  return { top, bot, yTop: (x) => at(top, x), yBot: (x) => at(bot, x) };
}

const cubicD = (c) => `C${pt(c[1])} ${pt(c[2])} ${pt(c[3])}`;

/** Nageoire sur le dos (sens -1) ou sous le ventre (+1), de x0 (avant) à x1 (arrière). */
function fin(b, f, color) {
  const dir = f.side === 'top' ? -1 : 1;
  const y = (x) => (f.side === 'top' ? b.yTop(x) : b.yBot(x));
  const [x0, x1] = [f.from, f.to];
  const y0 = y(x0);
  const y1 = y(x1);
  const inset = 1.4 * -dir;
  const h = f.h;
  let d;
  if (f.shape === 'sail') {
    d = `M${pt([x0, y0 + inset])}L${pt([x0, y0])}L${pt([x0 - 0.6, y0 + dir * h])}C${pt([x0 - 2, y0 + dir * (h + 0.8)])} ${pt([x1 + 1.5, y1 + dir * h * 0.9])} ${pt([x1 + 0.2, y1 + dir * h * 0.6])}L${pt([x1, y1])}L${pt([x1, y1 + inset])}z`;
  } else if (f.shape === 'round') {
    // Arche arrondie, un peu couchée vers l'arrière.
    const lean = f.lean ?? 0.6;
    d = `M${pt([x0, y0 + inset])}L${pt([x0, y0])}C${pt([x0 - lean * 0.3, y0 + dir * h * 1.35])} ${pt([x1 + 0.2 - lean, y1 + dir * h * 1.35])} ${pt([x1, y1])}L${pt([x1, y1 + inset])}z`;
  } else {
    // Triangle couché vers l'arrière: bord d'attaque long, bord de fuite court.
    const ax = x1 - (f.lean ?? 1);
    d = `M${pt([x0, y0 + inset])}L${pt([x0, y0])}L${pt([ax, Math.min(y0, y1) * (dir < 0 ? 1 : 0) + Math.max(y0, y1) * (dir > 0 ? 1 : 0) + dir * h])}L${pt([x1, y1])}L${pt([x1, y1 + inset])}z`;
  }
  let out = `<path class="lpl-ik" d="${d}" fill="${color}"/>`;
  if (f.spines !== undefined) {
    const lines = [];
    for (let i = 1; i <= f.spines; i += 1) {
      const x = x0 + ((x1 - x0) * i) / (f.spines + 1);
      const yy = y(x);
      lines.push(`M${pt([x, yy])}l${r1(-0.5)} ${r1(dir * (h - 0.6))}`);
    }
    out += `<path d="${lines.join('')}" stroke="${C.ink}" stroke-width=".7" stroke-linecap="round" fill="none"/>`;
  }
  return out;
}

/** Queue: fourchue, droite (échancrée), arrondie, ou rien (lamproie). */
function tail(s, color) {
  const t = s.tail;
  const x = s.ped + 0.8;
  const tx = s.ped - t.len;
  const cy = s.cy;
  let d;
  if (t.kind === 'fork') {
    d = `M${pt([x, cy - s.ph])}L${pt([tx, cy - t.half])}L${pt([tx + t.fork, cy])}L${pt([tx, cy + t.half])}L${pt([x, cy + s.ph])}z`;
  } else if (t.kind === 'square') {
    d = `M${pt([x, cy - s.ph])}L${pt([tx, cy - t.half])}Q${pt([tx + t.fork, cy])} ${pt([tx, cy + t.half])}L${pt([x, cy + s.ph])}z`;
  } else {
    d = `M${pt([x, cy - s.ph])}L${pt([tx + 1, cy - t.half])}C${pt([tx - 0.9, cy - t.half * 0.6])} ${pt([tx - 0.9, cy + t.half * 0.6])} ${pt([tx + 1, cy + t.half])}L${pt([x, cy + s.ph])}z`;
  }
  return `<path class="lpl-ik" d="${d}" fill="${color}"/>`;
}

function eye(e) {
  if (e.iris === undefined)
    return `<circle cx="${r1(e.x)}" cy="${r1(e.y)}" r="${r1(e.r ?? 0.95)}" fill="${C.ink}"/>`;
  return `<circle cx="${r1(e.x)}" cy="${r1(e.y)}" r="${r1(e.r ?? 1.3)}" fill="${e.iris}" stroke="${C.ink}" stroke-width=".7"/><circle cx="${r1(e.x + 0.15)}" cy="${r1(e.y)}" r="${r1((e.r ?? 1.3) * 0.45)}" fill="${C.ink}"/>`;
}

const fine = (d, w = 0.9, color = C.ink) =>
  `<path d="${d}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;

function fish(s) {
  const b = body(s);
  const cy = s.cy;
  const col = s.colors;
  const parts = [];
  parts.push(tail(s, col.tail ?? col.fins));
  for (const f of s.fins ?? []) parts.push(fin(b, f, f.color ?? col.fins));
  const outline = `M${pt(s.nose)}${cubicD(b.top)}L${pt([s.ped, cy + s.ph])}${cubicD(b.bot)}z`;
  parts.push(`<path d="${outline}" fill="${col.flank}"/>`);
  // Dos: la courbe du dos, puis une ligne médiane un peu au-dessus du centre.
  const mY = cy - (cy - s.top.y) * (s.backLine ?? 0.12);
  parts.push(
    `<path d="M${pt(s.nose)}${cubicD(b.top)}L${pt([s.ped, cy - s.ph * 0.15])}C${pt([s.ped + s.top.b, mY])} ${pt([s.nose[0] - s.top.a, mY])} ${pt(s.nose)}z" fill="${col.back}"/>`,
  );
  const bY = cy + (s.bot.y - cy) * (s.bellyLine ?? 0.5);
  parts.push(
    `<path d="M${pt([s.ped, cy + s.ph])}${cubicD(b.bot)}C${pt([s.nose[0] - s.bot.a, bY])} ${pt([s.ped + s.bot.b, bY])} ${pt([s.ped, cy + s.ph * 0.5])}z" fill="${col.belly}"/>`,
  );
  if (s.marks !== undefined) parts.push(s.marks(b));
  parts.push(`<path class="lpl-ikf" d="${outline}"/>`);
  for (const f of s.overFins ?? []) parts.push(f(b));
  if (s.gill !== undefined) {
    const g = s.gill;
    const yt = b.yTop(g) + 0.7;
    const yb = b.yBot(g) - 0.7;
    parts.push(fine(`M${pt([g, yt])}Q${pt([g - 1.5, (yt + yb) / 2])} ${pt([g, yb])}`, 1.1));
  }
  if (s.mouth !== undefined) parts.push(fine(s.mouth, 1));
  for (const d of s.barbels ?? []) parts.push(fine(d, 0.85));
  parts.push(eye(s.eye));
  if (s.extra !== undefined) parts.push(s.extra);
  return parts.join('\n    ');
}

/** Points sur le flanc: [x, y, rayon]; couleur, et un cerne facultatif (truite). */
const spots = (list, color, ring) =>
  list
    .map(
      ([x, y, r]) =>
        `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" fill="${color}"${ring === undefined ? '' : ` stroke="${ring}" stroke-width=".6"`}/>`,
    )
    .join('');

/** Bandes verticales, du dos jusqu'à `to` (part de la hauteur sous le dos). */
const bands = (b, xs, color, w, to) =>
  xs
    .map((x) => {
      const yt = b.yTop(x);
      const yb = b.yBot(x);
      return `<path d="M${pt([x + 0.3, yt + 0.4])}L${pt([x - 0.3, yt + (yb - yt) * to])}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
    })
    .join('');

/** Petite étoile à quatre branches (éclat), centrée en x, y. */
const sparkle = (x, y, s, color) =>
  `<path d="M${pt([x, y - s])}Q${pt([x + s * 0.18, y - s * 0.18])} ${pt([x + s, y])}Q${pt([x + s * 0.18, y + s * 0.18])} ${pt([x, y + s])}Q${pt([x - s * 0.18, y + s * 0.18])} ${pt([x - s, y])}Q${pt([x - s * 0.18, y - s * 0.18])} ${pt([x, y - s])}z" fill="${color}" stroke="${C.ink}" stroke-width=".6" stroke-linejoin="round"/>`;

const FISH = [
  {
    id: 'gudgeon',
    note: 'Goujon: petit, tête ronde, deux moustaches au coin de la bouche, une rangée de taches sombres.',
    nose: [20.6, 13.2],
    cy: 12.6,
    ped: 7.2,
    ph: 1.1,
    top: { y: 8.6, a: 2.2, b: 5.5 },
    bot: { y: 16.4, a: 1.6, b: 5 },
    tail: { kind: 'fork', len: 4.4, half: 3.4, fork: 2.2 },
    fins: [
      { side: 'top', from: 14.8, to: 12, h: 2.6, lean: 0.8 },
      { side: 'bottom', from: 12.8, to: 11, h: 1.8 },
    ],
    colors: { back: C.sepiaDark, flank: C.rockLight, belly: C.fishBelly, fins: C.sepia },
    marks: () =>
      spots(
        [
          [9.6, 12.4, 0.75],
          [11.6, 12.6, 0.85],
          [13.7, 12.8, 0.85],
          [15.6, 12.8, 0.7],
        ],
        C.barkDark,
      ),
    gill: 17.2,
    eye: { x: 18.4, y: 11.6, r: 1 },
    mouth: 'M20.6 13.2l-1 .5',
    barbels: ['M19.7 13.9c-.2 1.2-.8 2-1.8 2.6', 'M20.2 13.8c.3 1.1.1 2.1-.4 2.9'],
  },
  {
    id: 'minnow',
    note: 'Vairon: grand comme un doigt, fuselé, des taches sombres en barreaux et le ventre rouge du printemps.',
    nose: [20, 12.4],
    cy: 12.5,
    ped: 7.6,
    ph: 0.9,
    top: { y: 9.8, a: 2.6, b: 5.4 },
    bot: { y: 15, a: 2.4, b: 5 },
    tail: { kind: 'fork', len: 4, half: 2.8, fork: 1.8 },
    fins: [
      { side: 'top', from: 13, to: 11, h: 2, lean: 0.6 },
      { side: 'bottom', from: 12, to: 10.5, h: 1.6 },
    ],
    colors: { back: C.fishOlive, flank: C.fishSilver, belly: C.flowerRed, fins: C.fishOlive },
    bellyLine: 0.35,
    marks: (b) => bands(b, [9.6, 11.6, 13.6, 15.6], C.leafFir, 1.3, 0.55),
    gill: 17,
    eye: { x: 18.2, y: 11.8, r: 0.9 },
    mouth: 'M20 12.4l-1 .3',
  },
  {
    id: 'stone-loach',
    note: 'Loche franche: corps de cigare, queue droite, trois barbillons sous le museau, marbrures brunes.',
    nose: [21.6, 13],
    cy: 12.6,
    ped: 5.6,
    ph: 1.6,
    top: { y: 10.2, a: 1.4, b: 6 },
    bot: { y: 15.4, a: 1.2, b: 6 },
    tail: { kind: 'square', len: 3.4, half: 2.6, fork: 0.8 },
    fins: [
      { side: 'top', from: 14, to: 11.2, h: 1.4, shape: 'round' },
      { side: 'bottom', from: 11.4, to: 9.6, h: 1.2, shape: 'round' },
    ],
    colors: { back: C.bark, flank: C.strawDark, belly: C.fishBelly, fins: C.sepia },
    backLine: 0.3,
    marks: () =>
      spots(
        [
          [8, 12.1, 0.9],
          [10.4, 11.6, 1],
          [10.8, 13.4, 0.7],
          [13, 12.2, 1],
          [15.4, 11.8, 0.9],
          [15, 13.6, 0.6],
          [17.4, 12.4, 0.7],
        ],
        C.barkDark,
      ),
    gill: 18.6,
    eye: { x: 19.6, y: 11.8, r: 0.8 },
    barbels: [
      'M21.4 13.4c.4.8.4 1.6 0 2.4',
      'M20.6 13.9c0 .9-.3 1.6-.9 2.2',
      'M21.8 13.1c.9.3 1.4.9 1.6 1.7',
    ],
  },
  {
    id: 'bleak',
    note: "Ablette: lame d'argent, bouche relevée, ventre en carène, queue très fourchue; un trait de lumière sur le flanc.",
    nose: [21.8, 11.6],
    cy: 12.4,
    ped: 6.6,
    ph: 0.9,
    top: { y: 10, a: 3, b: 5.4 },
    bot: { y: 15.6, a: 3.4, b: 4.6 },
    tail: { kind: 'fork', len: 4.4, half: 3.4, fork: 2.8 },
    fins: [
      { side: 'top', from: 11.6, to: 10, h: 2.2, lean: 0.6 },
      { side: 'bottom', from: 11.8, to: 8.6, h: 1.6, lean: 0.4 },
    ],
    colors: { back: C.fishBack, flank: C.fishSilver, belly: C.fishBelly, fins: C.fishSilver },
    marks: () => fine('M9 12.4c3-.5 7-.6 10.4-.2', 1, C.featherWhite),
    gill: 18,
    eye: { x: 19.2, y: 11.7, r: 1.15 },
    mouth: 'M21.8 11.6l-1.4 1',
  },
  {
    id: 'roach',
    note: "Gardon: corps haut d'argent, nageoires rouges, l'œil rouge (son signe).",
    nose: [21.2, 12.6],
    cy: 12.4,
    ped: 6.8,
    ph: 1.1,
    top: { y: 7.6, a: 2.4, b: 5 },
    bot: { y: 17, a: 2.2, b: 4.6 },
    tail: { kind: 'fork', len: 4.2, half: 3.6, fork: 2.2 },
    fins: [
      { side: 'top', from: 14, to: 11.4, h: 2.4, lean: 0.8, color: C.fishBack },
      { side: 'bottom', from: 13.6, to: 12, h: 2.2, color: C.flowerRed },
      { side: 'bottom', from: 10.4, to: 8.6, h: 1.8, color: C.flowerRed },
    ],
    colors: {
      back: C.fishBack,
      flank: C.fishSilver,
      belly: C.fishBelly,
      fins: C.flowerRed,
      tail: C.foxRed,
    },
    gill: 17.6,
    eye: { x: 18.9, y: 11.6, r: 1.45, iris: C.combRed },
    mouth: 'M21.2 12.6l-1.1.2',
  },
  {
    id: 'chub',
    note: 'Chevesne: grosse tête ronde, large bouche, écailles cernées de sombre, nageoires du ventre orangées.',
    nose: [21.9, 12.6],
    cy: 12.5,
    ped: 6.6,
    ph: 1.6,
    top: { y: 8.6, a: 1.2, b: 6 },
    bot: { y: 16.6, a: 1.2, b: 5.6 },
    tail: { kind: 'fork', len: 4, half: 3.4, fork: 1.8 },
    fins: [
      { side: 'top', from: 13, to: 10.8, h: 2.2, lean: 0.6, color: C.fishBack },
      { side: 'bottom', from: 13, to: 11.4, h: 2, color: C.foxRed },
      { side: 'bottom', from: 10, to: 8.4, h: 1.8, color: C.foxRed },
    ],
    colors: {
      back: C.fishOlive,
      flank: C.fishSilver,
      belly: C.fishBelly,
      fins: C.foxRed,
      tail: C.fishBack,
    },
    marks: () =>
      fine(
        'M9.4 10.6a1.2 1.2 0 0 0 0 2.2M12 10.2a1.2 1.2 0 0 0 0 2.2M14.6 10.2a1.2 1.2 0 0 0 0 2.2M10.7 12.8a1.2 1.2 0 0 0 0 2.2M13.3 12.8a1.2 1.2 0 0 0 0 2.2',
        0.6,
        C.fishBack,
      ),
    gill: 17.4,
    eye: { x: 19.4, y: 11.5, r: 1 },
    mouth: 'M21.9 12.6l-2.2.7',
  },
  {
    id: 'trout',
    note: 'Truite: points rouges cerclés de blanc et points noirs, petite nageoire adipeuse, queue presque droite.',
    nose: [21.8, 12.8],
    cy: 12.5,
    ped: 6.4,
    ph: 1.4,
    top: { y: 8.8, a: 2, b: 5.6 },
    bot: { y: 16.2, a: 1.8, b: 5.4 },
    tail: { kind: 'square', len: 4.2, half: 3.6, fork: 1.2 },
    fins: [
      { side: 'top', from: 14.2, to: 11.8, h: 2.4, lean: 0.8 },
      { side: 'top', from: 8.6, to: 7.8, h: 1.2, shape: 'round' },
      { side: 'bottom', from: 12.6, to: 11, h: 1.8 },
      { side: 'bottom', from: 9.4, to: 8, h: 1.6 },
    ],
    colors: { back: C.fishOlive, flank: C.plasterOchre, belly: C.fishBelly, fins: C.fishOlive },
    marks: () =>
      spots(
        [
          [9.2, 11.4, 0.6],
          [12.6, 10.6, 0.6],
          [16.2, 10.8, 0.55],
        ],
        C.black,
      ) +
      spots(
        [
          [10.6, 12.7, 0.85],
          [14, 12.4, 0.85],
          [12.2, 14.2, 0.7],
          [16, 13.4, 0.7],
        ],
        C.troutSpot,
        C.fishBelly,
      ),
    gill: 17.6,
    eye: { x: 19.2, y: 11.7, r: 1 },
    mouth: 'M21.8 12.8l-1.8.5',
  },
  {
    id: 'perch',
    note: 'Perche: dos bossu, nageoire épineuse, bandes sombres sur fond vert-jaune, nageoires du ventre rouges.',
    nose: [21.2, 13],
    cy: 12.6,
    ped: 6.8,
    ph: 1.2,
    top: { y: 7.2, a: 3.6, b: 4 },
    bot: { y: 16.8, a: 2, b: 4.6 },
    tail: { kind: 'fork', len: 4, half: 3.4, fork: 1.8 },
    fins: [
      { side: 'top', from: 17, to: 12.6, h: 3, lean: 1.4, spines: 4, color: C.fishOlive },
      { side: 'top', from: 11.8, to: 9, h: 2, lean: 0.4, color: C.fishOlive },
      { side: 'bottom', from: 14.2, to: 12.6, h: 2.2, color: C.foxRed },
      { side: 'bottom', from: 10.6, to: 8.8, h: 2, color: C.foxRed },
    ],
    colors: {
      back: C.leafFir,
      flank: C.grassDry,
      belly: C.fishBelly,
      fins: C.foxRed,
      tail: C.foxRed,
    },
    marks: (b) => bands(b, [8.8, 11, 13.3, 15.6], C.leafFir, 1.3, 0.72),
    gill: 17.8,
    eye: { x: 19.2, y: 11.8, r: 1.05 },
    mouth: 'M21.2 13l-1.4.3',
  },
  {
    id: 'dace',
    note: "Vandoise: fine et pressée, petite tête pointue, nageoires jaune pâle, l'œil jaune.",
    nose: [22, 12.5],
    cy: 12.5,
    ped: 6.6,
    ph: 0.9,
    top: { y: 9.8, a: 3.6, b: 4.8 },
    bot: { y: 15.2, a: 3.6, b: 4.6 },
    tail: { kind: 'fork', len: 4.4, half: 3.2, fork: 2.6 },
    fins: [
      { side: 'top', from: 13.2, to: 11, h: 2.4, lean: 0.4, color: C.fishBack },
      { side: 'bottom', from: 13, to: 11.6, h: 1.8 },
      { side: 'bottom', from: 9.8, to: 8.2, h: 1.6 },
    ],
    colors: {
      back: C.lauzeDark,
      flank: C.fishSilver,
      belly: C.fishBelly,
      fins: C.straw,
      tail: C.straw,
    },
    gill: 18.4,
    eye: { x: 19.7, y: 12, r: 1.1, iris: C.paintYellow },
    mouth: 'M22 12.5l-1.2.3',
  },
  {
    id: 'bullhead',
    note: "Chabot: tête énorme et plate, yeux sur le dessus, corps qui s'effile, grande nageoire en éventail.",
    nose: [21.6, 13.6],
    cy: 13,
    ped: 6.8,
    ph: 0.9,
    top: { y: 7.4, a: 0.6, b: 9.6 },
    bot: { y: 16.6, a: 1.2, b: 8 },
    tail: { kind: 'round', len: 3.6, half: 2.4 },
    fins: [
      { side: 'top', from: 15.6, to: 13.6, h: 1.4, shape: 'round', color: C.bark },
      { side: 'top', from: 13, to: 8.6, h: 1.8, shape: 'round', color: C.bark },
      { side: 'bottom', from: 11.6, to: 8.4, h: 1.3, shape: 'round', color: C.bark },
      { side: 'bottom', from: 17.4, to: 12.4, h: 3, shape: 'round', lean: 1.6, color: C.sepia },
    ],
    colors: { back: C.bark, flank: C.rock, belly: C.fishBelly, fins: C.sepia, tail: C.bark },
    backLine: 0.25,
    marks: () =>
      spots(
        [
          [9.4, 12.6, 0.7],
          [11.6, 13.4, 0.8],
          [13.6, 12.2, 0.8],
        ],
        C.barkDark,
      ),
    gill: 18,
    eye: { x: 19.4, y: 10.6, r: 1.05 },
    mouth: 'M21.6 13.6l-2.2.5',
  },
  {
    id: 'tench',
    note: 'Tanche: épaisse, vert de vieux bronze, ventre doré, nageoires rondes, petit œil rouge.',
    nose: [21.4, 12.8],
    cy: 12.5,
    ped: 6.8,
    ph: 2,
    top: { y: 8.4, a: 1.8, b: 5.2 },
    bot: { y: 16.6, a: 1.6, b: 5 },
    tail: { kind: 'square', len: 3.8, half: 3.6, fork: 0.6 },
    fins: [
      { side: 'top', from: 13.8, to: 11, h: 2.4, shape: 'round' },
      { side: 'bottom', from: 14, to: 11.6, h: 2.2, shape: 'round' },
      { side: 'bottom', from: 10.6, to: 8.6, h: 1.8, shape: 'round' },
    ],
    colors: { back: C.leafFir, flank: C.fishOlive, belly: C.brass, fins: C.leafFir },
    backLine: 0.25,
    gill: 17.6,
    eye: { x: 19.2, y: 11.7, r: 1.2, iris: C.combRed },
    mouth: 'M21.4 12.8l-1 .4',
    barbels: ['M20.6 13.3c0 .7-.3 1.2-.8 1.5'],
  },
  {
    id: 'barbel',
    note: 'Barbeau: long corps de lutteur, museau pointu vers le fond, quatre barbillons, flanc bronze et nageoires rouille.',
    nose: [22.4, 13.6],
    cy: 12.6,
    ped: 5.4,
    ph: 1.1,
    top: { y: 9.4, a: 3.4, b: 6 },
    bot: { y: 15.4, a: 2.6, b: 6 },
    tail: { kind: 'fork', len: 3.6, half: 3, fork: 1.8 },
    fins: [
      { side: 'top', from: 14.6, to: 12.4, h: 2.6, lean: 0.8, color: C.fishOlive },
      { side: 'bottom', from: 13, to: 11.4, h: 1.8 },
      { side: 'bottom', from: 9, to: 7.6, h: 1.6 },
    ],
    colors: { back: C.fishOlive, flank: C.brass, belly: C.fishBelly, fins: C.rust },
    gill: 18.6,
    eye: { x: 19.8, y: 11.7, r: 0.95 },
    mouth: 'M22 13.9l-1.4.2',
    barbels: [
      'M21.6 14.1c.2 1 0 1.8-.6 2.4',
      'M20.8 14.1c-.2.9-.7 1.6-1.4 2',
      'M22.3 13.8c.8.4 1.2 1 1.3 1.8',
    ],
  },
  {
    id: 'pike',
    note: 'Brochet: très long, museau en bec de canard, dorsale tout près de la queue, taches claires sur vert.',
    nose: [23, 12.8],
    cy: 12.6,
    ped: 4.8,
    ph: 1.3,
    top: { y: 10.6, a: 4.6, b: 6 },
    bot: { y: 14.8, a: 3.6, b: 6 },
    tail: { kind: 'fork', len: 3.4, half: 3.2, fork: 1.6 },
    fins: [
      { side: 'top', from: 8.6, to: 6, h: 2.6, lean: 0.4, shape: 'round' },
      { side: 'bottom', from: 8.6, to: 6.2, h: 2.2, shape: 'round' },
      { side: 'bottom', from: 13.6, to: 12.2, h: 1.4 },
    ],
    colors: { back: C.leafFir, flank: C.fishOlive, belly: C.fishBelly, fins: C.rust },
    backLine: 0.25,
    marks: () =>
      spots(
        [
          [8.2, 12.2, 0.55],
          [10.2, 11.8, 0.6],
          [12.4, 12.4, 0.6],
          [14.4, 11.9, 0.55],
          [11.2, 13.4, 0.5],
          [13.6, 13.5, 0.5],
        ],
        C.grassLight,
      ),
    gill: 17.4,
    eye: { x: 18.6, y: 11.6, r: 0.95 },
    mouth: 'M23 12.8l-5 .6',
  },
  {
    id: 'grayling',
    note: 'Ombre commun: une grande dorsale en voile, violette tachetée de rouge; petite tête, flanc gris piqué de noir.',
    nose: [21.6, 13],
    cy: 12.9,
    ped: 6.4,
    ph: 1,
    top: { y: 10.4, a: 2.8, b: 5 },
    bot: { y: 16, a: 2.4, b: 5 },
    tail: { kind: 'fork', len: 4.2, half: 3.2, fork: 2.2 },
    fins: [
      { side: 'top', from: 16, to: 9.6, h: 5.4, shape: 'sail', color: C.flowerViolet },
      { side: 'bottom', from: 13.2, to: 11.6, h: 1.8, color: C.flowerViolet },
      { side: 'bottom', from: 9.6, to: 8.2, h: 1.6, color: C.flowerViolet },
    ],
    colors: {
      back: C.fishBack,
      flank: C.fishSilver,
      belly: C.fishBelly,
      fins: C.flowerViolet,
      tail: C.heronGrey,
    },
    marks: () =>
      spots(
        [
          [15.4, 12, 0.45],
          [16.6, 13, 0.45],
          [14.6, 13.2, 0.4],
        ],
        C.black,
      ),
    extra: spots(
      [
        [14.4, 7.4, 0.55],
        [12.2, 7.2, 0.55],
        [10.6, 8.6, 0.5],
      ],
      C.troutSpot,
    ),
    gill: 18.2,
    eye: { x: 19.6, y: 12.2, r: 0.95 },
    mouth: 'M21.6 13l-.9.3',
  },
  {
    id: 'bitterling',
    note: 'Bouvière: toute petite et haute, ventre rose irisé, un trait turquoise vers la queue, nageoires rouges.',
    nose: [19.6, 12.4],
    cy: 12.4,
    ped: 8,
    ph: 1,
    top: { y: 7.4, a: 2.2, b: 4 },
    bot: { y: 17.2, a: 2, b: 3.8 },
    tail: { kind: 'fork', len: 3.6, half: 3, fork: 1.8 },
    fins: [
      { side: 'top', from: 14.2, to: 11, h: 2.2, lean: 0.6, color: C.flowerRed },
      { side: 'bottom', from: 13.6, to: 10.8, h: 1.8, color: C.flowerRed },
    ],
    colors: {
      back: C.fishOlive,
      flank: C.fishSilver,
      belly: C.flowerPink,
      fins: C.flowerRed,
      tail: C.fishOlive,
    },
    bellyLine: 0.3,
    marks: () => fine('M8.6 12.4h5.6', 1.6, C.kingfisher),
    gill: 16.8,
    eye: { x: 17.8, y: 11.4, r: 1.1, iris: C.flowerRed },
    mouth: 'M19.6 12.4l-.9.3',
  },
  {
    id: 'shad',
    note: "Alose: haute et argentée comme un hareng, dos bleu, une grande tache noire derrière l'ouïe, puis d'autres plus petites.",
    nose: [22, 12.2],
    cy: 12.5,
    ped: 6.4,
    ph: 0.9,
    top: { y: 8.4, a: 3, b: 5 },
    bot: { y: 17, a: 2.6, b: 4.4 },
    tail: { kind: 'fork', len: 4.4, half: 3.6, fork: 2.8 },
    fins: [
      { side: 'top', from: 14.6, to: 12.2, h: 2.4, lean: 0.6 },
      { side: 'bottom', from: 12.6, to: 9, h: 1.4, lean: 0.4 },
    ],
    colors: { back: C.glass, flank: C.fishSilver, belly: C.fishBelly, fins: C.fishBack },
    marks: () =>
      spots(
        [
          [16.2, 10.9, 1.05],
          [14, 11, 0.55],
          [12.2, 11.2, 0.5],
          [10.6, 11.4, 0.45],
        ],
        C.black,
      ),
    gill: 17.8,
    eye: { x: 19.4, y: 11.8, r: 1.1 },
    mouth: 'M22 12.2l-1.8 1.1',
  },
  {
    id: 'mirror-carp',
    note: 'Carpe miroir: corps haut et épais, longue dorsale, quelques grandes écailles comme des miroirs, deux barbillons.',
    nose: [21.4, 13.2],
    cy: 12.6,
    ped: 6.4,
    ph: 1.8,
    top: { y: 6.8, a: 2.4, b: 4.6 },
    bot: { y: 17.4, a: 2, b: 4.6 },
    tail: { kind: 'fork', len: 4.2, half: 3.8, fork: 1.8 },
    fins: [
      { side: 'top', from: 15, to: 8.6, h: 2.2, lean: 0.4 },
      { side: 'bottom', from: 14, to: 12.4, h: 2 },
      { side: 'bottom', from: 10.2, to: 8.4, h: 1.8 },
    ],
    colors: { back: C.bark, flank: C.brass, belly: C.fishBelly, fins: C.bark },
    marks: () =>
      `<g fill="${C.copperLight}" stroke="${C.ink}" stroke-width=".6"><circle cx="10.4" cy="10.6" r="1.5"/><circle cx="13.6" cy="10.2" r="1.7"/><circle cx="12.2" cy="13.6" r="1.4"/><circle cx="15.6" cy="13.2" r="1.2"/></g>` +
      fine('M13 9.5a1 1 0 0 1 1-.4M9.9 10a.9.9 0 0 1 .8-.3', 0.7, C.featherWhite),
    gill: 18,
    eye: { x: 19.2, y: 11.8, r: 0.95 },
    mouth: 'M21.4 13.2l-.9.3',
    barbels: ['M20.8 13.6c.2.8 0 1.4-.6 1.8'],
  },
  {
    id: 'salmon',
    note: "Saumon: grand fuseau d'argent au dos bleu, croix noires sur le haut, mâchoire en crochet, nageoire adipeuse.",
    nose: [22.6, 12.6],
    cy: 12.5,
    ped: 5.6,
    ph: 1.2,
    top: { y: 8.8, a: 2.8, b: 6 },
    bot: { y: 16, a: 2.6, b: 5.6 },
    tail: { kind: 'square', len: 4, half: 3.6, fork: 1.4 },
    fins: [
      { side: 'top', from: 14.4, to: 12, h: 2.4, lean: 0.8 },
      { side: 'top', from: 7.8, to: 7, h: 1.1, shape: 'round' },
      { side: 'bottom', from: 12.4, to: 10.8, h: 1.8 },
      { side: 'bottom', from: 8.8, to: 7.4, h: 1.6 },
    ],
    colors: { back: C.glass, flank: C.fishSilver, belly: C.fishBelly, fins: C.fishBack },
    marks: () =>
      fine(
        'M9 10.8l1.2 1.2M10.2 10.8 9 12M12.6 10l1.2 1.2M13.8 10l-1.2 1.2M16 10.2l1.1 1.1M17.1 10.2 16 11.3M11 12.8l1 1M12 12.8l-1 1',
        0.9,
        C.black,
      ),
    gill: 18.6,
    eye: { x: 19.9, y: 11.6, r: 1 },
    mouth: 'M22.6 12.6c-.4.8-1.4 1-2.4.7',
    extra: fine('M22.6 12.6c.3.6.1 1.2-.5 1.5', 1),
  },
  {
    id: 'burbot',
    note: 'Lote: longue et ronde, tête large, un seul barbillon au menton, longues nageoires du dos et du ventre, marbrée.',
    nose: [21.8, 12.9],
    cy: 12.6,
    ped: 5,
    ph: 1.4,
    top: { y: 9.8, a: 1.8, b: 6.6 },
    bot: { y: 15.6, a: 1.6, b: 6.6 },
    tail: { kind: 'round', len: 3.4, half: 2.8 },
    fins: [
      { side: 'top', from: 15.8, to: 14.2, h: 1.4, shape: 'round', color: C.bark },
      { side: 'top', from: 13.6, to: 6, h: 1.4, shape: 'round', color: C.bark },
      { side: 'bottom', from: 12.4, to: 6, h: 1.3, shape: 'round', color: C.bark },
    ],
    colors: { back: C.bark, flank: C.fishOlive, belly: C.fishBelly, fins: C.bark },
    backLine: 0.35,
    marks: () =>
      spots(
        [
          [8.4, 12, 0.9],
          [10.8, 12.8, 0.8],
          [12.6, 11.6, 1],
          [15, 12.6, 0.9],
          [9.6, 13.6, 0.6],
          [17, 11.8, 0.7],
        ],
        C.barkDark,
      ),
    gill: 18,
    eye: { x: 19.8, y: 11.4, r: 0.95 },
    mouth: 'M21.8 12.9l-2 .5',
    barbels: ['M20.6 14c.2.9 0 1.7-.6 2.3'],
  },
  {
    id: 'golden-trout',
    note: 'La Dorée: une truite couleur de miel, points rouges, et des éclats (mythique).',
    nose: [21.4, 13],
    cy: 12.8,
    ped: 6.6,
    ph: 1.4,
    top: { y: 9.2, a: 2, b: 5.6 },
    bot: { y: 16.4, a: 1.8, b: 5.4 },
    tail: { kind: 'square', len: 4, half: 3.4, fork: 1.2 },
    fins: [
      { side: 'top', from: 14.2, to: 11.8, h: 2.4, lean: 0.8 },
      { side: 'top', from: 8.8, to: 8, h: 1.2, shape: 'round' },
      { side: 'bottom', from: 12.6, to: 11, h: 1.8 },
      { side: 'bottom', from: 9.4, to: 8, h: 1.6 },
    ],
    colors: { back: C.brass, flank: C.paintYellow, belly: C.fishBelly, fins: C.titYellow },
    marks: () =>
      spots(
        [
          [10.6, 12.8, 0.8],
          [13.8, 12.4, 0.8],
          [12.2, 14.4, 0.65],
          [16, 13.4, 0.65],
          [9.4, 11.6, 0.55],
          [13, 10.9, 0.55],
        ],
        C.troutSpot,
        C.fishBelly,
      ),
    gill: 17.6,
    eye: { x: 19, y: 12, r: 1 },
    mouth: 'M21.4 13l-1.8.5',
    extra: sparkle(12.4, 5, 2, C.flame),
  },
  {
    id: 'moon-pike',
    note: 'Le Brochet de lune: un brochet pâle comme la lune, taches claires; un croissant de lune au-dessus de lui (mythique).',
    nose: [23, 13.6],
    cy: 13.4,
    ped: 4.8,
    ph: 1.3,
    top: { y: 11.4, a: 4.6, b: 6 },
    bot: { y: 15.6, a: 3.6, b: 6 },
    tail: { kind: 'fork', len: 3.4, half: 3.2, fork: 1.6 },
    fins: [
      { side: 'top', from: 8.6, to: 6, h: 2.6, lean: 0.4, shape: 'round' },
      { side: 'bottom', from: 8.6, to: 6.2, h: 2.2, shape: 'round' },
      { side: 'bottom', from: 13.6, to: 12.2, h: 1.4 },
    ],
    colors: { back: C.heronGrey, flank: C.featherWhite, belly: C.featherWhite, fins: C.heronGrey },
    backLine: 0.25,
    marks: () =>
      spots(
        [
          [8.4, 13, 0.55],
          [10.4, 12.6, 0.6],
          [12.6, 13.2, 0.6],
          [14.6, 12.7, 0.55],
          [11.4, 14.2, 0.5],
        ],
        C.stoneLight,
      ),
    gill: 17.4,
    eye: { x: 18.6, y: 12.4, r: 0.95 },
    mouth: 'M23 13.6l-5 .6',
    extra: `<path class="lpl-ik" d="M12.6 2.2a2.8 2.8 0 1 0 1.4 3.8 2.3 2.3 0 0 1-1.4-3.8z" fill="${C.glassLamp}"/>`,
  },
];

const LAMPREY_BODY =
  'M2.4 14.4C5 12 7 9.8 9.6 10.2c2.4.4 3.8 2.2 6 2 2-.2 3.4-2.2 5.2-2.2 1.6 0 2.2 1.2 2 2.4-.2 1.2-1.4 1.6-2.6 1.4-1.6-.2-2.6 1.6-4.8 1.8-2.6.2-3.8-2.2-5.8-2.2-2.2 0-4.2 2-7.2 1z';

/** Lamproie de Planer: pas d'écailles, pas de queue en éventail, une ventouse et sept pores. Dessinée à part. */
const LAMPREY = {
  id: 'brook-lamprey',
  note: "Lamproie de Planer: corps d'anguille, une ventouse ronde au bout, sept petits trous derrière l'œil, nageoire basse vers la queue.",
  body: [
    // Nageoire basse et continue vers la queue, puis le corps ondulé (pas de queue en éventail).
    `<path class="lpl-ik" d="M8.6 10.6c-2.4.4-4.4 1.8-6.8 4.2 2.4.8 4.4.4 6.6-.6z" fill="${C.woodOldDark}"/>`,
    `<path d="${LAMPREY_BODY}" fill="${C.rockLight}"/>`,
    `<path d="M2.4 14.4C5 12 7 9.8 9.6 10.2c2.4.4 3.8 2.2 6 2 2-.2 3.4-2.2 5.2-2.2 1.6 0 2.2 1.2 2 2.4" stroke="${C.woodOldDark}" stroke-width="1.8" stroke-linecap="round" fill="none"/>`,
    `<path class="lpl-ikf" d="${LAMPREY_BODY}"/>`,
    spots(
      [
        [19.4, 12.2, 0.32],
        [18.7, 12.5, 0.32],
        [18, 12.9, 0.32],
        [17.3, 13.2, 0.32],
        [16.6, 13.5, 0.32],
        [15.9, 13.7, 0.32],
        [15.2, 13.9, 0.32],
      ],
      C.ink,
    ),
    `<circle cx="22.1" cy="12.6" r="1.2" fill="${C.radishTip}" stroke="${C.ink}" stroke-width=".8"/>`,
    `<circle cx="20.6" cy="11.4" r=".8" fill="${C.ink}"/>`,
  ].join('\n    '),
};

/** Raretés: un fond teinté et un liseré, plus un ornement d'angle à partir de « rare». */
const RARITIES = [
  {
    id: 'common',
    note: 'commun: pierre claire, liseré simple',
    fill: C.stoneLight,
    edge: C.stoneDark,
    deco: '',
  },
  {
    id: 'rare',
    note: "rare: eau claire, liseré d'eau profonde, un point à chaque angle",
    fill: C.waterFoam,
    edge: C.waterDeep,
    deco: spots(
      [
        [3.4, 3.4, 0.9],
        [20.6, 3.4, 0.9],
        [3.4, 20.6, 0.9],
        [20.6, 20.6, 0.9],
      ],
      C.waterDeep,
    ),
  },
  {
    id: 'epic',
    note: 'épique: rose pâle, double liseré violet',
    fill: C.radishTip,
    edge: C.flowerViolet,
    deco: `<rect x="2.6" y="2.6" width="18.8" height="18.8" rx="2.8" fill="none" stroke="${C.flowerViolet}" stroke-width=".8"/>`,
  },
  {
    id: 'legendary',
    note: 'légendaire: bronze, liseré cuivre, angles en équerre',
    fill: C.logEnd,
    edge: C.copper,
    deco: fine('M2.4 6.4V2.4h4M17.6 2.4h4v4M21.6 17.6v4h-4M6.4 21.6h-4v-4', 1.3, C.copper),
  },
  {
    id: 'mythic',
    note: 'mythique: lueur dorée, liseré laiton, une étoile à chaque angle',
    fill: C.glassLamp,
    edge: C.brass,
    deco: [
      [3.6, 3.6],
      [20.4, 3.6],
      [3.6, 20.4],
      [20.4, 20.4],
    ]
      .map(([x, y]) => sparkle(x, y, 2.2, C.flame))
      .join(''),
  },
];

function raritySymbol(r) {
  return `<rect x=".9" y=".9" width="22.2" height="22.2" rx="4" fill="${r.fill}" stroke="${r.edge}" stroke-width="1.5"/>${r.deco}`;
}

/**
 * Robes de poule (reglages.hens.care.colors): portrait de profil tourné vers la gauche, tête et
 * poitrail; crête et barbillons rouges, bec jaune. La coucou est grise rayée de blanc; la dorée a le
 * camail plus sombre; la noire a un reflet vert (comme le coq).
 */
const HENS = [
  {
    id: 'white',
    note: 'la blanche',
    plume: C.chickenWhite,
    hackle: C.featherWhite,
    eyeRing: C.ink,
  },
  { id: 'red', note: 'la rousse', plume: C.chickenRusset, hackle: C.foxRed, eyeRing: C.ink },
  {
    id: 'black',
    note: 'la noire, reflet vert sur le camail',
    plume: C.chickenBlack,
    hackle: C.loco,
    eyeRing: C.featherWhite,
  },
  {
    id: 'golden',
    note: 'la dorée, camail cuivré',
    plume: C.owlBuff,
    hackle: C.copper,
    eyeRing: C.ink,
  },
  {
    id: 'ash',
    note: 'la cendrée',
    plume: C.gooseGrey,
    hackle: C.gooseGreyDark,
    eyeRing: C.featherWhite,
  },
  {
    id: 'cuckoo',
    note: 'la coucou, grise rayée de blanc',
    plume: C.heronGrey,
    hackle: C.heronGreyDark,
    eyeRing: C.featherWhite,
    bars: true,
  },
];

function henPortrait(h) {
  const silhouette = h.unknown === true;
  const body = silhouette ? C.rockLight : h.plume;
  const comb = silhouette ? C.rock : C.combRed;
  const beak = silhouette ? C.rock : C.beak;
  const parts = [];
  // Poitrail et dos (bas du portrait), puis le cou et la tête.
  parts.push(
    `<path class="lpl-ik" d="M3.4 21.6c-.4-4.4 1.6-8 4.8-9.8 4-.6 9 .8 11.6 4 1.4 1.8 1.6 3.8 1.2 5.8z" fill="${body}"/>`,
  );
  if (!silhouette) {
    parts.push(
      `<path d="M8.8 12c1.8 1.6 4.2 2.4 6.8 2.4" stroke="${h.hackle}" stroke-width="1.6" stroke-linecap="round" fill="none"/>`,
    );
    if (h.bars === true)
      parts.push(
        fine(
          'M5.8 16.4c2.8.8 5.6 1 8.2.6M4.6 19.4c3.2.8 6.8 1 10.4.4M11.6 13.6c1.4.6 3 .8 4.6.6',
          1.1,
          C.featherWhite,
        ),
      );
    // L'aile repliée: c'est elle qui fait lire un oiseau et non un pion.
    parts.push(fine('M9.2 17c2.6-1.4 6.2-1 8.8 1.4', 1.1));
  }
  parts.push(
    `<path class="lpl-ik" d="M6.6 13.6c-1.6-3-1.8-6.4 0-8.6 1.6-1.8 4.6-2 6.4-.2 1.6 1.6 1.8 4 1 6.2-.4 1.4-.2 2.6.6 3.6-2.6 1-5.8.8-8-1z" fill="${body}"/>`,
  );
  if (!silhouette && h.hackle !== h.plume) {
    parts.push(
      `<path d="M13.8 7.8c.4 1.8-.6 3.4-.4 5.4" stroke="${h.hackle}" stroke-width="1.4" stroke-linecap="round" fill="none"/>`,
    );
  }
  parts.push(
    `<path class="lpl-ik" d="M7.4 4.6c-.6-1.6.6-2.8 1.8-2 .4-1.4 2.2-1.4 2.4 0 1.2-.4 2 .8 1.2 2z" fill="${comb}"/>`,
  );
  parts.push(`<path class="lpl-ik" d="M6.2 7.2 3.2 8.4l3 1z" fill="${beak}"/>`);
  parts.push(
    `<path class="lpl-ik" d="M6.2 9.6c-.8 1-.6 2.4.4 2.6.6-.6.6-1.8 0-2.6z" fill="${comb}"/>`,
  );
  if (!silhouette)
    parts.push(
      `<circle cx="8.6" cy="7" r="1" fill="${C.ink}" stroke="${h.eyeRing}" stroke-width=".6"/>`,
    );
  return parts.join('\n    ');
}

const blocs = [];
blocs.push(DEBUT);
blocs.push(
  '  <!-- Poissons (0.12.2): tournés vers la droite, comme le poisson générique; une silhouette et des couleurs par espèce. -->',
);
for (const f of FISH.slice(0, 14))
  blocs.push(
    `  <!-- ${f.note} -->\n  <symbol id="fish-${f.id}" viewBox="0 0 24 24">\n    ${fish(f)}\n  </symbol>`,
  );
blocs.push(
  `  <!-- ${LAMPREY.note} -->\n  <symbol id="fish-${LAMPREY.id}" viewBox="0 0 24 24">\n    ${LAMPREY.body}\n  </symbol>`,
);
for (const f of FISH.slice(14))
  blocs.push(
    `  <!-- ${f.note} -->\n  <symbol id="fish-${f.id}" viewBox="0 0 24 24">\n    ${fish(f)}\n  </symbol>`,
  );
blocs.push(
  "  <!-- Raretés des poissons (0.12.2): fond et liseré à poser derrière l'icône du poisson (deux <use> superposés). -->",
);
for (const r of RARITIES)
  blocs.push(
    `  <!-- ${r.note} -->\n  <symbol id="rarity-${r.id}" viewBox="0 0 24 24">\n    ${raritySymbol(r)}\n  </symbol>`,
  );
blocs.push(
  "  <!-- Robes de poule (0.12.2): portraits de profil, tournés vers la gauche comme l'icône « hen ». -->",
);
for (const h of HENS)
  blocs.push(
    `  <!-- ${h.note} -->\n  <symbol id="hen-${h.id}" viewBox="0 0 24 24">\n    ${henPortrait(h)}\n  </symbol>`,
  );
blocs.push(
  `  <!-- robe à trouver: la silhouette grise, sans œil ni couleur -->\n  <symbol id="hen-unknown" viewBox="0 0 24 24">\n    ${henPortrait({ unknown: true })}\n  </symbol>`,
);
blocs.push(FIN);

const source = readFileSync(fichierSource, 'utf8');
const posDebut = source.indexOf(DEBUT);
const posFin = source.indexOf(FIN);
const bloc = `${blocs.join('\n')}\n`;
let sortie;
if (posDebut >= 0 && posFin > posDebut) {
  sortie = source.slice(0, posDebut) + bloc + source.slice(posFin + FIN.length + 1);
} else {
  // Première fois: le bloc se place juste avant les vignettes des souvenirs.
  const ancre = source.indexOf('  <!-- Vignettes des souvenirs');
  if (ancre < 0) throw new Error('ancre des vignettes introuvable dans icones-source.svg');
  sortie = source.slice(0, ancre) + bloc + '\n' + source.slice(ancre);
}
writeFileSync(fichierSource, sortie, 'utf8');
const nombre = (bloc.match(/<symbol /g) ?? []).length;
process.stdout.write(`icones-source.svg: bloc des familles réécrit (${nombre} symboles)\n`);
