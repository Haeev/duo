/**
 * Écrit les sources des vignettes de sachets de graines de fleurs (`vignettes/graines-<fleur>.svg`)
 * et des légumes du potager semés en graines (carotte, poireau):
 * le sachet de papier de la famille (celui de `graines-radis`), une bande de couleur, la fleur
 * dessinée en petit sur le devant et quelques graines tombées, propres à chaque espèce.
 * On modifie ce script, pas les SVG écrits.
 *
 *   node assets-src/interface-encre/generer-sachets.mjs [id,id,...]
 * puis `generer-images.mjs vignettes <id>,...` pour l'encrage.
 *
 * Ajouter un sachet: une entrée dans `SACHETS` (bande, dessin de la fleur centré vers 47,56 dans
 * un rayon de 14, graines tombées, inclinaison, commentaire).
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Graines tombées: trois petites formes posées en bas à droite, hors du sachet. */
const grains = (fill, shape = 'ovale') => {
  const at = [
    [78, 88, -20],
    [87, 83, 30],
    [85, 92, 10],
  ];
  if (shape === 'rond')
    return `<g data-w="0.45" fill="${fill}">${at.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6"/>`).join('')}</g>`;
  if (shape === 'raye')
    return `<g data-w="0.45" fill="${fill}">${at.map(([x, y]) => `<path d="M${x - 2.4} ${y + 3} L${x} ${y - 4} L${x + 2.4} ${y + 3} Z"/>`).join('')}</g><g data-w="0" fill="#F3EDE0">${at.map(([x, y]) => `<path d="M${x - 0.4} ${y + 2.6} L${x} ${y - 2.4} L${x + 0.4} ${y + 2.6} Z"/>`).join('')}</g>`;
  if (shape === 'croissant')
    return `<g data-w="0.45" fill="${fill}">${at.map(([x, y]) => `<path d="M${x - 3} ${y} Q${x} ${y - 5} ${x + 3} ${y} Q${x} ${y - 2} ${x - 3} ${y} Z"/>`).join('')}</g>`;
  return `<g data-w="0.45" fill="${fill}">${at.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3" ry="2"/>`).join('')}</g>`;
};

