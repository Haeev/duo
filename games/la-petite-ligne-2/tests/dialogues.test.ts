// Dialogues (lot L3, cahier 1.5 et 4.9): graphe, choix, effets, hygiène, amitié, mémoire, accords.
import { describe, expect, it } from 'vitest';
import { checkAgreementTags, resolveAgreement } from '../src/simulation/dialogues/accords';
import { heartKey } from '../src/simulation/dialogues/amitie';
import { talkView } from '../src/simulation/dialogues/conversation';
import { agreementTagShare, validateDialogueTexts } from '../src/simulation/dialogues/valider';
import type { Sim } from '../src/simulation/noyau/pas';
import { act, contentWith } from './aides-l3';
import { NORTH, put } from './aides-noyau';
import { bondKey } from '../src/etat/progression';
import { gameContent, newSim } from './aides';

const content = gameContent();
const VILLAGER = 'cheffe-de-gare';

/** Devant le guichet, face à l'habitant: la touche d'action ouvre la conversation (brique `talk`). */
function openTalk(sim: Sim, player: 0 | 1): Sim['events'] {
  put(sim, player, 20, 16, NORTH);
  return act(sim, player, { type: 'act' });
}

describe('dialogues', () => {
  it('ouvre, avance de page en page avec un événement de babil, choisit et applique les effets', () => {
    const sim = newSim(content);
    const events = openTalk(sim, 0);
    expect(events.map((e) => e.type)).toEqual(['talk_started', 'talk_page']);
    expect(events[1]).toEqual({
      type: 'talk_page',
      player: 0,
      villager: VILLAGER,
      node: 'bonjour',
      speaker: VILLAGER,
    });
    expect(sim.world.places['essai-gare']?.villagers[VILLAGER]).toMatchObject({
      met: [true, false],
      talkingWith: 0,
    });
    // Chacun parle de son côté: l'autre joueur n'est pas dans la conversation.
    expect(sim.world.players[1].talk).toBeNull();
    act(sim, 0, { type: 'talk_next' });
    act(sim, 0, { type: 'talk_next' });
    expect(talkView(content, sim.world, 0)?.options.map((o) => o.id)).toEqual(['oui', 'non']);
    act(sim, 0, { type: 'talk_choose', option: 'oui' });
    expect(sim.world.players[0].bag?.id).toBe('besace');
    expect(sim.world.progress.memory['essai-gare.besace']).toEqual({ v: true, by: 0, day: 1 });
    expect(talkView(content, sim.world, 0)?.text).toMatch(/^Tiens/);
    expect(act(sim, 0, { type: 'talk_next' })).toContainEqual({
      type: 'talk_ended',
      player: 0,
      villager: VILLAGER,
    });
    expect(sim.world.players[0].talk).toBeNull();
    // La mémoire change la suite: l'aiguillage mène à la réplique de retour.
    openTalk(sim, 1);
    expect(sim.world.players[1].talk?.node).toBe('revoir');
  });

  it('hygiène basse: l’échange est marqué d’avance, échoue, puis réussit une fois lavé', () => {
    const sim = newSim(content);
    sim.world.players[0].tiers.hygiene = 'low';
    sim.world.players[0].needs.hygiene = 15;
    openTalk(sim, 0);
    act(sim, 0, { type: 'talk_next' });
    act(sim, 0, { type: 'talk_next' });
    expect(talkView(content, sim.world, 0)?.options).toEqual([
      { id: 'oui', text: "Oui, je n'ai que mes poches.", fails: 'hygiene', blocked: null },
      { id: 'non', text: 'Ça ira, merci.', fails: null, blocked: null },
    ]);
    expect(act(sim, 0, { type: 'talk_choose', option: 'oui' })).toContainEqual({
      type: 'refused',
      player: 0,
      reason: 'too-dirty',
      target: VILLAGER,
    });
    expect(sim.world.players[0].bag).toBeNull();
    sim.world.players[0].needs.hygiene = 60;
    act(sim, 0);
    act(sim, 0, { type: 'talk_choose', option: 'oui' });
    expect(sim.world.players[0].bag?.id).toBe('besace');
  });

  it('amitié: première conversation du jour, une fois par jour, modulée par l’hygiène', () => {
    const sim = newSim(content);
    openTalk(sim, 0);
    // Hygiène de départ en bonus (Soigné): 5 points multipliés par 1,2.
    expect(sim.world.progress.bonds[bondKey(VILLAGER, 0)]).toBe(6);
    act(sim, 0, { type: 'talk_close' });
    openTalk(sim, 0);
    expect(sim.world.progress.bonds[bondKey(VILLAGER, 0)]).toBe(6);
    act(sim, 0, { type: 'talk_close' });
    sim.world.players[1].tiers.hygiene = 'low';
    sim.world.players[1].needs.hygiene = 15;
    openTalk(sim, 1);
    expect(sim.world.progress.bonds[bondKey(VILLAGER, 1)]).toBeUndefined();
  });

  it('un dialogue ajouté par un seul fichier, conditionné à l’amitié, joué une fois par joueur', () => {
    const custom = contentWith((files) => {
      files['lieux/essai-gare/dialogues/confidence.json'] = {
        schema: 1,
        id: 'confidence',
        villager: VILLAGER,
        priority: 10,
        when: [{ type: 'bond_at_least', villager: VILLAGER, points: 100 }],
        once: 'player',
        start: 'aveu',
        nodes: {
          aveu: {
            kind: 'line',
            speaker: VILLAGER,
            text: 'Te voilà [[revenue|revenu]]. Je peux te dire un secret ?',
            emote: 'idea',
            next: null,
          },
        },
      };
    });
    expect(validateDialogueTexts(custom)).toEqual([]);
    const sim = newSim(custom);
    sim.world.progress.bonds[bondKey(VILLAGER, 0)] = 90;
    openTalk(sim, 0);
    expect(sim.world.players[0].talk?.dialogue).toBe('accueil');
    act(sim, 0, { type: 'talk_close' });
    sim.world.common.day = 2;
    openTalk(sim, 0);
    expect(sim.world.players[0].talk?.dialogue).toBe('accueil');
    // Le premier cœur vient d'être atteint au bonjour du jour 2: la confidence passe au suivant.
    expect(sim.world.progress.memory[heartKey(VILLAGER, 1, 0)]?.v).toBe(true);
    act(sim, 0, { type: 'talk_close' });
    openTalk(sim, 0);
    const view = talkView(custom, sim.world, 0);
    expect(view?.node).toBe('aveu');
    // Le texte arrive déjà accordé au genre choisi dans l'éditeur.
    expect(view?.text).toBe('Te voilà revenu. Je peux te dire un secret ?');
    sim.world.players[0].gender = 'f';
    expect(talkView(custom, sim.world, 0)?.text).toBe(
      'Te voilà revenue. Je peux te dire un secret ?',
    );
    act(sim, 0, { type: 'talk_next' });
    openTalk(sim, 0);
    expect(sim.world.players[0].talk?.dialogue).toBe('accueil');
  });
});

