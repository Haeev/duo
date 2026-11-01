/**
 * Onglet Souvenirs vu de l'interface (tour 7, conception section 2.3): la ligne à soi selon qui
 * lit (S-12), aucun compteur ni moment jamais vu (S-11, modèle), une rumeur différente chez les
 * deux et jamais sur un moment déjà vu (S-13, 8 graines), dates et intercalaires sur deux années.
 * Avec la graine de la démo, p1 est l'informé des poules et p2 celui du mot de Lucie.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { finishedSecretLine } from '../../etat/secrets';
import type { CharacterId, MomentMemoryEntry } from '../../etat/types';
import type { Sim } from '../../simulation/contexte';
import { createWorld } from '../../simulation/monde';
import { setupScenario } from '../demo/scenarios';
import { memoriesPageModel, rumorMoment } from '../modele-souvenirs';
import { apply, contentAndMap, newSim, playUntil, uiContext } from './aides';

const plain = (s: string): string => s.replace(/[\u00a0\u202f]/g, ' ').replace(/\u2019/g, "'");

function memory(
  id: string,
  first: number,
  hintTo: CharacterId | null,
  hintFrom: string | null,
  count = 1,
  last = first,
): MomentMemoryEntry {
  return { id, first, hintTo, hintFrom, count, last };
}

/** Tout le texte de la page de ce joueur, rumeur comprise. */
function pageText(sim: Sim, me: CharacterId): string {
  return plain(JSON.stringify(memoriesPageModel(sim.world, uiContext(me))));
}

function entries(
  sim: Sim,
  me: CharacterId,
): ReturnType<typeof memoriesPageModel>['seasons'][number]['entries'] {
  return memoriesPageModel(sim.world, uiContext(me)).seasons.flatMap((s) => s.entries);
}

function started(): Sim {
  const sim = newSim();
  apply(sim, 'p1', { type: 'create_character', name: 'Camille', hair: 0, outfit: 0 });
  apply(sim, 'p2', { type: 'create_character', name: 'Sacha', hair: 2, outfit: 1 });
  return sim;
}

describe('page vide', () => {
  it('au début: la phrase de la page vide et la rumeur, aucune entrée', () => {
    const sim = started();
    for (const me of ['p1', 'p2'] as const) {
      const page = memoriesPageModel(sim.world, uiContext(me));
      expect(page.seasons).toEqual([]);
      expect(plain(page.empty ?? '')).toBe(
        "Pas encore de souvenir. Le bourg garde ses plus beaux moments pour les jours où l'on flâne à deux.",
      );
      expect(page.rumor?.lead).toBe('On dit au bourg…');
    }
  });
});

