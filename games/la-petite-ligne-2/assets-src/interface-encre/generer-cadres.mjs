/**
 * Génère `cadres.css`: les cadres du style « encré », thème sombre (retour du client du
 * 2026-11-10: « plus sombre, moins encré »). Panneaux presque noirs, liseré fin et clair, bords un
 * peu irréguliers et anguleux mais nets; ombre en aplat sombre, sans hachures ni second trait.
 * Le trait vivant reste aux vignettes, pictos et portraits.
 *
 * Lancer depuis le paquet: `node assets-src/interface-encre/generer-cadres.mjs`, puis
 * `prettier --write src/interface/encre/cadres.css`. Le tirage est fixe (graine par cadre): deux
 * lancements donnent le même fichier. Pour un nouveau cadre: une ligne dans `FRAMES`.
 *
 * Principe: une image SVG sans dimensions propres, étirée par `border-image` (découpe 0, `fill`)
 * sur la boîte et son débord. Tout y est en pixels comptés depuis les bords (svg imbriqués ancrés
 * à 100 %): le trait garde son épaisseur quelle que soit la taille de la boîte, et rien ne se
 * raccorde, donc aucune couture. `encre.css` donne à chaque taille son débord (`--bi-*`), qui doit
 * rester égal à `out` et `out + shadow` ci-dessous.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Couleurs: les mêmes que les variables de `encre.css` (une image ne lit pas les variables). */
const INK = '#9c8a6c';
const SHADOW = '#0b0908';
const FILLS = {
  papier: '#2a2421',
  page: '#221d1b',
  creux: '#171413',
  accent: '#ffc83d',
  encre: '#f0e4c8',
  nuit: '#1b2238',
  tilleul: '#26302a',
  ciel: '#1e2a33',
};
/** Liseré par fond: clair sur le sombre, plus chaud sur l'accent, éteint sur les tirets. */
const LINES = { accent: '#ffe7a3', creux: '#6e604f' };

/**
 * Tailles (px): `ink` épaisseur du trait, `out` débord du cadre hors de la boîte, `shadow`
 * décalage de l'ombre, `skew` écart des coins, `over` dépassement des traits aux coins, `bends`
 * nombre de cassures d'un grand bord.
 */
const SIZES = {
  grand: { ink: 2.2, out: 6, shadow: 9, skew: 1.4, over: 0, bends: 2 },
  moyen: { ink: 1.9, out: 5, shadow: 6, skew: 1.1, over: 0, bends: 1 },
  petit: { ink: 1.6, out: 4, shadow: 5, skew: 0.8, over: 0, bends: 0 },
};

/** Écart (px) entre la case et le second trait de plume des cadres de focus. */
const HALO = 6;

/** nom, taille, fond, ombre en hachures, trait en tirets (refus, vide), second trait (focus). */
const FRAMES = [
  ['grand-papier-ombre', 'grand', 'papier', true, false],
  ['grand-tilleul-ombre', 'grand', 'tilleul', true, false],
  ['moyen-papier-ombre', 'moyen', 'papier', true, false],
  ['moyen-papier-ombre-b', 'moyen', 'papier', true, false],
  ['moyen-accent-ombre', 'moyen', 'accent', true, false],
  ['moyen-nuit-ombre', 'moyen', 'nuit', true, false],
  ['moyen-ciel', 'moyen', 'ciel', false, false],
  ['moyen-tirets', 'moyen', 'creux', false, true],
  ['petit-papier', 'petit', 'papier', false, false],
  ['petit-papier-b', 'petit', 'papier', false, false],
  ['petit-papier-ombre', 'petit', 'papier', true, false],
  ['petit-papier-ombre-b', 'petit', 'papier', true, false],
  ['petit-creux', 'petit', 'creux', false, false],
  ['petit-accent', 'petit', 'accent', false, false],
  ['petit-accent-ombre', 'petit', 'accent', true, false],
  ['petit-encre', 'petit', 'encre', false, false],
  ['petit-tirets', 'petit', 'creux', false, true],
  ['petit-focus', 'petit', 'accent', false, false, true],
  ['moyen-focus', 'moyen', 'accent', true, false, true],
];

