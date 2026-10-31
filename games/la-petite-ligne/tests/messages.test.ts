// Textes composés par la simulation: l'objet avec son article (champ `indefinite` de objets.json,
// demande 12 de l'interface) et les messages facultatifs (repli silencieux si le texte manque).
import { describe, expect, it } from 'vitest';
import type { AuthoredIntent } from '../src/etat/actions';
import type { CharacterId } from '../src/etat/types';
import { loadContent } from '../src/donnees/contenu';
import { CONTENT_FILES } from '../src/donnees/fichiers';
import type { Content } from '../src/donnees/types';
import { ContentError } from '../src/donnees/lecteur';
import type { Sim } from '../src/simulation/contexte';
import { character, message } from '../src/simulation/contexte';
import { footprintCells, placeCharacter } from '../src/simulation/deplacement';
import { step } from '../src/simulation/pas';
import { updateFishing } from '../src/simulation/peche';
import { addToBag } from '../src/simulation/sac';
import { newSim } from './aides';

/** Un champ d'un objet de `objets.json` à changer (`value` absente: le champ est retiré). */
interface ItemEdit {
  id: string;
  key: string;
  value?: unknown;
}

/** Le contenu du jeu, avec ces retouches de `objets.json` (sur une copie: le fichier n'est pas touché). */
function contentWith(...edits: ItemEdit[]): Content {
  const objets: unknown = structuredClone(CONTENT_FILES.objets);
  const items: unknown = typeof objets === 'object' && objets !== null && 'items' in objets ? objets.items : null;
  if (!Array.isArray(items)) throw new Error('objets.json sans liste « items »');
  for (const edit of edits) {
    const index = items.findIndex((x: unknown) => typeof x === 'object' && x !== null && 'id' in x && x.id === edit.id);
    const item: unknown = items[index];
    if (typeof item !== 'object' || item === null) throw new Error(`objet absent: ${edit.id}`);
    const rest = Object.fromEntries(Object.entries(item).filter(([key]) => key !== edit.key));
    items[index] = edit.value === undefined ? rest : { ...rest, [edit.key]: edit.value };
  }
  return loadContent({ ...CONTENT_FILES, objets });
}

/** Jour 1, les deux personnages créés, scène d'arrivée passée (comme dans regles.test.ts). */
function started(content?: Content): Sim {
  const sim = newSim(undefined, content);
  step(sim, {
    controls: {},
    intents: [
      { by: 'p1', intent: { type: 'create_character', name: 'Camille', hair: 0, outfit: 0 } },
      { by: 'p2', intent: { type: 'create_character', name: 'Sacha', hair: 1, outfit: 1 } },
    ],
  });
  for (let i = 0; i < 40 && sim.world.scene !== null; i++) {
    const scene = sim.world.scene;
    const next: AuthoredIntent[] = (['p1', 'p2'] as CharacterId[]).map((by) => ({
      by,
      intent: scene.choices.length > 0 ? { type: 'dialogue_choice', choice: scene.choices[0]?.id ?? '' } : { type: 'dialogue_next' },
    }));
    step(sim, { controls: {}, intents: next });
  }
  return sim;
}

/** Camille achète à l'épicerie (au-delà du seuil: une proposition chez Sacha). */
function proposeAtGrocery(sim: Sim, item: string, count: number): string | undefined {
  const counter = sim.map.points.grocery_counter;
  if (counter === undefined) throw new Error('comptoir absent');
  sim.world.clock.minutes = 9 * 60;
  for (let i = 0; i < 20; i++) step(sim, { controls: {}, intents: [] });
  placeCharacter(sim, character(sim, 'p1'), counter);
  step(sim, { controls: {}, intents: [{ by: 'p1', intent: { type: 'buy', item, count } }] });
  return character(sim, 'p2').notifications.find((n) => n.key === 'big_purchase_proposal')?.text;
}