describe('la ligne à soi (S-12)', () => {
  it('moment avec confidence d’un habitant: « Tu étais dans la confidence » chez l’un, le prénom chez l’autre', () => {
    const sim = started();
    sim.world.memories.moments = [memory('glowworms', 9, 'p2', 'odette')];
    expect(entries(sim, 'p2')[0]?.self).toBe('Tu étais dans la confidence (Odette).');
    expect(entries(sim, 'p1')[0]?.self).toBe('Sacha était dans la confidence (Odette).');
  });

  it('moment avec indice sans habitant: « Tu avais eu un indice la veille. » chez l’un seulement', () => {
    const sim = started();
    sim.world.memories.moments = [memory('fox', 3, 'p1', null)];
    expect(entries(sim, 'p1')[0]?.self).toBe('Tu avais eu un indice la veille.');
    expect(entries(sim, 'p2')[0]?.self).toBe('Camille avait eu un indice la veille.');
  });

  it('moment de quête: la même ligne chez les deux; ancienne sauvegarde (confidence inconnue): pas de ligne', () => {
    const sim = started();
    sim.world.memories.moments = [memory('heron', 6, null, 'jeanne'), memory('fox', 7, null, null)];
    for (const me of ['p1', 'p2'] as const) {
      const list = entries(sim, me);
      expect(plain(list.find((e) => e.key === 'moment:heron')?.self ?? '')).toBe(
        "C'est Jeanne qui vous en avait parlé.",
      );
      expect(list.find((e) => e.key === 'moment:fox')?.self).toBeNull();
    }
  });

  it('les noms des poules et le mot de Lucie, joués par les robots: la ligne diffère, le secret n’est chez l’autre qu’une fois la quête finie', () => {
    const sim = newSim();
    apply(sim, 'p1', { type: 'title_ready', ready: true });
    apply(sim, 'p2', { type: 'title_ready', ready: true });
    // Le mot de Lucie en cours: Firmin a répondu à p2, p1 ne l'a pas encore dit à Jeanne.
    setupScenario(sim, 'lucie-carnet', 'p1');
    const entry = sim.world.secrets.entries.find((e) => e.quest === 'lucie_note');
    if (entry === undefined) throw new Error('mot de Lucie');
    const secret = plain(finishedSecretLine(sim.world, sim.content, 'lucie_note', entry.variant));
    expect(secret.length).toBeGreaterThan(10);
    expect(sim.world.quests.find((q) => q.id === 'lucie_note')?.status).toBe('active');
    expect(pageText(sim, 'p1')).not.toContain(secret);
    expect(pageText(sim, 'p2')).not.toContain(secret);
    playUntil(sim, (s) => s.world.memories.secrets.some((m) => m.quest === 'lucie_note'));
    const hens = {
      p1: entries(sim, 'p1').find((e) => e.key === 'secret:hen_names'),
      p2: entries(sim, 'p2').find((e) => e.key === 'secret:hen_names'),
    };
    const lucie = {
      p1: entries(sim, 'p1').find((e) => e.key === 'secret:lucie_note'),
      p2: entries(sim, 'p2').find((e) => e.key === 'secret:lucie_note'),
    };
    // Poules: p1 informé (Odette), p2 a appelé.
    expect(plain(hens.p1?.self ?? '')).toMatch(
      /^Odette te les avait confiés ; Sacha les a appelées\./,
    );
    expect(plain(hens.p2?.self ?? '')).toMatch(/^Camille te les a soufflés ; tu les as appelées\./);
    // Lucie: p2 informé; p1, l'autre, lit la réponse maintenant que la quête est finie.
    expect(plain(lucie.p2?.self ?? '')).toContain(
      `Firmin t'a répondu : « ${secret} » C'est Camille qui l'a dit à Jeanne.`,
    );
    expect(plain(lucie.p1?.self ?? '')).toContain(
      `Sacha t'a confié la réponse de Firmin : « ${secret} » Et tu l'as rapportée à Jeanne.`,
    );
    expect(hens.p1?.self).not.toBe(hens.p2?.self);
    expect(lucie.p1?.self).not.toBe(lucie.p2?.self);
    expect(lucie.p1?.title).toBe('Le mot de Lucie');
  });

  it('du premier coup: une phrase en plus, chez les deux', () => {
    const sim = started();
    sim.world.memories.secrets = [
      { quest: 'hen_names', day: 5, informed: 'p1', firstTry: true, variant: 0 },
    ];
    for (const me of ['p1', 'p2'] as const)
      expect(entries(sim, me)[0]?.self).toMatch(/Du premier coup\.$/);
    sim.world.memories.secrets = [
      { quest: 'hen_names', day: 5, informed: 'p1', firstTry: false, variant: 0 },
    ];
    for (const me of ['p1', 'p2'] as const)
      expect(entries(sim, me)[0]?.self).not.toMatch(/premier coup/);
  });
});