/** Générateur pseudo-aléatoire à graine (mulberry32): le fichier produit est stable. */
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedOf(name) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i += 1) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const r1 = (n) => Math.round(n * 10) / 10;

/**
 * Un bord: des segments de plume entre le coin de départ et le coin d'arrivée. `near` et `far`
 * sont les distances (px) du trait aux deux bords de l'image dans l'axe du bord (côté départ,
 * côté arrivée), `depth` sa distance au bord de l'image en travers, `anchorFar` dit si ce bord
 * est compté depuis le bord opposé (droite, bas). Les positions le long du bord mêlent pixels et
 * pourcentages grâce à un svg imbriqué décalé; en travers, tout est en pixels.
 */
function edge(rnd, s, horizontal, anchorFar, near, far, depth, dashed) {
  const jitter = () => (rnd() * 2 - 1) * s.skew;
  const overStart = rnd() * s.over;
  const overEnd = rnd() * s.over;
  const shift = far - overEnd;
  // Points du trait: [position le long du bord, écart vers l'extérieur].
  const stops = [[`${r1(near - overStart + shift)}`, jitter()]];
  for (let i = 1; i <= s.bends; i += 1) {
    const at = (i + (rnd() - 0.5) * 0.5) / (s.bends + 1);
    stops.push([`${r1(at * 100)}%`, jitter() * 0.8]);
  }
  stops.push(['100%', jitter()]);
  const across = (d) => r1(anchorFar ? -depth + d : depth - d);
  const lines = [];
  for (let i = 0; i + 1 < stops.length; i += 1) {
    const [a, da] = stops[i];
    const [b, db] = stops[i + 1];
    const draw = (d0, d1, width) => {
      const [p0, p1] = [across(d0), across(d1)];
      const coords = horizontal
        ? `x1='${a}' y1='${p0}' x2='${b}' y2='${p1}'`
        : `x1='${p0}' y1='${a}' x2='${p1}' y2='${b}'`;
      lines.push(`<line ${coords} stroke-width='${r1(width)}'/>`);
    };
    draw(da, db, s.ink);
    if (!dashed && s.double === true) {
      // Second passage de plume, vers l'intérieur: le trait s'épaissit vers un coin (jamais à
      // une cassure, où les deux segments doivent se rejoindre).
      const swell = s.ink * (0.3 + rnd() * 0.3);
      const first = i === 0;
      const last = i + 2 === stops.length;
      if (first && (!last || rnd() < 0.5)) draw(da - swell, db, s.ink * 0.72);
      else if (last) draw(da, db - swell, s.ink * 0.72);
    }
  }
  const place = horizontal
    ? `x='${r1(-shift)}' width='100%'${anchorFar ? " y='100%'" : ''}`
    : `y='${r1(-shift)}' height='100%'${anchorFar ? " x='100%'" : ''}`;
  return `<svg ${place} overflow='visible'>${lines.join('')}</svg>`;
}