describe('objets: article indéfini', () => {
  it('`indefinite` est facultatif, et doit être un texte non vide', () => {
    const field = { id: 'mattress', key: 'indefinite' };
    expect(contentWith({ ...field, value: 'un matelas' }).items.mattress?.indefinite).toBe('un matelas');
    expect(contentWith(field).items.mattress?.indefinite).toBeNull();
    expect(() => contentWith({ ...field, value: ' ' })).toThrow(ContentError);
    expect(() => contentWith({ ...field, value: 12 })).toThrow(/indefinite/);
  });

  it('gros achat: la proposition et l’accord écrivent l’objet avec son article', () => {
    const sim = started(contentWith({ id: 'mattress', key: 'indefinite', value: 'un matelas' }));
    const text = proposeAtGrocery(sim, 'mattress', 1);
    expect(text).toBe(message(sim, 'big_purchase_proposal', { partner: 'Camille', item: 'un matelas', price: 120 }));
    const proposal = sim.world.proposals[0];
    step(sim, { controls: {}, intents: [{ by: 'p2', intent: { type: 'proposal_answer', proposal: proposal?.id ?? '', accept: true } }] });
    const accepted = character(sim, 'p1').notifications.find((n) => n.key === 'big_purchase_accepted');
    expect(accepted?.text).toBe(message(sim, 'big_purchase_accepted', { item: 'un matelas' }));
  });

  it('sans `indefinite`, le nom seul; à plusieurs, le nombre et le pluriel', () => {
    const content = contentWith({ id: 'mattress', key: 'indefinite' }, { id: 'carrot_seed', key: 'indefinite' });
    const alone = started(content);
    expect(proposeAtGrocery(alone, 'mattress', 1)).toBe(message(alone, 'big_purchase_proposal', { partner: 'Camille', item: 'matelas', price: 120 }));
    const many = started(content);
    const seed = content.items.carrot_seed;
    if (seed === undefined || seed.buyPrice === null) throw new Error('graines de carotte sans prix');
    const count = Math.ceil(content.settings.economy.bigPurchaseThreshold / seed.buyPrice);
    expect(proposeAtGrocery(many, 'carrot_seed', count)).toBe(
      message(many, 'big_purchase_proposal', { partner: 'Camille', item: `${count} ${seed.plural}`, price: count * seed.buyPrice }),
    );
  });
});

describe('messages facultatifs', () => {
  function escape(sim: Sim): void {
    const c = character(sim, 'p1');
    const rod = c.bag.findIndex((s) => s?.item === 'fishing_rod');
    expect(rod).toBeGreaterThanOrEqual(0);
    c.selected = rod;
    c.fishing = { phase: 'bite', bobber: { x: c.pos.x + 1, y: c.pos.y }, biteAt: sim.world.tick, until: sim.world.tick };
    sim.world.tick += 1;
    updateFishing(sim, c);
  }

  it('pêche: le poisson échappé se dit avec `fish_escaped`, en silence si le texte manque', () => {
    const sim = started();
    escape(sim);
    expect(character(sim, 'p1').notifications.at(-1)?.key).toBe('fish_escaped');
    expect(sim.events.some((e) => e.type === 'escaped')).toBe(true);

    const base = loadContent(CONTENT_FILES);
    const messages = Object.fromEntries(Object.entries(base.texts.messages).filter(([key]) => key !== 'fish_escaped'));
    const quiet = started({ ...base, texts: { ...base.texts, messages } });
    const before = character(quiet, 'p1').notifications.at(-1)?.id;
    escape(quiet);
    const c = character(quiet, 'p1');
    expect(c.fishing).toBeNull();
    expect(c.notifications.at(-1)?.id, 'aucune notification nouvelle').toBe(before);
    expect(quiet.events.some((e) => e.type === 'escaped')).toBe(true);
  });
});

describe('aménagement: raison du refus', () => {
  it('suit le monde, même quand la case visée ne change pas (remarque 11 de l’interface)', () => {
    const sim = started();
    const c = character(sim, 'p1');
    const counter = sim.map.points.grocery_counter;
    if (counter === undefined) throw new Error('comptoir absent');
    placeCharacter(sim, character(sim, 'p2'), counter);
    sim.world.furniture = [];
    sim.runtime.dynamicDirty = true;
    addToBag(sim, c, 'table', 'ordinary', 1);
    const room = sim.map.house.room;
    placeCharacter(sim, c, { x: room.x + 0.5, y: room.y + 1.5 });
    c.facing = 0;
    step(sim, { controls: {}, intents: [{ by: 'p1', intent: { type: 'hold_furniture', item: 'table' } }] });
    const preview = c.placement;
    const footprint = sim.content.items.table?.footprint;
    if (preview === null || footprint === null || footprint === undefined) throw new Error('aperçu absent');
    expect(preview.valid).toBe(true);
    const [first] = footprintCells(footprint, preview.cell, preview.rotation);
    if (first === undefined) throw new Error('empreinte vide');
    const texts = sim.content.texts.messages;
    // Sacha se tient sur l'empreinte, puis un meuble y est posé: la case reste la même, la raison change.
    placeCharacter(sim, character(sim, 'p2'), { x: first.cx + 0.5, y: first.cy + 0.5 });
    step(sim, { controls: {}, intents: [] });
    expect(c.placement?.blocked).toBe(texts.placement_occupied);
    sim.world.furniture.push({ id: 'f-essai', item: 'table', cell: { ...first }, rotation: 0, placedBy: null });
    sim.runtime.dynamicDirty = true;
    step(sim, { controls: {}, intents: [] });
    expect(c.placement?.cell).toEqual(preview.cell);
    expect(c.placement?.valid).toBe(false);
    expect(c.placement?.blocked).toBe(texts.placement_overlap);
  });
});
