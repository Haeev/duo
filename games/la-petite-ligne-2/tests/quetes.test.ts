// Moteur des quêtes et des scènes: la mini-suite d'essai déroulée de bout en bout, une suite et
// une scène factices ajoutées par le test, le déclencheur de 5 h 12, la reprise, le validateur.
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { ContentError } from '../src/donnees/charger';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { WorldSchema } from '../src/etat/monde';
import { BUDGET_BYTES } from '../src/reseau/canaux';
import { startTalk } from '../src/simulation/dialogues/conversation';
import { createSim, type Sim } from '../src/simulation/noyau/pas';
import { isZoneOpen } from '../src/simulation/quetes/faits';
import { glanceTarget, journal, seenScenes } from '../src/simulation/quetes/lecture';
import { STORY } from '../src/simulation/quetes/reglages';
import { sceneView } from '../src/simulation/scenes/lecture';
import { giveItem } from '../src/simulation/sac/actions';
import { countHeld } from '../src/simulation/regles/conditions';
import { fileURLToPath } from 'node:url';
import { plan } from '../outils/nouveau';
import { act, contentWith, contextOf, newSim, wait } from './aides-l3';

type Json = Record<string, unknown>;
const PLACE = 'essai-gare';
const TEMPLATE_DIR = fileURLToPath(new URL('../donnees/_gabarits/', import.meta.url));

function moveTo(sim: Sim, player: PlayerIndex, point: string): void {
  const at = sim.content.places[PLACE]?.map.points[point];
  if (at === undefined) throw new Error(point);
  sim.world.players[player].body.x = at.x;
  sim.world.players[player].body.y = at.y;
}

/** Parle à la cheffe et lit jusqu'au nœud `node` (sans fermer). */
function talkUntil(sim: Sim, player: PlayerIndex, node: string): void {
  expect(startTalk(contextOf(sim), player, 'cheffe-de-gare')).toBe(true);
  for (let i = 0; i < 6 && sim.world.players[player].talk?.node !== node; i++)
    act(sim, player, { type: 'talk_next' });
  expect(sim.world.players[player].talk?.node).toBe(node);
  wait(sim, 0.3);
  act(sim, player, { type: 'talk_close' });
}

/** La cheffe offre la besace (dialogue d'accueil): c'est ce qui ouvre la mini-suite. */
function welcome(sim: Sim): void {
  expect(startTalk(contextOf(sim), 0, 'cheffe-de-gare')).toBe(true);
  expect(sim.world.players[0].talk?.dialogue).toBe('accueil');
  for (let i = 0; i < 4 && sim.world.players[0].talk?.node !== 'choix'; i++)
    act(sim, 0, { type: 'talk_next' });
  act(sim, 0, { type: 'talk_choose', option: 'oui' });
  act(sim, 0, { type: 'talk_close' });
  act(sim, 0, { type: 'talk_close' });
}

function passed(sim: Sim, quest: string): readonly string[] {
  return sim.world.progress.quests[quest]?.passed ?? [];
}

/** Lit la réplique de scène en cours pour chaque joueur concerné. */
function readLine(sim: Sim): void {
  for (const p of [0, 1] as const) {
    const view = sceneView(sim.world, sim.content, p);
    if (view?.beat.kind === 'say' && view.beat.mine) act(sim, p, { type: 'scene_next' });
  }
}

