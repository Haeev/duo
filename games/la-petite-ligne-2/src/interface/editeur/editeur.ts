/**
 * Écran de l'éditeur de personnage (interface 5.8). À gauche le personnage en pied, en 3D (aperçu
 * fourni par le rendu), à droite les rayons en signets à images et leurs cases (vignettes des
 * pièces, pastilles de couleur), en bas le prénom, « Au hasard » et la validation. Tout au clavier
 * (A et E rayons, flèches, Espace ou Entrée, Q et D tournent, R au hasard), la souris en plus.
 * La validation envoie `set_look` (apparence, genre, prénom): l'autre joueur voit le résultat.
 */
import type { Gender, Look } from '../../donnees/schemas/personnage';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { ReadonlyWorld } from '../../etat/monde';
import type { Intent } from '../../simulation/noyau/entrees';
import { el, setText, show, toggle } from '../dom';
import {
  type CharacterData,
  choose,
  cleanName,
  editorCategories,
  type EditorDraft,
  genderOfShape,
  isSelected,
  moveFocus,
  randomDraft,
  type Row,
  rowsFor,
  shapeFor,
  type Tile,
  wornAt,
} from './modele';
import { EDITOR_SETTINGS, type EditorCategory } from './reglages';
import { EDITOR_TEXTS as T, fillText } from './textes';
import './editeur.css';

/** Ce que l'éditeur demande au rendu (`rendu/personnages/apercu.ts`). */
export interface EditorPreview {
  setLook(look: Look, react: boolean): void;
  turn(radians: number): void;
  face(yaw: number): void;
  frame(dt: number): void;
  resize(width: number, height: number): void;
  thumbnail(look: Look, mode: 'piece' | 'figure'): string;
  dispose(): void;
}
export type EditorPreviewFactory = (canvas: HTMLCanvasElement) => Promise<EditorPreview>;

export type EditorMode = 'create' | 'mirror';

export interface EditorDeps {
  readonly data: CharacterData;
  readonly send: (intent: Intent) => void;
  readonly keyLabel: (code: string) => string;
  readonly reduced: () => boolean;
  /** Aperçu 3D; absent (tests, repli), l'éditeur reste utilisable sans le personnage. */
  readonly preview?: EditorPreviewFactory;
  /** Look de départ d'un joueur selon le genre (celui que le jeu montre avant l'éditeur). */
  readonly starter: (player: PlayerIndex, gender: Gender) => Look;
  /** Genre par défaut d'un joueur qui n'a pas encore choisi. */
  readonly defaultGender: (player: PlayerIndex) => Gender;
}

export interface CharacterEditor {
  open(mode: EditorMode, world: ReadonlyWorld, me: PlayerIndex): void;
  isOpen(): boolean;
  /** Une touche (code); `true` si l'éditeur l'a prise. */
  key(event: KeyboardEvent): boolean;
  frame(dt: number, world: ReadonlyWorld, me: PlayerIndex): void;
  /** Brouillon courant (démonstration, tests). */
  draft(): EditorDraft | null;
  dispose(): void;
}

interface Focus {
  row: number;
  col: number;
}
const BAR = ['name', 'random', 'done'] as const;
type BarItem = (typeof BAR)[number];

