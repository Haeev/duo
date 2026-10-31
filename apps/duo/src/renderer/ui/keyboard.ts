// Clavier de l'interface (UX 0.5, ADR 0012 point 6): Échap ferme la couche du
// dessus; anti-double-appui de 300 ms après un changement d'écran; une touche
// maintenue n'active jamais un bouton; focus par défaut de chaque écran.
import type { RefObject } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

const GUARD_MS = 300;
let guardUntil = 0;
const escapeStack: { current: () => void }[] = [];

/** À appeler quand l'écran change: Entrée et Espace sont ignorés 300 ms. */
export function markScreenChange(): void {
  guardUntil = performance.now() + GUARD_MS;
}

function isActivationKey(event: KeyboardEvent): boolean {
  return event.key === 'Enter' || event.key === ' ';
}

export function installKeyboardGuards(): void {
  window.addEventListener(
    'keydown',
    (event) => {
      if (isActivationKey(event) && (event.repeat || performance.now() < guardUntil)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key === 'Escape' && !event.repeat) {
        const top = escapeStack.at(-1);
        if (top !== undefined) {
          event.preventDefault();
          top.current();
        }
      }
    },
    true,
  );
  window.addEventListener(
    'keyup',
    (event) => {
      // Espace active un bouton au relâchement: même garde.
      if (event.key === ' ' && performance.now() < guardUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true,
  );
}

/** Échap pour cette couche, tant qu'elle est affichée (la dernière montée l'emporte). */
export function useEscape(handler: (() => void) | null): void {
  const ref = useRef<() => void>(() => undefined);
  ref.current = handler ?? (() => undefined);
  const enabled = handler !== null;
  useEffect(() => {
    if (!enabled) return undefined;
    const entry = { current: () => ref.current() };
    escapeStack.push(entry);
    return () => {
      const index = escapeStack.indexOf(entry);
      if (index !== -1) escapeStack.splice(index, 1);
    };
  }, [enabled]);
}

/** Focus par défaut d'un écran ou d'une fenêtre, et garde contre le double appui. */
export function useInitialFocus<T extends HTMLElement>(key: unknown = null): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    markScreenChange();
    ref.current?.focus();
  }, [key]);
  return ref;
}

/** Garde le focus dans une fenêtre de confirmation (Tab boucle) et le rend à la fermeture. */
export function useFocusTrap(container: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Tab' || container.current === null) return;
      const focusable = Array.from(
        container.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])'),
      );
      const first = focusable.at(0);
      const last = focusable.at(-1);
      if (first === undefined || last === undefined) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (previous?.isConnected === true) previous.focus();
    };
  }, [container]);
}

/** Disposition réelle du clavier, pour les libellés des touches (AZERTY). */
export async function readKeyboardLayout(): Promise<ReadonlyMap<string, string> | null> {
  const keyboard = (navigator as Navigator & {
    keyboard?: { getLayoutMap?: () => Promise<ReadonlyMap<string, string>> };
  }).keyboard;
  if (keyboard?.getLayoutMap === undefined) return null;
  try {
    return await keyboard.getLayoutMap();
  } catch {
    return null;
  }
}