describe('aucun compteur, aucun moment jamais vu (S-11, modèle)', () => {
  it('ni « sur 12 », ni « / », ni « % », ni le nom ou le souvenir d’un moment jamais vu, hors rumeur', () => {
    const sim = started();
    sim.world.clock.day = 12;
    sim.world.memories.moments = [
      memory('heron', 6, null, 'jeanne', 2, 11),
      memory('fox', 7, 'p2', null, 5, 12),
    ];
    sim.world.memories.secrets = [
      { quest: 'hen_names', day: 5, informed: 'p1', firstTry: true, variant: 0 },
    ];
    const seen = new Set(sim.world.memories.moments.map((m) => m.id));
    for (const me of ['p1', 'p2'] as const) {
      const page = memoriesPageModel(sim.world, uiContext(me));
      const text = plain(JSON.stringify({ ...page, rumor: null }));
      for (const bad of ['sur 12', '/', '%']) expect(text, `${me}: « ${bad} »`).not.toContain(bad);
      for (const def of sim.content.moments.filter((m) => !seen.has(m.id))) {
        const title = plain(sim.content.texts.messages[def.texts.memory] ?? '').split(',')[0] ?? '';
        expect(text).not.toContain(def.name);
        expect(text).not.toContain(title);
      }
    }
  });
});

describe('les retours', () => {
  it('« Vu deux fois ensemble », « trois fois », puis « souvent », et la dernière date; l’année si elle a changé', () => {
    const sim = started();
    sim.world.clock.day = 96;
    sim.world.memories.moments = [
      memory('heron', 6, null, 'jeanne', 2, 14),
      memory('geese', 11, null, 'firmin', 3, 95),
      memory('fox', 7, 'p1', null, 7, 50),
      memory('tits', 40, 'p1', 'basile'),
    ];
    const list = entries(sim, 'p1');
    const by = (id: string): string =>
      plain(list.find((e) => e.key === `moment:${id}`)?.returns ?? '');
    // Jour 14: un vendredi de printemps (jour 1: samedi).
    expect(by('heron')).toBe('Vu deux fois ensemble ; la dernière, un vendredi de printemps.');
    // Jour 95: printemps de la deuxième année.
    expect(by('geese')).toBe(
      'Vu trois fois ensemble ; la dernière, un mardi de printemps, deuxième année.',
    );
    expect(by('fox')).toBe("Vu souvent ensemble ; la dernière, un samedi d'automne.");
    expect(list.find((e) => e.key === 'moment:tits')?.returns).toBeNull();
  });

  it('du plus récent au plus ancien, un intercalaire par saison, sur deux années', () => {
    const sim = started();
    sim.world.clock.day = 96;
    sim.world.memories.moments = [
      memory('heron', 6, null, 'jeanne'),
      memory('glowworms', 23, 'p2', 'odette'),
      memory('tits', 90, 'p1', 'basile'),
    ];
    sim.world.memories.secrets = [
      { quest: 'hen_names', day: 5, informed: 'p1', firstTry: true, variant: 0 },
    ];
    const page = memoriesPageModel(sim.world, uiContext('p2'));
    expect(page.seasons.map((s) => plain(s.title))).toEqual([
      'Le printemps, deuxième année',
      "L'été, première année",
      'Le printemps, première année',
    ]);
    expect(page.seasons.map((s) => s.entries.map((e) => e.key))).toEqual([
      ['moment:tits'],
      ['moment:glowworms'],
      ['moment:heron', 'secret:hen_names'],
    ]);
    expect(page.seasons[0]?.entries[0]?.date).toBe('Jour 90 · printemps, deuxième année');
    expect(page.seasons[0]?.entries[0]?.title).toBe('Les mésanges du grand chêne, un jeudi matin.');
  });
});

