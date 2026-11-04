import { describe, expect, it } from 'vitest';
import { loadContent } from '../../donnees/contenu';
import { CONTENT_FILES } from '../../donnees/fichiers';
import { starterWear } from '../../etat/garde-robe';
import { hasVillagerPhoto, playerColors, portraitSvg, setVillagerPortraitSource, villagerColors, villagerPortraitHtml } from '../portrait';

const clothes = loadContent(CONTENT_FILES).clothes;

describe('portraits', () => {
  it('peint le badge brodé à la couleur du profil Duo (plus de foulard) et suit la tenue choisie', () => {
    const wear = starterWear(clothes, 1);
    const colors = playerColors('p1', { hair: 2, wear, scarf: '#8D6CFF' }, clothes);
    expect(colors).toMatchObject({ scarf: '', badge: '#8d6cff', style: 'bun', top: clothes.byId[wear.top]?.couleurs.principale.toLowerCase() });
    expect(portraitSvg(colors, 'great', 'Pleine forme')).toContain('fill="#8d6cff"');
  });

  it('refuse une couleur de profil invalide et échappe le nom accessible', () => {
    const colors = playerColors('p2', { hair: 99, scarf: '"><script>' });
    expect(colors.badge).toBe('#5CE1E6');
    expect(colors.style).toBe('short');
    const svg = portraitSvg(colors, 'low', 'a "b" <c>');
    expect(svg).toContain('aria-label="a &quot;b&quot; &lt;c&gt;"');
    expect(svg).not.toContain('<script>');
  });

  it('a un portrait pour chaque habitant de la démo', () => {
    for (const id of ['firmin', 'odette', 'basile', 'jeanne']) expect(villagerColors(id)).not.toBeNull();
    expect(portraitSvg(villagerColors('basile') ?? playerColors('p1', { hair: 0, scarf: '#fff' }), 'ok', '', 'basile')).toContain('aria-hidden="true"');
  });

  it('montre le portrait 3D du rendu quand il existe, le dessin sinon (0.13)', () => {
    expect(villagerPortraitHtml('odette', 'good')).toContain('<svg');
    setVillagerPortraitSource((id) => (id === 'odette' ? 'blob:http://jeu/1234' : id === 'basile' ? 'javascript:alert(1)' : null));
    try {
      const html = villagerPortraitHtml('odette', 'good', 'Odette "la"') ?? '';
      expect(html).toContain('<img class="lpl-portrait__photo" src="blob:http://jeu/1234"');
      expect(html).toContain('alt="Odette &quot;la&quot;"');
      expect(hasVillagerPhoto('odette')).toBe(true);
      // Adresse étrangère refusée: le dessin reste.
      expect(villagerPortraitHtml('basile', 'good')).toContain('<svg');
      expect(hasVillagerPhoto('basile')).toBe(false);
      expect(villagerPortraitHtml('inconnu', 'good')).toBeNull();
    } finally {
      setVillagerPortraitSource(null);
    }
    expect(villagerPortraitHtml('odette', 'good')).toContain('<svg');
  });
});
