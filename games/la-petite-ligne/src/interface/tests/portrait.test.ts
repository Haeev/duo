import { describe, expect, it } from 'vitest';
import { loadContent } from '../../donnees/contenu';
import { CONTENT_FILES } from '../../donnees/fichiers';
import { starterWear } from '../../etat/garde-robe';
import { playerColors, portraitSvg, villagerColors } from '../portrait';

const clothes = loadContent(CONTENT_FILES).clothes;

describe('portraits', () => {
  it('peint le foulard à la couleur du profil Duo et suit la tenue choisie', () => {
    const wear = starterWear(clothes, 1);
    const colors = playerColors('p1', { hair: 2, wear, scarf: '#8D6CFF' }, clothes);
    expect(colors).toMatchObject({ scarf: '#8d6cff', style: 'bun', top: clothes.byId[wear.top]?.couleurs.principale });
    expect(portraitSvg(colors, 'great', 'Pleine forme')).toContain('fill="#8d6cff"');
  });

  it('refuse une couleur de foulard invalide et échappe le nom accessible', () => {
    const colors = playerColors('p2', { hair: 99, scarf: '"><script>' });
    expect(colors.scarf).toBe('#5CE1E6');
    expect(colors.style).toBe('short');
    const svg = portraitSvg(colors, 'low', 'a "b" <c>');
    expect(svg).toContain('aria-label="a &quot;b&quot; &lt;c&gt;"');
    expect(svg).not.toContain('<script>');
  });

  it('a un portrait pour chaque habitant de la démo', () => {
    for (const id of ['firmin', 'odette', 'basile', 'jeanne']) expect(villagerColors(id)).not.toBeNull();
    expect(portraitSvg(villagerColors('basile') ?? playerColors('p1', { hair: 0, scarf: '#fff' }), 'ok', '', 'basile')).toContain('aria-hidden="true"');
  });
});
