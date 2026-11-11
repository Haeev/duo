// Comptoir tenu (`held` de la brique `shop`): depuis le côté client, la touche d'action s'adresse
// au commerçant qui se tient derrière. Dialogue en attente d'abord, sinon la boutique; « Parler »
// depuis la boutique; une réplique de quête ne rouvre pas la boutique derrière elle. Test court.
import { describe, expect, it } from 'vitest';
import type { Content } from '../src/donnees/charger';
import { aimOf } from '../src/simulation/briques/visee';
import { startTalk, talkView } from '../src/simulation/dialogues/conversation';
import { DIALOGUES } from '../src/simulation/dialogues/reglages';
import type { Sim } from '../src/simulation/noyau/pas';
import { remember } from '../src/simulation/regles/memoire';
import { act, contentWith, contextOf, wait } from './aides-l3';
import { put } from './aides-noyau';
import { newSim } from './aides';

type Json = Record<string, unknown>;
const AUBRUNE = 'aubrune';
const COUNTER = 'epicerie-comptoir';
const KEEPER = 'odette';
const SHOP = 'epicerie-ferrand';
/** Côté client du comptoir de l'épicerie (pièce en (48; 210), comptoir en (50,5; 213)), face à lui. */
const CLIENT = { x: 51.4, y: 213, facing: Math.PI } as const;
const NEWS = 'aubrune.essai.comptoir';

/** Aubrune à 10 h, plus un dialogue factice d'histoire d'Odette (répété, ouvert par un fait). */
function counterContent(): Content {
  return contentWith((files) => {
    const settings = files['commun/reglages.json'] as { start: Json };
    settings.start = { ...settings.start, place: AUBRUNE, minute: 600 };
    files['lieux/aubrune/dialogues/odette-essai-comptoir.json'] = {
      schema: 1,
      id: 'odette-essai-comptoir',
      villager: KEEPER,
      priority: 55,
      when: [{ type: 'remembered', key: NEWS, equals: true }],
      once: null,
      start: 'n1',
      nodes: {
        n1: {
          kind: 'line',
          speaker: KEEPER,
          text: 'Approche, j’ai une nouvelle pour toi.',
          emote: null,
          next: null,
        },
      },
    };
  });
}

function sim10h(content: Content): Sim {
  const sim = newSim(content);
  wait(sim, 0.2);
  const story = sim.world.common.story;
  if (story !== undefined) story.scene = null;
  sim.world.minutes = 600;
  wait(sim, 2);
  put(sim, 0, CLIENT.x, CLIENT.y, CLIENT.facing);
  wait(sim, 0.1);
  return sim;
}

/** Lit la conversation ouverte jusqu'à son terme ou jusqu'à la page de la boutique. */
function readThrough(sim: Sim): string[] {
  const seen: string[] = [];
  for (let i = 0; i < 12; i++) {
    const talk = sim.world.players[0].talk;
    if (talk === null || talk.node === DIALOGUES.shopOffer.node) break;
    seen.push(`${talk.dialogue}#${talk.node}`);
    const options = talkView(sim.content, sim.world, 0)?.options ?? [];
    const first = options[0];
    if (first === undefined) act(sim, 0, { type: 'talk_next' });
    else act(sim, 0, { type: 'talk_choose', option: first.id });
  }
  return seen;
}

