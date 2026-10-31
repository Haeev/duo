import { describe, expect, it } from 'vitest';
import { loadContent } from '../../donnees/contenu';
import { loadMap } from '../../donnees/carte';
import { MAP_FILES } from '../../donnees/cartes-fichiers';
import { CONTENT_FILES } from '../../donnees/fichiers';
import { BenchSeating, benchById, benchesOf } from '../../etat/bancs';
import type { WorldState } from '../../etat/types';
import { createExampleWorld, type DemoOptions } from './etat-exemple';

const content = loadContent(CONTENT_FILES);
const map = loadMap(MAP_FILES).map;
const BASE: DemoOptions = {
  minutes: 9 * 60,
  weather: 'sunny',
  inside: false,
  repaired: false,
  train: 'away',
  pin: false,
  fishing: 'none',
  absent: false,
};

/** Banc sur lequel le rendu dessine l'habitant assis (même règle que `personnages.ts`), ou `null`. */
function seatOf(world: WorldState, villagerId: string): string | null {
  const seating = new BenchSeating();
  seating.update(
    benchesOf(map),
    content.settings.benches,
    map.points,
    world.characters,
    world.villagers,
  );
  const index = world.villagers.findIndex((villager) => villager.id === villagerId);
  return seating.bench[index]?.id ?? null;
}

describe('page de rendu: habitants placés comme le jeu (revue du directeur artistique, tour 5)', () => {
  it('assoit Jeanne sur le banc du quai le matin, hors de l’emprise du banc', () => {
    const world = createExampleWorld(map, content, BASE);
    const jeanne = world.villagers.find((villager) => villager.id === 'jeanne');
    expect(jeanne?.visible).toBe(true);
    expect(seatOf(world, 'jeanne')).toBe('quay_bench');
    const bench = benchById(map, 'quay_bench');
    expect(bench?.rect).toBeDefined();
    const rect = bench?.rect ?? null;
    if (jeanne === undefined || rect === null) {
      return;
    }
    const { x, y, w, h } = rect;
    const inside =
      jeanne.pos.x > x && jeanne.pos.x < x + w && jeanne.pos.y > y && jeanne.pos.y < y + h;
    expect(inside).toBe(false);
  });

  it('suit l’emploi du temps: Firmin à sa cloche, Jeanne assise au banc de la berge l’après-midi', () => {
    const world = createExampleWorld(map, content, { ...BASE, minutes: 14 * 60 });
    expect(world.villagers.find((villager) => villager.id === 'firmin')?.target).toBe('quay_bell');
    expect(world.villagers.find((villager) => villager.id === 'jeanne')?.target).toBe('riverbank');
    expect(seatOf(world, 'jeanne')).toBe('riverbank_bench');
  });

  it('dans banc-quai, laisse le banc aux deux joueurs: Jeanne debout en 30,5 ; 17,5', () => {
    const world = createExampleWorld(map, content, {
      ...BASE,
      minutes: 10 * 60,
      scene: 'banc-quai',
    });
    const jeanne = world.villagers.find((villager) => villager.id === 'jeanne');
    expect(jeanne?.pos).toEqual({ x: 30.5, y: 17.5 });
    expect(seatOf(world, 'jeanne')).toBeNull();
    expect(world.characters.map((character) => character.seat?.bench ?? null)).toEqual([
      'quay_bench',
      'quay_bench',
    ]);
  });
});
