// Bouton « Équiper » du carnet: modèle de vue pur, branché sur l'intention réelle `equip_bag`.
import { describe, expect, it } from 'vitest';
import { equipModel, equippedText } from '../src/interface/equiper';
import { fitScale } from '../src/interface/modeles';
import { TEXTS } from '../src/interface/textes';
import { act } from './aides-l3';
import { gameContent, newSim } from './aides';

const content = gameContent();
// Tirets cadratin et demi-cadratin, écrits par code pour ne pas les mettre dans le dépôt.
const DASHES = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);

describe('carnet: taille d’interface et petite fenêtre', () => {
  it('carnet fermé: la taille choisie; ouvert dans une petite fenêtre: ramenée pour qu’il tienne', () => {
    expect(fitScale(1.15, false, 1280, 720)).toBe(1.15);
    expect(fitScale(1.15, true, 1920, 1080)).toBe(1.15);
    expect(fitScale(1.15, true, 1366, 768)).toBeCloseTo(1.0841, 3);
    expect(fitScale(1.15, true, 1280, 720)).toBeCloseTo(1280 / 1260, 5);
    expect(fitScale(1, true, 1100, 600)).toBe(1);
  });
});

describe('carnet: équiper un sac', () => {
  it('un objet qui n’est pas un sac n’a pas de bouton', () => {
    expect(equipModel(content, 'pomme', null).kind).toBe('none');
    expect(equipModel(content, 'objet-inconnu', null).kind).toBe('none');
  });

  it('sans sac, ou avec un sac plus petit: possible, avec le nom et la place gagnée', () => {
    expect(equipModel(content, 'sac-de-toile', null)).toEqual({
      kind: 'ready',
      bag: 'sac-de-toile',
      name: 'Sac de toile',
      slots: 6,
    });
    expect(equipModel(content, 'sac-de-toile', 'besace').kind).toBe('ready');
  });

  it('même sac ou sac plus petit: refusé, et le refus dit quoi faire', () => {
    const same = equipModel(content, 'sac-de-toile', 'sac-de-toile');
    expect(same).toMatchObject({ kind: 'refused', why: 'same' });
    const smaller = equipModel(content, 'sac-de-toile', 'sac-a-dos');
    expect(smaller).toMatchObject({ kind: 'refused', why: 'smaller' });
    if (smaller.kind === 'refused') {
      expect(smaller.text).toContain('10 cases');
      expect(smaller.text).toContain('6');
      expect(smaller.text).toMatch(/Garde|donne/);
    }
  });

  it('l’intention réelle répond par bag_changed, et le texte de succès nomme le sac', () => {
    const sim = newSim(content);
    const me = sim.world.players[0];
    me.toolbar[0] = { item: 'sac-de-toile', count: 1 };
    const events = act(sim, 0, { type: 'equip_bag', from: { area: 'toolbar', index: 0 } });
    expect(events).toContainEqual({ type: 'bag_changed', player: 0, bag: 'sac-de-toile' });
    expect(me.bag?.slots).toHaveLength(6);
    expect(equippedText(content, 'sac-de-toile')).toBe('Sac de toile équipé : 6 cases.');
  });

  it('les textes du bouton sont en français typographié, sans tiret cadratin', () => {
    const all = Object.values(TEXTS.notebook).flatMap((t) => (typeof t === 'string' ? [t] : []));
    for (const text of all) expect(text).not.toMatch(DASHES);
    expect(TEXTS.notebook.equip).toBe('Équiper');
  });
});
