/** Aides des tests de sauvegarde: partie « vécue » (référence) et partie au pire. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Content } from '../src/donnees/charger';
import type { Stack } from '../src/etat/joueur';
import type { WorldState } from '../src/etat/monde';
import { createPlaceState, createWorld } from '../src/simulation/noyau/monde';
import { MEMBERS } from './aides';

/** Une sauvegarde de référence rangée dans `tests/donnees/`, relue telle quelle (JSON). */
export function referenceSave(version: number): { dataSchema: number; data: unknown } {
  const path = fileURLToPath(new URL(`./donnees/sauvegarde-v${version}.json`, import.meta.url));
  return { dataSchema: version, data: JSON.parse(readFileSync(path, 'utf8')) as unknown };
}

/**
 * Une partie avancée: jour 3, deux lieux visités (le premier quitté), sac, argent, besoins,
 * mémoire, amitiés, quête, collection. C'est ce qu'on range comme référence de la version courante.
 */
export function livedWorld(content: Content): WorldState {
  const world = createWorld(content, 7, MEMBERS);
  // Le lieu de départ et le premier lieu qu'il dessert (d'autres lieux peuvent s'ajouter aux données).
  const first = content.settings.start.place;
  const second = content.places[first]?.def.links[0];
  if (second === undefined) throw new Error('il faut deux lieux d’essai');
  world.tick = 5400;
  world.minutes = 14 * 60 + 5;
  world.common.day = 3;
  world.common.chest = 1500;
  world.common.weather = 'overcast';
  const place = content.places[second];
  if (place === undefined) throw new Error('lieu absent');
  const gone = world.places[first];
  if (gone === undefined) throw new Error('lieu de départ absent');
  gone.leftOn = 3;
  world.places[second] = createPlaceState(content, place);
  world.common.place = second;
  world.progress.opened.push(second);
  world.players[0].money = 4250;
  world.players[0].toolbar[0] = { item: 'buche', count: 3 };
  world.players[0].needs = { hunger: 40, sleep: 55.5, hygiene: 70 };
  world.players[1].money = 120;
  world.players[1].toolbar[1] = { item: 'hache-forgee', count: 1, wear: 30 };
  world.players[1].body = { x: 4.5, y: 6.25, facing: 1.5, speed: 0 };
  world.progress.memory[`${first}.pomme.cueillie`] = { v: true, by: 0, day: 2 };
  world.progress.bonds['j0-cheffe-de-gare'] = 12;
  world.progress.bonds['j1-cheffe-de-gare'] = 4;
  world.progress.quests.arrivee = { chapter: 'prologue', step: 'quai', done: false };
  world.progress.collections.poissons = ['gardon'];
  return world;
}

/** Le pire que les règles permettent, dans `lieux` lieux visités (voir `tailles.test.ts`). */
export function worstWorld(content: Content, lieux: number): WorldState {
  const world = livedWorld(content);
  const full: Stack = { item: 'hache-forgee', count: 1, wear: 120 };
  for (const player of world.players) {
    player.toolbar = player.toolbar.map(() => ({ ...full }));
    player.bag = {
      id: 'malle-a-bretelles',
      slots: Array.from({ length: 20 }, () => ({ ...full })),
    };
    player.look = {
      shape: 'adult-medium',
      skin: 3,
      pieces: ['body', 'head', 'hair', 'top', 'bottom', 'shoes', 'hat', 'glasses', 'accessory'].map(
        (slot) => ({
          slot: slot as 'body',
          id: `${slot}-piece-au-nom-long-00`,
          colors: [10, 20, 30],
        }),
      ),
    };
  }
  const model = Object.values(content.places)[0];
  if (model === undefined) throw new Error('aucun lieu');
  for (let n = 0; n < lieux; n++) {
    const id = `lieu-visite-${n}`;
    const state = createPlaceState(content, model);
    for (let i = 0; i < 80; i++)
      state.ground.push({ id: i, stack: { item: 'planche', count: 10 }, x: 12.345, y: 23.456 });
    for (let i = 0; i < 200; i++) {
      state.placed.push({ id: `pose-${i}`, type: 'banc', x: 12.5, y: 23.5, rotation: 1 });
      state.objects[`pose-${i}`] = { sit: [0, 1] };
    }
    for (let i = 0; i < 20; i++)
      state.villagers[`habitant-${i}`] = {
        met: [true, true],
        talkingWith: null,
        body: { x: 1, y: 1, facing: 0, speed: 0 },
      };
    world.places[id] = state;
  }
  const progress = world.progress;
  for (let i = 0; i < 300; i++)
    progress.memory[`lieu.sujet-${i}.detail`] = { v: `valeur-${i}`, by: 'duo', day: 999 };
  for (let i = 0; i < 60; i++) progress.bonds[`habitant-${i}`] = 9999;
  for (let i = 0; i < 40; i++)
    progress.quests[`suite-de-quetes-${i}`] = {
      chapter: 'chapitre-final',
      step: 'derniere-etape',
      done: true,
    };
  for (let i = 0; i < 8; i++)
    progress.collections[`collection-${i}`] = Array.from({ length: 40 }, (_, n) => `entree-${n}`);
  return world;
}
