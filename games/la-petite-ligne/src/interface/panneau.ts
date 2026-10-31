/**
 * Base des panneaux du jeu (carnet, caisse, catalogue, comptoir, établi,
 * réchaud, coffre): en-tête en bois, corps qui défile, pied avec les
 * touches. Le jeu continue derrière (PA-02).
 */
import type { ReadonlyWorld } from '../etat/types';
import type { KeyInfo, Layer, UiHost } from './composant';
import { button, clear, el, focusElement, focusables, icon, keycap, setText } from './dom';
import { SOUND_ATTR } from './sons';

export interface PanelOptions {
  icon: string;
  title: string;
  subtitle?: string;
  narrow?: boolean;
  width?: string;
  /** Libellé de la touche de fermeture affichée (Retour arrière, ou Tab pour le carnet). */
  closeKeyLabel: string;
  closeAria: string;
}

export abstract class Panel implements Layer {
  readonly root: HTMLElement;
  readonly closable = true;
  readonly letterNavigation = true;
  readonly closeKey?: string;
  protected readonly host: UiHost;
  protected readonly header: HTMLElement;
  protected readonly titleBlock: HTMLDivElement;
  protected readonly titleEl: HTMLHeadingElement;
  protected readonly subtitleEl: HTMLParagraphElement;
  protected readonly body: HTMLDivElement;
  protected readonly footer: HTMLElement;
  protected readonly closeButton: HTMLButtonElement;
  private bodySig = '';

  constructor(host: UiHost, options: PanelOptions, closeKey?: string) {
    this.host = host;
    if (closeKey !== undefined) this.closeKey = closeKey;
    const titleId = `panneau-${Math.round(host.now() * 1000)}`;
    this.titleEl = el('h2', { class: 'lpl-panel__title', id: titleId, text: options.title });
    this.subtitleEl = el('p', { class: 'lpl-panel__subtitle', text: options.subtitle ?? '', hidden: options.subtitle === undefined });
    this.titleBlock = el('div', {}, [this.titleEl, this.subtitleEl]);
    this.closeButton = button([host.ctx.texts.extra.common.close, ' ', keycap(options.closeKeyLabel)], () => {
      this.close();
    }, { class: 'lpl-button lpl-button--on-dark lpl-panel__close', attrs: { 'aria-label': options.closeAria, [SOUND_ATTR]: 'none' } });
    this.header = el('header', { class: 'lpl-panel__header' }, [icon(options.icon), this.titleBlock, this.closeButton]);
    this.body = el('div', { class: 'lpl-panel__body' });
    this.footer = el('footer', { class: 'lpl-panel__footer' });
    const style = options.width === undefined ? null : `--lpl-panel-width: ${options.width}`;
    this.root = el('section', { class: `lpl-panel${options.narrow === true ? ' lpl-panel--narrow' : ''}`, style, 'aria-labelledby': titleId }, [
      this.header,
      this.body,
      this.footer,
    ]);
  }

  close(): void {
    this.host.setMenu(null);
  }

  protected setSubtitle(text: string): void {
    setText(this.subtitleEl, text);
    this.subtitleEl.toggleAttribute('hidden', text === '');
  }

  /**
   * Reconstruit le corps quand sa signature change, en gardant le focus sur
   * l'élément de même `data-key` (ou sur l'élément par défaut).
   */
  protected renderBody(sig: string, build: () => readonly (Node | null)[]): void {
    if (sig === this.bodySig) return;
    this.bodySig = sig;
    const active = document.activeElement;
    const inside = active instanceof HTMLElement && this.body.contains(active);
    const key = inside ? (active.dataset.key ?? null) : null;
    clear(this.body);
    for (const node of build()) if (node !== null) this.body.append(node);
    if (!inside) return;
    const same = key === null ? null : this.body.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`);
    if (!focusElement(same)) focusElement(this.defaultFocus());
  }

  protected setFooter(nodes: readonly (Node | string | null)[]): void {
    clear(this.footer);
    for (const n of nodes) if (n !== null) this.footer.append(n);
  }

  abstract update(world: ReadonlyWorld): void;

  defaultFocus(): HTMLElement | null {
    const marked = this.body.querySelector<HTMLElement>('[data-autofocus]');
    if (marked !== null && focusables(this.root).includes(marked)) return marked;
    return focusables(this.body)[0] ?? this.closeButton;
  }

  key?(code: string, info: KeyInfo): boolean;
}
