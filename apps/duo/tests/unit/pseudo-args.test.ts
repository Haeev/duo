import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCommandLine } from '../../src/main/args';
import { PLAYER_APPEARANCES, PLAYER_COLORS } from '../../src/shared/players';
import { checkPseudo, filterPseudoInput } from '../../src/shared/pseudo';

describe('pseudo (F01, H-01)', () => {
  it('accepte les accents, Œ et Ç, chiffres, espaces intérieures, trait d’union et apostrophes', () => {
    for (const pseudo of ['Hélène', 'Œdipe', 'Çà et là', 'Jean-Luc', "Lou'", 'N’Golo', 'Zoé 2']) {
      expect(checkPseudo(pseudo)).toEqual({ ok: true, value: pseudo });
    }
  });

  it('retire les espaces de début et de fin et normalise en NFC', () => {
    const decomposed = 'Hélène';
    const result = checkPseudo(`  ${decomposed}  `);
    expect(result).toEqual({ ok: true, value: 'Hélène' });
  });

  it('refuse le vide, les émojis, les symboles et plus de 16 graphèmes', () => {
    expect(checkPseudo('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(checkPseudo('Lou\u{1F338}')).toEqual({ ok: false, reason: 'character' });
    expect(checkPseudo('a<b')).toEqual({ ok: false, reason: 'character' });
    expect(checkPseudo('a_b')).toEqual({ ok: false, reason: 'character' });
    expect(checkPseudo('a'.repeat(17))).toEqual({ ok: false, reason: 'length' });
    expect(checkPseudo('é'.repeat(16))).toEqual({ ok: true, value: 'é'.repeat(16) });
  });

  it('filtre la saisie et signale le caractère refusé', () => {
    expect(filterPseudoInput('Sa<cha')).toEqual({ value: 'Sacha', rejected: true });
    expect(filterPseudoInput('x'.repeat(20)).value).toHaveLength(16);
  });
});

describe('profils de joueur', () => {
  it('lit les six profils de joueurs.json dans l’ordre du choix de couleur', () => {
    expect(PLAYER_COLORS).toEqual(['orb', 'crescent', 'star', 'sun', 'planet', 'comet']);
    expect(PLAYER_APPEARANCES.comet.label).toBe('Comète jade');
    expect(PLAYER_APPEARANCES.orb.path.startsWith('M')).toBe(true);
  });
});

describe('ligne de commande (ADR 0003, point 9)', () => {
  it('lit le dossier de données, les jeux, le port et l’adresse', () => {
    const options = parseCommandLine(
      [
        'electron',
        '.',
        '--duo-data-dir=données/Hélène D',
        '--duo-games-dir=/jeux',
        '--duo-liaison-port=41000',
        '--duo-peer-address=192.168.1.42:39430',
      ],
      '/base',
    );
    expect(options).toEqual({
      dataDir: path.resolve('/base', 'données/Hélène D'),
      gamesDir: path.resolve('/jeux'),
      liaisonPort: 41000,
      peerAddress: { host: '192.168.1.42', port: 39430 },
    });
  });

  it('ignore les valeurs invalides', () => {
    const options = parseCommandLine(['--duo-liaison-port=80', '--duo-peer-address=pas une adresse'], '/');
    expect(options).toEqual({ dataDir: null, gamesDir: null, liaisonPort: null, peerAddress: null });
  });
});