describe('quêtes et scènes', () => {
  it('la mini-suite d’essai se joue: dialogue, objet remis, scène à deux asymétrique, verrou', () => {
    const sim = newSim();
    wait(sim, 0.3);
    expect(sim.world.progress.quests).toEqual({});
    welcome(sim);
    wait(sim, 0.3);
    expect(sim.world.progress.quests['sonnerie-essai']).toMatchObject({ step: 'parler' });
    expect(sim.world.common.story?.tracked).toEqual(['sonnerie-essai', 'sonnerie-essai']);
    // Coup d'œil: la cheffe de gare, chez les deux.
    expect(glanceTarget(sim.world, sim.content, 1)?.target).toMatchObject({
      kind: 'villager',
      id: 'cheffe-de-gare',
    });

    talkUntil(sim, 0, 'fin');
    expect(passed(sim, 'sonnerie-essai')).toEqual(['parler']);
    expect(glanceTarget(sim.world, sim.content, 1)?.target).toMatchObject({ id: 'bois' });

    // L'autre joueur rapporte la bûche: l'étape passe pour les deux, la bûche est remise.
    giveItem(contextOf(sim), 1, 'buche', 1);
    const events = (() => {
      expect(startTalk(contextOf(sim), 1, 'cheffe-de-gare')).toBe(true);
      return wait(sim, 0.3);
    })();
    act(sim, 1, { type: 'talk_close' });
    expect(passed(sim, 'sonnerie-essai')).toEqual(['parler', 'buche']);
    expect(countHeld(sim.world.players[1], 'buche')).toBe(0);
    expect(events).toContainEqual({
      type: 'quest_step_done',
      quest: 'sonnerie-essai',
      step: 'buche',
      by: 1,
    });

    // La scène démarre (les deux sont réunis au départ), le rôle « a » au joueur qui a remis.
    expect(sim.world.common.story?.scene).toMatchObject({ id: 'sonnerie', roleA: 1 });
    readLine(sim);
    wait(sim, 0.1);
    expect(sceneView(sim.world, sim.content, 1)?.beat).toMatchObject({
      kind: 'await',
      hints: [{ text: "Va jusqu'au guichet.", done: false }],
    });
    expect(sceneView(sim.world, sim.content, 0)?.roleName).toBe('Sur le quai');
    moveTo(sim, 1, 'guichet');
    moveTo(sim, 0, 'quai');
    wait(sim, 0.1);
    // Chacun sa réplique: le joueur 1 voit la pendule, le joueur 0 la lueur.
    expect(sceneView(sim.world, sim.content, 1)?.beat).toMatchObject({ kind: 'say', mine: true });
    expect(sceneView(sim.world, sim.content, 0)?.beat).toMatchObject({ kind: 'say', mine: false });
    readLine(sim);
    readLine(sim);
    wait(sim, 0.5);
    expect(sim.world.common.story?.scene?.fade).toBe('black');
    wait(sim, 8);
    expect(sim.world.common.story?.scene).toBeNull();
    expect(seenScenes(sim.world, sim.content).map((s) => s.scene)).toEqual(['sonnerie']);

    // Étape à deux: elle attend que les deux se retrouvent.
    wait(sim, 0.3);
    expect(passed(sim, 'sonnerie-essai')).not.toContain('ecouter');
    moveTo(sim, 0, 'guichet');
    wait(sim, 0.3);
    expect(passed(sim, 'sonnerie-essai')).toContain('ecouter');

    expect(isZoneOpen(sim.world, PLACE, 'voie-nord')).toBe(false);
    talkUntil(sim, 0, 'fin');
    expect(isZoneOpen(sim.world, PLACE, 'voie-nord')).toBe(true);

    moveTo(sim, 0, 'quai');
    moveTo(sim, 1, 'quai');
    const end = wait(sim, 0.3);
    expect(end).toContainEqual({ type: 'quest_done', quest: 'sonnerie-essai' });
    expect(sim.world.common.story?.tracked).toEqual([null, null]);
    expect(journal(sim.world, sim.content, 0)[0]).toMatchObject({
      done: true,
      passed: 5,
      total: 5,
    });
  });

  it('une suite et une scène factices ajoutées par deux fichiers fonctionnent: étapes en parallèle, déclencheur de 5 h 12 chaque jour', () => {
    const content = contentWith((files) => {
      files['lieux/essai-gare/quetes/factice.json'] = {
        schema: 1,
        id: 'factice',
        kind: 'side',
        title: 'Factice',
        giver: null,
        requires: [{ type: 'quest_step', quest: 'sonnerie-essai', step: 'parler' }],
        chapters: [
          {
            id: 'acte',
            title: 'Acte',
            steps: [
              {
                id: 'bois',
                objective: 'Va au tas de bois.',
                target: { point: 'bois' },
                after: [],
                done: [{ type: 'reach', point: 'bois', who: 'one' }],
                together: false,
                onStart: [],
                onDone: [],
              },
              {
                id: 'aube',
                objective: 'Vois la scène de l’aube.',
                target: null,
                after: [],
                done: [{ type: 'scene_seen', scene: 'aube' }],
                together: false,
                onStart: [],
                onDone: [{ type: 'unlock_zone', zone: 'remise' }],
              },
            ],
          },
        ],
      } satisfies Json;
      files['lieux/essai-gare/scenes/aube.json'] = {
        schema: 1,
        id: 'aube',
        title: 'L’aube',
        together: false,
        roles: null,
        trigger: {
          at: 312,
          when: [{ type: 'not', condition: { type: 'time_is', from: 600, to: 700 } }],
          repeat: 'daily',
        },
        beats: [
          { do: 'emote', who: 'cheffe-de-gare', emote: 'surprise', sound: 'Ding !' },
          { do: 'walk', who: 'cheffe-de-gare', to: 'quai' },
          { do: 'wait', seconds: 1 },
        ],
      } satisfies Json;
    });
    const sim = newSim(content);
    wait(sim, 0.3);
    expect(sim.world.progress.quests).toEqual({});
    welcome(sim);
    wait(sim, 0.3);
    expect(sim.world.progress.quests.factice).toBeUndefined();
    talkUntil(sim, 0, 'fin');
    wait(sim, 0.3);
    // Les deux étapes sont ouvertes en même temps.
    const entry = journal(sim.world, sim.content, 0).find((j) => j.quest === 'factice');
    expect(entry?.steps.map((s) => s.id)).toEqual(['bois', 'aube']);
    act(sim, 0, { type: 'quest_track', quest: 'factice' });
    expect(sim.world.common.story?.tracked).toEqual(['factice', 'sonnerie-essai']);

    sim.world.minutes = 312;
    const started = wait(sim, 0.3);
    expect(started).toContainEqual({ type: 'scene_started', scene: 'aube', roleA: 0 });
    wait(sim, 30);
    // Envoyée sur le quai où sont les joueurs, elle s'arrête à distance de conversation.
    const cheffe = sim.world.places[PLACE]?.villagers['cheffe-de-gare']?.body;
    for (const p of sim.world.players)
      expect(Math.hypot((cheffe?.x ?? 0) - p.body.x, (cheffe?.y ?? 0) - p.body.y)).toBeGreaterThan(
        1.1,
      );
    expect(passed(sim, 'factice')).toEqual(['aube']);
    expect(isZoneOpen(sim.world, PLACE, 'remise')).toBe(true);
    // Pas deux fois le même jour; de nouveau le lendemain.
    sim.world.minutes = 312;
    expect(wait(sim, 0.3).some((e) => e.type === 'scene_started')).toBe(false);
    sim.world.common.day += 1;
    expect(wait(sim, 0.3).some((e) => e.type === 'scene_started')).toBe(true);
  });

  it('une réplique ne bloque pas: un seul lecteur ou personne, elle passe au délai; reprise après sauvegarde', () => {
    const sim = newSim();
    wait(sim, 0.3);
    expect(sim.world.progress.quests).toEqual({});
    welcome(sim);
    wait(sim, 0.3);
    talkUntil(sim, 0, 'fin');
    giveItem(contextOf(sim), 0, 'buche', 1);
    startTalk(contextOf(sim), 0, 'cheffe-de-gare');
    wait(sim, 0.3);
    act(sim, 0, { type: 'talk_close' });
    expect(sim.world.common.story?.scene?.beat).toBe(1);
    // Le joueur 1 est parti: le joueur 0 lit seul, la réplique passe après le délai.
    act(sim, 0, { type: 'scene_next' });
    wait(sim, STORY.soloReadSeconds - 0.5);
    expect(sim.world.common.story?.scene?.beat).toBe(1);
    wait(sim, 0.6);
    expect(sim.world.common.story?.scene?.beat).toBe(2);

    // Sauvegarde et reprise: le temps en cours et le rôle sont gardés.
    const saved = v.parse(WorldSchema, JSON.parse(JSON.stringify(sim.world)));
    const resumed = createSim(sim.content, saved);
    expect(resumed.world.common.story?.scene).toMatchObject({ id: 'sonnerie', beat: 2, roleA: 0 });
    moveTo(resumed, 0, 'guichet');
    moveTo(resumed, 1, 'quai');
    wait(resumed, 0.1);
    // Personne ne lit: chaque réplique passe au plafond.
    wait(resumed, STORY.maxLineSeconds * 2 + 12);
    expect(resumed.world.common.story?.scene).toBeNull();
    expect(JSON.stringify(resumed.world.common).length).toBeLessThan(BUDGET_BYTES.common);
  });
});

