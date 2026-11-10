/**
 * État factice des onglets (page de démonstration, tests, exemplaire du gabarit de lecture): il
 * tient la place des systèmes qui n'existent pas encore (moteur de quêtes, habitants écrits,
 * catalogue de collections). Les noms sont inventés ici et ne servent que l'essai; rien du moteur
 * ne les connaît. Dès qu'un système réel remplit `worldSources`, ce fichier n'est plus utilisé en jeu.
 */
import {
  COLLECTION_FAMILIES,
  type CarnetSources,
  type CollectionEntryRead,
  type CollectionRead,
  type QuestLineRead,
  type VillagerRead,
} from './lectures';
import { UI_TUNING } from '../reglages';
import type { PlanRead } from './plan';

const NAMES = [
  'Firmin',
  'Odette',
  'Basile',
  'Solange',
  'Achille',
  'Lucie',
  'Honorine',
  'Marthe',
  'Ambroise',
  'Jeanne',
];

function pearls(total: number, current: number): QuestLineRead['chapters'] {
  return Array.from({ length: total }, (_, i) => ({
    id: `c${String(i + 1)}`,
    title: `Chapitre ${String(i + 1)}`,
    state: i < current ? 'done' : i === current ? 'current' : 'todo',
  }));
}

export function fakeQuests(): readonly QuestLineRead[] {
  const line = (
    id: string,
    kind: QuestLineRead['kind'],
    title: string,
    giver: number | null,
    total: number,
    current: number,
    step: string,
    together = false,
  ): QuestLineRead => ({
    id,
    kind,
    title,
    giver: giver === null ? null : { id: `h${String(giver)}`, name: NAMES[giver] ?? '' },
    chapters: pearls(total, current),
    finished: current >= total,
    step: current >= total ? '' : step,
    together,
    target: current >= total ? null : { x: 130 + id.length * 3, y: 112 },
  });
  return [
    line(
      'histoire',
      'main',
      'Logement fourni',
      null,
      5,
      2,
      'Va voir le mécanicien à la halte, il t’attend.',
    ),
    line(
      'couture',
      'side',
      'Le bouton perdu',
      1,
      3,
      1,
      'Cherche un bouton de laiton près de la berge.',
    ),
    line('pain', 'side', 'Le levain', 4, 4, 0, 'Apporte de l’eau de la pompe au fournil.'),
    line(
      'veille',
      'side',
      'Veiller la nuit',
      3,
      3,
      1,
      'Retrouve-toi avec l’autre joueur devant l’église.',
      true,
    ),
    line('vieux', 'side', 'Le vieux chêne', 2, 2, 2, ''),
    line('poules', 'errand', 'Les œufs de Solange', 3, 1, 0, 'Rapporte six œufs frais.'),
    line(
      'lettre',
      'errand',
      'Une lettre à poster',
      7,
      1,
      0,
      'Dépose la lettre au bureau de poste.',
    ),
  ];
}

export function fakeVillagers(plan: PlanRead | null): readonly VillagerRead[] {
  const spots = plan?.points_cles ?? [];
  return NAMES.map((name, i) => {
    const key = spots[(i * 2) % Math.max(1, spots.length)];
    const node = key === undefined ? undefined : plan?.noeuds[key.noeud];
    const met = i < 7;
    return {
      id: `h${String(i)}`,
      name,
      met,
      halves: [Math.max(0, 7 - i), Math.max(0, 4 - i)] as const,
      craft: met
        ? ([
            'Cheminot',
            'Pensionnaire',
            'Forgeron',
            'Fermière',
            'Boulanger',
            'Couturière',
            'Horlogère',
          ][i] ?? null)
        : null,
      likes: met && i % 2 === 0 ? [{ item: 'pomme', name: 'Pomme' }] : [],
      dislikes: met && i === 0 ? [{ item: 'buche', name: 'Bûche' }] : [],
      where: met && node !== undefined ? { label: key?.nom ?? '', x: node.x, y: node.y } : null,
      something: i === 1 ? 'story' : i === 3 ? 'gift' : i === 4 ? 'request' : null,
    };
  });
}

export function fakeCollections(): readonly CollectionRead[] {
  const sizes: Readonly<Record<string, number>> = {
    fish: 16,
    insects: 16,
    fossils: 12,
    flowers: 12,
    outfits: 15,
    recipes: 18,
    postcards: 12,
    music: 8,
  };
  return COLLECTION_FAMILIES.map((family) => {
    const total = sizes[family] ?? 8;
    const foundCount =
      family === 'music' ? total : family === 'fish' ? 7 : family === 'flowers' ? 3 : 0;
    const entries: CollectionEntryRead[] = Array.from({ length: total }, (_, i) => ({
      id: `${family}-${String(i + 1)}`,
      name: `${family === 'music' ? 'Air' : 'Trouvaille'} ${String(i + 1)}`,
      rarity: i % 7 === 6 ? 3 : i % 3 === 2 ? 2 : 1,
      found: i < foundCount,
      firstBy: i < foundCount ? (i % 3 === 0 ? 0 : i % 3 === 1 ? 1 : 'duo') : null,
      clues: {
        moments: i < foundCount || i % 4 === 0 ? ['morning', 'evening'] : null,
        weathers: i < foundCount && i % 2 === 0 ? ['rain'] : null,
        seasons: i < foundCount ? ['spring', 'summer'] : null,
        where: i < foundCount ? 'la rivière' : null,
      },
    }));
    return { family, entries };
  });
}

/** Sources entièrement factices (la carte seulement si un plan est donné). */
export function dummySources(plan: PlanRead | null, closed: readonly string[] = []): CarnetSources {
  return {
    quests: () => fakeQuests(),
    villagers: () => fakeVillagers(plan),
    collections: () => fakeCollections(),
    map(world) {
      if (plan === null) return null;
      const villagers = fakeVillagers(plan);
      return {
        plan,
        players: world.players.map((p, i) => ({
          index: i === 0 ? 0 : 1,
          name: p.name,
          x: p.body.x,
          y: p.body.y,
        })),
        villagers: villagers.flatMap((v) =>
          v.met && v.where !== null
            ? [
                {
                  id: v.id,
                  name: v.name,
                  x: v.where.x + v.id.length,
                  y: v.where.y,
                  something: v.something !== null,
                },
              ]
            : [],
        ),
        closed,
        night: world.minutes >= UI_TUNING.nightFrom || world.minutes < UI_TUNING.nightUntil,
      };
    },
  };
}
