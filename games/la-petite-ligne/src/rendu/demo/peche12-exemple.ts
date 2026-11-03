/**
 * Pêche de la 0.12 sur la page de démonstration (`rendu.html?peche12=1`): des ombres posées à
 * la main au gué, au ponton et dans le ru, le coin qui frémit et le guet, en attendant l'état de
 * la simulation (`world.fishing`, lot 1). Paramètres: `coin=<id>` (coin qui frémit, `pontoon` par
 * défaut, `aucun` pour aucun), `guet=1` (le joueur 1 fait le guet: éclats et mythiques chez lui),
 * `approche=1` (l'ombre la plus proche du bouchon du joueur 2 vient dessous, puis attend).
 */
import type { CharacterId, WorldState } from '../../etat/types';
import type {
  FishShadowView,
  FishZoneView,
  FishingSource,
  FishingView,
  ShadowPhase,
} from '../peche-vue';

/** Coins de pêche de la conception (section 2), en attendant `peche.coins` dans la carte. */
export const DEMO_FISH_ZONES: readonly FishZoneView[] = [
  { id: 'upstream', rects: [{ x0: 0, y0: 38, x1: 10, y1: 42 }] },
  { id: 'ford', rects: [{ x0: 11, y0: 38, x1: 23, y1: 42 }] },
  { id: 'sands', rects: [{ x0: 24, y0: 38, x1: 37, y1: 42 }] },
  { id: 'pontoon', rects: [{ x0: 38, y0: 38, x1: 57, y1: 42 }] },
  {
    id: 'confluence',
    rects: [
      { x0: 58, y0: 38, x1: 70, y1: 42 },
      { x0: 63, y0: 36, x1: 64, y1: 37 },
    ],
  },
  { id: 'ru', rects: [{ x0: 63, y0: 0, x1: 64, y1: 35 }] },
  { id: 'downstream', rects: [{ x0: 71, y0: 38, x1: 99, y1: 42 }] },
];

type Shadow = { -readonly [K in keyof FishShadowView]: FishShadowView[K] };

/** Ombres de l'exemple: chaque rareté, chaque taille, au gué, au ponton et dans le ru. */
function exampleShadows(): Shadow[] {
  const s = (
    id: number,
    zone: string,
    species: string,
    rarity: FishShadowView['rarity'],
    size: FishShadowView['size'],
    x: number,
    y: number,
  ): Shadow => ({
    id,
    zone,
    species,
    rarity,
    size,
    pos: { x, y },
    // Le ru est étroit (1 à 1,5 m): la nage y reste au milieu du lit.
    roam: zone === 'ru' ? 0.25 : 0.8,
    heading: (id * 2.39996) % (Math.PI * 2),
    phase: 'free',
    target: null,
    watchOnly: rarity === 'mythic',
  });
  return [
    // Au ponton (le bout du ponton est en 45; 39,5): de part et d'autre et au large.
    s(1, 'pontoon', 'roach', 'common', 'medium', 42.2, 40.9),
    s(2, 'pontoon', 'bleak', 'common', 'small', 47.6, 40.6),
    s(3, 'pontoon', 'perch', 'rare', 'medium', 43.6, 41.6),
    s(4, 'pontoon', 'pike', 'epic', 'large', 48.4, 41.4),
    s(5, 'pontoon', 'mirror_carp', 'legendary', 'huge', 45.6, 41.7),
    s(6, 'pontoon', 'moon_pike', 'mythic', 'huge', 50.6, 41.0),
    // Au gué: le bouchon du joueur 2 tombe vers 21,5; 41,5.
    s(11, 'ford', 'gudgeon', 'common', 'small', 20.8, 41.1),
    s(12, 'ford', 'gudgeon', 'common', 'small', 21.2, 41.4),
    s(13, 'ford', 'trout', 'rare', 'medium', 22.4, 40.6),
    s(14, 'ford', 'barbel', 'epic', 'large', 16.4, 41.3),
    // Dans le ru, au milieu du lit.
    s(21, 'ru', 'minnow', 'common', 'small', 63.9, 32.6),
    s(22, 'ru', 'trout', 'rare', 'medium', 63.9, 27.6),
    s(23, 'ru', 'golden_trout', 'mythic', 'medium', 63.9, 24.8),
  ];
}

export interface Peche12Demo {
  readonly source: FishingSource;
  /** Avance l'exemple (l'approche de l'ombre), à chaque image de la page. */
  step(world: WorldState, dt: number): void;
}

const APPROACH_SPEED = 0.4;
const UNDER_DISTANCE = 0.2;

export function createPeche12Demo(params: URLSearchParams, local: CharacterId): Peche12Demo | null {
  if (params.get('peche12') !== '1') return null;
  const coin = params.get('coin') ?? 'pontoon';
  const shadows = exampleShadows();
  const view: { shadows: Shadow[]; hotSpot: string | null; watchers: CharacterId[] } = {
    shadows,
    hotSpot: coin === 'aucun' ? null : coin,
    watchers: params.get('guet') === '1' ? [local] : [],
  };
  const approach = params.get('approche') === '1';
  let chosen: Shadow | null = null;
  return {
    source: {
      view: (): FishingView => view,
      zones: () => DEMO_FISH_ZONES,
    },
    step(world: WorldState, dt: number): void {
      if (!approach) return;
      const line = world.characters[1]?.fishing ?? null;
      if (line === null) {
        if (chosen !== null) {
          // Ligne remontée ou poisson pris: l'ombre visée s'en va (prise) ou reprend sa nage.
          view.shadows = view.shadows.filter((shadow) => shadow !== chosen);
          chosen = null;
        }
        return;
      }
      if (chosen === null) {
        let best = Infinity;
        for (const shadow of view.shadows) {
          const d = Math.hypot(shadow.pos.x - line.bobber.x, shadow.pos.y - line.bobber.y);
          if (d < best) {
            best = d;
            chosen = shadow;
          }
        }
      }
      if (chosen === null) return;
      const d = Math.hypot(line.bobber.x - chosen.pos.x, line.bobber.y - chosen.pos.y);
      const phase: ShadowPhase = d <= UNDER_DISTANCE ? 'under' : 'approach';
      if (phase === 'approach') {
        const k = Math.min(1, (APPROACH_SPEED * dt) / d);
        chosen.pos = {
          x: chosen.pos.x + (line.bobber.x - chosen.pos.x) * k,
          y: chosen.pos.y + (line.bobber.y - chosen.pos.y) * k,
        };
      }
      chosen.phase = phase;
      chosen.roam = 0;
      chosen.target = { ...line.bobber };
    },
  };
}
