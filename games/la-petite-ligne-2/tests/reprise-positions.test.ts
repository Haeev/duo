// Reprise (défaut D11 de la recette): quitter puis reprendre replace chacun là où il était. Le
// garde-fou des personnages coincés (`noyau/deblocage.ts`) ne doit dégager que ceux qui le sont
// vraiment: ni un joueur debout dans le couloir du wagon, ni un joueur entré dans une maison (un
// intérieur ne se rejoint que par sa porte, pas à pied depuis le quai).
import { describe, expect, it } from 'vitest';
import { loadContent, type Content } from '../src/donnees/charger';
import type { WorldState } from '../src/etat/monde';
import { restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { bodyCollides } from '../src/simulation/noyau/grille';
import { createPlaceState, createWorld, placeAtArrival } from '../src/simulation/noyau/monde';
import { currentBlockers } from '../src/simulation/noyau/obstacles';
import { createSim } from '../src/simulation/noyau/pas';
import { gameDataFiles, MEMBERS, SEED } from './aides';
import { walkableFromArrival } from './aides-acces';
import { wait } from './aides-l3';

const content = loadContent(gameDataFiles());

/** Sauvegarde puis reprise, comme le jeu: instantané, JSON, lecture, simulation recréée. */
function saveAndResume(game: Content, world: WorldState): WorldState {
  const snapshot = snapshotOf(world, game);
  const loaded = {
    dataSchema: snapshot.dataSchema,
    data: JSON.parse(JSON.stringify(snapshot.data)) as unknown,
  };
  const restored = restoreWorld(game, loaded, MEMBERS);
  if (!restored.ok) throw new Error(`reprise refusée: ${restored.reason}`);
  const sim = createSim(game, restored.world);
  wait(sim, 0.5);
  return sim.world;
}

const AHEAD = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
] as const;

const spotsOf = (world: WorldState): number[][] =>
  world.players.map((p) => [Number(p.body.x.toFixed(2)), Number(p.body.y.toFixed(2))]);

describe('reprise: chacun reparaît là où il était', () => {
  it('au milieu du prologue, les deux reprennent sur chaque case libre du wagon', () => {
    const place = content.places[content.settings.start.place];
    if (place === undefined) throw new Error('lieu de départ absent');
    const { width } = place.map;
    // Hors des cases où se tient un habitant: il pousse qui s'y pose, ce n'est pas la reprise.
    const posts = place.villagers.map((v) => place.map.points[v.stands]);
    const cells = [...walkableFromArrival(content, place)].filter((i) =>
      posts.every(
        (at) =>
          at === undefined ||
          Math.hypot(at.x - ((i % width) + 0.5), at.y - (Math.floor(i / width) + 0.5)) > 1,
      ),
    );
    expect(cells.length).toBeGreaterThan(4);
    // Deux joueurs sur deux cases libres différentes, toutes les cases y passent.
    for (const [n, i] of cells.entries()) {
      const j = cells[(n + 1) % cells.length] ?? i;
      const world = createWorld(content, SEED, MEMBERS);
      const story = world.common.story;
      if (story !== undefined) story.scene = null;
      for (const [p, cell] of [i, j].entries()) {
        const body = world.players[p]?.body;
        if (body === undefined) throw new Error('joueur absent');
        body.x = (cell % width) + 0.5 + 0.1 * p;
        body.y = Math.floor(cell / width) + 0.5 - 0.1 * p;
      }
      const before = spotsOf(world);
      expect(spotsOf(saveAndResume(content, world)), `cases ${String(i)} et ${String(j)}`).toEqual(
        before,
      );
    }
  });

  it('dans chaque intérieur de chaque lieu, un joueur entré par la porte y reparaît', () => {
    let tried = 0;
    for (const place of Object.values(content.places)) {
      const reached = walkableFromArrival(content, place);
      for (const [id, door] of Object.entries(place.map.doors ?? {})) {
        const world = createWorld(content, SEED, MEMBERS);
        world.common.place = place.def.id;
        world.places[place.def.id] ??= createPlaceState(content, place);
        placeAtArrival(content, world);
        const story = world.common.story;
        if (story !== undefined) story.scene = null;
        // Histoire avancée: tous les verrous levés (leurs faits posés), tout le lieu se parcourt.
        for (const lock of Object.values(place.map.locks ?? {}))
          for (const c of lock.opens)
            if (c.type === 'remembered')
              world.progress.memory[c.key] = { v: c.equals ?? true, by: 'duo', day: 1 };
        const b = currentBlockers(content, world);
        if (b === null) throw new Error('obstacles absents');
        // Un pas devant la porte, du côté où l'on arrive en la passant (0 sud, 1 est, 2 nord, 3 ouest).
        const [dx, dy] = AHEAD[door.facing];
        const spot = { x: Math.floor(door.x) + 0.5 + dx, y: Math.floor(door.y) + 0.5 + dy };
        if (bodyCollides(b, spot.x, spot.y, content.settings.movement.radius)) continue;
        // Une autre porte sur cette case (palier d'escalier): s'y tenir, c'est la passer.
        const onDoor = Object.values(place.map.doors ?? {}).some(
          (d) => Math.floor(d.x) === Math.floor(spot.x) && Math.floor(d.y) === Math.floor(spot.y),
        );
        if (onDoor) continue;
        // Pièce que la carte ne relie à rien (défaut de carte, signalé à part): personne n'y entre.
        if (!reached.has(Math.floor(spot.y) * place.map.width + Math.floor(spot.x))) continue;
        tried += 1;
        // Un seul joueur passe la porte: l'autre reste où il est né.
        Object.assign(world.players[0].body, spot);
        const before = spotsOf(world);
        expect(spotsOf(saveAndResume(content, world)), `${place.def.id}, porte ${id}`).toEqual(
          before,
        );
      }
    }
    expect(tried, 'des portes ont été essayées').toBeGreaterThan(10);
  });
});
