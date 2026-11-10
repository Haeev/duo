/**
 * Crée un contenu à partir de son gabarit commenté (`donnees/_gabarits/`):
 *   pnpm nouveau meuble chaise
 *   pnpm nouveau habitant facteur aubrune
 *   pnpm nouveau lieu hautefonte
 * Le fichier créé est le gabarit sans ses commentaires, avec l'identifiant demandé. Il reste à
 * remplir ses champs, puis `pnpm test` dit ce qui cloche. Lancé par Node tel quel (types effacés).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Template {
  /** Fichiers du gabarit, relatifs à `donnees/_gabarits/`, et nom du fichier créé (`<id>`: l'identifiant). */
  readonly files: readonly { readonly from: string; readonly to: string }[];
  /** Dossier d'arrivée, relatif à `donnees/` (`<lieu>`: le lieu donné en troisième argument). */
  readonly folder: string;
  /** Le contenu appartient à un lieu. */
  readonly inPlace: boolean;
  /** Le contenu est une entrée d'un tableau d'un fichier existant, et non un fichier à lui. */
  readonly into?: { readonly file: string; readonly array: string };
}

/** Les types de contenu: chacun a son schéma, son gabarit et sa recette dans `donnees/README.md`. */
export const TEMPLATES: Readonly<Record<string, Template>> = {
  objet: {
    files: [{ from: 'objet.jsonc', to: '<id>.json' }],
    folder: 'commun/objets',
    inPlace: false,
  },
  meuble: {
    files: [{ from: 'meuble.jsonc', to: '<id>.json' }],
    folder: 'commun/meubles',
    inPlace: false,
  },
  'piece-de-personnage': {
    files: [{ from: 'piece-de-personnage.jsonc', to: '<id>.json' }],
    folder: 'commun/personnages',
    inPlace: false,
    // Entrée du catalogue: le générateur de pièces (lot L5) l'écrit d'ordinaire lui-même, avec le maillage.
    into: { file: 'commun/personnages/catalogue.json', array: 'pieces' },
  },
  recette: {
    files: [{ from: 'recette.jsonc', to: '<id>.json' }],
    folder: 'commun/recettes',
    inPlace: false,
  },
  plan: {
    files: [{ from: 'plan.jsonc', to: '<id>.json' }],
    folder: 'commun/plans',
    inPlace: false,
  },
  prise: {
    files: [{ from: 'prise.jsonc', to: '<id>.json' }],
    folder: 'commun/prises',
    inPlace: false,
  },
  culture: {
    files: [{ from: 'culture.jsonc', to: '<id>.json' }],
    folder: 'commun/cultures',
    inPlace: false,
  },
  espece: {
    files: [{ from: 'espece.jsonc', to: '<id>.json' }],
    folder: 'commun/especes',
    inPlace: false,
  },
  abri: {
    files: [{ from: 'abri.jsonc', to: '<id>.json' }],
    folder: 'commun/meubles',
    inPlace: false,
  },
  ressource: {
    files: [{ from: 'ressource.jsonc', to: '<id>.json' }],
    folder: 'commun/ressources',
    inPlace: false,
  },
  'entree-de-collection': {
    files: [{ from: 'entree-de-collection.jsonc', to: '<id>.json' }],
    folder: 'commun/carnet',
    inPlace: false,
  },
  insecte: {
    files: [{ from: 'insecte.jsonc', to: '<id>.json' }],
    folder: 'commun/insectes',
    inPlace: false,
  },
  'sujet-photo': {
    files: [{ from: 'sujet-photo.jsonc', to: '<id>.json' }],
    folder: 'commun/photos',
    inPlace: false,
  },
  evenement: {
    files: [{ from: 'evenement.jsonc', to: '<id>.json' }],
    folder: 'lieux/<lieu>/evenements',
    inPlace: true,
  },
  habitant: {
    files: [{ from: 'habitant.jsonc', to: '<id>.json' }],
    folder: 'lieux/<lieu>/habitants',
    inPlace: true,
  },
  dialogue: {
    files: [{ from: 'dialogue.jsonc', to: '<id>.json' }],
    folder: 'lieux/<lieu>/dialogues',
    inPlace: true,
  },
  commerce: {
    files: [{ from: 'commerce.jsonc', to: '<id>.json' }],
    folder: 'lieux/<lieu>/commerces',
    inPlace: true,
  },
  logement: {
    files: [{ from: 'logement.jsonc', to: '<id>.json' }],
    folder: 'lieux/<lieu>/logements',
    inPlace: true,
  },
  quete: {
    files: [{ from: 'quete.jsonc', to: '<id>.json' }],
    folder: 'lieux/<lieu>/quetes',
    inPlace: true,
  },
  interieur: {
    files: [{ from: 'interieur.jsonc', to: '<id>.json' }],
    folder: 'lieux/<lieu>/interieurs',
    inPlace: true,
  },
  scene: {
    files: [{ from: 'scene.jsonc', to: '<id>.json' }],
    folder: 'lieux/<lieu>/scenes',
    inPlace: true,
  },
  lieu: {
    files: [
      { from: 'lieu/lieu.jsonc', to: 'lieu.json' },
      { from: 'lieu/carte.jsonc', to: 'carte.json' },
    ],
    folder: 'lieux/<id>',
    inPlace: false,
  },
};