export function createCharacterEditor(layer: HTMLElement, deps: EditorDeps): CharacterEditor {
  const S = EDITOR_SETTINGS;
  const { data } = deps;
  const categories = editorCategories(data.catalogue, S);

  const canvas = el('canvas', { class: 'lpl-ed__canvas', 'aria-hidden': 'true' });
  const loading = el('p', { class: 'lpl-ed__loading', text: T.loading });
  const turnHint = el('p', { class: 'lpl-ed__hint' });
  const stage = el('div', { class: 'lpl-ed__stage' }, [canvas, loading, turnHint]);
  const title = el('h2', { class: 'lpl-ed__title' });
  const tabs = el('div', { class: 'lpl-ed__tabs', role: 'tablist' });
  const grid = el('div', { class: 'lpl-ed__grid' });
  const nameInput = el('input', {
    class: 'lpl-ed__name',
    type: 'text',
    maxlength: S.nameMax,
    placeholder: T.namePlaceholder,
    'aria-label': T.name,
    spellcheck: 'false',
  });
  const nameError = el('p', { class: 'lpl-ed__error', role: 'alert' });
  const randomButton = el('button', { class: 'lpl-ed__button', type: 'button' }, [
    el('span', { class: 'lpl-ed__die', 'aria-hidden': 'true', text: '⚄' }),
    el('span', { text: T.random }),
  ]);
  const doneButton = el('button', {
    class: 'lpl-ed__button lpl-ed__button--primary',
    type: 'button',
  });
  const bar = el('div', { class: 'lpl-ed__bar' }, [
    el('label', { class: 'lpl-ed__field' }, [el('span', { text: T.name }), nameInput, nameError]),
    randomButton,
    doneButton,
  ]);
  const keys = el('p', { class: 'lpl-ed__keys' });
  const otherChip = el('div', { class: 'lpl-ed__other' });
  const panel = el('div', { class: 'lpl-ed__panel' }, [title, tabs, grid, bar, keys]);
  const root = el('section', { class: 'lpl-ed', 'aria-label': T.title }, [stage, panel, otherChip]);
  root.hidden = true;
  layer.append(root);

  let mode: EditorMode = 'create';
  let open = false;
  let draft: EditorDraft | null = null;
  let player: PlayerIndex = 0;
  let touched = false;
  let category = 0;
  let focus: Focus = { row: 0, col: 0 };
  let rows: Row[] = [];
  let preview: EditorPreview | null = null;
  let previewPending = false;
  let popTile: string | null = null;
  let randomCount = 0;
  let dragX: number | null = null;
  const thumbs = new Map<string, string>();

  function current(): EditorCategory | undefined {
    return categories[category];
  }

  /** Rangées affichées: celles du rayon, plus la barre du bas (prénom, au hasard, valider). */
  function navRows(): { tiles: readonly unknown[] }[] {
    return [...rows, { tiles: BAR }];
  }

  function thumb(look: Look, modeOf: 'piece' | 'figure'): string | null {
    if (preview === null) return null;
    const key = `${modeOf}|${JSON.stringify(look)}`;
    let url = thumbs.get(key);
    if (url === undefined) {
      url = preview.thumbnail(look, modeOf);
      thumbs.set(key, url);
    }
    return url;
  }

  function pieceLook(slot: Look['pieces'][number]['slot'], id: string): Look | null {
    if (draft === null) return null;
    const def = data.catalogue.pieces.find((p) => p.id === id);
    if (def === undefined) return null;
    const worn = wornAt(draft.look, slot);
    const defaults = data.morphologies.defaults[id] ?? [];
    const colors = def.zones.map((_, i) =>
      worn?.id === id ? (worn.colors[i] ?? defaults[i] ?? 0) : (defaults[i] ?? 0),
    );
    return { shape: draft.look.shape, skin: draft.look.skin, pieces: [{ slot, id, colors }] };
  }

  /** Silhouette seule (corps en sous-vêtement, bible 2.2): vignettes qui ne changent qu'avec la peau. */
  function bodyLook(shape: string): Look {
    return { shape, skin: draft?.look.skin ?? 0, pieces: [] };
  }

  function tileKey(tile: Tile): string {
    return JSON.stringify(tile);
  }

  function tileLabel(tile: Tile): string {
    switch (tile.kind) {
      case 'gender':
        return T.genders[tile.gender];
      case 'shape': {
        const shape = data.catalogue.shapes.find((s) => s.id === tile.shape);
        const g = genderOfShape(tile.shape, data.morphologies, S);
        return `${T.builds[shape?.build ?? ''] ?? tile.shape}${g === null ? '' : ` (${T.genders[g]})`}`;
      }
      case 'height':
        return fillText(T.heightValue, { n: (tile.cm / 100).toFixed(2).replace('.', ',') });
      case 'skin':
        return colorName(data.catalogue.skins[tile.index] ?? '');
      case 'piece': {
        if (tile.id === null) return T.none;
        const list = data.catalogue.pieces.filter((p) => p.slot === tile.slot);
        const n = list.findIndex((p) => p.id === tile.id) + 1;
        return fillText(T.pieceName, { slot: T.slots[tile.slot] ?? tile.slot, n: String(n) });
      }
      case 'color':
        return colorName(tile.hex);
    }
  }

  function colorName(hex: string): string {
    return T.colors[hex] ?? hex;
  }

  function tileImage(tile: Tile): Node | null {
    if (draft === null) return null;
    let url: string | null = null;
    if (tile.kind === 'piece' && tile.id !== null) {
      const look = pieceLook(tile.slot, tile.id);
      url = look === null ? null : thumb(look, 'piece');
    } else if (tile.kind === 'shape') {
      url = thumb(bodyLook(tile.shape), 'figure');
    } else if (tile.kind === 'gender') {
      const build = data.catalogue.shapes.find((s) => s.id === draft?.look.shape)?.build ?? null;
      const shape = shapeFor(tile.gender, build, data, S);
      url = shape === null ? null : thumb(bodyLook(shape), 'figure');
    }
    if (url !== null) return el('img', { src: url, alt: '', draggable: 'false' });
    if (tile.kind === 'height') {
      const ratio = (tile.cm - 140) / 50;
      return el('span', { class: 'lpl-ed__ruler', style: `--h:${ratio.toFixed(2)}` });
    }
    if (tile.kind === 'piece' && tile.id === null)
      return el('span', { class: 'lpl-ed__none', text: '∅' });
    return el('span', { class: 'lpl-ed__initial', text: tileLabel(tile).slice(0, 1) });
  }

  function categoryImage(cat: EditorCategory): Node {
    if (draft !== null && preview !== null) {
      const first = cat.sections[0];
      if (first?.kind === 'slot') {
        const worn = wornAt(draft.look, first.slot);
        const id = worn?.id ?? data.catalogue.pieces.find((p) => p.slot === first.slot)?.id;
        const look = id === undefined ? null : pieceLook(first.slot, id);
        const url = look === null ? null : thumb(look, 'piece');
        if (url !== null) return el('img', { src: url, alt: '', draggable: 'false' });
      } else {
        const url = thumb(bodyLook(draft.look.shape), 'figure');
        return el('img', { src: url, alt: '', draggable: 'false' });
      }
    }
    return el('span', {
      class: 'lpl-ed__initial',
      text: (T.categories[cat.id] ?? cat.id).slice(0, 1),
    });
  }

  function sectionTitle(key: string): string {
    if (key in T.sections) return T.sections[key as keyof typeof T.sections];
    if (key.startsWith('slot:')) return T.slots[key.slice(5)] ?? key;
    if (key.startsWith('zone:')) return T.zones[key.split(':')[2] ?? ''] ?? T.sections.colors;
    return key;
  }

  function render(): void {
    if (draft === null) return;
    const d = draft;
    setText(title, mode === 'create' ? T.title : T.titleMirror);
    setText(doneButton, mode === 'create' ? T.done : T.doneMirror);
    tabs.replaceChildren(
      ...categories.map((cat, i) => {
        const tab = el(
          'button',
          {
            class: 'lpl-ed__tab',
            type: 'button',
            role: 'tab',
            'aria-selected': i === category ? 'true' : 'false',
            'aria-label': T.categories[cat.id] ?? cat.id,
            title: T.categories[cat.id] ?? cat.id,
          },
          [
            categoryImage(cat),
            el('span', { class: 'lpl-ed__tab-name', text: T.categories[cat.id] ?? cat.id }),
          ],
        );
        tab.addEventListener('click', () => {
          setCategory(i);
        });
        return tab;
      }),
    );
    const cat = current();
    rows = cat === undefined ? [] : rowsFor(cat, d, data, S);
    const parts: Node[] = [];
    rows.forEach((row, r) => {
      if (row.title !== null) {
        parts.push(el('h3', { class: 'lpl-ed__section', text: sectionTitle(row.title) }));
        if (row.title === 'gender')
          parts.push(el('p', { class: 'lpl-ed__note', text: T.genderNote }));
      }
      const line = el('div', { class: `lpl-ed__row lpl-ed__row--${row.kind}` });
      row.tiles.forEach((tile, c) => {
        const label = tileLabel(tile);
        const chosen = isSelected(d, tile, data);
        const key = tileKey(tile);
        const isSwatch = row.kind === 'swatches';
        const hex =
          tile.kind === 'skin'
            ? data.catalogue.skins[tile.index]
            : tile.kind === 'color'
              ? tile.hex
              : null;
        const button = el(
          'button',
          {
            class: `lpl-ed__${isSwatch ? 'swatch' : 'tile'}`,
            type: 'button',
            'aria-label': label,
            'aria-pressed': chosen ? 'true' : 'false',
            title: label,
            style: hex === null || hex === undefined ? null : `--c:${hex}`,
          },
          isSwatch
            ? []
            : [
                tileImage(tile),
                el('span', { class: 'lpl-ed__label', text: label.replace(/ \(.*\)$/, '') }),
              ],
        );
        toggle(button, 'is-chosen', chosen);
        toggle(
          button,
          'is-reserved',
          tile.kind === 'color' && S.playerOnlyColors.includes(tile.hex),
        );
        toggle(button, 'focus', focus.row === r && focus.col === c);
        if (key === popTile && chosen) button.classList.add('is-pop');
        button.addEventListener('click', () => {
          focus = { row: r, col: c };
          activate();
        });
        line.append(button);
      });
      parts.push(line);
    });
    grid.replaceChildren(...parts);
    const barRow = rows.length;
    BAR.forEach((item, c) => {
      const node = item === 'name' ? nameInput : item === 'random' ? randomButton : doneButton;
      toggle(
        node,
        'focus',
        focus.row === barRow && focus.col === c && document.activeElement !== nameInput,
      );
    });
    const label = deps.keyLabel;
    setText(
      keys,
      [
        fillText(T.keys.categories, { prev: label('KeyQ'), next: label('KeyE') }),
        fillText(T.keys.choose, { key: label('Space') }),
        fillText(T.keys.random, { key: label('KeyR') }),
      ].join('  ·  '),
    );
    setText(turnHint, fillText(T.keys.turn, { left: label('KeyA'), right: label('KeyD') }));
    popTile = null;
  }

  function setLook(next: EditorDraft, react: boolean): void {
    const changed = draft === null || JSON.stringify(draft.look) !== JSON.stringify(next.look);
    draft = next;
    if (changed) preview?.setLook(next.look, react);
  }

  function setCategory(index: number): void {
    const count = categories.length;
    if (count === 0) return;
    const next = ((index % count) + count) % count;
    if (next === category) return;
    category = next;
    focus = { row: 0, col: 0 };
    if (!deps.reduced()) preview?.face(categories[next]?.yaw ?? S.frontYaw);
    render();
  }

  function activate(): void {
    if (draft === null) return;
    if (focus.row >= rows.length) {
      const item: BarItem | undefined = BAR[focus.col];
      if (item === 'name') nameInput.focus();
      else if (item === 'random') randomize();
      else if (item === 'done') submit();
      render();
      return;
    }
    const tile = rows[focus.row]?.tiles[focus.col];
    if (tile === undefined) return;
    const starter =
      mode === 'create' && !touched ? (g: Gender): Look => deps.starter(player, g) : null;
    const next = choose(draft, tile, data, starter, S);
    if (tile.kind !== 'gender') touched = true;
    popTile = tileKey(tile);
    setLook(next, true);
    render();
  }

  function randomize(): void {
    if (draft === null) return;
    randomCount += 1;
    touched = true;
    setLook(
      randomDraft(
        draft,
        `hasard-${String(player)}-${String(randomCount)}-${String(Date.now())}`,
        data,
        S,
      ),
      true,
    );
    render();
  }

  function submit(): void {
    if (draft === null) return;
    const name = cleanName(nameInput.value, S);
    if (name === '') {
      setText(nameError, T.nameEmpty);
      nameInput.focus();
      return;
    }
    deps.send({ type: 'set_look', name, look: draft.look, gender: draft.gender });
    close();
  }

  function close(): void {
    open = false;
    root.hidden = true;
    nameInput.blur();
    preview?.dispose();
    preview = null;
    previewPending = false;
    thumbs.clear();
  }

  function ensurePreview(): void {
    if (preview !== null || previewPending || deps.preview === undefined) return;
    previewPending = true;
    show(loading, true);
    deps.preview(canvas).then(
      (ready) => {
        previewPending = false;
        if (!open) {
          ready.dispose();
          return;
        }
        preview = ready;
        resize();
        if (draft !== null) ready.setLook(draft.look, false);
        show(loading, false);
        render();
      },
      () => {
        previewPending = false;
        // GLB absents: l'éditeur reste utilisable, sans le personnage ni les vignettes.
      },
    );
  }

  function resize(): void {
    const rect = canvas.getBoundingClientRect();
    preview?.resize(Math.max(1, Math.round(rect.width)), Math.max(1, Math.round(rect.height)));
  }

  canvas.addEventListener('pointerdown', (event) => {
    dragX = event.clientX;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (dragX === null) return;
    preview?.turn((event.clientX - dragX) * S.turnPerPixel);
    dragX = event.clientX;
  });
  const endDrag = (): void => {
    dragX = null;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  nameInput.addEventListener('input', () => {
    setText(nameError, '');
  });
  nameInput.addEventListener('focus', () => {
    focus = { row: rows.length, col: 0 };
    render();
  });
  randomButton.addEventListener('click', () => {
    focus = { row: rows.length, col: 1 };
    randomize();
  });
  doneButton.addEventListener('click', () => {
    focus = { row: rows.length, col: 2 };
    submit();
  });
  const onResize = (): void => {
    resize();
  };
  window.addEventListener('resize', onResize);

  return {
    open(nextMode, world, me) {
      const state = world.players[me];
      mode = nextMode;
      player = me;
      const gender = state.gender ?? deps.defaultGender(me);
      const look = (state.look as Look | null) ?? deps.starter(me, gender);
      draft = null;
      setLook({ gender, look: structuredClone(look), name: state.name }, false);
      nameInput.value = state.name;
      setText(nameError, '');
      touched = state.look !== null;
      category = 0;
      focus = { row: 0, col: 0 };
      open = true;
      root.hidden = false;
      ensurePreview();
      render();
    },
    isOpen() {
      return open;
    },
    key(event) {
      if (!open) return false;
      const code = event.code;
      if (document.activeElement === nameInput) {
        if (code === 'Enter') {
          nameInput.blur();
          focus = { row: rows.length, col: 2 };
          render();
          return true;
        }
        if (code === 'Escape' || code === 'Tab' || code === 'ArrowUp' || code === 'ArrowDown') {
          nameInput.blur();
          if (code === 'ArrowUp') focus = moveFocus(navRows(), focus, 'up');
          render();
          return true;
        }
        // Le prénom se tape librement: la touche reste au champ, rien ne part au jeu.
        return false;
      }
      const label = event.repeat ? null : code;
      switch (code) {
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight': {
          const dir =
            code === 'ArrowUp'
              ? 'up'
              : code === 'ArrowDown'
                ? 'down'
                : code === 'ArrowLeft'
                  ? 'left'
                  : 'right';
          focus = moveFocus(navRows(), focus, dir);
          render();
          return true;
        }
        case 'KeyA':
        case 'KeyD':
          preview?.turn(((code === 'KeyA' ? -1 : 1) * S.turnPerSecond) / 15);
          return true;
        case 'KeyQ':
        case 'KeyE':
          if (label !== null) setCategory(category + (code === 'KeyQ' ? -1 : 1));
          return true;
        case 'Space':
        case 'Enter':
          if (label !== null) activate();
          return true;
        case 'KeyR':
          if (label !== null) randomize();
          return true;
        case 'Backspace':
        case 'Escape':
          // Au miroir, on repart sans rien changer; la première création se termine par la validation.
          if (mode === 'mirror') close();
          return true;
        default:
          return true;
      }
    },
    frame(dt, world, me) {
      if (!open) return;
      preview?.frame(dt);
      const other: PlayerIndex = me === 0 ? 1 : 0;
      const o = world.players[other];
      const ready = o.look !== null;
      setText(otherChip, `${o.name} : ${ready ? T.other.ready : T.other.waiting}`);
      toggle(otherChip, 'is-ready', ready);
      show(otherChip, mode === 'create');
    },
    draft() {
      return draft;
    },
    dispose() {
      close();
      window.removeEventListener('resize', onResize);
      root.remove();
    },
  };
}