describe('gabarits des quêtes et des scènes', () => {
  it('une suite et une scène tirées des gabarits (`pnpm nouveau`) se chargent et se jouent', () => {
    const content = contentWith((files) => {
      for (const type of ['quete', 'scene'])
        for (const file of plan(TEMPLATE_DIR, type, `${type}-factice`, PLACE))
          files[file.path] = file.value;
      // La scène du gabarit se lance par une étape: une ligne d'effet suffit.
      const quest = files[`lieux/${PLACE}/quetes/quete-factice.json`] as {
        chapters: { steps: { onDone: Json[] }[] }[];
      };
      quest.chapters[0]?.steps[0]?.onDone.push({ type: 'play_scene', scene: 'scene-factice' });
    });
    const sim = newSim(content);
    wait(sim, 0.3);
    expect(journal(sim.world, sim.content, 0).map((j) => j.quest)).toContain('quete-factice');
    giveItem(contextOf(sim), 0, 'pomme', 3);
    expect(startTalk(contextOf(sim), 0, 'cheffe-de-gare')).toBe(true);
    const events = wait(sim, 0.3);
    act(sim, 0, { type: 'talk_close' });
    expect(passed(sim, 'quete-factice')).toContain('cueillir');
    expect(countHeld(sim.world.players[0], 'pomme')).toBe(0);
    expect(events).toContainEqual({ type: 'scene_started', scene: 'scene-factice', roleA: 0 });
  });
});