/** Petits dessins de fleurs, à l'échelle du devant du sachet. */
const SACHETS = {
  'graines-capucine': {
    note: 'Sachet de graines de capucine: bande orange, capucine en cornet et feuille ronde, grosses graines ridées vert-brun.',
    bande: '#D9822E',
    tourne: 6,
    fleur: `<circle cx="38" cy="64" r="8" fill="#9DBB5B" data-w="0.55"/>
    <g data-teinte="#40592D" data-w="0.28" fill="none" stroke="#000"><path d="M38 64 L32 58 M38 64 L44 60 M38 64 L38 72"/></g>
    <path id="fleur" d="M50 62 Q38 60 38 50 Q40 42 48 44 Q52 38 58 42 Q66 44 62 52 Q64 60 50 62 Z" fill="#D9822E"/>
    <path data-clip="fleur" data-w="0" d="M60 40 Q68 60 48 66 L70 66 L70 40 Z" fill="#B8704E"/>
    <path d="M58 46 L66 38 L62 48 Z" fill="#D9822E" data-w="0.45"/>
    <circle cx="51" cy="52" r="2.4" fill="#F2C55C" data-w="0.35"/>`,
    graines: grains('#8D8A4E', 'rond'),
  },
  'graines-souci': {
    note: 'Sachet de graines de souci: bande jaune, souci rond à pétales serrés, graines en croissant brunes.',
    bande: '#F2C55C',
    tourne: -6,
    fleur: `<path id="fleur" d="M47 41 L51 46 L56 43 L57 49 L63 49 L60 54 L64 58 L58 60 L59 66 L53 64 L50 70 L47 65 L42 69 L41 63 L35 63 L37 58 L32 54 L37 51 L35 45 L41 47 L42 42 Z" fill="#FFC264"/>
    <path data-clip="fleur" data-w="0" d="M58 40 Q68 64 44 72 L70 72 L70 40 Z" fill="#D9822E"/>
    <circle cx="48" cy="56" r="5.6" fill="#C0803A" data-w="0.45"/>
    <path data-w="0.6" fill="none" stroke="#000" d="M48 68 L48 78"/>`,
    graines: grains('#8C6F4E', 'croissant'),
  },
  'graines-pensee': {
    note: 'Sachet de graines de pensée: bande violette, pensée de face (deux pétales violets, trois jaunes, figure sombre), graines minuscules brunes.',
    bande: '#7E3F55',
    tourne: 7,
    fleur: `<path d="M46 52 Q34 52 34 44 Q36 38 44 40 Q48 42 47 52 Z" fill="#7E3F55" data-w="0.5"/>
    <path d="M48 52 Q48 42 52 40 Q60 38 62 44 Q62 52 50 52 Z" fill="#7E3F55" data-w="0.5"/>
    <path id="bas" d="M48 50 Q60 52 62 60 Q60 70 48 70 Q36 70 34 60 Q36 52 48 50 Z" fill="#F2C55C"/>
    <path data-clip="bas" data-w="0" d="M30 66 Q48 74 66 66 L66 76 L30 76 Z" fill="#7E3F55"/>
    <path data-w="0" d="M48 52 Q54 54 54 58 Q52 62 48 63 Q44 62 42 58 Q42 54 48 52 Z" fill="#45324F"/>
    <circle cx="48" cy="53" r="1.8" fill="#F2C55C" data-w="0.3"/>`,
    graines: grains('#8C5A35', 'rond'),
  },
  'graines-giroflee': {
    note: 'Sachet de graines de giroflée: bande brique, tige à trois petites fleurs brique à quatre pétales, graines plates brunes.',
    bande: '#A85837',
    tourne: -8,
    fleur: `<path data-w="0.6" fill="none" stroke="#000" d="M48 46 Q47 62 46 78"/>
    <path d="M47 70 Q38 66 34 60 Q42 62 47 66 Z" fill="#6E9241" data-w="0.45"/>
    <g data-w="0.5" fill="#A85837"><path d="M40 50 l-4 -3 l3 -4 l4 2 l3 -3 l3 4 l-3 3 l2 4 l-4 2 l-2 -4 Z"/><path d="M54 52 l-4 -3 l3 -4 l4 2 l3 -3 l3 4 l-3 3 l2 4 l-4 2 l-2 -4 Z"/><path d="M47 62 l-4 -3 l3 -4 l4 2 l3 -3 l3 4 l-3 3 l2 4 l-4 2 l-2 -4 Z"/></g>
    <g data-w="0" fill="#C0803A"><circle cx="42" cy="48" r="1.4"/><circle cx="56" cy="50" r="1.4"/><circle cx="49" cy="60" r="1.4"/></g>
    <ellipse cx="48" cy="42" rx="2.4" ry="3.4" fill="#6E9241" data-w="0.45"/>`,
    graines: grains('#96704C'),
  },
  'graines-bleuet': {
    note: 'Sachet de graines de bleuet: bande bleue, bleuet étoilé en dentelle, graines grises à aigrette.',
    bande: '#44618A',
    tourne: 5,
    fleur: `<path data-w="0.6" fill="none" stroke="#000" d="M48 64 L46 78"/>
    <path id="fleur" d="M48 40 L50 46 L54 41 L54 48 L60 45 L58 51 L64 52 L58 55 L62 60 L55 59 L55 66 L50 61 L46 66 L45 59 L38 61 L41 55 L34 53 L40 50 L36 45 L43 47 L43 41 L46 46 Z" fill="#44618A"/>
    <path data-clip="fleur" data-w="0" d="M56 38 Q68 60 44 70 L70 70 L70 38 Z" fill="#2C3B57"/>
    <circle cx="48" cy="53" r="3.4" fill="#2C3B57" data-w="0.4"/>`,
    graines: grains('#B6A890'),
  },
  'graines-tournesol': {
    note: 'Sachet de graines de tournesol: bande moutarde, tournesol (couronne jaune, cœur brun), graines rayées noir et blanc.',
    bande: '#D4A33E',
    tourne: -7,
    fleur: `<path id="fleur" d="M48 38 L51 44 L56 40 L56 46 L62 45 L59 50 L65 53 L59 56 L62 61 L56 61 L56 67 L51 63 L48 69 L45 63 L40 67 L40 61 L34 61 L37 56 L31 53 L37 50 L34 45 L40 46 L40 40 L45 44 Z" fill="#F2C55C"/>
    <path data-clip="fleur" data-w="0" d="M58 38 Q68 62 44 72 L70 72 L70 38 Z" fill="#D4A33E"/>
    <circle cx="48" cy="53" r="8" fill="#5E4233" data-w="0.5"/>
    <g data-w="0" fill="#8C5A35"><circle cx="45" cy="51" r="1"/><circle cx="50" cy="50" r="1"/><circle cx="47" cy="55" r="1"/><circle cx="51" cy="55" r="1"/></g>`,
    graines: grains('#26282E', 'raye'),
  },
  'graines-nigelle': {
    note: 'Sachet de graines de nigelle: bande bleu ciel, nigelle à cinq pétales dans sa collerette de fils verts, graines noires anguleuses.',
    bande: '#A9C7D9',
    tourne: 8,
    fleur: `<g data-teinte="#6E9241" data-w="0.4" fill="none" stroke="#000"><path d="M48 54 Q38 50 32 52 M48 54 Q38 60 34 66 M48 54 Q58 60 62 66 M48 54 Q58 50 64 52 M48 54 Q42 44 40 38 M48 54 Q54 44 56 38"/></g>
    <path id="fleur" d="M48 42 Q51 48 50 50 Q56 46 60 48 Q56 54 52 55 Q57 59 58 64 Q52 63 49 59 Q48 65 44 68 Q43 62 45 58 Q40 61 34 60 Q38 55 43 53 Q38 50 37 45 Q43 47 46 50 Q45 46 48 42 Z" fill="#A9C7D9"/>
    <path data-clip="fleur" data-w="0" d="M54 42 Q64 60 44 70 L70 70 L70 42 Z" fill="#587F8E"/>
    <circle cx="48" cy="54" r="3" fill="#9DBB5B" data-w="0.4"/>`,
    graines: grains('#231A17'),
  },
  'graines-marguerite': {
    note: 'Sachet de graines de marguerite: bande verte, marguerite (pétales blancs en rayons, cœur jaune), toutes petites graines claires.',
    bande: '#6E9241',
    tourne: -5,
    fleur: `<path data-w="0.6" fill="none" stroke="#000" d="M48 62 L47 78"/>
    <path id="fleur" d="M48 40 Q51 40 50 49 Q54 41 57 43 Q58 46 52 51 Q60 47 61 51 Q60 54 52 54 Q61 57 59 60 Q56 61 51 56 Q55 64 52 66 Q49 66 48 57 Q46 66 43 66 Q40 64 45 56 Q39 61 37 60 Q35 57 44 54 Q36 54 35 51 Q36 47 44 51 Q38 46 39 43 Q42 41 46 49 Q45 40 48 40 Z" fill="#F7F3EA"/>
    <path data-clip="fleur" data-w="0" d="M56 40 Q66 60 44 70 L70 70 L70 40 Z" fill="#D9CAAE"/>
    <circle cx="48" cy="53" r="4" fill="#F2C55C" data-w="0.4"/>`,
    graines: grains('#B8A17E'),
  },
  'graines-oeillet': {
    note: "Sachet de graines d'œillet de poète: bande coquelicot, tête de petits œillets rouges bordés de blanc, graines plates noires.",
    bande: '#C5443D',
    tourne: 6,
    fleur: `<path data-w="0.6" fill="none" stroke="#000" d="M48 64 L47 78"/>
    <path d="M34 56 Q34 42 48 42 Q62 42 62 56 Q60 64 48 64 Q36 64 34 56 Z" fill="#40592D" data-w="0.5"/>
    <g data-w="0" fill="#F3EDE0"><circle cx="41" cy="50" r="5"/><circle cx="55" cy="50" r="5"/><circle cx="48" cy="58" r="5"/></g>
    <g data-w="0" fill="#C5443D"><circle cx="41" cy="50" r="3.4"/><circle cx="55" cy="50" r="3.4"/><circle cx="48" cy="58" r="3.4"/></g>
    <g data-w="0" fill="#8F3B34"><circle cx="41" cy="50" r="1.3"/><circle cx="55" cy="50" r="1.3"/><circle cx="48" cy="58" r="1.3"/></g>`,
    graines: grains('#3A3331'),
  },
  // Semences du potager: même sachet, le légume dessiné à la place de la fleur.
  'graines-carotte': {
    note: 'Sachet de graines de carotte: bande ocre, carotte en biais avec ses fanes, graines minuscules brun clair.',
    bande: '#C0803A',
    tourne: -6,
    fleur: `<g data-w="0.45" fill="#6E9241"><path d="M54 46 Q54 36 58 32 Q60 40 57 47 Z"/><path d="M56 47 Q62 38 68 38 Q64 46 58 49 Z"/><path d="M53 46 Q48 38 50 32 Q55 38 55 46 Z"/></g>
    <path id="fleur" d="M52 46 Q58 46 60 52 L40 72 Q37 74 36 71 Z" fill="#D9822E"/>
    <path data-clip="fleur" data-w="0" d="M60 50 L64 54 L40 76 L38 72 Z" fill="#A85837"/>
    <g data-teinte="#A85837" data-w="0.3" fill="none" stroke="#000"><path d="M47 56 l3 3 M43 62 l3 2"/></g>`,
    graines: grains('#B8A17E'),
  },
  'graines-poireau': {
    note: 'Sachet de graines de poireau: bande vert bouteille, poireau debout (fût blanc, feuilles vertes en éventail, radicelles), graines noires.',
    bande: '#3F6453',
    tourne: 6,
    fleur: `<g data-w="0.45" fill="#6E9241"><path d="M46 56 Q38 46 34 40 Q42 42 48 52 Z"/><path d="M50 56 Q58 46 64 42 Q58 52 52 58 Z"/></g>
    <path d="M46 56 Q44 44 46 38 Q52 44 51 56 Z" fill="#40592D" data-w="0.45"/>
    <path id="fleur" d="M45 55 L51 55 L51 72 Q48 75 45 72 Z" fill="#F3EDE0"/>
    <path data-clip="fleur" data-w="0" d="M45 55 L51 55 L51 61 L45 61 Z" fill="#B9C76A"/>
    <g data-w="0.4" fill="none" stroke="#000"><path d="M47 74 L45 78 M48 74 L48 79 M49 74 L51 78"/></g>`,
    graines: grains('#231A17', 'croissant'),
  },
};

