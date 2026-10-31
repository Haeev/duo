import { describe, expect, it } from 'vitest';
import { playerColors, portraitSvg, villagerColors } from '../portrait';

describe('portraits', () => {
  it('peint le foulard à la couleur du profil Duo et suit la tenue choisie', () => {
    const colors = playerColors('p1', { hair: 2, outfit: 1, scarf: '#8D6CFF' });
    expect(colors).toMatchObject({ scarf: '#8d6cff', style: 'bun', top: '#B5663F' });
    expect(portraitSvg(colors, 'great', 'Pleine forme')).toContain('fill="#8d6cff"');
  });

  it('refuse une couleur de foulard invalide et échappe le nom accessible', () => {
    const colors = playerColors('p2', { hair: 9, outfit: 9, scarf: '"><script>' });
    expect(colors.scarf).toBe('#5CE1E6');
    expect(colors.style).toBe('short');
    const svg = portraitSvg(colors, 'low', 'a "b" <c>');
    expect(svg).toContain('aria-label="a &quot;b&quot; &lt;c&gt;"');
    expect(svg).not.toContain('<script>');
  });

  it('a un portrait pour chaque habitant de la démo', () => {
    for (const id of ['firmin', 'odette', 'basile', 'jeanne']) expect(villagerColors(id)).not.toBeNull();
    expect(portraitSvg(villagerColors('basile') ?? playerColors('p1', { hair: 0, outfit: 0, scarf: '#fff' }), 'ok', '', 'basile')).toContain('aria-hidden="true"');
  });
});