function frameSvg(name, sizeName, fillName, shadow, dashed, halo = false) {
  const s = SIZES[sizeName];
  const rnd = random(seedOf(name));
  // Le milieu du trait passe à `lead` du bord de l'image, et l'encre mord d'un pixel sur la boîte.
  const lead = s.out - s.ink / 2 + 1 + (halo ? HALO : 0);
  const trail = lead + (shadow ? s.shadow : 0);
  const size = `width:calc(100% - ${r1(lead + trail)}px);height:calc(100% - ${r1(lead + trail)}px)`;
  const parts = [];
  if (shadow) {
    // Ombre portée en aplat sombre, décalée de moitié: elle pose la case sans la doubler.
    const d = r1(s.shadow * 0.5);
    parts.push(
      `<rect x='${r1(lead + d)}' y='${r1(lead + d)}' style='${size}' fill='${SHADOW}' fill-opacity='0.55'/>`,
    );
  }
  parts.push(`<rect x='${r1(lead)}' y='${r1(lead)}' style='${size}' fill='${FILLS[fillName]}'/>`);
  if (fillName === 'ciel') {
    // Vitrine: une trame de points dans le tiers bas, comme une ombre imprimée sous l'objet.
    parts.push(
      `<pattern id='p' width='7' height='7' patternUnits='userSpaceOnUse'><circle cx='2' cy='2' r='1.1' fill='%23000' fill-opacity='0.35'/><circle cx='5.5' cy='5.5' r='1.1' fill='%23000' fill-opacity='0.35'/></pattern>`,
      `<rect x='${r1(lead)}' y='68%' style='width:calc(100% - ${r1(lead + trail)}px);height:calc(32% - ${r1(trail)}px)' fill='url(%23p)'/>`,
    );
  }
  if (sizeName === 'grand' && s.double === true) {
    // Quelques hachures dans le coin bas droit de la case, comme une ombre portée du bord.
    const strokes = [];
    for (let i = 1; i <= 7; i += 1) {
      const k = i * 7 + rnd() * 3;
      const inset = trail + 3;
      strokes.push(`M${r1(-inset - k)} ${r1(-inset)}l${r1(k)} ${r1(-k)}`);
    }
    parts.push(
      `<svg x='100%' y='100%' overflow='visible'><path d='${strokes.join('')}' stroke='${INK}' stroke-opacity='0.3' stroke-width='2' stroke-linecap='round' fill='none'/></svg>`,
    );
  }
  const dash = dashed ? ` stroke-dasharray='${r1(s.ink * 2.4)} ${r1(s.ink * 2.2)}'` : '';
  const line = LINES[fillName] ?? INK;
  parts.push(
    `<g stroke='${line}' stroke-linecap='${dashed ? 'butt' : 'square'}'${dash}>`,
    edge(rnd, s, true, false, lead, trail, lead, dashed),
    edge(rnd, s, false, true, lead, trail, trail, dashed),
    edge(rnd, s, true, true, lead, trail, trail, dashed),
    edge(rnd, s, false, false, lead, trail, lead, dashed),
    '</g>',
  );
  if (halo) {
    // Second trait fin, d'accent, autour de la case: le focus se lit aussi sans la couleur.
    const pen = { ink: 1.6, skew: 0.8, over: 0, bends: s.bends };
    const [near, far] = [2.6, trail - lead + 2.6];
    parts.push(
      `<g stroke='${FILLS.accent}' stroke-linecap='square'>`,
      edge(rnd, pen, true, false, near, far, near, false),
      edge(rnd, pen, false, true, near, far, far, false),
      edge(rnd, pen, true, true, near, far, far, false),
      edge(rnd, pen, false, false, near, far, near, false),
      '</g>',
    );
  }
  return `<svg xmlns='http://www.w3.org/2000/svg'>${parts.join('')}</svg>`;
}

const encode = (svg) => svg.replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E');

const lines = FRAMES.map(([name, size, fill, shadow, dashed, halo]) => {
  const svg = encode(frameSvg(name, size, fill, shadow, dashed, halo));
  return `  --cadre-${name}: url("data:image/svg+xml,${svg}");`;
});
const outsets = Object.entries(SIZES).flatMap(([name, s]) => [
  `  --bi-${name}: 0 fill / 0 / ${s.out}px stretch;`,
  `  --bi-${name}-ombre: 0 fill / 0 / ${s.out}px ${s.out + s.shadow}px ${s.out + s.shadow}px ${s.out}px stretch;`,
  `  --bi-${name}-focus: 0 fill / 0 / ${s.out + HALO}px stretch;`,
  `  --bi-${name}-focus-ombre: 0 fill / 0 / ${s.out + HALO}px ${s.out + HALO + s.shadow}px ${s.out + HALO + s.shadow}px ${s.out + HALO}px stretch;`,
]);

const css = `/*
 * Cadres encrés du style « encré ». Fichier généré par assets-src/interface-encre/generer-cadres.mjs: ne pas le retoucher à
 * la main (changer le script, relancer, repasser Prettier).
 * Usage: border-image: var(--cadre-<taille>-<fond>[-ombre]) var(--bi-<taille>[-ombre]);
 */
[data-lpl-style='encre'] .lpl-ui {
${outsets.join('\n')}
${lines.join('\n')}
}
`;

writeFileSync(fileURLToPath(new URL('../../src/interface/encre/cadres.css', import.meta.url)), css);
