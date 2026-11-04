/**
 * Situations de la page de démonstration pour l'onglet Voisins du carnet (0.13, lot H3): début
 * de partie (quelques voisins rencontrés), milieu (découvertes, goûts, liens variés), fin (tout
 * le bourg connu, beaucoup d'amitié), pluie (bascule du temps), notifications de découverte.
 * Partis de la référence d'été du format 13 (jour 25, mardi), migrée au format 14. Le carnet est
 * rempli à la main, de façon déterministe. Outil de captures et de tests seulement.
 */
import type { CharacterId } from '../../etat/types';
import type { Sim } from '../../simulation/contexte';
import { addBond, revealTaste } from '../../simulation/amitie';
import { step } from '../../simulation/pas';
import { revealHabit } from '../../simulation/voisins';

export const NEIGHBOURS_SCENARIOS: readonly string[] = [
  'voisins-debut',
  'voisins-milieu',
  'voisins-fin',
  'voisins-pluie',
  'voisins-notifications',
];

type Stage = 'debut' | 'milieu' | 'fin';

/** Voisins rencontrés au début: les six de la démo et Lucie, revenue par le train. */
const EARLY = new Set(['firmin', 'odette', 'basile', 'jeanne', 'achille', 'solange', 'lucie']);
/** Au milieu, sept de plus. */
const MIDDLE = new Set([
  ...EARLY,
  'armand',
  'berthe',
  'marthe',
  'honorine',
  'mado',
  'nour',
  'colette',
]);

/** Part des habitudes connues d'un habitant (de 0 à 1), variée d'un habitant à l'autre. */
function share(stage: Stage, index: number): number {
  if (stage === 'debut') return index % 3 === 0 ? 0.25 : 0.1;
  if (stage === 'milieu') return [0.35, 0.6, 0.45, 0.8, 0.5, 0.25, 0.7][index % 7] ?? 0.5;
  return index % 4 === 0 ? 0.85 : 1;
}

function bondFor(stage: Stage, index: number): number {
  if (stage === 'debut') return [0, 40, 110, 20, 60][index % 5] ?? 0;
  if (stage === 'milieu') return [120, 260, 80, 460, 300, 30, 190][index % 7] ?? 100;
  return [1000, 760, 880, 1000, 720, 940][index % 6] ?? 800;
}

function fill(sim: Sim, stage: Stage): void {
  const w = sim.world;
  const metSet = stage === 'debut' ? EARLY : stage === 'milieu' ? MIDDLE : null;
  // Lucie est revenue (« Le retour de Lucie »): son vrai planning remplace sa tournée hors du bourg.
  if (!w.flags.includes('lucie_back')) w.flags.push('lucie_back');
  sim.content.villagers.forEach((def, index) => {
    const met = metSet === null || metSet.has(def.id);
    const state = w.villagers.find((v) => v.id === def.id);
    if (state !== undefined) state.met = met;
    if (!met) {
      // Avant la rencontre, une habitude peut déjà avoir été vue (« une personne inconnue »).
      const first = def.habits.find((h) => h.kind === 'routine');
      if (stage === 'milieu' && index % 2 === 0 && first !== undefined)
        w.habits.known[def.id] = [first.id];
      return;
    }
    // Les habitudes de tous les jours d'abord, puis les variantes, dans l'ordre des données.
    const ordered = [
      ...def.habits.filter((h) => h.kind === 'routine' || h.kind === 'home'),
      ...def.habits.filter(
        (h) => h.kind !== 'routine' && h.kind !== 'home' && h.kind !== 'after_quest',
      ),
    ];
    const count = Math.round(ordered.length * share(stage, index));
    w.habits.known[def.id] = ordered.slice(0, count).map((h) => h.id);
    w.bonds[def.id] = bondFor(stage, index);
    const tastes: Record<string, 'loves' | 'likes' | 'dislikes'> = {};
    const loves = stage === 'fin' ? def.tastes.loves : def.tastes.loves.slice(0, index % 2);
    const likes =
      stage === 'fin'
        ? def.tastes.likes
        : def.tastes.likes.slice(0, stage === 'milieu' ? 1 + (index % 3) : index % 2);
    const dislikes =
      stage === 'fin'
        ? def.tastes.dislikes.map((d) => d.item)
        : def.tastes.dislikes.slice(0, stage === 'milieu' ? index % 2 : 0).map((d) => d.item);
    for (const item of loves) tastes[item] = 'loves';
    for (const item of likes) tastes[item] = 'likes';
    for (const item of dislikes) tastes[item] = 'dislikes';
    w.tastesKnown[def.id] = tastes;
  });
}

