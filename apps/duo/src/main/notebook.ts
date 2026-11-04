// Carnet de séance (pont 1.1): pendant une séance, le joueur écrit une note sur ce qu'il voit
// (un bug, une idée) et le jeu y joint les images des secondes d'avant et d'après. Le
// principal écrit le tout dans un dossier lisible du dossier Documents; rien ne part sur le
// réseau. Seuls les noms de fichiers validés par le schéma du pont sont écrits, dans un dossier
// nommé par le principal: le jeu ne choisit jamais un chemin.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { NotebookStatus } from '@duo/protocol';

export interface NotebookFile {
  readonly name: string;
  readonly data: Uint8Array;
}

/** Ce que la plateforme joint à chaque note, une fois (versions, système, partie). */
export interface NotebookContext {
  readonly gameId: string;
  readonly details: Readonly<Record<string, unknown>>;
}

export interface NotebookStore {
  /** Carnet offert sur cette machine (macOS seulement, sauf version de test). */
  readonly available: boolean;
  enabled(): boolean;
  setEnabled(enabled: boolean): Promise<void>;
  write(
    context: NotebookContext,
    entry: string,
    files: readonly NotebookFile[],
  ): Promise<NotebookStatus>;
}

export interface NotebookStoreOptions {
  /** Racine du carnet, par exemple `~/Documents/Duo/carnet-de-seance`. */
  readonly root: string;
  /** Réglage gardé par la plateforme (activé ou coupé), dans le dossier de données de Duo. */
  readonly settingsFile: string;
  readonly available: boolean;
  readonly now?: () => Date;
}

const README = `Carnet de séance de Duo

Chaque dossier du jour contient une note par sous-dossier (heure de la note, puis le jeu):
- note.txt: ton message, l'heure, le jour et l'heure du jeu, ta position;
- etat.json: l'état utile du jeu au moment de la note;
- plateforme.json: versions de Duo et du jeu, système;
- planche.jpg: jusqu'à 24 images du jeu, de 10 s avant la note à 10 s après son envoi;
- ecran-ouverture.jpg et ecran-fin.jpg: l'écran entier, interface comprise, à l'ouverture
  de la note et 10 s après son envoi;
- images/: toutes les images, nommées par leur écart à la note (moins-09-7s: 9,7 s avant);
- images.json: l'heure et la légende de chaque image.

Rien n'est envoyé sur Internet. Pour transmettre une note au studio, compresse son dossier
(clic droit, Compresser) et envoie le fichier .zip.
`;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function dayFolder(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function timeFolder(date: Date): string {
  return `${pad(date.getHours())}h${pad(date.getMinutes())}m${pad(date.getSeconds())}s`;
}

async function readEnabled(file: string): Promise<boolean> {
  try {
    const parsed: unknown = JSON.parse(await readFile(file, 'utf8'));
    if (typeof parsed === 'object' && parsed !== null && 'enabled' in parsed) {
      return parsed.enabled !== false;
    }
  } catch {
    // Pas encore de réglage, ou réglage illisible: carnet activé.
  }
  return true;
}

export async function createNotebookStore(options: NotebookStoreOptions): Promise<NotebookStore> {
  const now = options.now ?? ((): Date => new Date());
  let enabled = options.available ? await readEnabled(options.settingsFile) : false;
  /** Dossier de chaque note déjà commencée (`entry` du SDK), pour ses envois suivants. */
  const folders = new Map<string, string>();
  // Écritures en file: deux envois d'une même note ne se croisent jamais.
  let chain: Promise<unknown> = Promise.resolve();

  const folderFor = async (context: NotebookContext, entry: string): Promise<string> => {
    const key = `${context.gameId}/${entry}`;
    const known = folders.get(key);
    if (known !== undefined) return known;
    const date = now();
    const day = path.join(options.root, dayFolder(date));
    await mkdir(day, { recursive: true });
    const readme = path.join(options.root, 'LISEZMOI.txt');
    await writeFile(readme, README, { encoding: 'utf8', flag: 'wx' }).catch(() => undefined);
    const base = `${timeFolder(date)}-${context.gameId}`;
    for (let index = 1; index < 100; index++) {
      const candidate = path.join(day, index === 1 ? base : `${base}-${index}`);
      try {
        await mkdir(candidate);
        await mkdir(path.join(candidate, 'images'));
        await writeFile(
          path.join(candidate, 'plateforme.json'),
          `${JSON.stringify({ ecritLe: date.toISOString(), ...context.details }, null, 2)}\n`,
          'utf8',
        );
        folders.set(key, candidate);
        return candidate;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      }
    }
    throw new Error('carnet: trop de notes dans la même seconde');
  };

  const writeAll = async (
    context: NotebookContext,
    entry: string,
    files: readonly NotebookFile[],
  ): Promise<NotebookStatus> => {
    if (!enabled) return 'disabled';
    try {
      const folder = await folderFor(context, entry);
      for (const file of files) {
        // Images numérotées du canevas dans `images/`; planche et écrans à côté de la note.
        const target = /^\d{4}-.*\.jpg$/.test(file.name)
          ? path.join(folder, 'images', file.name)
          : path.join(folder, file.name);
        await writeFile(target, file.data);
      }
      return 'ok';
    } catch {
      return 'write-error';
    }
  };

  return {
    available: options.available,
    enabled: () => enabled,
    async setEnabled(next) {
      if (!options.available) return;
      enabled = next;
      await mkdir(path.dirname(options.settingsFile), { recursive: true });
      await writeFile(options.settingsFile, `${JSON.stringify({ schema: 1, enabled: next })}\n`);
    },
    write(context, entry, files) {
      const result = chain.then(() => writeAll(context, entry, files));
      chain = result.catch(() => undefined);
      return result;
    },
  };
}
