/** Éditeur de personnage: modèle pur (rayons, choix, hasard), intention `set_look`, brique `mirror`. */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/donnees/charger';
import { type Catalogue, LookSchema, type PieceDef } from '../src/donnees/schemas/personnage';
import {
  choose,
  cleanName,
  editorCategories,
  type EditorDraft,
  genderOfShape,
  isSelected,
  moveFocus,
  piecesFor,
  randomDraft,
  rowsFor,
  wornAt,
} from '../src/interface/editeur/modele';
import { EDITOR_SETTINGS } from '../src/interface/editeur/reglages';
import { WorldSchema } from '../src/etat/monde';
import { aimOf } from '../src/simulation/briques/visee';
import { lookRevealedKey } from '../src/simulation/regles/apparence';
import { wardrobeOf } from '../src/simulation/regles/recompenses';
import { dataFiles, gameContent, newSim } from './aides';
import { contentWith, NORTH, put, send } from './aides-noyau';

const content = gameContent();
const data = { catalogue: content.catalogue, morphologies: content.morphologies };

function draft(): EditorDraft {
  return { gender: 'f', name: 'Camille', look: { shape: 'adult-f-medium', skin: 2, pieces: [] } };
}

function category(id: string): NonNullable<ReturnType<typeof editorCategories>[number]> {
  const found = editorCategories(content.catalogue).find((c) => c.id === id);
  if (found === undefined) throw new Error(`rayon ${id} absent`);
  return found;
}

describe('éditeur de personnage: modèle', () => {
  it('rayons tirés du catalogue: les emplacements sans pièce disparaissent', () => {
    const ids = editorCategories(content.catalogue).map((c) => c.id);
    expect(ids[0]).toBe('corps');
    expect(ids).toContain('haut');
    // Aucune paire de lunettes au catalogue: la section disparaît, le rayon Visage reste.
    expect(category('visage').sections).toStrictEqual([{ kind: 'slot', slot: 'head' }]);
  });

  it('femme ou homme: même choix de pièces, silhouette proposée de même corpulence', () => {
    const rows = rowsFor(category('haut'), draft(), data);
    const asMan = choose(draft(), { kind: 'gender', gender: 'm' }, data);
    expect(asMan.gender).toBe('m');
    expect(genderOfShape(asMan.look.shape, content.morphologies)).toBe('m');
    expect(content.catalogue.shapes.find((s) => s.id === asMan.look.shape)?.build).toBe('medium');
    expect(rowsFor(category('haut'), asMan, data)).toEqual(rows);
    // Les six silhouettes adultes restent proposées à tous (corpulences portables par tous), en
    // une rangée en deux groupes légendés, femme puis homme, dans l'ordre des cases du genre.
    const shapes = rowsFor(category('corps'), asMan, data).find((r) => r.title === 'shape');
    expect(shapes?.tiles).toHaveLength(6);
    expect(shapes?.groups).toEqual([
      { title: 'shape:f', count: 3 },
      { title: 'shape:m', count: 3 },
    ]);
    const genders = shapes?.tiles.map(
      (t) => t.kind === 'shape' && genderOfShape(t.shape, content.morphologies),
    );
    expect(genders).toEqual(['f', 'f', 'f', 'm', 'm', 'm']);
    // La silhouette cochée est celle du groupe du genre choisi.
    const chosen = shapes?.tiles.findIndex((t) => isSelected(asMan, t, data)) ?? -1;
    expect(chosen).toBeGreaterThanOrEqual(3);
  });

  it('robe contre haut et bas, couleurs gardées, taille dans la fourchette', () => {
    let d = choose(draft(), { kind: 'piece', slot: 'top', id: 'top-tee' }, data);
    d = choose(d, { kind: 'piece', slot: 'bottom', id: 'bottom-trousers' }, data);
    d = choose(d, { kind: 'color', slot: 'top', zone: 0, index: 5, hex: '' }, data);
    d = choose(d, { kind: 'piece', slot: 'top', id: 'top-sweater' }, data);
    expect(wornAt(d.look, 'top')?.colors).toEqual([5]);
    d = choose(d, { kind: 'piece', slot: 'dress', id: 'dress-simple' }, data);
    expect(d.look.pieces.map((p) => p.slot)).toEqual(['dress']);
    d = choose(d, { kind: 'height', cm: 175 }, data);
    expect(isSelected(d, { kind: 'height', cm: 175 }, data)).toBe(true);
    expect(v.is(LookSchema, d.look)).toBe(true);
  });

  it('au hasard: déterministe par graine, toujours une apparence valide et de la silhouette choisie', () => {
    const a = randomDraft(draft(), 'graine', data);
    expect(randomDraft(draft(), 'graine', data)).toEqual(a);
    for (let i = 0; i < 30; i += 1) {
      const d = randomDraft(draft(), `g${String(i)}`, data);
      expect(v.is(LookSchema, d.look)).toBe(true);
      expect(genderOfShape(d.look.shape, content.morphologies)).toBe('f');
      expect(EDITOR_SETTINGS.heights).toContain(d.look.height);
      const slots = d.look.pieces.map((p) => p.slot);
      expect(slots.includes('dress') && (slots.includes('top') || slots.includes('bottom'))).toBe(
        false,
      );
    }
  });

  it('gabarits: une pièce ajoutée au catalogue paraît sans code; réservées masquées, teintes de fantaisie à la fin', () => {
    const files = dataFiles();
    const catalogue = files['commun/personnages/catalogue.json'] as Catalogue;
    const hair = catalogue.pieces.find((p) => p.slot === 'hair');
    if (hair === undefined) throw new Error('coiffure absente');
    const fancy = [...(hair.zones[0]?.colors ?? []), ...EDITOR_SETTINGS.playerOnlyColors];
    const extra: PieceDef = {
      ...hair,
      id: 'hair-factice',
      zones: [{ id: 'cheveux', colors: fancy }],
    };
    const reserved: PieceDef = {
      ...hair,
      id: 'hair-habitant',
      tags: [EDITOR_SETTINGS.villagerOnlyTag],
    };
    const watch: PieceDef = {
      ...hair,
      id: 'accessory-montre-factice',
      slot: 'accessory',
      hair: null,
    };
    files['commun/personnages/catalogue.json'] = {
      ...catalogue,
      pieces: [...catalogue.pieces, extra, reserved, watch],
    };
    const more = loadContent(files);
    const moreData = { catalogue: more.catalogue, morphologies: more.morphologies };
    expect(piecesFor(more.catalogue, 'hair').map((p) => p.id)).toContain('hair-factice');
    expect(piecesFor(more.catalogue, 'hair').map((p) => p.id)).not.toContain('hair-habitant');
    const cheveux = editorCategories(more.catalogue).find((c) => c.id === 'cheveux');
    if (cheveux === undefined) throw new Error('rayon cheveux absent');
    const worn = choose(draft(), { kind: 'piece', slot: 'hair', id: 'hair-factice' }, moreData);
    const rows = rowsFor(cheveux, worn, moreData);
    const ids = rows.flatMap((r) => r.tiles).flatMap((t) => (t.kind === 'piece' ? [t.id] : []));
    expect(ids).toEqual([null, ...piecesFor(more.catalogue, 'hair').map((p) => p.id)]);
    const swatches = rows
      .flatMap((r) => r.tiles)
      .flatMap((t) => (t.kind === 'color' ? [t.hex] : []));
    expect(swatches.slice(-3)).toEqual([...EDITOR_SETTINGS.playerOnlyColors]);
    const accessoire = editorCategories(more.catalogue).find((c) => c.id === 'accessoire');
    // Rangée des accessoires: « aucun », ceux du catalogue, et la montre factice ajoutée ici.
    expect(accessoire !== undefined && rowsFor(accessoire, worn, moreData)[0]?.tiles.length).toBe(
      piecesFor(content.catalogue, 'accessory').length + 2,
    );
  });

  it('navigation au clavier entre rangées de longueurs différentes, prénom nettoyé', () => {
    const rows = [{ tiles: [1, 2] }, { tiles: [1, 2, 3, 4, 5, 6] }, { tiles: [1, 2, 3] }];
    expect(moveFocus(rows, { row: 0, col: 1 }, 'down')).toEqual({ row: 1, col: 5 });
    expect(moveFocus(rows, { row: 1, col: 5 }, 'down')).toEqual({ row: 2, col: 2 });
    expect(moveFocus(rows, { row: 2, col: 2 }, 'right')).toEqual({ row: 2, col: 2 });
    expect(moveFocus(rows, { row: 0, col: 0 }, 'up')).toEqual({ row: 0, col: 0 });
    expect(cleanName('  Lou   Anne ')).toBe('Lou Anne');
    expect(cleanName('   ')).toBe('');
  });
});