function character(sim: Sim, id: CharacterId): Sim['world']['characters'][number] {
  const c = sim.world.characters.find((x) => x.id === id);
  if (c === undefined) throw new Error(`personnage ${id}`);
  return c;
}

/** Le carnet ouvert dans l'état (page de démonstration seulement). */
function openNotebook(sim: Sim, me: CharacterId): void {
  step(sim, { controls: {}, intents: [{ by: me, intent: { type: 'menu', menu: 'notebook' } }] });
  const c = character(sim, me);
  c.menu = 'notebook';
  c.status = 'menu';
}

/** Pose la situation d'un scénario de ce lot (`done` faux si le nom n'en est pas un), et la suite après montage. */
export function setupNeighbours(
  sim: Sim,
  name: string,
  me: CharacterId,
): { done: boolean; after?: () => void } {
  if (!NEIGHBOURS_SCENARIOS.includes(name)) return { done: false };
  const w = sim.world;
  // Un pas de simulation d'abord: les habitants de la 0.13 reçoivent leur état (la sauvegarde est du format 13).
  step(sim, { controls: {}, intents: [] });
  w.phase = 'day';
  w.clock.minutes = 14 * 60 + 10;
  w.weather = 'sunny';
  switch (name) {
    case 'voisins-debut':
      w.clock.minutes = 9 * 60 + 20;
      fill(sim, 'debut');
      openNotebook(sim, me);
      return { done: true };
    case 'voisins-milieu':
      fill(sim, 'milieu');
      openNotebook(sim, me);
      return { done: true };
    case 'voisins-fin':
      w.clock.minutes = 17 * 60 + 40;
      fill(sim, 'fin');
      openNotebook(sim, me);
      return { done: true };
    case 'voisins-pluie':
      w.weather = 'rain';
      fill(sim, 'milieu');
      // Jeanne sous la pluie: sa variante est au carnet, la bascule du temps paraît.
      for (const id of ['jeanne', 'lucie', 'berthe']) {
        const def = sim.content.villagers.find((v) => v.id === id);
        const rain = def?.habits.filter((h) => h.kind === 'rain').map((h) => h.id) ?? [];
        w.habits.known[id] = [...new Set([...(w.habits.known[id] ?? []), ...rain])];
      }
      openNotebook(sim, me);
      return { done: true };
    case 'voisins-notifications': {
      fill(sim, 'milieu');
      const other: CharacterId = me === 'p1' ? 'p2' : 'p1';
      // Après le montage: trois découvertes et une lanterne de plus, comme en jeu (notifications chez les deux).
      return {
        done: true,
        after: () => {
          const berthe = sim.content.villagers.find((v) => v.id === 'berthe');
          const unknown =
            berthe?.habits.filter(
              (h) => !(w.habits.known.berthe ?? []).includes(h.id) && h.kind !== 'after_quest',
            ) ?? [];
          const [a, b] = unknown;
          if (a !== undefined)
            revealHabit(sim, { villager: 'berthe', habit: a.id }, 'seen', other, null);
          if (b !== undefined)
            revealHabit(sim, { villager: 'berthe', habit: b.id }, 'heard', me, 'honorine');
          revealTaste(
            sim,
            'colette',
            sim.content.villagers.find((v) => v.id === 'colette')?.tastes.loves[0] ?? '',
            me,
          );
          addBond(sim, 'mado', 260 - (w.bonds.mado ?? 0), me);
        },
      };
    }
    default:
      return { done: false };
  }
}

/** Onglet du carnet qu'ouvre un scénario de ce lot. */
export function neighboursNotebookTab(name: string): 'neighbours' | null {
  return NEIGHBOURS_SCENARIOS.includes(name) && name !== 'voisins-notifications'
    ? 'neighbours'
    : null;
}
