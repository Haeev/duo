// Répliques des scènes à l'écran (défaut D1): qui parle, pour qui, qui a lu, accords, fondu, et
// l'avance par `scene_next` quand les deux ont lu (le délai d'un lecteur seul part de sa lecture).
import { describe, expect, it } from 'vitest';
import type { Content } from '../src/donnees/charger';
import { sceneScreenModel } from '../src/interface/histoire/modele';
import { paginate } from '../src/interface/modeles';
import { HOOKS } from '../src/simulation/quetes/crochets';
import { STORY } from '../src/simulation/quetes/reglages';
import { queueScene } from '../src/simulation/scenes/lecteur';
import { act, contentWith, contextOf, newSim, wait } from './aides-l3';

type Json = Record<string, unknown>;
const PLACE = 'essai-gare';
const CHEF = 'cheffe-de-gare';
const NNBSP = String.fromCharCode(0x202f);

function say(who: string, to: string, text: string, emote: string | null = null): Json {
  return { do: 'say', who, text, emote, sound: null, to, seconds: null };
}

const beats: Json[] = [
  say(CHEF, 'both', `Te voilà [[réveillée|réveillé]]${NNBSP}!`, 'surprise'),
  say('a', 'both', 'On a dormi sur le banc.'),
  say('narrator', 'a', 'Un billet dans ta poche.'),
  { do: 'fade', to: 'black', seconds: 1.5 },
  say(CHEF, 'both', 'Bienvenue.'),
];

function content(): Content {
  return contentWith((files) => {
    files[`lieux/${PLACE}/scenes/repliques.json`] = {
      schema: 1,
      id: 'repliques',
      title: 'Le réveil',
      together: false,
      roles: { a: 'Sur le banc', b: 'Sur le banc' },
      trigger: null,
      beats,
    };
  });
}

function started(): ReturnType<typeof newSim> {
  const sim = newSim(content());
  wait(sim, 0.2);
  const story = sim.world.common.story;
  if (story !== undefined) {
    story.scene = null;
    story.queue = [];
  }
  sim.world.players[0].gender = 'f';
  sim.world.players[1].gender = 'm';
  expect(queueScene(contextOf(sim), 'repliques', 0, HOOKS)).toBe(true);
  return sim;
}

describe('répliques des scènes', () => {
  it('chacun lit la réplique accordée; elle passe quand les deux ont lu, jetons « lu » croisés', () => {
    const sim = started();
    const mine = sceneScreenModel(sim.world, sim.content, 0);
    const theirs = sceneScreenModel(sim.world, sim.content, 1);
    expect(mine).toMatchObject({ title: 'Le réveil', kind: 'say', beat: 0, otherName: 'Bob' });
    expect(mine?.line).toMatchObject({
      speaker: { kind: 'villager', id: CHEF },
      text: `Te voilà réveillée${NNBSP}!`,
      audience: 'both',
      mark: '!',
      readByMe: false,
      readByOther: false,
    });
    expect(theirs?.line?.text).toBe(`Te voilà réveillé${NNBSP}!`);
    // Le signe reste collé au mot: jamais seul en début de ligne.
    expect(paginate(`${'mot '.repeat(14)}réveillé${NNBSP}!`)[0]?.split('\n')[1]).toBe(
      `réveillé${NNBSP}!`,
    );

    act(sim, 0, { type: 'scene_next' });
    expect(sceneScreenModel(sim.world, sim.content, 0)?.line?.readByMe).toBe(true);
    expect(sceneScreenModel(sim.world, sim.content, 1)?.line?.readByOther).toBe(true);
    // L'autre lit à son rythme: plus que l'ancien délai de 4 s, la réplique attend.
    wait(sim, STORY.soloReadSeconds - 0.5);
    expect(sim.world.common.story?.scene?.beat).toBe(0);
    act(sim, 1, { type: 'scene_next' });
    expect(sim.world.common.story?.scene?.beat).toBe(1);

    // Deux personnages se répondent: le personnage du joueur `a`, vu par chacun.
    expect(sceneScreenModel(sim.world, sim.content, 0)?.line?.speaker).toEqual({
      kind: 'player',
      player: 0,
      name: 'Ada',
      me: true,
      hidden: false,
    });
    expect(sceneScreenModel(sim.world, sim.content, 1)?.line?.speaker).toMatchObject({
      kind: 'player',
      me: false,
    });
  });

  it('réplique d’un seul rôle, délai d’un lecteur seul compté depuis sa lecture, fondu', () => {
    const sim = started();
    act(sim, 0, { type: 'scene_next' });
    act(sim, 1, { type: 'scene_next' });
    act(sim, 0, { type: 'scene_next' });
    act(sim, 1, { type: 'scene_next' });
    expect(sim.world.common.story?.scene?.beat).toBe(2);
    expect(sceneScreenModel(sim.world, sim.content, 0)?.line).toMatchObject({
      speaker: { kind: 'narrator' },
      audience: 'me',
      text: 'Un billet dans ta poche.',
    });
    // L'autre ne lit pas cette réplique: il voit seulement que l'on lit, sans le texte.
    expect(sceneScreenModel(sim.world, sim.content, 1)?.line).toMatchObject({
      audience: 'other',
      text: '',
    });
    act(sim, 0, { type: 'scene_next' });
    // Fondu au noir: la durée vient de la scène.
    expect(sceneScreenModel(sim.world, sim.content, 1)).toMatchObject({
      kind: 'other',
      fade: 'black',
      fadeSeconds: 1.5,
      line: null,
    });
    wait(sim, 1.6);
    expect(sceneScreenModel(sim.world, sim.content, 0)).toMatchObject({
      beat: 4,
      fade: 'black',
      fadeSeconds: null,
    });
    // Un seul lit, tard: l'autre a encore tout le délai après cette lecture.
    wait(sim, 3);
    act(sim, 1, { type: 'scene_next' });
    wait(sim, STORY.soloReadSeconds - 0.5);
    expect(sim.world.common.story?.scene?.beat).toBe(4);
    wait(sim, 0.6);
    expect(sim.world.common.story?.scene ?? null).toBeNull();
  });
});
