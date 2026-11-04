/**
 * Page de rendu, planche de décision de la qualité visuelle (étape A, `qualite-visuelle-plan.md`):
 * `temoins=1` aligne sur la place les trois témoins refaits (Colette, Firmin, le joueur 1 en tenue
 * témoin: chemise, pantalon, bottines, coupe courte) mêlés à des habitants pas encore refaits
 * (Odette, Basile, Jeanne) et au joueur 2 dans une tenue d'avant, tournés vers la caméra
 * (orientation 0). `temoins=marche`: chacun marche en aller-retour sur sa propre file, en travers
 * de l'écran (contour en mouvement, demi-tours compris); aucune file n'en croise une autre. `temoins_centre=x,y`: la rangée ailleurs (le soir, la place est à l'ombre de l'épicerie).
 */
import type { Character, VillagerState, WorldState } from '../../etat/types';

/** Rangée, de gauche à droite à l'écran (orientation 0: la droite de l'écran va vers +x -y). */
const ROW = ['odette', 'colette', 'p1', 'firmin', 'basile', 'p2', 'jeanne'] as const;
const VILLAGERS: ReadonlySet<string> = new Set(['odette', 'colette', 'firmin', 'basile', 'jeanne']);
/** Milieu de la rangée par défaut, sur la place (m); `temoins_centre=x,y` le déplace (soir au soleil). */
const CENTER = { x: 38.6, y: 31.0 };
const SPACING = 0.95;
/** Face à la caméra (elle regarde vers -x -y), un peu de trois quarts selon le rang. */
const TOWARD_CAMERA = Math.PI / 4;
const THREE_QUARTER = 0.35;
/** Droite de l'écran et direction de la caméra, en coordonnées de la carte (orientation 0). */
const SCREEN_RIGHT = { x: Math.SQRT1_2, y: -Math.SQRT1_2 };
const SCREEN_DOWN = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
const WALK_SPEED = 1.4;
/**
 * Marche: files en travers espacées en profondeur (m) et longueur des allers-retours, choisies pour
 * rester sur le sol libre de la place (ni le puits, ni les bancs, ni la tonnelle).
 */
const LANE_GAP = 0.9;
const WALK_LENGTH = 3.6;

/** Tenue témoin du joueur 1 (`verifier/temoins.html` de l'artiste) et tenue d'avant du joueur 2. */
const WITNESS_WEAR = {
  top: 'chemise_bleu_travail',
  bottom: 'pantalon_beige',
  shoes: 'bottines_brunes',
  outer: null,
  hat: null,
};
const OLD_WEAR = {
  top: 'pull_moutarde',
  bottom: 'pantalon_bleu',
  shoes: 'bottes_jaunes',
  outer: null,
  hat: null,
};
const SHORT_HAIR = 0;

export interface TemoinsDemo {
  step(world: WorldState, seconds: number): void;
}

type Placed = VillagerState | Character;

function villagerState(id: string): VillagerState {
  return {
    id,
    pos: { ...CENTER },
    prev: { ...CENTER },
    facing: TOWARD_CAMERA,
    speed: 0,
    visible: true,
    target: 'demo_temoins',
    activity: 'stand',
    talkingWith: [],
    met: true,
    inside: null,
  };
}

function along(
  origin: { x: number; y: number },
  dir: { x: number; y: number },
  distance: number,
): { x: number; y: number } {
  return { x: origin.x + dir.x * distance, y: origin.y + dir.y * distance };
}

/** Place du rang `rank` dans la rangée immobile. */
function rowPlace(rank: number, center: { x: number; y: number }): { x: number; y: number } {
  return along(center, SCREEN_RIGHT, (rank - (ROW.length - 1) / 2) * SPACING);
}

function dressPlayer(
  character: Character | undefined,
  wear: Character['appearance']['wear'],
  hair: number | null,
): void {
  if (character === undefined) return;
  character.appearance.wear = { ...wear };
  if (hair !== null) character.appearance.hair = hair;
  // Mains vides: rien ne passe devant le visage sur la planche.
  character.bag[character.selected] = null;
  character.destination = null;
  character.action = { kind: 'idle', since: 0, duration: 0, target: null };
  character.speed = 0;
}

function find(world: WorldState, id: string): Placed | undefined {
  return VILLAGERS.has(id)
    ? world.villagers.find((v) => v.id === id)
    : world.characters.find((c) => c.id === id);
}

export function applyTemoinsExample(
  world: WorldState,
  params: URLSearchParams,
): TemoinsDemo | null {
  const mode = params.get('temoins');
  if (mode === null) return null;
  const moved = /^(-?[\d.]+),(-?[\d.]+)$/.exec(params.get('temoins_centre') ?? '');
  const center = moved === null ? CENTER : { x: Number(moved[1]), y: Number(moved[2]) };
  const existing = new Map(world.villagers.map((villager) => [villager.id, villager]));
  world.villagers = [...VILLAGERS].map((id) =>
    Object.assign(existing.get(id) ?? villagerState(id), villagerState(id)),
  );
  const [p1, p2] = world.characters;
  dressPlayer(p1, WITNESS_WEAR, SHORT_HAIR);
  dressPlayer(p2, OLD_WEAR, null);
  ROW.forEach((id, rank) => {
    const target = find(world, id);
    if (target === undefined) return;
    const at = rowPlace(rank, center);
    target.pos = { ...at };
    target.prev = { ...at };
    // Le joueur 1 au milieu, de face; les autres alternent de trois quarts.
    target.facing =
      rank === 2
        ? TOWARD_CAMERA
        : TOWARD_CAMERA + (rank % 2 === 0 ? -THREE_QUARTER : THREE_QUARTER);
  });
  if (mode !== 'marche') return { step: () => undefined };
  const period = (2 * WALK_LENGTH) / WALK_SPEED;
  return {
    step: (state, seconds) => {
      ROW.forEach((id, rank) => {
        const target = find(state, id);
        if (target === undefined) return;
        // Une file chacun, en travers de l'écran, de l'arrière (rang 0) vers l'avant.
        const lane = along(center, SCREEN_DOWN, (rank - (ROW.length - 1) / 2) * LANE_GAP);
        const dir = SCREEN_RIGHT;
        const t = (seconds + rank * 1.3) % period;
        const forward = t * WALK_SPEED < WALK_LENGTH;
        const run = forward ? t * WALK_SPEED : 2 * WALK_LENGTH - t * WALK_SPEED;
        target.prev = { ...target.pos };
        target.pos = along(lane, dir, run - WALK_LENGTH / 2);
        target.facing = forward ? Math.atan2(dir.y, dir.x) : Math.atan2(-dir.y, -dir.x);
        target.speed = WALK_SPEED;
        if ('action' in target)
          target.action = { kind: 'walk', since: 0, duration: 0, target: null };
      });
    },
  };
}
