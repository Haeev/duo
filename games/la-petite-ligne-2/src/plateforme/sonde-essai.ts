/**
 * Sonde des parcours de recette (qa-testeur, `tests/e2e/`): installée seulement quand l'adresse
 * du jeu porte `?sonde=1` (le banc l'y met par redirection), jamais dans une partie normale. Elle
 * lit l'état (monde, joueur local, cible, phase, lieu affiché, statistiques de rendu) et, chez
 * l'hôte seulement, place un joueur, règle un besoin ou l'heure, pour ne pas marcher ni attendre
 * en rendu logiciel. Les réglages marquent la tranche touchée, comme un système (`touch`).
 */
import type { BrickStates } from '../etat/briques';
import type { PlayerState } from '../etat/joueur';
import type { PlaceState } from '../etat/lieu';
import type { GameRenderer } from '../rendu/moteur';
import type { Session } from '../session';
import { isFactKey } from '../simulation/regles/memoire';

type NeedId = 'hunger' | 'sleep' | 'hygiene';
type GroundItem = PlaceState['ground'][number];
type PlacedProp = PlaceState['placed'][number];

export interface TestProbe {
  readonly role: 'host' | 'guest';
  /** Copie de l'état logique de cette machine (`null` avant le premier état chez l'invité). */
  world(): unknown;
  local(): number | null;
  /** Cible et verbe de la touche d'action d'un joueur, vus de cette machine. */
  aim(player: number): unknown;
  phase(): string | null;
  /** Lieu construit par le rendu (`null`: aucun). */
  placeId(): string | null;
  /** Statistiques du rendu de la dernière image (appels de dessin, triangles...). */
  stats(): unknown;
  /** Hôte seulement: place un joueur (mètres, repère de la carte). Faux chez l'invité. */
  teleport(player: number, x: number, y: number, facing?: number): boolean;
  /** Hôte seulement: fixe une jauge (0 à 100). */
  setNeed(player: number, need: NeedId, value: number): boolean;
  /** Hôte seulement: fixe l'heure (minutes depuis minuit). */
  setMinutes(minutes: number): boolean;
  /** Hôte seulement: fixe la bourse d'un joueur (centimes). */
  setMoney(player: number, cents: number): boolean;
  /**
   * Hôte seulement: retient un fait d'histoire au nom des deux (une pièce de logement restaurée,
   * par exemple), comme le ferait l'effet `remember` d'une quête; `value` (défaut vrai): la valeur
   * retenue (`"ouvert"` ouvre une suite). Faux si la clé est refusée.
   */
  remember(key: string, value?: string | boolean): boolean;
  /** Cadre la vue de cette machine: lacet (degrés) et largeur (m). Faux sans rendu. */
  setCamera(yawDeg: number, width: number): boolean;
  /**
   * Hôte seulement: retouche l'état du lieu courant (états des briques par meuble, objets au sol),
   * pour montrer un arbre abattu ou un potager semé sans jouer les gestes. Faux chez l'invité.
   */
  patchPlace(patch: PlacePatch): boolean;
}

/** Retouche de la sonde: champs de l'état d'un lieu, tels que la sauvegarde les écrit. */
export interface PlacePatch {
  readonly objects?: Readonly<Record<string, BrickStates>>;
  readonly ground?: readonly GroundItem[];
  /** Meubles posés (mode déco), ajoutés à ceux du lieu. */
  readonly placed?: readonly PlacedProp[];
}

export interface ProbeOptions {
  readonly session: Session;
  readonly renderer: GameRenderer | null;
}

export function installTestProbe(options: ProbeOptions): TestProbe {
  const { session, renderer } = options;
  const view = session.view;
  const sim = (): ReturnType<Session['hostSim']> => session.hostSim();
  const playerOf = (index: number): PlayerState | null => {
    const s = sim();
    if (s === null || (index !== 0 && index !== 1)) return null;
    return s.world.players[index];
  };
  const probe: TestProbe = {
    role: view.role,
    world: () => {
      const world = view.world();
      return world === null ? null : (JSON.parse(JSON.stringify(world)) as unknown);
    },
    local: () => view.localIndex(),
    aim: (player) => (player === 0 || player === 1 ? view.aim(player) : null),
    phase: () => view.world()?.common.phase ?? null,
    placeId: () => renderer?.placeId() ?? null,
    stats: () => renderer?.stats() ?? null,
    teleport(player, x, y, facing) {
      const target = playerOf(player);
      if (target === null) return false;
      target.body.x = x;
      target.body.y = y;
      target.body.speed = 0;
      if (facing !== undefined) target.body.facing = facing;
      return true;
    },
    setNeed(player, need, value) {
      const target = playerOf(player);
      const s = sim();
      if (target === null || s === null) return false;
      target.needs[need] = value;
      s.revisions.players += 1;
      return true;
    },
    setMinutes(minutes) {
      const s = sim();
      if (s === null) return false;
      s.world.minutes = minutes;
      return true;
    },
    setMoney(player, cents) {
      const target = playerOf(player);
      const s = sim();
      if (target === null || s === null) return false;
      target.money = cents;
      s.revisions.players += 1;
      return true;
    },
    remember(key, value = true) {
      const s = sim();
      if (s === null || !isFactKey(key)) return false;
      s.world.progress.memory[key] = { v: value, by: 'duo', day: s.world.common.day };
      s.revisions.progress += 1;
      return true;
    },
    patchPlace(patch) {
      const s = sim();
      const place = s?.world.places[s.world.common.place];
      if (s === null || place === undefined) return false;
      for (const [id, states] of Object.entries(patch.objects ?? {}))
        place.objects[id] = structuredClone(states);
      if (patch.ground !== undefined) {
        place.ground = structuredClone([...patch.ground]);
        place.nextGroundId = Math.max(place.nextGroundId, ...place.ground.map((g) => g.id + 1));
      }
      for (const prop of patch.placed ?? []) place.placed.push(structuredClone(prop));
      s.revisions.place += 1;
      return true;
    },
    setCamera(yawDeg, width) {
      if (renderer === null) return false;
      renderer.setCamera(yawDeg, width);
      return true;
    },
  };
  (window as unknown as { __lplSonde?: TestProbe }).__lplSonde = probe;
  return probe;
}
