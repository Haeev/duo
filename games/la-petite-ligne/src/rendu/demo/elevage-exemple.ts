/**
 * Page de rendu, `elevage=1` (0.12): la chevrerie et le poulailler agrandi bâtis, le coq, trois
 * poussines derrière leur mère, les six couleurs de poules, une chèvre au piquet (et une menée par
 * Camille avec `elevage=mene`), la litière fraîche et l'herbe rase d'une place broutée la veille.
 */
import type { GameMap } from '../../etat/carte';
import type { Goat, Hen, WorldState } from '../../etat/types';

const COLORS = ['hen_golden', 'hen_ash', 'hen_cuckoo'] as const;
const NAMES = ['Praline', 'Grêle', 'Frisette'] as const;

export function applyBreedingExample(world: WorldState, map: GameMap, mode: string): void {
  const day = world.clock.day;
  // Le poulailler réparé (sinon ses fantômes de chantier restent à l'écran).
  for (const k of world.constructions) if (k.id === 'chicken_coop') k.status = 'done';
  world.improvements.goat_shed = { paid: 600, planks: 0, funded: true, builtDay: day - 1 };
  world.improvements.coop_extension = { paid: 800, planks: 0, funded: true, builtDay: day - 1 };
  const coop = map.points.chicken_coop ?? { x: 15.5, y: 31.5 };
  const pen = map.zones.hen_pen ?? { x: 13, y: 31, w: 4, h: 4 };
  COLORS.forEach((variant, i) => {
    const at = { x: pen.x + 0.7 + i * 1.1, y: pen.y + 1.2 };
    const hen: Hen = {
      id: `hen_new_${String(i)}`,
      name: NAMES[i] ?? variant,
      variant,
      pos: { ...at },
      prev: { ...at },
      facing: i * 2,
      wander: { ...at },
      nameKnownBy: ['p1', 'p2'],
      namedBy: null,
      happiness: 70,
    };
    world.hens.push(hen);
  });
  const mother = world.hens[0];
  const b = world.breeding;
  const rooster = { x: coop.x - 0.9, y: coop.y + 1.6 };
  b.rooster = {
    id: 'rooster',
    name: 'Gaspard',
    variant: 'rooster_golden',
    pos: { ...rooster },
    prev: { ...rooster },
    facing: 0.6,
    wander: { ...rooster },
  };
  if (mother !== undefined) {
    for (let i = 0; i < 3; i++) {
      const at = { x: mother.pos.x - 0.35 + i * 0.3, y: mother.pos.y + 0.35 + (i % 2) * 0.12 };
      b.chicks.push({
        id: `chick_${String(i)}`,
        name: i === 0 ? 'Pépite' : '',
        variant: mother.variant,
        pos: { ...at },
        prev: { ...at },
        facing: 1.5,
        wander: { ...at },
        mother: mother.id,
        bornDay: day - 2,
      });
    }
  }
  b.strawDay = day;
  b.grazed = { goat_graze_01: day - 1, goat_graze_02: day };
  const spot = map.points.goat_graze_02 ?? { x: 15.5, y: 24.8 };
  const at = { x: spot.x + 1.2, y: spot.y - 0.9 };
  const goat: Goat = {
    id: 'goat_1',
    name: 'Noisette',
    pos: { ...at },
    prev: { ...at },
    facing: -2.2,
    wander: { ...at },
    happiness: 82,
    stake: 'goat_graze_02',
    led: null,
    home: false,
    milkedDay: null,
    wateredDay: day,
    milking: null,
  };
  b.goats.push(goat);
  if (mode === 'mene') {
    const p1 = world.characters[0];
    if (p1 !== undefined) {
      const lead = { x: 14.2, y: 19.6 };
      p1.pos = { ...lead };
      p1.prev = { ...lead };
      const behind = { x: lead.x + 1.1, y: lead.y + 1.0 };
      b.goats.push({
        ...goat,
        id: 'goat_2',
        name: 'Réglisse',
        pos: { ...behind },
        prev: { ...behind },
        wander: { ...behind },
        facing: -2.4,
        stake: 'goat_graze_01',
        led: p1.id,
      });
    }
  }
}
