/**
 * Informations propres (R16) vues de l'interface: fiche du carnet selon le rôle, appel des
 * poules, coup de coude, et la règle S-02: rien de ce que lit l'autre ne contient le secret.
 * Avec la graine de la démo, p1 est l'informé des poules et p2 celui du mot de Lucie.
 */
import { describe, expect, it } from 'vitest';
import { henColor, secretCards } from '../../etat/secrets';
import type { CharacterId, GameNotification } from '../../etat/types';
import type { Sim } from '../../simulation/contexte';
import { setupScenario } from '../demo/scenarios';
import { watchModel, momentHintModel } from '../modele-moments';
import { henCallModel, henWrongAside } from '../modele-secrets';
import { nextObjective, partnerModel, questModels } from '../modele';
import { toastVisual } from '../notifications';
import { apply, character, newSim, playUntil, uiContext } from './aides';

const plain = (s: string): string => s.replace(/[\u00a0\u202f]/g, ' ').replace(/\u2019/g, "'");

function scenario(name: string): Sim {
  const sim = newSim();
  apply(sim, 'p1', { type: 'title_ready', ready: true });
  apply(sim, 'p2', { type: 'title_ready', ready: true });
  setupScenario(sim, name, 'p1')?.();
  return sim;
}

/** Tout ce que l'interface de ce joueur tire de l'état, à plat (carnet, HUD, carte de l'autre, appel, confidence). */
function everythingShown(sim: Sim, me: CharacterId): string {
  const ctx = uiContext(me);
  const notifications = character(sim, me).notifications.map((n) => n.text);
  return plain(
    JSON.stringify([
      questModels(sim.world, ctx),
      nextObjective(sim.world, ctx),
      partnerModel(sim.world, ctx, null),
      watchModel(sim.world, ctx),
      momentHintModel(sim.world, ctx),
      henCallModel(sim.world, ctx),
      notifications,
    ]),
  );
}

/** Ce qui trahirait les noms: « Bichette, c'est la noire » pour chaque poule que l'autre n'a pas encore nommée. */
function henSecrets(sim: Sim): string[] {
  const out: string[] = [];
  for (const hen of sim.world.hens) {
    if (hen.namedBy !== null) continue;
    const color = henColor(sim.content, hen.variant);
    out.push(`${hen.name}, c'est ${color}`.toLowerCase());
  }
  for (const card of secretCards(sim.world, sim.content, 'p1')) for (const line of card.lines) out.push(plain(line).toLowerCase());
  return out;
}

describe('fiche secrète au carnet', () => {
  it("avant la confidence d'Odette, aucune fiche chez personne", () => {
    const sim = newSim();
    apply(sim, 'p1', { type: 'title_ready', ready: true });
    playUntil(sim, (s) => s.world.secrets.entries.some((e) => e.quest === 'hen_names' && !e.revealed));
    for (const me of ['p1', 'p2'] as const) {
      expect(questModels(sim.world, uiContext(me)).find((q) => q.id === 'hen_names')?.secret ?? null).toBeNull();
    }
  });

  it("l'informé lit les noms (« Rien que pour toi »); l'autre a une fiche qui l'invite à demander, sans une ligne du secret", () => {
    const sim = scenario('poules-carnet');
    const informed = questModels(sim.world, uiContext('p1')).find((q) => q.id === 'hen_names')?.secret;
    expect(informed?.kind).toBe('mine');
    if (informed?.kind !== 'mine') return;
    expect(informed.lines).toHaveLength(3);
    expect(plain(informed.chip)).toBe('Rien que pour toi');
    expect(plain(informed.help)).toContain('Sacha ne voit pas cette fiche');
    expect(informed.nudge).toBeNull();
    const doer = questModels(sim.world, uiContext('p2')).find((q) => q.id === 'hen_names');
    expect(doer?.secret?.kind).toBe('ask');
    expect(Object.keys(doer?.secret ?? {}).sort()).toEqual(['chip', 'kind', 'text', 'title']);
    expect(plain(doer?.secret?.title ?? '')).toBe('Une fiche que tu ne vois pas');
    expect(doer?.secret?.kind === 'ask' ? plain(doer.secret.text) : '').toBe('Camille a la réponse : demande-lui !');
    // L'objectif de l'autre dit la touche réelle (jeton {act} rempli).
    expect(plain(doer?.text ?? '')).toContain('(Espace près d');
    expect(doer?.text).not.toContain('{');
  });

  it("le mot de Lucie: l'informé (p2) lit la réponse de Firmin, l'autre (p1) est invité à la demander", () => {
    const sim = scenario('lucie-carnet');
    const entry = sim.world.secrets.entries.find((e) => e.quest === 'lucie_note');
    expect(entry?.informed).toBe('p2');
    const informed = questModels(sim.world, uiContext('p2')).find((q) => q.id === 'lucie_note')?.secret;
    expect(informed?.kind).toBe('mine');
    const sentence = informed?.kind === 'mine' ? (informed.lines[0] ?? '') : '';
    expect(sentence.length).toBeGreaterThan(10);
    const doer = questModels(sim.world, uiContext('p1')).find((q) => q.id === 'lucie_note');
    expect(doer?.secret?.kind).toBe('ask');
    expect(everythingShown(sim, 'p1')).not.toContain(plain(sentence));
    expect(everythingShown(sim, 'p2')).toContain(plain(sentence));
  });

  it('à la fin des poules, la fiche est chez les deux', () => {
    const sim = scenario('poules-carnet');
    playUntil(sim, (s) => s.world.quests.some((q) => q.id === 'hen_names' && q.status === 'done'));
    for (const me of ['p1', 'p2'] as const) {
      expect(questModels(sim.world, uiContext(me)).find((q) => q.id === 'hen_names')?.secret?.kind).toBe('shared');
    }
  });
});

