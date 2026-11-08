/**
 * Interfaces posées et écrans de choix (ux 4.1, 4.2): une pile de calques par-dessus la vue.
 *
 * - Ouvrir un calque rend le curseur (`onCursor(true)`), fermer le dernier le reprend sans geste
 *   (C20). Fondu de 150 ms, aucun avec « Réduire les animations ».
 * - Clavier, comme La Petite Ligne: flèches ou Z Q S D (positions) pour l'élément voisin
 *   (navigation spatiale), A et E (positions `KeyQ`, `KeyE`) pour la section ou la page, Entrée
 *   ou Espace pour activer, Tab et Maj+Tab pour boucler (Tab range le téléphone, sa touche),
 *   Retour arrière pour fermer la fenêtre du dessus. Échap n'est jamais lu ici (C19).
 * - Anti-double-appui: Entrée, Espace et E ignorés 300 ms après l'ouverture; une touche
 *   maintenue n'active jamais deux fois.
 * - Le SDK capte les touches du jeu avant la page et empêche leur effet par défaut, sauf dans un
 *   champ de saisie: toute l'activation passe donc par ce gestionnaire.
 * - Un calque se reconstruit quand son contenu change; le focus est retrouvé par sa clé.
 */
import { fr } from './typo';

export interface LayerSpec {
  readonly id: string;
  /** Écran de choix (matin, nuit, première fois): plein écran, pas de fermeture par clic à côté. */
  readonly modal?: boolean;
  readonly narrow?: boolean;
  /**
   * Téléphone tenu en main (ux-telephone 10.1): la vue s'assombrit sous le HUD, le téléphone
   * passe au-dessus; un clic à côté le range d'un coup, Maj+Tab ne fait rien.
   */
  readonly phone?: boolean;
  /** Nom accessible du calque quand il n'a pas de titre `h2` (« Ton téléphone »). */
  readonly label?: string;
  /** Touche (code) qui ferme ce calque, en plus de Retour arrière (« Tab » pour le téléphone). */
  readonly closeKey?: string;
  /** Construit le contenu dans `root` (appelé à l'ouverture et à chaque `refresh`). */
  render(root: HTMLElement, layer: LayerHandle): void;
  /** Retour arrière ou clic à côté: `true` si le calque l'a traité lui-même. */
  back?(): boolean;
  /** A et E. */
  section?(delta: -1 | 1): void;
  /** Origine (`Home`): raccourci de confort vers l'accueil du téléphone. */
  home?(): void;
  /** Flèches gauche et droite tournent aussi les pages (bilan). */
  readonly arrowPages?: boolean;
  /** Focus par défaut, cherché après chaque rendu d'ouverture. */
  defaultFocus?(root: HTMLElement): HTMLElement | null;
  onClose?(): void;
}

export interface LayerHandle {
  readonly id: string;
  /** Reconstruit le contenu en gardant le focus. */
  refresh(): void;
  close(): void;
}

export interface Layers {
  open(spec: LayerSpec): LayerHandle;
  close(id?: string): void;
  isOpen(id: string): boolean;
  top(): string | null;
  /** Un calque a le curseur. */
  any(): boolean;
  refresh(id?: string): void;
  dispose(): void;
}

interface Entry {
  spec: LayerSpec;
  backdrop: HTMLElement;
  root: HTMLElement;
  handle: LayerHandle;
  openedAt: number;
  opener: Element | null;
}

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex="0"]';
const ACTIVATION_GUARD_MS = 300;
/** Durée du rangement du téléphone (ux-telephone 2.1). */
const PHONE_OUT_MS = 150;

const DIRECTIONS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  KeyW: [0, -1],
  KeyS: [0, 1],
  KeyA: [-1, 0],
  KeyD: [1, 0],
};

function isTyping(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  return (
    (el instanceof HTMLInputElement && el.type !== 'range' && el.type !== 'checkbox') ||
    el instanceof HTMLTextAreaElement
  );
}

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.getClientRects().length > 0,
  );
}