const ID = /^[a-z][a-z0-9-]{0,39}$/;

/**
 * Rend un gabarit lisible par `JSON.parse`: sans ses lignes de commentaire (`//` en début de
 * ligne) ni les virgules finales que Prettier ajoute aux fichiers `.jsonc`.
 */
export function stripComments(text: string): string {
  return text
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n')
    .replace(/,(\s*[}\]])/g, '$1');
}

/** Le contenu d'un gabarit, lu comme du JSON, avec l'identifiant voulu s'il en porte un. */
export function fromTemplate(text: string, id: string): Record<string, unknown> {
  const value = JSON.parse(stripComments(text)) as Record<string, unknown>;
  if ('id' in value) value.id = id;
  return value;
}

export interface PlannedFile {
  /** Fichier à créer, ou fichier existant à compléter quand `array` est donné. */
  readonly path: string;
  readonly value: Record<string, unknown>;
  readonly array: string | null;
}

/** Chemins (relatifs à `donnees/`) et contenus des fichiers à créer ou à compléter. */
export function plan(
  templates: string,
  type: string,
  id: string,
  place: string | null,
): PlannedFile[] {
  const template = TEMPLATES[type];
  if (template === undefined)
    throw new Error(`type inconnu « ${type} » (connus: ${Object.keys(TEMPLATES).join(', ')})`);
  if (!ID.test(id))
    throw new Error(
      `identifiant « ${id} »: minuscules, chiffres et traits d'union, 40 caractères au plus`,
    );
  if (template.inPlace && (place === null || !ID.test(place)))
    throw new Error(`le type « ${type} » demande un lieu: pnpm nouveau ${type} ${id} <lieu>`);
  const folder = template.folder.replace('<lieu>', place ?? '').replace('<id>', id);
  return template.files.map(({ from, to }) => ({
    path: template.into?.file ?? `${folder}/${to.replace('<id>', id)}`,
    array: template.into?.array ?? null,
    value: fromTemplate(readFileSync(join(templates, from), 'utf8'), id),
  }));
}

function main(args: readonly string[]): void {
  const [type, id, place] = args;
  const data = join(dirname(fileURLToPath(import.meta.url)), '..', 'donnees');
  if (type === undefined || id === undefined)
    throw new Error(`usage: pnpm nouveau <${Object.keys(TEMPLATES).join('|')}> <id> [lieu]`);
  const files = plan(join(data, '_gabarits'), type, id, place ?? null);
  for (const file of files) {
    const target = join(data, ...file.path.split('/'));
    if (file.array === null && existsSync(target)) throw new Error(`${file.path} existe déjà`);
  }
  for (const file of files) {
    const target = join(data, ...file.path.split('/'));
    if (file.array === null) {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, `${JSON.stringify(file.value, null, 2)}\n`, 'utf8');
      process.stdout.write(`créé: donnees/${file.path}\n`);
      continue;
    }
    const host = JSON.parse(readFileSync(target, 'utf8')) as Record<string, unknown>;
    const list = host[file.array];
    if (!Array.isArray(list)) throw new Error(`${file.path}: tableau « ${file.array} » absent`);
    list.push(file.value);
    writeFileSync(target, `${JSON.stringify(host, null, 2)}\n`, 'utf8');
    process.stdout.write(`ajouté à donnees/${file.path} (${file.array})\n`);
  }
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