describe("l'écran de l'autre ne montre jamais le secret (S-02)", () => {
  it('à chaque étape des poules: confidence, appel, erreur, coup de coude', () => {
    for (const name of ['poules-carnet', 'poules-appel', 'poules-erreur', 'poules-coup-de-coude']) {
      const sim = scenario(name);
      const secrets = henSecrets(sim);
      expect(secrets.length).toBeGreaterThan(0);
      const doer = everythingShown(sim, 'p2').toLowerCase();
      for (const s of secrets) expect(doer, `${name}: « ${s} » chez l'autre`).not.toContain(s);
      // Témoin: l'informé, lui, les lit bien.
      const informed = everythingShown(sim, 'p1').toLowerCase();
      expect(secrets.some((s) => informed.includes(s)), name).toBe(true);
    }
  });
});

describe('appeler une poule', () => {
  it('les trois noms dans l’ordre fixe, « Laisser » à part, le nom déjà trouvé grisé avec sa couleur', () => {
    const sim = scenario('poules-appel');
    const call = henCallModel(sim.world, uiContext('p2'));
    expect(call).not.toBeNull();
    if (call === null) return;
    expect(call.choices.map((c) => c.text)).toEqual([...sim.world.hens.map((h) => h.name), 'Laisser']);
    expect(call.choices.at(-1)?.leave).toBe(true);
    const named = sim.world.hens.findIndex((h) => h.namedBy !== null);
    expect(named).toBeGreaterThanOrEqual(0);
    sim.world.hens.forEach((hen, i) => {
      const found = call.choices[i]?.found ?? null;
      if (i === named) expect(plain(found ?? '')).toBe(`déjà trouvée : ${henColor(sim.content, hen.variant)}`);
      else expect(found).toBeNull();
    });
    const asked = sim.world.hens.find((h) => h.id === call.hen);
    expect(plain(call.question)).toBe(`Comment s'appelle ${asked?.variant === 'hen_white' ? 'la poule blanche' : asked?.variant === 'hen_red' ? 'la poule rousse' : 'la poule noire'} ?`);
    expect(plain(call.help)).toBe('Camille connaît leurs noms. Demande-lui !');
    // Chez l'informé, aucune conversation d'appel.
    expect(henCallModel(sim.world, uiContext('p1'))).toBeNull();
  });

  it('un mauvais nom: la poule répond (réplique variée, sans hasard), sans rien dévoiler', () => {
    const sim = scenario('poules-erreur');
    const ctx = uiContext('p2');
    const wrong = character(sim, 'p2').notifications.find((n) => n.key === 'hen_named_wrong');
    expect(wrong).toBeDefined();
    if (wrong === undefined) return;
    const visual = toastVisual(wrong, ctx.texts.messages);
    expect(visual).toMatchObject({ variant: 'hen', icon: 'hen', henAside: true });
    expect(henWrongAside(ctx, 3)).toBe(henWrongAside(ctx, 3));
    const asides = new Set([0, 1, 2, 3, 4, 5].map((i) => henWrongAside(ctx, i)));
    expect(asides.size).toBe(ctx.texts.extra.secrets.henWrongAsides.length);
  });

  it('deux erreurs: le coup de coude chez l’informé seul, en notification et au carnet', () => {
    const sim = scenario('poules-coup-de-coude');
    const ctx = uiContext('p1');
    const nudge = character(sim, 'p1').notifications.find((n) => n.key === 'secret_nudge_hens');
    expect(nudge).toBeDefined();
    if (nudge !== undefined) expect(toastVisual(nudge, ctx.texts.messages).variant).toBe('whisper');
    expect(character(sim, 'p2').notifications.some((n) => n.key === 'secret_nudge_hens')).toBe(false);
    const card = questModels(sim.world, ctx).find((q) => q.id === 'hen_names')?.secret;
    expect(card?.kind === 'mine' ? plain(card.nudge ?? '') : '').toBe('Sacha cherche encore : souffle-lui la réponse !');
    expect(questModels(sim.world, uiContext('p2')).find((q) => q.id === 'hen_names')?.secret?.kind).toBe('ask');
  });
});

describe('style des notifications des moments et des secrets', () => {
  const ctx = uiContext('p1');
  const n = (key: string): GameNotification => ({ id: 1, kind: 'message', text: ctx.texts.messages[key] ?? key, key, tick: 0 });
  it('apogée vue à deux, confidence et coup de coude à voix basse', () => {
    expect(toastVisual(n('heron_seen'), ctx.texts.messages).variant).toBe('moment');
    expect(toastVisual(n('moment_tits_climax'), ctx.texts.messages).variant).toBe('moment');
    expect(toastVisual(n('moment_fox_hint'), ctx.texts.messages).variant).toBe('whisper');
    expect(toastVisual(n('secret_nudge_lucie'), ctx.texts.messages).variant).toBe('whisper');
    expect(toastVisual(n('moment_notice'), ctx.texts.messages)).toMatchObject({ variant: 'event', icon: 'ui-eye' });
  });
});
