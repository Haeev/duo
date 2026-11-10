/**
 * Sonde des parcours de recette (qa-testeur, `tests/e2e/`): installée seulement quand l'adresse
 * du jeu porte `?sonde=1` (le banc l'y met par redirection), jamais dans une partie normale. Elle
 * lit l'état (monde, joueur local, cible, phase, lieu affiché, statistiques de rendu) et, chez
 * l'hôte seulement, place un joueur, règle un besoin ou l'heure, pour ne pas marcher ni attendre
 * en rendu logiciel. Les réglages marquent la tranche touchée, comme un système (`touch`).
 */
import type { PlayerState } from '../etat/joueur';
import type { GameRenderer } from '../rendu/moteur';
import type { Session } from '../session';

type NeedId = 'hunger' | 'sleep' | 'hygiene';

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
  };
  (window as unknown as { __lplSonde?: TestProbe }).__lplSonde = probe;
  return probe;
}