const sachet = (
  id,
  s,
) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" data-trait="5.2" data-pas="0.6" data-tremble="0.35" data-halo="3.6">
  <!-- ${s.note} Écrit par generer-sachets.mjs: modifier le script, pas ce fichier. -->
  <g transform="rotate(${String(s.tourne)} 48 48)">
    <path id="sachet" d="M22 18 L30 14 L38 19 L46 13 L54 18 L62 13 L70 18 L74 84 L20 86 Z" fill="#F5E6C6"/>
    <path data-clip="sachet" data-w="0" d="M60 10 L80 10 L80 90 L40 90 Q66 60 60 10 Z" fill="#DDC59C"/>
    <g data-clip="sachet" data-teinte="#A88C6C" data-w="0.3" fill="none" stroke="#000"><path d="M22 40 L28 40 M66 46 L72 46 M24 80 L30 74"/></g>
    <path d="M24 26 L71 24 L72 32 L25 34 Z" fill="${s.bande}" data-w="0.6"/>
    ${s.fleur.replace(/id="(fleur|bas)"/g, 'id="$1" data-w="0.5"')}
    <g data-w="0.4" fill="none" stroke="#000"><path d="M28 81 L40 81"/></g>
  </g>
  ${s.graines}
</svg>
`;

const only = process.argv[2]?.split(',');
for (const [id, s] of Object.entries(SACHETS)) {
  if (only !== undefined && !only.includes(id)) continue;
  writeFileSync(path.join(here, 'vignettes', `${id}.svg`), sachet(id, s));
  process.stdout.write(`${id}\n`);
}