describe('accords de genre', () => {
  it('résout la balise du joueur et celle du duo (féminin pluriel pour deux femmes seulement)', () => {
    const text = 'Te voilà [[prête|prêt]] ! Vous voilà [[duo:arrivées|arrivés]].';
    expect(resolveAgreement(text, 'f', ['f', 'f'])).toBe('Te voilà prête ! Vous voilà arrivées.');
    expect(resolveAgreement(text, 'f', ['f', 'm'])).toBe('Te voilà prête ! Vous voilà arrivés.');
    expect(resolveAgreement(text, 'm', ['m', 'f'])).toBe('Te voilà prêt ! Vous voilà arrivés.');
  });

  it('le validateur refuse une balise incomplète et signale un accord hors balise', () => {
    expect(checkAgreementTags('Te voilà [[prête|prêt]] !')).toEqual([]);
    expect(checkAgreementTags('Te voilà [[prête]] !')).toHaveLength(1);
    expect(checkAgreementTags('Te voilà [[prête|prêt !')).toHaveLength(1);
    expect(checkAgreementTags('Te voilà [[|prêt]] !')).toHaveLength(1);
    expect(checkAgreementTags('Tu es arrivé bien tard.')[0]).toMatch(/hors balise/);
    expect(checkAgreementTags('Tu es là ? Quelle mine !')).toEqual([]);
  });

  it('le chargement refuse une balise incomplète et une condition d’amitié sur un habitant inconnu', () => {
    expect(() =>
      contentWith((files) => {
        const accueil = files['lieux/essai-gare/dialogues/accueil.json'] as {
          nodes: Record<string, { text?: string }>;
          when: unknown[];
        };
        const bonjour = accueil.nodes.bonjour;
        if (bonjour !== undefined) bonjour.text = 'Te voilà [[prête !';
        accueil.when.push({ type: 'bond_at_least', villager: 'personne', points: 100 });
      }),
    ).toThrow(
      /balise d’accord incomplète[^]*habitant inconnu « personne »|habitant inconnu « personne »[^]*balise d’accord incomplète/,
    );
  });

  it('les dialogues du jeu passent le validateur, avec moins d’une réplique sur dix balisée', () => {
    expect(validateDialogueTexts(content)).toEqual([]);
    expect(agreementTagShare(content)).toBeLessThan(0.1);
  });
});