describe('comptoir tenu', () => {
  const content = counterContent();

  it('le commerçant est hors de portée de la touche d’action depuis le côté client', () => {
    const sim = sim10h(content);
    const keeper = sim.world.places[AUBRUNE]?.villagers[KEEPER]?.body;
    if (keeper === undefined) throw new Error('Odette absente');
    const me = sim.world.players[0].body;
    expect(Math.hypot(keeper.x - me.x, keeper.y - me.y)).toBeGreaterThan(
      content.settings.reach.action,
    );
    expect(aimOf(sim, 0)).toMatchObject({ id: COUNTER, verb: 'Acheter', refusal: null });
  });

  it('dialogue en attente: il se joue d’abord, sans boutique derrière; ensuite la boutique', () => {
    const sim = sim10h(content);
    remember(contextOf(sim), NEWS, true, 'duo');
    expect(aimOf(sim, 0)).toMatchObject({ id: COUNTER, verb: 'Parler', refusal: null });
    const events = act(sim, 0, { type: 'act' });
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'talk_started', player: 0, villager: KEEPER }),
    );
    expect(readThrough(sim)).toEqual(['odette-essai-comptoir#n1']);
    // Réplique d'histoire: pas d'offre de la boutique derrière elle.
    expect(sim.world.players[0].talk).toBeNull();
    wait(sim, 0.2);
    // Entendue aujourd'hui: le comptoir ouvre la boutique.
    expect(aimOf(sim, 0)).toMatchObject({ id: COUNTER, verb: 'Acheter' });
    expect(act(sim, 0, { type: 'act' })).toContainEqual({
      type: 'shop_opened',
      player: 0,
      shop: SHOP,
    });
    // Le lendemain, la nouvelle repasse avant la boutique.
    sim.world.common.day += 1;
    expect(aimOf(sim, 0)?.verb).toBe('Parler');
  });

  it('en face: la nouvelle réentendue le même jour débouche sur l’offre de la boutique', () => {
    const sim = sim10h(content);
    remember(contextOf(sim), NEWS, true, 'duo');
    // Première écoute du jour, par-dessus le comptoir: pas d'offre derrière la réplique.
    expect(startTalk(contextOf(sim), 0, KEEPER)).toBe(true);
    expect(readThrough(sim)).toEqual(['odette-essai-comptoir#n1']);
    expect(sim.world.players[0].talk).toBeNull();
    // Réentendue par-dessus le comptoir: toujours pas d'offre (le comptoir ouvre la boutique).
    startTalk(contextOf(sim), 0, KEEPER);
    readThrough(sim);
    expect(sim.world.players[0].talk).toBeNull();
    // Réentendue ce jour-là en face: la boutique est proposée, comme après le quotidien.
    const keeper = sim.world.places[AUBRUNE]?.villagers[KEEPER]?.body;
    if (keeper === undefined) throw new Error('Odette absente');
    Object.assign(sim.world.players[0].body, { x: keeper.x + 0.9, y: keeper.y });
    startTalk(contextOf(sim), 0, KEEPER);
    expect(readThrough(sim)).toEqual(['odette-essai-comptoir#n1']);
    expect(sim.world.players[0].talk?.node).toBe(DIALOGUES.shopOffer.node);
    expect(act(sim, 0, { type: 'talk_choose', option: DIALOGUES.shopOffer.open })).toContainEqual({
      type: 'shop_opened',
      player: 0,
      shop: SHOP,
    });
    // Le lendemain, la première écoute repasse sans offre.
    sim.world.common.day += 1;
    startTalk(contextOf(sim), 0, KEEPER);
    readThrough(sim);
    expect(sim.world.players[0].talk).toBeNull();
  });

  it('« Parler » depuis la boutique: la conversation ordinaire, puis l’offre de la boutique', () => {
    const sim = sim10h(content);
    const events = act(sim, 0, { type: 'shop_talk', shop: SHOP });
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'talk_started', player: 0, villager: KEEPER }),
    );
    readThrough(sim);
    expect(sim.world.players[0].talk?.node).toBe(DIALOGUES.shopOffer.node);
    // Trop loin du commerçant comme de son comptoir: refusé.
    act(sim, 0, { type: 'talk_close' });
    put(sim, 0, CLIENT.x + 6, CLIENT.y, CLIENT.facing);
    expect(act(sim, 0, { type: 'shop_talk', shop: SHOP })).toContainEqual({
      type: 'refused',
      player: 0,
      reason: 'too-far',
      target: SHOP,
    });
  });

  it('commerçant parti de son comptoir: la boutique s’ouvre, sans détour', () => {
    const sim = sim10h(content);
    remember(contextOf(sim), NEWS, true, 'duo');
    const keeper = sim.world.places[AUBRUNE]?.villagers[KEEPER]?.body;
    if (keeper === undefined) throw new Error('Odette absente');
    keeper.x += 4;
    expect(aimOf(sim, 0)).toMatchObject({ id: COUNTER, verb: 'Acheter' });
  });
});
