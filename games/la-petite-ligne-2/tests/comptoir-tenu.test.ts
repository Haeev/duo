// Comptoir tenu (`held` de la brique `shop`): depuis le côté client, la touche d'action s'adresse
// au commerçant qui se tient derrière. Seule sa réplique d'HISTOIRE en attente (étape de quête
// ouverte) passe avant la boutique, une fois; souvenirs, cadeaux et petites phrases attendent
// « Parler » de la boutique; une réplique de quête ne rouvre pas la boutique derrière elle. Test court.
import { describe, expect, it } from 'vitest';
import type { Content } from '../src/donnees/charger';
import { keeperHasNews } from '../src/interface/boutique/modele';
import { aimOf } from '../src/simulation/briques/visee';
import { pickDialogue, startTalk, talkView } from '../src/simulation/dialogues/conversation';
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
const QUEST = 'suite-essai-comptoir';
/** Fait écrit à l'ouverture de l'étape factice (il ouvre la réplique d'histoire), puis à sa fin. */
const STEP = 'aubrune.essai.comptoir.etape';
const STEP_DONE = 'aubrune.essai.comptoir.fini';
/** Faits qui ouvrent le cadeau et le souvenir factices (hors de toute quête). */
const GIFT = 'aubrune.essai.comptoir.cadeau';
const MEMORY = 'aubrune.essai.comptoir.souvenir';

function oneLine(
  id: string,
  priority: number,
  when: Json[],
  once: string | null,
  text: string,
): Json {
  return {
    schema: 1,
    id,
    villager: KEEPER,
    priority,
    when,
    once,
    start: 'n1',
    nodes: { n1: { kind: 'line', speaker: KEEPER, text, emote: null, next: null } },
  };
}

/**
 * Aubrune à 10 h, plus une suite factice d'une étape qui ouvre une réplique d'histoire d'Odette
 * (répétée, priorité 55), un cadeau plus prioritaire (58, une fois) et un souvenir (30, une fois).
 */
function counterContent(): Content {
  return contentWith((files) => {
    const settings = files['commun/reglages.json'] as { start: Json };
    settings.start = { ...settings.start, place: AUBRUNE, minute: 600 };
    files['lieux/aubrune/dialogues/odette-essai-comptoir.json'] = oneLine(
      'odette-essai-comptoir',
      55,
      [{ type: 'remembered', key: STEP, equals: 'ouvert' }],
      null,
      'Approche, j’ai une nouvelle pour toi.',
    );
    files['lieux/aubrune/dialogues/odette-essai-cadeau.json'] = oneLine(
      'odette-essai-cadeau',
      58,
      [{ type: 'remembered', key: GIFT, equals: true }],
      'player',
      'Tiens, c’est pour toi.',
    );
    files['lieux/aubrune/dialogues/odette-essai-souvenir.json'] = oneLine(
      'odette-essai-souvenir',
      30,
      [{ type: 'remembered', key: MEMORY, equals: true }],
      'player',
      'Tu te souviens du premier jour ?',
    );
    // Le chargement refuse une condition qu'aucune donnée n'écrit: ce dialogue jamais joué (le
    // moins prioritaire d'un autre habitant) écrit les deux faits que le test pose à la main.
    files['lieux/aubrune/dialogues/achille-essai-comptoir.json'] = {
      schema: 1,
      id: 'achille-essai-comptoir',
      villager: 'achille',
      priority: -100,
      when: [],
      once: null,
      start: 'e1',
      nodes: {
        e1: {
          kind: 'effects',
          effects: [
            { type: 'remember', key: NEWS, value: true, by: 'duo' },
            { type: 'remember', key: STEP_DONE, value: true, by: 'duo' },
          ],
          next: 'n1',
        },
        n1: { kind: 'line', speaker: 'achille', text: 'Mmh.', emote: null, next: null },
      },
    };
    files[`lieux/aubrune/quetes/${QUEST}.json`] = {
      schema: 1,
      id: QUEST,
      kind: 'side',
      title: 'La nouvelle d’Odette',
      giver: KEEPER,
      requires: [{ type: 'remembered', key: NEWS, equals: true }],
      chapters: [
        {
          id: 'chapitre-1',
          title: 'La nouvelle',
          steps: [
            {
              id: 'nouvelle',
              objective: 'Écoute la nouvelle d’Odette.',
              target: { villager: KEEPER },
              done: [{ type: 'remembered', key: STEP_DONE, equals: true }],
              together: false,
              onStart: [{ type: 'remember', key: STEP, value: 'ouvert', by: 'duo' }],
              onDone: [{ type: 'remember', key: STEP, value: 'fait', by: 'duo' }],
            },
          ],
        },
      ],
    };
  });
}

