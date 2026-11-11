// Résultats envoyés à la plateforme, bornés aux limites du pont (ADR 0005, `matchEnd` et
// `sessionEnd`): trois statistiques au plus, libellé de 32 caractères, valeur de 16,
// progression de 0 à 1. Un message hors limites serait écarté par la plateforme et le
// résumé perdu sans bruit: le SDK coupe plutôt que de laisser partir un message refusé.
import type { ResultStat } from '@duo/protocol';

/** Limites du pont 1.0, reprises de `ResultStatSchema` (`@duo/protocol`). */
export const RESULT_LIMITS = { stats: 3, label: 32, value: 16 } as const;

/** Coupe un texte à `max` unités UTF-16 sans laisser de moitié de caractère à la fin. */
function cut(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  const head = trimmed.slice(0, max);
  const last = head.charCodeAt(head.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? head.slice(0, -1) : head;
}

/** Statistiques valides et bornées: lignes sans libellé écartées, trois au plus. */
export function boundStats(stats: readonly ResultStat[] | undefined): ResultStat[] {
  const kept: ResultStat[] = [];
  for (const stat of stats ?? []) {
    if (kept.length === RESULT_LIMITS.stats) break;
    // Données d'un jeu en JavaScript ou mal typées: on revérifie à l'exécution.
    const label: unknown = stat.label;
    const raw: unknown = stat.value;
    if (typeof label !== 'string') continue;
    const shown = cut(label, RESULT_LIMITS.label);
    if (shown === '') continue;
    const value =
      typeof raw === 'string'
        ? raw
        : typeof raw === 'number' && Number.isFinite(raw)
          ? String(raw)
          : '';
    kept.push({ label: shown, value: cut(value, RESULT_LIMITS.value) });
  }
  return kept;
}

/** Progression ramenée entre 0 et 1; `undefined` si elle n'est pas un nombre fini. */
export function boundProgress(progress: number | undefined): number | undefined {
  if (typeof progress !== 'number' || !Number.isFinite(progress)) return undefined;
  return Math.min(1, Math.max(0, progress));
}
