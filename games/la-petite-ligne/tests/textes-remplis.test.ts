/**
 * Retour S06 (2026-11-02): « hencolor2 » dans les répliques d'Odette. Toute réplique et toute lettre,
 * une fois ses paramètres remplacés comme en jeu, ne garde ni accolade ni identifiant brut.
 */
import { describe, expect, it } from 'vitest';
import { format } from '../src/simulation/contexte';
import { textVars } from '../src/simulation/courrier';
import { dialogueVars } from '../src/simulation/dialogues';
import { spawnHens } from '../src/simulation/poules';
import { newSim } from './aides';

/**
 * Toutes les chaînes `text` et `title` d'une définition (répliques, choix, réponses, accords, variantes).
 * L'effet `show_text` porte une clé de `textes.json`, pas un texte: écarté.
 */
function texts(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) for (const n of node) texts(n, out);
  else if (typeof node === 'object' && node !== null) {
    if ((node as { type?: unknown }).type === 'show_text') return out;
    for (const [k, v] of Object.entries(node)) {
      if ((k === 'text' || k === 'title') && typeof v === 'string') out.push(v);
      else texts(v, out);
    }
  }
  return out;
}

// Accolade restante, identifiant de code (`hen_white`, `henColor2`) ou sa forme mise en minuscules.
const RAW = /[{}]|\b[a-z]+_[a-z0-9_]+\b|\b[a-z]+[A-Z][A-Za-z]*\d*\b|\bhencolor\d/;

describe('paramètres des textes (S06)', () => {
  const sim = newSim();
  // Les poules telles que la quête `hens` les fait arriver (les répliques qui les citent viennent après).
  spawnHens(sim, 'hen', 3, ['Bichette', 'Cocotte', 'la Duchesse'], 'chicken_coop', 'hen_names');

  it('les répliques des habitants sont remplies', () => {
    const bad: string[] = [];
    for (const def of Object.values(sim.content.dialogues)) {
      for (const who of ['p1', 'p2'] as const) {
        for (const t of texts(def)) {
          const filled = format(t, dialogueVars(sim, who));
          if (RAW.test(filled)) bad.push(`${def.id}: ${filled}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('les poules d\'Odette sont nommées par leur couleur', () => {
    const intro = Object.values(sim.content.dialogues).flatMap((d) => texts(d)).find((t) => t.includes('{henColor2}'));
    expect(intro).toBeDefined();
    const filled = format(intro ?? '', dialogueVars(sim, 'p1'));
    expect(filled).toMatch(/Cocotte, c'est la (blanche|rousse|noire)/);
  });

  it('les lettres sont remplies', () => {
    const vars = { ...textVars(sim), greeting: 'Bonjour', tip: 'Sème tôt.' };
    const bad: string[] = [];
    for (const def of Object.values(sim.content.letters)) {
      for (const t of texts(def)) {
        const filled = format(t, vars);
        if (RAW.test(filled)) bad.push(`${def.id}: ${filled}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
