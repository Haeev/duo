// Images « à la plume » de l'interface: vignettes d'objets, pictos et portraits. Couleurs du
// nuancier de la bible 0.2, tailles, sources présentes, branchement (vignette dessinée sinon
// pastille, expressions des portraits).
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { spriteMarkup, itemThumb, thumbUrl } from '../src/interface/pictos';
import { INK_PICTOS } from '../src/interface/pictos-encre';
import { hasDrawnPortrait, portraitMarkup, PORTRAIT_MOODS } from '../src/interface/portrait';

const PKG = path.join(import.meta.dirname, '..');
const OUT = path.join(PKG, 'assets', 'commun', 'interface');
const SRC = path.join(PKG, 'assets-src', 'interface-encre');

/** Toutes les couleurs du nuancier 0.2 (personnages, encre, tons des lieux). */
function palette(): Set<string> {
  // Copie du nuancier dans le paquet: la publication ne récupère pas `docs/`.
  const file = path.join(SRC, 'nuancier-v02.json');
  const text = readFileSync(file, 'utf8');
  const colors = new Set([...text.matchAll(/#[0-9A-Fa-f]{6}/g)].map((m) => m[0].toUpperCase()));
  // Lèvres des peaux sombres, fixées par la bible 0.2 (section 2.4) hors du fichier.
  colors.add('#D9A08F');
  return colors;
}
const colorsOf = (svg: string): string[] =>
  [...svg.matchAll(/(?:fill|stroke)="(#[0-9A-Fa-f]{6})"/g)].map((m) => (m[1] ?? '').toUpperCase());
const svgIds = (dir: string): string[] =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.svg') && !f.startsWith('_') && !f.startsWith('.'))
    .map((f) => f.slice(0, -4))
    .sort();
/** Largeur et hauteur lues dans l'en-tête d'un PNG. */
function pngSize(file: string): [number, number] {
  const b = readFileSync(file);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

const objects = new Set<string>();
for (const f of readdirSync(path.join(PKG, 'donnees', 'commun', 'objets')))
  if (f.endsWith('.json')) objects.add(f.slice(0, -5));
/** Meubles que les joueurs transportent et posent (`placeable`): ils ont leur vignette aussi. */
const placeables = new Set<string>();
for (const f of readdirSync(path.join(PKG, 'donnees', 'commun', 'meubles'))) {
  if (!f.endsWith('.json')) continue;
  const m: unknown = JSON.parse(
    readFileSync(path.join(PKG, 'donnees', 'commun', 'meubles', f), 'utf8'),
  );
  if (typeof m === 'object' && m !== null && 'placeable' in m && m.placeable === true)
    placeables.add(f.slice(0, -5));
}
/** Vignettes d'essai dessinées avant leur objet (la lettre des quêtes d'Aubrune). */
const AHEAD = new Set(['lettre']);
/**
 * Objets ou meubles posables admis sans vignette, chacun avec sa raison. Vide: toute la série est
 * dessinée. Un nouvel objet des données sans dessin fait échouer le test « chaque objet a sa
 * vignette »: dessiner la vignette (recette dans `assets-src/interface-encre/README.md`) ou l'inscrire ici.
 */
const WITHOUT_THUMB: ReadonlyMap<string, string> = new Map();

describe('vignettes à la plume', () => {
  const ids = svgIds(path.join(OUT, 'vignettes'));
  const colors = palette();

  it('chaque vignette a sa source, et chaque source sa vignette', () => {
    expect(ids).toEqual(svgIds(path.join(SRC, 'vignettes')));
    expect(ids.length).toBeGreaterThanOrEqual(objects.size + placeables.size - WITHOUT_THUMB.size);
  });

  it('porte le nom d’un objet ou d’un meuble posable des données', () => {
    for (const id of ids)
      expect(objects.has(id) || placeables.has(id) || AHEAD.has(id), id).toBe(true);
  });

  it('chaque objet et chaque meuble posable a sa vignette (sauf exceptions justifiées)', () => {
    const drawn = new Set(ids);
    const missing = [...objects, ...placeables].filter(
      (id) => !drawn.has(id) && !WITHOUT_THUMB.has(id),
    );
    expect(missing).toEqual([]);
    for (const [id, why] of WITHOUT_THUMB) {
      expect(why.length, id).toBeGreaterThan(0);
      expect(drawn.has(id), `${id}: dessinée, à retirer des exceptions`).toBe(false);
    }
    expect(objects.size).toBeGreaterThan(0);
    expect(placeables.size).toBeGreaterThan(0);
  });

  it('grille 96, couleurs du nuancier, PNG en 96 et 48 px, sans trait calculé par le moteur', () => {
    for (const id of ids) {
      const svg = readFileSync(path.join(OUT, 'vignettes', `${id}.svg`), 'utf8');
      expect(svg, id).toContain('viewBox="0 0 96 96"');
      for (const c of colorsOf(svg)) expect(colors.has(c), `${id}: ${c}`).toBe(true);
      expect(pngSize(path.join(OUT, 'vignettes', `${id}-96.png`))).toEqual([96, 96]);
      expect(pngSize(path.join(OUT, 'vignettes', `${id}-48.png`))).toEqual([48, 48]);
    }
  });

  it('remplace la pastille à lettres quand elle existe, et seulement alors', () => {
    expect(thumbUrl('hache')).not.toBeNull();
    expect(itemThumb('hache', 'Hache')).toMatch(
      /^<img class="obj obj--plume" src="[^"]+hache\.svg"/,
    );
    // Un objet factice sans dessin garde sa pastille.
    expect(thumbUrl('objet-factice')).toBeNull();
    expect(itemThumb('objet-factice', 'Objet factice')).toContain('>OF</text>');
  });
});

describe('pictos à la plume', () => {
  const ORIGINAL = [
    'soleil',
    'lune',
    'bol',
    'goutte',
    'sac',
    'plume',
    'gens',
    'album',
    'carte',
    'tenue',
    'rouage',
    'lit',
    'cadenas',
    'refus',
    'train',
    'coffre',
    'info',
    'losange',
    'nuage',
    'pluie',
    'brume',
    'neige',
    'orage',
  ];

  it('garde tous les identifiants d’avant (même API), plus la pièce', () => {
    for (const id of [...ORIGINAL, 'piece']) expect(INK_PICTOS[id], id).toBeDefined();
    const sprite = spriteMarkup();
    for (const id of ORIGINAL)
      expect(sprite).toContain(`<symbol id="lpl-i-${id}" viewBox="0 0 24 24">`);
  });

  it('encre en currentColor, sans trait ni couleur fixe', () => {
    for (const [id, body] of Object.entries(INK_PICTOS)) {
      expect(body, id).not.toMatch(/stroke=|#[0-9A-Fa-f]{3,6}/);
      expect(body, id).toContain('fill="currentColor"');
    }
  });
});

describe('portraits à la plume', () => {
  const ids = svgIds(path.join(OUT, 'portraits'));
  const colors = palette();

  it('Firmin, Odette et un joueur, chacun en cinq expressions avec sa bouche', () => {
    for (const id of ['firmin', 'odette', 'joueur']) expect(ids).toContain(id);
    for (const id of ids) {
      const svg = readFileSync(path.join(OUT, 'portraits', `${id}.svg`), 'utf8');
      for (const e of PORTRAIT_MOODS)
        expect(svg, `${id} ${e}`).toContain(`class="expr expr--${e}"`);
      expect(svg.match(/class="bouche"/g)?.length, id).toBe(PORTRAIT_MOODS.length);
      for (const c of colorsOf(svg)) expect(colors.has(c), `${id}: ${c}`).toBe(true);
    }
  });

  it('donne des identifiants propres à chaque portrait affiché, et son expression', () => {
    expect(hasDrawnPortrait('firmin')).toBe(true);
    expect(hasDrawnPortrait('player-1')).toBe(true);
    expect(hasDrawnPortrait('habitant-factice')).toBe(false);
    const a = portraitMarkup('odette');
    const b = portraitMarkup('odette', 'content');
    expect(a).toMatch(/^<svg class="lpl-por" aria-hidden="true"/);
    expect(b).toContain('data-expr="content"');
    expect(a).not.toContain('__P__');
    const prefix = (s: string): string | undefined => /id="(lpl-p\d+-)/.exec(s)?.[1];
    expect(prefix(a)).toBeDefined();
    expect(prefix(a)).not.toBe(prefix(b));
    // Sans dessin: le substitut généré, qui garde sa bouche animée.
    expect(portraitMarkup('habitant-factice')).toContain('class="bouche"');
  });
});