describe('validateur des suites', () => {
  function problemsWith(edit: (files: Record<string, Json>) => void): string[] {
    try {
      contentWith(edit);
      return [];
    } catch (error) {
      if (error instanceof ContentError) return [...error.problems];
      throw error;
    }
  }
  const quest = (steps: Json[]): Json => ({
    schema: 1,
    id: 'cassee',
    kind: 'side',
    title: 'Cassée',
    giver: null,
    requires: [],
    chapters: [{ id: 'acte', title: 'Acte', steps }],
  });
  const step = (id: string, done: Json[], extra: Json = {}): Json => ({
    id,
    objective: 'Fais quelque chose.',
    target: null,
    done,
    together: false,
    onStart: [],
    onDone: [],
    ...extra,
  });

  it('refuse une suite qui peut se bloquer, en nommant l’étape', () => {
    const problems = problemsWith((files) => {
      files['lieux/essai-gare/quetes/cassee.json'] = quest([
        step('objet', [{ type: 'deliver', item: 'licorne', count: 1, villager: 'cheffe-de-gare' }]),
        step('fait', [{ type: 'remembered', key: 'essai-gare.jamais-ecrit' }]),
        step('heure', [{ type: 'time_is', from: 300, to: 300 }]),
        step('scene', [{ type: 'scene_seen', scene: 'sonnerie-orpheline' }]),
        step('boucle-a', [{ type: 'together' }], { after: ['boucle-b'] }),
        step('boucle-b', [{ type: 'together' }], { after: ['boucle-a'] }),
        step('plus-tard', [{ type: 'quest_step', quest: 'cassee', step: 'boucle-b' }], {
          after: [],
        }),
        step('deux-valeurs', [
          { type: 'remembered', key: 'essai-gare.sonnerie', equals: 'vue' },
          { type: 'remembered', key: 'essai-gare.sonnerie', equals: 'finie' },
        ]),
      ]);
      files['lieux/essai-gare/scenes/sonnerie-orpheline.json'] = {
        schema: 1,
        id: 'sonnerie-orpheline',
        title: 'Orpheline',
        together: false,
        roles: null,
        trigger: null,
        beats: [
          {
            do: 'say',
            who: 'a',
            text: 'Bonjour.',
            emote: null,
            sound: null,
            to: 'b',
            seconds: null,
          },
        ],
      };
    });
    const at = 'lieu essai-gare, quête cassee, étape';
    expect(problems).toEqual(
      expect.arrayContaining([
        `${at} objet: objet inconnu « licorne »`,
        `${at} fait: condition impossible, aucune donnée n'écrit le fait « essai-gare.jamais-ecrit »`,
        `${at} heure: condition impossible, plage d'heure vide (300)`,
        `${at} scene: condition impossible, rien ne lance la scène « sonnerie-orpheline »`,
        `${at} boucle-a: étape sans issue, elle ne s'ouvre jamais (\`after\` en boucle)`,
        `${at} plus-tard: blocage, l'étape attend « boucle-b » qui vient après`,
        `${at} deux-valeurs: condition impossible, « essai-gare.sonnerie » exigé à deux valeurs`,
        'lieu essai-gare, scène sonnerie-orpheline, temps 0: rôle « a » dans une scène sans `roles`',
      ]),
    );
  });

  it('accepte les données livrées (mini-suite comprise)', () => {
    expect(problemsWith(() => undefined)).toEqual([]);
  });
});
