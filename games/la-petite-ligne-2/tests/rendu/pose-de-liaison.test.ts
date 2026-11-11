// Aucun personnage affiché dans sa pose de liaison (revue visuelle du 2026-11-11, correction 10):
// debout, en marche, en geste sans clip livré, assis, couché, dès l'image où il paraît et à
// l'image qui suit une porte franchie, les clips joués pèsent ensemble 1. Sous 1, le squelette
// garde le reste de la pose de liaison, bras écartés (« pose en T »).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Group } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { beforeAll, describe, expect, it } from 'vitest';
import type { VillagerLifeState } from '../../src/etat/habitants';
import type { CharacterLibrary } from '../../src/rendu/personnages/assemblage';
import { loadCharacterLibrary } from '../../src/rendu/personnages/chargement';
import { AssembledCharacters } from '../../src/rendu/personnages/couche';
import { createWorld } from '../../src/simulation/noyau/monde';
import { gameContent } from '../aides';

const content = gameContent();
const dir = fileURLToPath(new URL('../../assets/commun/personnages/', import.meta.url));
const loader = new GLTFLoader();

function parse(file: string): Promise<GLTF> {
  const buffer = readFileSync(dir + file);
  const data = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return loader.parseAsync(data, '');
}

let library: CharacterLibrary;
beforeAll(async () => {
  library = await loadCharacterLibrary(content.catalogue, content.morphologies, parse);
});

function life(patch: Partial<VillagerLifeState>): VillagerLifeState {
  return {
    presence: 'here',
    entry: 0,
    activity: null,
    pose: 'stand',
    gesture: null,
    seat: null,
    emote: null,
    emoteUntil: 0,
    gaze: null,
    ...patch,
  };
}

describe('pose de liaison', () => {
  it('tout personnage visible joue au moins le repos, dès son apparition et après une porte', () => {
    const world = createWorld(content, 3, [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ]);
    const place = world.places[world.common.place];
    if (place === undefined) throw new Error('lieu');
    // Le wagon du prologue: une banquette où s'asseoir, une couchette où dormir.
    const map = content.places[world.common.place]?.map;
    const seat = map?.objects.find((o) =>
      content.props[o.type]?.bricks.some((b) => b.brick === 'sit'),
    );
    const bed = map?.objects.find((o) =>
      content.props[o.type]?.bricks.some((b) => b.brick === 'sleep'),
    );
    if (seat === undefined || bed === undefined) throw new Error('wagon sans siège ni lit');
    const figures: Record<string, VillagerLifeState | undefined> = {
      'debout-essai': undefined,
      'geste-essai': life({ gesture: 'geste-jamais-livre' }),
      'assis-essai': life({ pose: 'sit', seat: [seat.id, 0] }),
      'couche-essai': life({ pose: 'lie', seat: [bed.id, 0] }),
    };
    let x = 2;
    for (const [id, state] of Object.entries(figures)) {
      place.villagers[id] = {
        met: [false, false],
        talkingWith: null,
        body: { x, y: 4, facing: 0, speed: id === 'debout-essai' ? 1.5 : 0 },
        ...(state === undefined ? {} : { life: state }),
      };
      x += 1;
    }
    const root = new Group();
    const layer = new AssembledCharacters(
      { root, playerColors: ['#d9654f', '#4f8fd9'] },
      { content, onEvent: () => () => undefined },
      library,
    );
    const ids = ['player-0', 'player-1', ...Object.keys(place.villagers)];
    const unanimated = (): string[] =>
      ids.filter((id) => {
        const shown = root.getObjectByName(`personnage-${id}`)?.visible ?? false;
        const weight = layer.animationWeight(id);
        return shown && (weight === null || weight < 0.99);
      });

    // Première image, même sans temps écoulé (image retenue): chacun a déjà sa pose.
    layer.update({ dt: 0, world, place, cameraYaw: 0 });
    expect(unanimated()).toEqual([]);
    for (let i = 0; i < 5; i += 1) layer.update({ dt: 1 / 60, world, place, cameraYaw: 0 });
    expect(unanimated()).toEqual([]);

    // Porte franchie: caché le temps du saut, puis posé et animé à l'image suivante.
    const walker = place.villagers['debout-essai'];
    if (walker === undefined) throw new Error('habitant');
    walker.body.x += 200;
    layer.update({ dt: 1 / 60, world, place, cameraYaw: 0 });
    layer.update({ dt: 1 / 60, world, place, cameraYaw: 0 });
    expect(root.getObjectByName('personnage-debout-essai')?.visible).toBe(true);
    expect(unanimated()).toEqual([]);
    layer.dispose();
  });
});
