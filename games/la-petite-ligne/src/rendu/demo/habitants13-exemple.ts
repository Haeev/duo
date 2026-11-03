/**
 * Page de rendu, habitants de la 0.13 (lot H6): `habitants13=1` aligne les 21 habitants sur le
 * bas de la place, avec leurs accessoires (Armand au portail avec son cartable, Margot au beurre
 * avec son pot à lait, Barnabé à la pause de midi la hache à l'épaule, Colette à l'accordéon du
 * mardi soir, l'abbé qui entretient son vélo, Ambroise la loupe relevée), Lucie et Nour qui
 * passent devant en poussant leur vélo, et le chat. `habitants13=messe`: la sortie de la messe
 * (21 habitants à l'écran, dont six qui repartent: mesure du budget HB-20).
 *
 * Autres paramètres: `chat=assis|marche|dort|roule|non`, `loupe=oeil` (Ambroise à l'établi).
 * Les habitants absents des données (lot H4) sont créés ici, à l'échelle de pose de l'artiste.
 * L'habitude (champ `habit` du lot H1) est posée sur l'objet de l'état, comme la simulation le fera.
 */
import type { CatPose, CatSource, CatView } from '../chat';
import type { VillagerState, WorldState } from '../../etat/types';
import { SIM_HZ } from '../../etat/types';

/** Les 21 habitants, dans l'ordre du récapitulatif (section 2.2 de `v0-13-habitants.md`). */
export const VILLAGERS_013 = [
  'firmin',
  'odette',
  'basile',
  'jeanne',
  'achille',
  'solange',
  'lucie',
  'armand',
  'berthe',
  'martial',
  'marthe',
  'honorine',
  'ines',
  'barnabe',
  'mado',
  'paulin',
  'margot',
  'leon',
  'ambroise',
  'nour',
  'colette',
] as const;

/** Arrêtés dans la rangée: activité et habitude qui sortent leur accessoire (`villagerProps`). */
const ROW_POSES: Readonly<Record<string, { activity: string; habit: string }>> = {
  armand: { activity: 'stand', habit: 'gate' },
  margot: { activity: 'work', habit: 'butter' },
  barnabe: { activity: 'stand', habit: 'lunch' },
  colette: { activity: 'stand', habit: 'tuesday_accordion' },
  martial: { activity: 'work', habit: 'wednesday_bike' },
};
/** Ceux qui passent devant la rangée en poussant leur vélo. */
const ROW_WALKERS = ['lucie', 'nour'] as const;
/** Ceux qui repartent à la sortie de la messe (vélo, cartable, pot à lait, hache). */
const MASS_WALKERS = ['lucie', 'nour', 'martial', 'armand', 'margot', 'barnabe'] as const;

/** Rangée: bas de la place, du coin de l'épicerie au lampadaire (m), regard vers le sud. */
const ROW = { x: 29.0, y: 33.3, spacing: 1.0, bikeGap: 0.95 };
const SOUTH = Math.PI / 2;
const WALK_SPEED = 1.6;
const ROW_WALK = { from: 31, to: 45, y: 34.9, lane: 1.0 };
/** Sortie de la messe: groupes sur la place, autour de ce point (m). */
const MASS_CENTER = { x: 40.6, y: 32.6 };
const GROUP_RADIUS = 0.65;
/**
 * Ceux qui repartent, trois par voie, toujours dans le même sens et à distance égale (aucun ne
 * traverse l'autre): vers l'est au bas de la place, vers l'ouest sur la berge, arrêtés avant le
 * rocher de la berge (x 38,5) et le lampadaire (x 47,5).
 */