describe('éditeur de personnage: simulation', () => {
  it('set_look règle l’apparence, le prénom et le genre, et les synchronise', () => {
    const sim = newSim(content);
    const before = sim.revisions.players;
    // Comme l'éditeur du jeu: le hasard ne tire que dans la garde-robe du joueur (pas de pièce à gagner).
    const owned = { ...data, catalogue: wardrobeOf(content.catalogue, sim.world, 1) };
    const look = randomDraft(draft(), 'sim', owned).look;
    send(sim, 1, { type: 'set_look', name: 'Lou', look, gender: 'f' });
    const player = sim.world.players[1];
    expect(player).toMatchObject({ name: 'Lou', look, gender: 'f' });
    expect(sim.revisions.players).toBeGreaterThan(before);
    expect(v.is(WorldSchema, sim.world)).toBe(true);
  });

  it('brique mirror: refusée sans visage (avant la photo), puis l’appui rouvre l’éditeur chez ce joueur seulement', () => {
    const furnished = contentWith(
      [{ id: 'miroir-essai', bricks: [{ brick: 'mirror' }] }],
      [{ id: 'miroir', type: 'miroir-essai', x: 30.5, y: 25.5 }],
    );
    const sim = newSim(furnished);
    put(sim, 0, 30.5, 26.6, NORTH);
    // À la gare d'essai, personne ne fait de photo: on arrive avec son visage. On le retire.
    expect(sim.world.progress.memory[lookRevealedKey(0)]?.v).toBe(true);
    Reflect.deleteProperty(sim.world.progress.memory, lookRevealedKey(0));
    expect(aimOf(sim, 0)).toMatchObject({ id: 'miroir', refusal: 'no-face-yet' });
    expect(send(sim, 0, { type: 'act' })).toContainEqual(
      expect.objectContaining({ type: 'refused', player: 0, reason: 'no-face-yet' }),
    );
    sim.world.progress.memory[lookRevealedKey(0)] = { v: true, by: 0, day: 1 };
    expect(aimOf(sim, 0)).toMatchObject({ id: 'miroir', action: 'mirror', refusal: null });
    expect(send(sim, 0, { type: 'act' })).toContainEqual({
      type: 'mirror_opened',
      player: 0,
      target: 'miroir',
    });
  });
});
