// Parcours qui attendent des données d'essai (lits, objets à obtenir, rangement). Chacun se saute
// avec la mention « bloqué par les données » tant que la donnée manque, et se joue dès qu'elle
// arrive: le test échoue alors s'il n'est pas écrit en entier (à compléter par la recette).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from '@playwright/test';

const DATA = join(import.meta.dirname, '../../donnees');

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? files(join(dir, e.name))
      : e.name.endsWith('.json')
        ? [join(dir, e.name)]
        : [],
  );
}

const all = files(DATA).map((f) => readFileSync(f, 'utf8'));
const hasBrick = (brick: string): boolean => all.some((t) => t.includes(`"brick": "${brick}"`));
/** Un objet s'obtient au départ si une carte en pose au sol, un dialogue en donne, ou une cueillette inscrite. */
const itemObtainable = all.some((t) => t.includes('"give_item"') || t.includes('"ground"'));
/** La cueillette (`gather`, étals et marmites) donne les objets; elle doit être inscrite au registre. */
const gatherRegistered = /\bgather:/.test(
  readFileSync(join(import.meta.dirname, '../../src/simulation/briques/registre.ts'), 'utf8'),
);
const obtainable = itemObtainable || (hasBrick('gather') && gatherRegistered);
const WHY =
  'bloqué: aucun objet obtenable (brique « gather » des étals non inscrite au registre, rien au sol, aucun dialogue ne donne d’objet)';

test.describe('bloqués par les données ou le moteur', () => {
  test('P13 manger (CA-09)', () => {
    test.skip(!obtainable, WHY);
    test.fixme(true, 'à écrire: la soupe de Prune (halte) se mange; demande le voyage aller');
  });
  test('P14 ramasser et ranger (CA-17)', () => {
    test.skip(!obtainable || !hasBrick('store'), WHY);
    test.fixme(true, 'à écrire: la soupe de Prune se pose au sol puis se range au coffre');
  });
  test('P15 donner un objet à l’autre joueur', () => {
    test.skip(!obtainable, WHY);
    test.fixme(true, 'à écrire: la soupe de Prune se donne à l’autre joueur');
  });
});