describe('la rumeur du bourg (S-13)', () => {
  const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

  it('sur 8 graines et 15 jours: différente chez les deux tant que deux moments restent à voir, jamais sur un moment vu', () => {
    const { content, map } = contentAndMap();
    const ids = content.moments.filter((m) => m.texts.rumor !== null).map((m) => m.id);
    let differing = 0;
    for (const seed of SEEDS) {
      const sim = createWorld(content, map, seed, [
        { id: 'membre-a', name: 'Camille', color: '#5CE1E6' },
        { id: 'membre-b', name: 'Sacha', color: '#8D6CFF' },
      ]);
      sim.world.flags.push('nest_box_straight');
      for (let day = 1; day <= 15; day++) {
        sim.world.clock.day = day;
        // Un moment de plus vu tous les trois jours: la réserve de rumeurs se vide peu à peu.
        sim.world.memories.moments = ids
          .slice(0, Math.floor(day / 3))
          .map((id) => memory(id, 1, null, null));
        const seen = new Set(sim.world.memories.moments.map((m) => m.id));
        const a = rumorMoment(sim.world, content, 'p1');
        const b = rumorMoment(sim.world, content, 'p2');
        const possible = content.moments.filter(
          (m) =>
            m.texts.rumor !== null &&
            !seen.has(m.id) &&
            m.availableWhen.every((c) => c.type !== 'day_at_least' || c.day <= 15),
        );
        for (const r of [a, b])
          if (r !== null)
            expect(
              seen.has(r.id),
              `graine ${String(seed)}, jour ${String(day)}: ${r.id} déjà vu`,
            ).toBe(false);
        if (possible.length >= 2) {
          expect(a?.id, `graine ${String(seed)}, jour ${String(day)}`).not.toBe(b?.id);
          differing++;
        }
        if (possible.length === 1) expect(a?.id).toBe(b?.id);
        if (possible.length === 0) expect([a, b]).toEqual([null, null]);
      }
    }
    expect(differing).toBeGreaterThan(40);
  });

  it('change d’un matin à l’autre, sans toucher au générateur; jamais sur l’échelle (moment de quête)', () => {
    const sim = started();
    const rng = [...sim.world.rng];
    const seenRumors = new Set<string>();
    for (let day = 1; day <= 15; day++) {
      sim.world.clock.day = day;
      const r = rumorMoment(sim.world, sim.content, 'p1');
      if (r !== null) seenRumors.add(r.id);
      expect(r?.id).not.toBe('ladder');
    }
    expect(seenRumors.size).toBeGreaterThan(1);
    expect(sim.world.rng).toEqual(rng);
  });

  it('les mésanges ne sont promises qu’une fois le nichoir redressé', () => {
    const sim = started();
    for (let day = 1; day <= 15; day++) {
      sim.world.clock.day = day;
      for (const me of ['p1', 'p2'] as const)
        expect(rumorMoment(sim.world, sim.content, me)?.id).not.toBe('tits');
    }
  });
});

describe('données des souvenirs', () => {
  const sprite = readFileSync(
    fileURLToPath(new URL('../../../ui-maquettes/icones.svg', import.meta.url)),
    'utf8',
  );

  it('chaque moment et chaque quête à secret ont leur vignette dessinée, son texte, leur souvenir; chaque moment d’ambiance sa rumeur', () => {
    const { content } = contentAndMap();
    const texts = uiContext('p1').texts;
    for (const m of content.moments) {
      expect(m.vignette, m.id).not.toBeNull();
      expect(sprite).toContain(`<symbol id="${m.vignette ?? ''}"`);
      expect(texts.messages[m.texts.memory], m.id).toBeDefined();
      expect(
        m.texts.vignette === null ? undefined : texts.messages[m.texts.vignette],
        m.id,
      ).toBeDefined();
      if (m.mode !== 'quest')
        expect(
          m.texts.rumor === null ? undefined : texts.messages[m.texts.rumor],
          m.id,
        ).toBeDefined();
    }
    for (const q of content.quests.filter((x) => x.secret !== null)) {
      expect(sprite).toContain(`<symbol id="${q.secret?.vignette ?? ''}"`);
      expect(texts.game.souvenirs.secrets[q.id], q.id).toBeDefined();
    }
    expect(sprite).toContain('<symbol id="memory-generic"');
  });
});
