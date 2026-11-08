/**
 * Panneaux du jeu (tablette, ardoise, bilan, écrans de début): point d'extension du chantier
 * « interface ». Un panneau ouvert a le curseur (C20): le jeu rend le pointeur à l'ouverture et
 * le reprend à la fermeture, sans geste. Fermeture par sa touche, Retour arrière ou un clic,
 * jamais par Échap (C19: Échap reste la pause de Duo).
 */
import type { GameView } from '../reseau/vue';

export interface Panel {
  readonly id: string;
  /** Construit le contenu dans `root` (appelé à chaque ouverture). */
  open(root: HTMLElement, view: GameView): void;
  /** Mise à jour à chaque image tant que le panneau est ouvert (facultatif). */
  update?(view: GameView): void;
  close?(): void;
}

export interface Panels {
  register(panel: Panel): void;
  toggle(id: string): void;
  close(): void;
  current(): string | null;
  update(): void;
  dispose(): void;
}

const CSS = `
.dt-old-panel { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); min-width: 320px; max-width: 80vw; max-height: 80vh; overflow: auto; padding: 20px 24px; border-radius: 14px; background: #f6efe3; color: #2b2420; font-family: system-ui, sans-serif; box-shadow: 0 8px 30px rgba(0,0,0,0.35); }
.dt-old-panel h2 { margin: 0 0 8px; font-size: 20px; }
.dt-old-panel .dt-close { margin-top: 14px; }
`;

export function createPanels(
  host: HTMLElement,
  view: GameView,
  onCursor: (open: boolean) => void,
): Panels {
  const registry = new Map<string, Panel>();
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  let open: { panel: Panel; root: HTMLElement } | null = null;

  const close = (): void => {
    if (open === null) return;
    open.panel.close?.();
    open.root.remove();
    open = null;
    onCursor(false);
  };

  return {
    register(panel) {
      registry.set(panel.id, panel);
    },
    toggle(id) {
      if (open?.panel.id === id) {
        close();
        return;
      }
      close();
      const panel = registry.get(id);
      if (panel === undefined) return;
      const root = document.createElement('div');
      root.className = 'dt-old-panel';
      root.dataset.panel = id;
      host.append(root);
      panel.open(root, view);
      const button = document.createElement('button');
      button.className = 'dt-close';
      button.textContent = 'Fermer (Retour arrière)';
      button.addEventListener('click', close);
      root.append(button);
      open = { panel, root };
      onCursor(true);
    },
    close,
    current: () => open?.panel.id ?? null,
    update() {
      open?.panel.update?.(view);
    },
    dispose() {
      close();
      style.remove();
    },
  };
}

