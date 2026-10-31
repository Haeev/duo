import { describe, expect, it } from 'vitest';
import {
  capitalize,
  cleanName,
  clockTime,
  countIn,
  countedList,
  fill,
  hourLabel,
  itemTitle,
  keyTokens,
  lowerFirst,
  profileSymbol,
  safeColor,
  weekdayOf,
} from '../format';
import { contentAndMap } from './aides';

describe('gabarits et mots', () => {
  it('remplit les gabarits et garde les noms inconnus', () => {
    expect(fill('{partner} propose {item}', { partner: 'Sacha', item: 'un matelas' })).toBe('Sacha propose un matelas');
    expect(fill('{move} pour marcher', {})).toBe('{move} pour marcher');
  });

  it('met et retire la majuscule initiale', () => {
    expect(capitalize('écran')).toBe('Écran');
    expect(lowerFirst('Récolter quelque chose de beau.')).toBe('récolter quelque chose de beau.');
    expect(capitalize('')).toBe('');
  });

  it('nettoie le prénom comme la simulation', () => {
    expect(cleanName('  Camille  ')).toBe('Camille');
    expect(cleanName('Jean-Christophe-Marie-Eugène')).toBe('Jean-Christophe-');
    expect(cleanName('   ')).toBe('');
  });
});

describe('heures et jours', () => {
  it("arrondit l'horloge au pas de 10 minutes", () => {
    expect(clockTime(9 * 60 + 27, '{hours} h {minutes}')).toBe('9 h 20');
    expect(clockTime(6 * 60, '{hours} h {minutes}')).toBe('6 h 00');
    expect(clockTime(23 * 60 + 59.9, '{hours} h {minutes}')).toBe('23 h 50');
  });

  it('écrit une heure ronde sans minutes', () => {
    expect(hourLabel(16 * 60, '{hours} h {minutes}')).toBe('16 h');
    expect(hourLabel(17 * 60 + 30, '{hours} h {minutes}')).toBe('17 h 30');
  });

  it('donne le jour de la semaine du jour de la démo (le jour 1 est un samedi)', () => {
    const { content } = contentAndMap();
    expect(weekdayOf(1, content.texts.weekdays)).toBe('samedi');
    expect(weekdayOf(5, content.texts.weekdays)).toBe('mercredi');
    expect(weekdayOf(8, content.texts.weekdays)).toBe('samedi');
  });
});

describe('objets et commande', () => {
  it('écrit la commande avec les noms au pluriel', () => {
    const { content } = contentAndMap();
    expect(countedList(content, content.settings.order.lines, content.texts.orderFormat)).toBe('12 radis, 3 laitues, 6 œufs, 10 planches');
  });

  it('compte un objet dans des piles, toutes qualités ou une seule', () => {
    const stacks = [
      { item: 'radish', quality: 'fine' as const, count: 3 },
      null,
      { item: 'radish', quality: 'ordinary' as const, count: 5 },
      { item: 'egg', quality: 'ordinary' as const, count: 2 },
    ];
    expect(countIn(stacks, 'radish')).toBe(8);
    expect(countIn(stacks, 'radish', 'fine')).toBe(3);
    expect(countIn(stacks, 'carrot')).toBe(0);
  });

  it('met une majuscule au nom de l’objet', () => {
    const { content } = contentAndMap();
    expect(itemTitle(content.items.radish_seed, 1)).toBe('Sachet de graines de radis');
    expect(itemTitle(content.items.egg, 3)).toBe('Œufs');
  });
});

describe('touches et profils', () => {
  it('remplace les jetons des astuces par les libellés du clavier', () => {
    const azerty: Record<string, string> = { KeyW: 'Z', KeyA: 'Q', KeyS: 'S', KeyD: 'D', Space: 'Espace', KeyX: 'X', Tab: 'Tab' };
    const tokens = keyTokens((code) => azerty[code] ?? code);
    expect(tokens.move).toBe('Z Q S D');
    expect(fill('{act} ou un clic pour agir', tokens)).toBe('Espace ou un clic pour agir');
  });

  it('retrouve le symbole du profil Duo à partir de la couleur du foulard', () => {
    expect(profileSymbol('#5CE1E6')).toBe('orb');
    expect(profileSymbol('#8d6cff')).toBe('crescent');
    expect(profileSymbol('#e07a5f')).toBe('sun');
    expect(profileSymbol('pas une couleur')).toBe('orb');
  });

  it('refuse une couleur invalide', () => {
    expect(safeColor('#3D85C6')).toBe('#3d85c6');
    expect(safeColor('red; background: url(x)')).toBe('#5CE1E6');
  });
});
