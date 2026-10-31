import { describe, expect, it } from 'vitest';
import soundsFile from '../../../assets/son/sons.json';
import { parseCatalogue } from '../../audio/catalogue';
import { UI_SETTINGS } from '../config';
import { type MountedFacts, UiSoundGate, buttonSound, layerSounds } from '../sons';

const panel = (menu: string): MountedFacts => ({ kind: 'panel', key: `panel:${menu}` });
const button = (sound: string | null, ariaDisabled: string | null = null, disabled = false): { disabled: boolean; ariaDisabled: string | null; sound: string | null } => ({
  disabled,
  ariaDisabled,
  sound,
});

/** Joue un parcours de gestes (son voulu, instant en ms) et rend ce qui est vraiment parti. */
function played(steps: readonly (readonly [Parameters<UiSoundGate['play']>[0] | null, number])[]): string[] {
  const out: string[] = [];
  const gate = new UiSoundGate((id) => out.push(id));
  for (const [id, at] of steps) if (id !== null) gate.play(id, at);
  return out;
}

describe('sons de l’interface (demandes 7 et 14 de l’audio)', () => {
  it('chaque son demandé par l’interface existe dans sons.json, sur le bus interface', () => {
    const catalogue = parseCatalogue(soundsFile);
    for (const id of Object.keys(UI_SETTINGS.soundMinMs)) {
      const def = catalogue.sounds.get(id);
      expect(def, id).toBeDefined();
      expect(def?.bus, id).toBe('ui');
    }
  });

  it('valide, suit `data-sound`, se tait sur `none`, refuse un bouton désactivé', () => {
    expect(buttonSound(button(null))).toBe('ui-confirm');
    expect(buttonSound(button('ui-next'))).toBe('ui-next');
    expect(buttonSound(button('none'))).toBeNull();
    expect(buttonSound(button(null, 'true'))).toBe('ui-refusal');
    expect(buttonSound(button('inconnu'))).toBe('ui-confirm');
  });

  it('ouvre et ferme les panneaux, sauf ceux que l’audio du monde sonne déjà', () => {
    // Caisse ouverte puis fermée par Retour arrière ou par un clic sur la scène.
    expect(layerSounds(null, panel('crate'))).toEqual(['ui-panel-open']);
    expect(layerSounds(panel('crate'), null)).toEqual(['ui-panel-close']);
    // Le carnet garde `journal-open` à l’ouverture, se ferme comme les autres; le coffre a ses sons de couvercle.
    expect(layerSounds(null, panel('notebook'))).toEqual([]);
    expect(layerSounds(panel('notebook'), null)).toEqual(['ui-panel-close']);
    expect(layerSounds(null, panel('chest'))).toEqual([]);
    expect(layerSounds(panel('chest'), null)).toEqual([]);
    // D’un panneau à l’autre: une seule ouverture; dialogues et écrans ne sonnent pas ici.
    expect(layerSounds(panel('crate'), panel('shop'))).toEqual(['ui-panel-open']);
    expect(layerSounds(null, { kind: 'dialogue', key: 'dialogue:talk' })).toEqual([]);
    expect(layerSounds(panel('crate'), panel('crate'))).toEqual([]);
  });

  it('ne sonne jamais en rafale: flèche tenue, double clic, refus répétés', () => {
    // Flèche tenue (répétition du clavier toutes les 30 ms): un focus toutes les 45 ms au plus.
    expect(played([['ui-focus', 0], ['ui-focus', 30], ['ui-focus', 60], ['ui-focus', 90], ['ui-focus', 120]])).toEqual(['ui-focus', 'ui-focus', 'ui-focus']);
    // Double clic sur « Acheter 1 »: deux validations à 50 ms, un seul son; puis un onglet tout de suite.
    expect(played([['ui-confirm', 0], ['ui-confirm', 50], ['ui-tab', 60]])).toEqual(['ui-confirm', 'ui-tab']);
    // Refus répétés: 600 ms au moins entre deux.
    expect(played([['ui-refusal', 0], ['ui-refusal', 300], ['ui-refusal', 650]])).toEqual(['ui-refusal', 'ui-refusal']);
  });

  it('parcours du comptoir au clavier: ouvrir, descendre, acheter, changer d’onglet, fermer', () => {
    const steps = [
      ...layerSounds(null, panel('shop')).map((id) => [id, 0] as const),
      ['ui-focus', 400] as const,
      [buttonSound(button(null)), 900] as const,
      ['ui-tab', 1400] as const,
      ...layerSounds(panel('shop'), null).map((id) => [id, 2000] as const),
    ];
    expect(played(steps)).toEqual(['ui-panel-open', 'ui-focus', 'ui-confirm', 'ui-tab', 'ui-panel-close']);
  });

  it('sans audio (option absente), rien ne part et rien ne casse', () => {
    const gate = new UiSoundGate(null);
    expect(gate.play('ui-confirm', 0)).toBe(false);
  });
});