/** Ouvre la suite factice: son étape écrit le fait qui ouvre la réplique d'histoire d'Odette. */
function openStory(sim: Sim): void {
  remember(contextOf(sim), NEWS, true, 'duo');
  wait(sim, 0.5);
  expect(sim.world.progress.quests[QUEST]?.done).toBe(false);
  expect(sim.world.progress.memory[STEP]?.v).toBe('ouvert');
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

  it('réplique d’histoire en attente: elle se joue d’abord, sans boutique derrière; ensuite la boutique', () => {
    const sim = sim10h(content);
    openStory(sim);
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
    // L'étape franchie, ce n'est plus de l'histoire: le comptoir vend, ce jour comme les suivants.
    remember(contextOf(sim), STEP_DONE, true, 'duo');
    wait(sim, 0.5);
    expect(sim.world.progress.quests[QUEST]?.done).toBe(true);
    expect(aimOf(sim, 0)).toMatchObject({ id: COUNTER, verb: 'Acheter' });
  });

  it('trois dialogues en attente (cadeau, histoire, souvenir): un seul appui avant la boutique, celui de l’histoire', () => {
    const sim = sim10h(content);
    openStory(sim);
    remember(contextOf(sim), GIFT, true, 'duo');
    remember(contextOf(sim), MEMORY, true, 'duo');
    // En face, Odette dirait d'abord le cadeau (le plus prioritaire); au comptoir, l'histoire seule.
    expect(pickDialogue(sim, 0, KEEPER)?.id).toBe('odette-essai-cadeau');
    expect(aimOf(sim, 0)).toMatchObject({ id: COUNTER, verb: 'Parler', refusal: null });
    act(sim, 0, { type: 'act' });
    expect(readThrough(sim)).toEqual(['odette-essai-comptoir#n1']);
    expect(sim.world.players[0].talk).toBeNull();
    wait(sim, 0.2);
    // Deuxième appui: la boutique, alors que le cadeau et le souvenir attendent toujours.
    expect(aimOf(sim, 0)).toMatchObject({ id: COUNTER, verb: 'Acheter' });
    expect(act(sim, 0, { type: 'act' })).toContainEqual({
      type: 'shop_opened',
      player: 0,
      shop: SHOP,
    });
    // Ils se disent par « Parler » de la boutique, dans l'ordre d'une conversation en face (le
    // cadeau, puis la nouvelle tant que l'étape est ouverte, puis le souvenir), et le comptoir
    // vend entre-temps.
    const heard: string[] = [];
    const talkFromShop = (): void => {
      act(sim, 0, { type: 'shop_talk', shop: SHOP });
      heard.push(...readThrough(sim));
      act(sim, 0, { type: 'talk_close' });
      wait(sim, 0.2);
      expect(aimOf(sim, 0)).toMatchObject({ id: COUNTER, verb: 'Acheter' });
    };
    talkFromShop();
    talkFromShop();
    remember(contextOf(sim), STEP_DONE, true, 'duo');
    wait(sim, 0.5);
    talkFromShop();
    expect(heard).toEqual([
      'odette-essai-cadeau#n1',
      'odette-essai-comptoir#n1',
      'odette-essai-souvenir#n1',
    ]);
  });

  it('sans histoire en attente (souvenir, cadeau, première visite): la boutique au premier appui', () => {
    const sim = sim10h(content);
    remember(contextOf(sim), GIFT, true, 'duo');
    remember(contextOf(sim), MEMORY, true, 'duo');
    // Les vraies répliques d'Odette aussi: le train revenu (souvenir) et des œufs à vendre (accueil).
    remember(contextOf(sim), 'aubrune.acte2.train', true, 'duo');
    sim.world.players[0].toolbar[0] = { item: 'oeuf', count: 3 };
    wait(sim, 0.2);
    expect(pickDialogue(sim, 0, KEEPER)?.id).toBe('odette-essai-cadeau');
    expect(aimOf(sim, 0)).toMatchObject({ id: COUNTER, verb: 'Acheter', refusal: null });
    expect(act(sim, 0, { type: 'act' })).toContainEqual({
      type: 'shop_opened',
      player: 0,
      shop: SHOP,
    });
    expect(sim.world.players[0].talk).toBeNull();
  });

  it('pastille de « Parler » (écran de boutique): allumée tant qu’une réplique non entendue attend', () => {
    const sim = sim10h(content);
    const news = (): boolean => keeperHasNews(sim.content, sim.world, 0, KEEPER);
    const talkFromShop = (): void => {
      act(sim, 0, { type: 'shop_talk', shop: SHOP });
      readThrough(sim);
      act(sim, 0, { type: 'talk_close' });
      wait(sim, 0.2);
    };
    // Ce qu'Odette a de neuf au départ (première visite...) s'épuise; le quotidien n'allume rien.
    for (let i = 0; i < 6 && news(); i++) talkFromShop();
    expect(news()).toBe(false);
    expect(pickDialogue(sim, 0, KEEPER)?.once ?? null).toBeNull();
    // Un cadeau (une fois): allumée, puis éteinte une fois entendu.
    remember(contextOf(sim), GIFT, true, 'duo');
    wait(sim, 0.2);
    expect(news()).toBe(true);
    talkFromShop();
    expect(news()).toBe(false);
    // Une nouvelle d'histoire qui se répète: allumée jusqu'à l'écoute du jour, et le lendemain.
    openStory(sim);
    expect(news()).toBe(true);
    talkFromShop();
    expect(news()).toBe(false);
    sim.world.common.day += 1;
    expect(news()).toBe(true);
  });

  it('remarque d’hygiène plus prioritaire: elle masque l’histoire, la boutique s’ouvre', () => {
    const sim = sim10h(content);
    openStory(sim);
    sim.world.players[0].needs.hygiene = 5;
    wait(sim, 0.2);
    expect(pickDialogue(sim, 0, KEEPER)?.id).toBe('odette-hygiene');
    expect(aimOf(sim, 0)).toMatchObject({ id: COUNTER, verb: 'Acheter' });
    // Lavé, l'histoire repasse devant.
    sim.world.players[0].needs.hygiene = 100;
    wait(sim, 0.2);
    expect(aimOf(sim, 0)).toMatchObject({ id: COUNTER, verb: 'Parler' });
  });

  it('faim à 0 sans un sou: la soupe offerte passe avant la boutique, une fois', () => {
    const sim = sim10h(content);
    sim.world.players[0].money = 0;
    sim.world.players[0].needs.hunger = 0;
    wait(sim, 0.1);
    expect(sim.world.players[0].tiers.hunger).toBe('blocked');
    expect(aimOf(sim, 0)).toMatchObject({ id: COUNTER, verb: 'Parler', refusal: null });
    act(sim, 0, { type: 'act' });
    expect(sim.world.players[0].talk?.dialogue).toBe('odette-soupe-offerte');
    readThrough(sim);
    expect(sim.world.players[0].needs.hunger).toBeGreaterThan(30);
    wait(sim, 0.2);
    expect(aimOf(sim, 0)).toMatchObject({ id: COUNTER, verb: 'Acheter' });
    // Affamé mais avec de quoi payer: la boutique sert mieux, elle s'ouvre.
    sim.world.players[0].money = 500;
    sim.world.players[0].needs.hunger = 0;
    wait(sim, 0.1);
    expect(aimOf(sim, 0)).toMatchObject({ id: COUNTER, verb: 'Acheter' });
  });

  it('en face: la nouvelle réentendue le même jour débouche sur l’offre de la boutique', () => {
    const sim = sim10h(content);
    openStory(sim);
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

  it('commerçant pas à son poste: la boutique s’ouvre, sans détour; à son poste, sa position ne compte pas', () => {
    const sim = sim10h(content);
    openStory(sim);
    const keeper = sim.world.places[AUBRUNE]?.villagers[KEEPER];
    const life = keeper?.life;
    if (keeper === undefined || life === undefined) throw new Error('Odette absente');
    expect(life.activity).not.toBeNull();
    const activity = life.activity;
    // En chemin vers son comptoir (activité nulle), même tout près: pas encore derrière.
    life.activity = null;
    expect(aimOf(sim, 0)).toMatchObject({ id: COUNTER, verb: 'Acheter' });
    // Arrivée: chez l'invité, la position interpolée peut traîner au-delà de `keeperReach`;
    // l'état de vie transmis suffit, la bulle dit la même chose que l'hôte.
    life.activity = activity;
    keeper.body.x -= 1.6;
    expect(aimOf(sim, 0)).toMatchObject({ id: COUNTER, verb: 'Parler' });
  });
});
