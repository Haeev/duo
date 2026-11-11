// Gabarits (règle du studio du 2026-11-10): un exemplaire factice tiré de chaque gabarit, ajouté
// aux données sans toucher à une ligne de code, doit se charger et paraître en jeu.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { loadContent, type Content } from '../src/donnees/charger';
import { SLICE_SCHEMAS } from '../src/reseau/canaux';
import { fastMessage, sliceMessage } from '../src/reseau/tranches';
import { seatedTogether } from '../src/simulation/besoins/repas';
import { createPlaceState, createWorld } from '../src/simulation/noyau/monde';
import { contextOf } from './aides-l3';
import { send } from './aides-noyau';
import { plan, stripComments, TEMPLATES } from '../outils/nouveau';
import { dataFiles, MEMBERS, newSim, SEED } from './aides';

const TEMPLATE_DIR = fileURLToPath(new URL('../donnees/_gabarits/', import.meta.url));

type Json = Record<string, unknown>;

/** Les données du jeu, plus les fichiers que `pnpm nouveau <type> <id> [lieu]` créerait, retouchés par `fill`. */
function withNew(
  type: string,
  id: string,
  place: string | null,
  fill?: (value: Json, files: Record<string, Json>) => void,
): Content {
  const files = dataFiles() as Record<string, Json>;
  for (const file of plan(TEMPLATE_DIR, type, id, place)) {
    if (file.array === null) {
      expect(files[file.path], `${file.path} existe déjà`).toBeUndefined();
      files[file.path] = file.value;
    } else {
      (files[file.path]?.[file.array] as Json[]).push(file.value);
    }
    fill?.(file.value, files);
  }
  return loadContent(files);
}

