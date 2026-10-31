// Empreinte d'un état de simulation (ADR 0005, point 5): sert aux tests et aux contrôles de désynchronisation.
import { fnv1a32 } from './random';

function stableStringify(value: unknown, out: string[]): void {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      out.push(String(value));
      return;
    }
    // JSON.stringify renvoie undefined pour undefined, une fonction ou un symbole.
    const text = JSON.stringify(value) as string | undefined;
    out.push(text ?? 'null');
    return;
  }
  if (Array.isArray(value)) {
    out.push('[');
    value.forEach((item: unknown, index) => {
      if (index > 0) out.push(',');
      stableStringify(item, out);
    });
    out.push(']');
    return;
  }
  if (value instanceof Map) {
    stableStringify([...value.entries()], out);
    return;
  }
  if (value instanceof Set) {
    stableStringify([...value.values()], out);
    return;
  }
  const keys = Object.keys(value).sort();
  out.push('{');
  let first = true;
  for (const key of keys) {
    const item: unknown = (value as Record<string, unknown>)[key];
    if (item === undefined) continue;
    if (!first) out.push(',');
    first = false;
    out.push(JSON.stringify(key), ':');
    stableStringify(item, out);
  }
  out.push('}');
}

/**
 * Empreinte (8 chiffres hexadécimaux) d'une valeur JSON, indépendante de l'ordre des clés.
 * `Map` et `Set` sont parcourus dans l'ordre d'insertion. À appeler dans les tests ou tous les
 * 30 pas au plus: elle parcourt tout l'état.
 */
export function hashState(value: unknown): string {
  const out: string[] = [];
  stableStringify(value, out);
  return fnv1a32(out.join('')).toString(16).padStart(8, '0');
}