/** Donne le focus; dans un champ de texte, le curseur va à la fin (ux 1.4). */
export function focusElement(el: HTMLElement): void {
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'nearest' });
  if (isTyping(el)) el.setSelectionRange(el.value.length, el.value.length);
}

/** Clé stable d'un élément focalisable (balise, nom, rang parmi ses semblables). */
function keyOf(el: Element, root: HTMLElement): string {
  const label = el.getAttribute('data-key') ?? el.getAttribute('aria-label') ?? el.textContent;
  const base = `${el.tagName}|${label}`;
  const same = [...root.querySelectorAll(FOCUSABLE)].filter(
    (o) =>
      `${o.tagName}|${o.getAttribute('data-key') ?? o.getAttribute('aria-label') ?? o.textContent}` ===
      base,
  );
  return `${base}|${String(same.indexOf(el))}`;
}

/** Élément le plus proche dans une direction (axe principal, plus deux fois l'écart latéral). */
function spatialNext(
  from: HTMLElement | null,
  candidates: readonly HTMLElement[],
  dir: readonly [number, number],
): HTMLElement | null {
  if (from === null) return candidates[0] ?? null;
  const a = from.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const c of candidates) {
    if (c === from) continue;
    const b = c.getBoundingClientRect();
    const dx = b.left + b.width / 2 - ax;
    const dy = b.top + b.height / 2 - ay;
    const main = dx * dir[0] + dy * dir[1];
    if (main <= 1) continue;
    const side = Math.abs(dir[0] === 0 ? dx : dy);
    const score = main + side * 2;
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

export function createLayers(
  host: HTMLElement,
  options: { onCursor: (open: boolean) => void; reducedMotion: () => boolean },
): Layers {
  const stack: Entry[] = [];
  const held = new Set<string>();

  const topEntry = (): Entry | undefined => stack[stack.length - 1];

  const focusDefault = (entry: Entry): void => {
    const target = entry.spec.defaultFocus?.(entry.root) ?? focusables(entry.root)[0] ?? null;
    if (target !== null) focusElement(target);
  };

  const render = (entry: Entry): void => {
    const active = document.activeElement;
    const hadFocus = active !== null && entry.root.contains(active);
    const key = hadFocus ? keyOf(active, entry.root) : null;
    const scrolls = [...entry.root.querySelectorAll<HTMLElement>('[data-scroll]')].map(
      (el) => [el.dataset.scroll ?? '', el.scrollTop] as const,
    );
    // Un champ en cours de saisie survit au nouveau rendu (curseur et lettres gardés).
    const kept =
      isTyping(active) && entry.root.contains(active) && active.dataset.keep !== undefined
        ? active
        : null;
    entry.root.replaceChildren();
    entry.spec.render(entry.root, entry.handle);
    if (kept !== null) {
      const fresh = entry.root.querySelector<HTMLElement>(
        `[data-keep="${kept.dataset.keep ?? ''}"]`,
      );
      if (fresh !== null) {
        fresh.replaceWith(kept);
        kept.focus({ preventScroll: true });
        return;
      }
    }
    for (const [id, top] of scrolls) {
      const el = entry.root.querySelector<HTMLElement>(`[data-scroll="${id}"]`);
      if (el !== null) el.scrollTop = top;
    }
    if (key === null) return;
    const again = [...entry.root.querySelectorAll<HTMLElement>(FOCUSABLE)].find(
      (el) => keyOf(el, entry.root) === key,
    );
    if (again !== undefined) again.focus({ preventScroll: true });
    else focusDefault(entry);
  };

  const remove = (entry: Entry): void => {
    const index = stack.indexOf(entry);
    if (index < 0) return;
    stack.splice(index, 1);
    if (entry.spec.phone === true && !options.reducedMotion()) {
      // Le téléphone redescend (150 ms) avant de quitter la page; il ne reçoit plus rien.
      entry.root.classList.add('out');
      entry.backdrop.classList.add('out');
      setTimeout(() => {
        entry.root.remove();
        entry.backdrop.remove();
      }, PHONE_OUT_MS);
    } else {
      entry.backdrop.remove();
      entry.root.remove();
    }
    entry.spec.onClose?.();
    const next = topEntry();
    if (next === undefined) {
      options.onCursor(false);
      return;
    }
    // Le focus revient sur ce qui a ouvert la fenêtre (ux 4.2).
    if (entry.opener instanceof HTMLElement && next.root.contains(entry.opener))
      entry.opener.focus({ preventScroll: true });
    else focusDefault(next);
  };

  const back = (entry: Entry): void => {
    if (entry.spec.back?.() === true) return;
    remove(entry);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const entry = topEntry();
    if (entry === undefined || event.code === 'Escape') return;
    const active = document.activeElement;
    const typing = isTyping(active);
    const now = performance.now();
    const guarded = now - entry.openedAt < ACTIVATION_GUARD_MS;
    const repeat = event.repeat || held.has(event.code);
    held.add(event.code);

    if (event.code === 'Backspace') {
      if (typing) return;
      event.preventDefault();
      if (!repeat) back(entry);
      return;
    }
    if (event.code === 'Tab') {
      event.preventDefault();
      if (repeat && entry.spec.closeKey === 'Tab') return;
      // Maj+Tab ne range pas le téléphone (évite de le ranger par erreur).
      if (entry.spec.phone === true && event.shiftKey) return;
      if (entry.spec.closeKey === 'Tab') {
        remove(entry);
        return;
      }
      const list = focusables(entry.root);
      if (list.length === 0) return;
      const i = active instanceof HTMLElement ? list.indexOf(active) : -1;
      const next = list[(i + (event.shiftKey ? -1 : 1) + list.length) % list.length];
      next?.focus();
      next?.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (entry.spec.closeKey !== undefined && event.code === entry.spec.closeKey && !typing) {
      event.preventDefault();
      if (!repeat) remove(entry);
      return;
    }
    if (event.code === 'Enter' || event.code === 'NumpadEnter' || event.code === 'Space') {
      if (typing && event.code === 'Space') return;
      event.preventDefault();
      if (guarded || repeat) return;
      if (typing) {
        // Entrée valide le champ: il garde sa valeur, le focus passe au voisin du dessous.
        active.dispatchEvent(new Event('change', { bubbles: true }));
        spatialNext(active, focusables(entry.root), [0, 1])?.focus();
        return;
      }
      if (active instanceof HTMLElement && entry.root.contains(active)) active.click();
      return;
    }
    if (event.code === 'Home' && entry.spec.home !== undefined && !typing) {
      event.preventDefault();
      if (!repeat) entry.spec.home();
      return;
    }
    if ((event.code === 'KeyQ' || event.code === 'KeyE') && !typing) {
      event.preventDefault();
      if (repeat || (guarded && event.code === 'KeyE')) return;
      entry.spec.section?.(event.code === 'KeyQ' ? -1 : 1);
      return;
    }
    if (
      entry.spec.arrowPages === true &&
      !typing &&
      (event.code === 'ArrowLeft' || event.code === 'ArrowRight')
    ) {
      event.preventDefault();
      if (!repeat) entry.spec.section?.(event.code === 'ArrowLeft' ? -1 : 1);
      return;
    }
    const dir = DIRECTIONS[event.code];
    if (dir !== undefined) {
      if (typing && (dir[1] === 0 || event.code.startsWith('Key'))) return;
      event.preventDefault();
      const from = active instanceof HTMLElement && entry.root.contains(active) ? active : null;
      // Curseur de réglage: gauche et droite changent la valeur (ux 4.2).
      if (from instanceof HTMLInputElement && from.type === 'range' && dir[1] === 0) {
        if (dir[0] > 0) from.stepUp();
        else from.stepDown();
        from.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
      const next = spatialNext(from, focusables(entry.root), dir);
      next?.focus({ preventScroll: true });
      next?.scrollIntoView({ block: 'nearest' });
    }
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    held.delete(event.code);
  };
  const onBlur = (): void => {
    held.clear();
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  const layers: Layers = {
    open(spec) {
      const existing = stack.find((e) => e.spec.id === spec.id);
      if (existing !== undefined) {
        render(existing);
        return existing.handle;
      }
      const phone = spec.phone === true;
      const moving = !options.reducedMotion();
      const backdrop = document.createElement('div');
      backdrop.className = phone
        ? `dt-phone-dim${moving ? ' in' : ''}`
        : `${spec.modal === true ? 'dt-screen' : 'dt-backdrop'}${moving ? ' fade' : ''}`;
      backdrop.dataset.layer = spec.id;
      const root = document.createElement('div');
      root.className = phone
        ? `dt-tel${moving ? ' in' : ''}`
        : `dt-panel${spec.narrow === true ? ' narrow' : ''}`;
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-modal', phone ? 'false' : 'true');
      if (spec.label !== undefined) root.setAttribute('aria-label', spec.label);
      if (phone) root.dataset.layer = spec.id;
      else backdrop.append(root);
      backdrop.addEventListener('pointerdown', (event) => {
        // Clic à côté: fermer (pas pour un écran de choix); le téléphone se range d'un coup.
        if (event.target !== backdrop || spec.modal === true) return;
        const entry = stack.find((e) => e.spec.id === spec.id);
        if (entry === undefined || entry !== topEntry()) return;
        if (phone) remove(entry);
        else back(entry);
      });
      const entry: Entry = {
        spec,
        backdrop,
        root,
        openedAt: performance.now(),
        opener: document.activeElement,
        handle: {
          id: spec.id,
          refresh: () => {
            render(entry);
          },
          close: () => {
            remove(entry);
          },
        },
      };
      const wasEmpty = stack.length === 0;
      // Le dernier ouvert passe au-dessus, écran de choix compris (lettre lue depuis le matin).
      // Le téléphone reste sous les fenêtres qu'il ouvre (proposition, ardoise).
      if (!phone) backdrop.style.zIndex = String(30 + stack.length);
      stack.push(entry);
      host.append(backdrop);
      if (phone) host.append(root);
      spec.render(root, entry.handle);
      const title = root.querySelector('h2');
      if (title !== null) {
        title.id = `dt-title-${spec.id}`;
        root.setAttribute('aria-labelledby', title.id);
      }
      if (wasEmpty) options.onCursor(true);
      focusDefault(entry);
      return entry.handle;
    },
    close(id) {
      const entry = id === undefined ? topEntry() : stack.find((e) => e.spec.id === id);
      if (entry !== undefined) remove(entry);
    },
    isOpen: (id) => stack.some((e) => e.spec.id === id),
    top: () => topEntry()?.spec.id ?? null,
    any: () => stack.length > 0,
    refresh(id) {
      for (const e of stack) if (id === undefined || e.spec.id === id) render(e);
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      for (const e of [...stack]) {
        e.backdrop.remove();
        e.root.remove();
      }
      stack.length = 0;
    },
  };
  return layers;
}

/** Pied de calque: les touches et leur effet (« A E sections · ... »). */
export function footer(
  parts: readonly (readonly [readonly string[], string])[],
  tail?: string,
): HTMLElement {
  const foot = document.createElement('footer');
  foot.className = 'dt-panel-foot';
  for (const [keys, text] of parts) {
    const span = document.createElement('span');
    keys.forEach((k, i) => {
      if (k === 'ou') {
        span.append(` ${fr('ou')} `);
        return;
      }
      const kbd = document.createElement('kbd');
      kbd.className = 'dt-kbd';
      kbd.textContent = fr(k);
      span.append(kbd);
      if (i === keys.length - 1) span.append(' ');
    });
    span.append(fr(text));
    foot.append(span);
  }
  if (tail !== undefined) {
    const span = document.createElement('span');
    span.textContent = fr(tail);
    foot.append(span);
  }
  return foot;
}