const MASS_LANES = [
  { y: 35.25, from: 32, to: 45.5 },
  { y: 36.1, from: 47, to: 41 },
] as const;
/** Le chat devant Ambroise et Colette (le buisson du bout de la place est à x 49,5). */
const CAT_ROW = { x: 46.4, y: 34.4 };
const CAT_WALK = { from: 41.5, to: 47.5, y: 34.5 };
/** À la messe, il dort au pied du lampadaire, à l'écart des marcheurs. */
const CAT_MASS = { x: 46.9, y: 33.8 };
/** Une roulade toutes les 4 s (`chat=roule`). */
const ROLL_EVERY = 4;

export interface Habitants13Demo {
  /** Fait avancer les marcheurs et le chat (secondes depuis le début de la page). */
  step(world: WorldState, seconds: number): void;
  cat: CatSource;
}

function villagerState(id: string, x: number, y: number, facing: number): VillagerState {
  return {
    id,
    pos: { x, y },
    prev: { x, y },
    facing,
    speed: 0,
    visible: true,
    target: 'demo_habitants13',
    activity: 'stand',
    talkingWith: [],
    met: true,
    inside: null,
  };
}

/** Pose l'habitude du lot H1 sur l'état (champ que le type ne porte pas encore). */
function setHabit(villager: VillagerState, habit: string | null): void {
  Object.assign(villager, { habit });
}

/** Aller-retour sur un segment de x (m) à `speed`: position, cap et marche. */
function shuttle(
  from: number,
  to: number,
  speed: number,
  seconds: number,
): { x: number; facing: number } {
  const length = to - from;
  const period = (2 * length) / speed;
  const t = ((seconds % period) + period) % period;
  const forward = t * speed < length;
  const x = forward ? from + t * speed : to - (t * speed - length);
  return { x, facing: forward ? 0 : Math.PI };
}

export function applyHabitants13Example(
  world: WorldState,
  params: URLSearchParams,
): Habitants13Demo | null {
  const mode = params.get('habitants13');
  if (mode === null) return null;
  const byId = new Map(world.villagers.map((villager) => [villager.id, villager]));
  world.villagers = VILLAGERS_013.map((id) => {
    const existing = byId.get(id);
    const villager = existing ?? villagerState(id, 0, 0, SOUTH);
    villager.visible = true;
    villager.inside = null;
    villager.talkingWith = [];
    villager.met = true;
    villager.target = 'demo_habitants13';
    villager.activity = 'stand';
    villager.speed = 0;
    setHabit(villager, null);
    return villager;
  });
  const messe = mode === 'messe';
  const walkers: readonly string[] = messe ? MASS_WALKERS : ROW_WALKERS;
  if (messe) layoutMass(world);
  else layoutRow(world, params.get('loupe') === 'oeil');
  const p1 = world.characters[0];
  const p2 = world.characters[1];
  // Les joueurs regardent de la place, hors de portée du salut (2,6 m): personne ne lève la main sur les captures.
  const watch = messe ? { x: 46.2, y: 30.2 } : { x: 38.0, y: 29.9 };
  if (p1 !== undefined) {
    p1.pos = { ...watch };
    p1.prev = { ...watch };
    p1.facing = SOUTH;
  }
  if (p2 !== undefined) {
    p2.pos = { x: watch.x + 0.9, y: watch.y + 0.2 };
    p2.prev = { ...p2.pos };
    p2.facing = SOUTH;
  }
  const catMode = params.get('chat') ?? (messe ? 'dort' : 'assis');
  const pose: CatPose | null =
    catMode === 'marche'
      ? 'walk'
      : catMode === 'dort'
        ? 'sleep'
        : catMode === 'roule'
          ? 'roll'
          : catMode === 'non'
            ? null
            : 'idle';
  const catAt = messe ? CAT_MASS : CAT_ROW;
  const cat = {
    pos: { ...catAt },
    prev: { ...catAt },
    facing: SOUTH,
    speed: 0,
    pose: pose ?? 'idle',
    since: 0,
    inside: null,
  };
  const catView: CatView | null = pose === null ? null : cat;
  return {
    cat: () => catView,
    step: (state, seconds) => {
      walkers.forEach((id, rank) => {
        const villager = state.villagers.find((v) => v.id === id);
        if (villager === undefined) return;
        villager.prev = { ...villager.pos };
        if (messe) {
          // Ils repartent de la place; au bout de la voie, ils reprennent au début (boucle de la page).
          const lane = MASS_LANES[rank % MASS_LANES.length] ?? MASS_LANES[0];
          const length = lane.to - lane.from;
          const share =
            Math.floor(rank / MASS_LANES.length) / Math.ceil(walkers.length / MASS_LANES.length);
          const run = (((seconds * WALK_SPEED) / Math.abs(length) + share) % 1) * length;
          villager.pos = { x: lane.from + run, y: lane.y };
          villager.facing = length > 0 ? 0 : Math.PI;
          villager.speed = WALK_SPEED;
        } else {
          const run = shuttle(ROW_WALK.from, ROW_WALK.to, WALK_SPEED, seconds + rank * 4.5);
          villager.pos = { x: run.x, y: ROW_WALK.y + rank * ROW_WALK.lane };
          villager.facing = run.facing;
          villager.speed = WALK_SPEED;
        }
      });
      if (catView === null) return;
      cat.prev = { ...cat.pos };
      if (cat.pose === 'walk') {
        const run = shuttle(CAT_WALK.from, CAT_WALK.to, 0.35, seconds);
        cat.pos = { x: run.x, y: CAT_WALK.y };
        cat.facing = run.facing;
        cat.speed = 0.35;
      } else if (cat.pose === 'roll') {
        cat.since = Math.floor(seconds / ROLL_EVERY) * ROLL_EVERY * SIM_HZ;
      }
    },
  };
}

