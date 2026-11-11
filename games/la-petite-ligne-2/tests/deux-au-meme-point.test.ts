// Deux personnages ne s'arrêtent jamais sur la même place: deux habitants factices (le gabarit
// copié deux fois) ont le même poste à la même heure. Test court, graine fixe.
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadContent, type Content } from '../src/donnees/charger';
import { currentPlace } from '../src/reseau/tranches';
import { VILLAGERS } from '../src/simulation/habitants/reglages';
import { createWorld } from '../src/simulation/noyau/monde';
import { createSim, type Sim } from '../src/simulation/noyau/pas';
import { plan } from '../outils/nouveau';
import { wait } from './aides-l3';
import { dataFiles, MEMBERS, SEED } from './aides';

type Json = Record<string, unknown>;
const TEMPLATE_DIR = fileURLToPath(new URL('../donnees/_gabarits/', import.meta.url));
const TWINS = ['facteur', 'facteur-bis'] as const;

/** La gare d'essai et deux facteurs du gabarit, au même planning (donc aux mêmes postes). */
function twinsContent(): Content {
  const files = dataFiles() as Record<string, Json>;
  for (const id of TWINS)
    for (const file of plan(TEMPLATE_DIR, 'habitant', id, 'essai-gare'))
      files[file.path] = file.value;
  return loadContent(files);
}

function simAt(content: Content, minutes: number): Sim {
  const world = createWorld(content, SEED, MEMBERS);
  world.minutes = minutes;
  // Les joueurs près de la gare: les habitants vivent à pleine fréquence.
  world.players[0].body = { x: 17, y: 18, facing: 0, speed: 0 };
  world.players[1].body = { x: 23, y: 18, facing: 0, speed: 0 };
  return createSim(content, world);
}

/** Écart entre les deux facteurs (m). */
function gap(sim: Sim): number {
  const [a, b] = TWINS.map((id) => currentPlace(sim.world).villagers[id]?.body);
  if (a === undefined || b === undefined) throw new Error('facteur absent');
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe('deux personnages, une seule place', () => {
  const content = twinsContent();

  it('posés d’un coup à leur poste (reprise, heure avancée): l’un à côté de l’autre', () => {
    const sim = simAt(content, 11 * 60 + 30);
    wait(sim, 0.2);
    expect(gap(sim)).toBeGreaterThanOrEqual(VILLAGERS.radius * 2);
  });

  it('partis ensemble vers le même poste: le second s’arrête sur une place libre voisine', () => {
    const sim = simAt(content, 11 * 60 + 59);
    wait(sim, 0.2);
    // Midi: les deux marchent en même temps vers le même point de flânerie.
    sim.world.minutes = 12 * 60;
    wait(sim, 20);
    for (const id of TWINS)
      expect(currentPlace(sim.world).villagers[id]?.life).toMatchObject({
        activity: 'flaner',
        pose: 'stand',
      });
    expect(gap(sim)).toBeGreaterThanOrEqual(VILLAGERS.radius * 2);
  });

  it('repris d’une sauvegarde faite en pleine marche: aucun ne reste figé, chacun à sa place', () => {
    const sim = simAt(content, 11 * 60 + 30);
    wait(sim, 0.2);
    // Le second arrivait encore à pied quand la partie a été enregistrée (le trajet ne l'est pas).
    const walker = currentPlace(sim.world).villagers[TWINS[1]];
    if (walker?.life === undefined) throw new Error('facteur absent');
    walker.life.presence = 'arriving';
    walker.life.pose = 'walk';
    walker.body = { x: walker.body.x, y: walker.body.y - 6, facing: 0, speed: 1.4 };
    const saved = JSON.parse(JSON.stringify(sim.world)) as typeof sim.world;
    const resumed = createSim(content, saved);
    wait(resumed, 2);
    expect(currentPlace(resumed.world).villagers[TWINS[1]]?.life).toMatchObject({
      presence: 'here',
      pose: 'stand',
    });
    expect(gap(resumed)).toBeGreaterThanOrEqual(VILLAGERS.radius * 2);
  });
});