describe('gabarits', () => {
  it('existent pour chaque type de contenu et se lisent une fois les commentaires retirés', () => {
    expect(Object.keys(TEMPLATES).sort()).toEqual(
      [
        'abri',
        'air-jouable',
        'batiment',
        'commande',
        'commerce',
        'culture',
        'espece',
        'dialogue',
        'entree-de-collection',
        'evenement',
        'guichet-de-commande',
        'habitant',
        'interieur',
        'insecte',
        'lettre',
        'lieu',
        'logement',
        'meuble',
        'objet',
        'piece-de-personnage',
        'plan',
        'prise',
        'quete',
        'recette',
        'ressource',
        'scene',
        'sujet-photo',
        'vehicule',
      ].sort(),
    );
    for (const template of Object.values(TEMPLATES)) {
      for (const file of template.files) {
        const text = readFileSync(TEMPLATE_DIR + file.from, 'utf8');
        expect(text.startsWith('// GABARIT'), file.from).toBe(true);
        expect(() => JSON.parse(stripComments(text)) as unknown, file.from).not.toThrow();
      }
    }
  });

  it('objet: une poire ajoutée par un seul fichier est connue du jeu', () => {
    const content = withNew('objet', 'poire', null);
    expect(content.items.poire).toMatchObject({ id: 'poire', stack: 5, food: { hunger: 10 } });
  });

  it('meuble avec brique: un tabouret ajouté par un seul fichier, posé sur une carte, paraît en jeu avec sa place assise', () => {
    const content = withNew('meuble', 'tabouret', null, (_value, files) => {
      // Le level designer la pose: une ligne dans la carte du lieu.
      (files['lieux/essai-gare/carte.json']?.objects as Json[]).push({
        id: 'tabouret-du-guichet',
        type: 'tabouret',
        x: 22.5,
        y: 16.5,
        rotation: 2,
      });
    });
    expect(content.props.tabouret?.bricks).toEqual([{ brick: 'sit', seats: 1, restPerMinute: 6 }]);
    const world = createWorld(content, SEED, MEMBERS);
    // En jeu: l'état du lieu porte le tabouret et sa brique, et la tranche « lieu » l'envoie à l'invité.
    expect(world.places['essai-gare']?.objects['tabouret-du-guichet']).toEqual({ sit: [null] });
    const message = sliceMessage(world, 'place');
    expect(message.place.objects['tabouret-du-guichet']).toEqual({ sit: [null] });
    expect(v.safeParse(SLICE_SCHEMAS.place, JSON.parse(JSON.stringify(message))).success).toBe(
      true,
    );
  });

  it('habitant: un facteur ajouté par un seul fichier se tient à son poste chez les deux joueurs', () => {
    const content = withNew('habitant', 'facteur', 'essai-gare');
    expect(content.places['essai-gare']?.villagers.map((villager) => villager.id)).toEqual([
      'cheffe-de-gare',
      'facteur',
      'odilon',
    ]);
    const world = createWorld(content, SEED, MEMBERS);
    expect(world.places['essai-gare']?.villagers.facteur?.body).toMatchObject({ x: 20, y: 15 });
    expect(sliceMessage(world, 'place').place.villagers.facteur).toEqual({
      met: [false, false],
      talkingWith: null,
    });
    expect(fastMessage(world, content, -1).villagers).toHaveLength(3);
  });

  it('dialogue: un dialogue ajouté par un seul fichier est rattaché à son habitant et passe le validateur', () => {
    const content = withNew('dialogue', 'pomme-offerte', 'essai-gare');
    const dialogue = content.places['essai-gare']?.dialogues.find((d) => d.id === 'pomme-offerte');
    expect(dialogue?.villager).toBe('cheffe-de-gare');
    expect(Object.keys(dialogue?.nodes ?? {})).toEqual(['bonjour', 'choix', 'merci']);
  });

  it('recette, prise, commerce, quête et pièce de personnage: chaque gabarit se charge tel quel', () => {
    expect(withNew('recette', 'compote', null).recipes.compote?.station).toBe('stove');
    expect(withNew('prise', 'poisson-factice', null).catches['poisson-factice']?.kind).toBe('fish');
    expect(
      withNew('commerce', 'buvette', 'essai-gare').places['essai-gare']?.shops.buvette?.keeper,
    ).toBe('cheffe-de-gare');
    expect(
      withNew('quete', 'pommes-du-quai', 'essai-gare').places['essai-gare']?.quests[
        'pommes-du-quai'
      ]?.chapters,
    ).toHaveLength(1);
    expect(withNew('piece-de-personnage', 'pull-bleu', null).pieces['pull-bleu']?.slot).toBe('top');
  });

  it('lieu: un dossier de lieu ajouté tel quel est connu du jeu, et se relie au rail par deux lignes', () => {
    const alone = withNew('lieu', 'bout-de-ligne', null);
    expect(alone.places['bout-de-ligne']?.map.objects[0]?.type).toBe('banc');
    const linked = withNew('lieu', 'bout-de-ligne', null, (value, files) => {
      if ('links' in value) value.links = ['essai-halte'];
      (files['lieux/essai-halte/lieu.json']?.links as string[]).push('bout-de-ligne');
    });
    expect(linked.places['essai-halte']?.def.links).toContain('bout-de-ligne');
  });

  it('intérieur: une pièce ajoutée sous le dehors, reliée par une paire de portes, est sur la grille du lieu', () => {
    const content = withNew('interieur', 'remise-d-essai', 'essai-gare', (value, files) => {
      const map = files['lieux/essai-gare/carte.json'];
      if (map === undefined) return;
      map.outdoor = { x: 0, y: 0, w: map.width, h: map.height };
      value.at = { x: 2, y: Number(map.height) + 2 };
      map.height = Number(map.height) + 10;
      map.doors = { 'piece-porte-dehors': { x: 20, y: 20, facing: 0, to: 'piece-porte' } };
    });
    const map = content.places['essai-gare']?.map;
    expect(map?.points['piece-milieu']).toEqual({ x: 6, y: 45 });
    expect(map?.doors?.['piece-porte']?.to).toBe('piece-porte-dehors');
  });

  it('objet sac: un sac ajouté par un seul fichier s’achète, se trouve ou se reçoit, puis s’équipe', () => {
    const content = withNew('objet', 'sac-de-mer', null, (value) => {
      Object.assign(value, { family: 'bag', stack: 1, food: null, bag: 'sac-de-toile' });
    });
    expect(content.items['sac-de-mer']).toMatchObject({ family: 'bag', bag: 'sac-de-toile' });
    const sim = newSim(content);
    sim.world.players[0].toolbar[0] = { item: 'sac-de-mer', count: 1 };
    send(sim, 0, { type: 'equip_bag', from: { area: 'toolbar', index: 0 } });
    expect(sim.world.players[0].bag?.id).toBe('sac-de-toile');
  });

  it('carte: les champs facultatifs du gabarit (objet au sol, pourquoi) se chargent et paraissent en jeu', () => {
    const content = withNew('lieu', 'bout-de-ligne', null);
    const place = content.places['bout-de-ligne'];
    expect(place?.map.groundItems?.[0]).toMatchObject({ item: 'pomme', respawnDaily: true });
    expect(place?.def.pourquoi).toMatch(/modèle/);
    expect(place?.map.objects[0]?.pourquoi).toMatch(/quai/);
    if (place === undefined) throw new Error('bout-de-ligne');
    expect(createPlaceState(content, place).ground[0]?.stack).toEqual({ item: 'pomme', count: 1 });
  });

  it('ensemble de meubles: le groupe du gabarit de carte (table et chaises) fait un repas à deux', () => {
    const content = withNew('meuble', 'tabouret', null, (_value, files) => {
      const objects = files['lieux/essai-gare/carte.json']?.objects as Json[];
      for (const [id, y] of [
        ['tabouret-a', 24],
        ['tabouret-b', 25],
      ] as const)
        objects.push({ id, type: 'tabouret', x: 22.5, y, rotation: 0, group: 'gouter' });
    });
    const sim = newSim(content);
    const seats = sim.world.places['essai-gare']?.objects;
    if (seats?.['tabouret-a']?.sit) seats['tabouret-a'].sit[0] = 0;
    if (seats?.['tabouret-b']?.sit) seats['tabouret-b'].sit[0] = 1;
    expect(seatedTogether(contextOf(sim), 'tabouret-a')).toBe(true);
  });

  it('refuse un type inconnu, un identifiant mal formé et un lieu manquant', () => {
    expect(() => plan(TEMPLATE_DIR, 'vaisseau', 'x1', null)).toThrow(/type inconnu/);
    expect(() => plan(TEMPLATE_DIR, 'objet', 'Poire', null)).toThrow(/identifiant/);
    expect(() => plan(TEMPLATE_DIR, 'habitant', 'facteur', null)).toThrow(/demande un lieu/);
  });
});