function layoutRow(world: WorldState, loupe: boolean): void {
  let x = ROW.x;
  for (const villager of world.villagers) {
    if ((ROW_WALKERS as readonly string[]).includes(villager.id)) continue;
    villager.pos = { x, y: ROW.y };
    villager.prev = { x, y: ROW.y };
    villager.facing = SOUTH;
    const pose =
      villager.id === 'ambroise' && loupe
        ? { activity: 'work', habit: 'shop' }
        : ROW_POSES[villager.id];
    if (pose !== undefined) {
      villager.activity = pose.activity;
      setHabit(villager, pose.habit);
    }
    // Le vélo de l'abbé est à sa gauche (+x, regard au sud): place en plus pour le voisin.
    x += ROW.spacing + (villager.id === 'martial' ? ROW.bikeGap : 0);
  }
}

/** Sortie de la messe: petits groupes qui bavardent, tournés les uns vers les autres. */
function layoutMass(world: WorldState): void {
  const groups: readonly (readonly string[])[] = [
    ['firmin', 'basile', 'ambroise'],
    ['odette', 'solange', 'honorine', 'marthe'],
    ['jeanne', 'leon'],
    ['achille', 'berthe', 'colette'],
    ['ines', 'mado', 'paulin'],
  ];
  const centers = [
    { x: -2.6, y: -0.4 },
    { x: 0.2, y: -1.4 },
    { x: 3.4, y: 0.3 },
    { x: -0.3, y: 0.8 },
    { x: -6.6, y: 0.6 },
  ];
  groups.forEach((group, g) => {
    const c = centers[g] ?? { x: 0, y: 0 };
    group.forEach((id, i) => {
      const villager = world.villagers.find((v) => v.id === id);
      if (villager === undefined) return;
      const angle = (i / group.length) * 2 * Math.PI + g;
      const at = {
        x: MASS_CENTER.x + c.x + Math.cos(angle) * GROUP_RADIUS,
        y: MASS_CENTER.y + c.y + Math.sin(angle) * GROUP_RADIUS,
      };
      villager.pos = at;
      villager.prev = { ...at };
      villager.facing = Math.atan2(-Math.sin(angle), -Math.cos(angle));
    });
  });
}
