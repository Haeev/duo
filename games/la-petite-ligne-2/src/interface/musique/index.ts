/**
 * Écran de la musique jouée (cahier 4.7): le cahier de fanfare où l'on choisit l'air, puis la
 * partition encrée. L'air se lit ligne après ligne comme un cahier de musique: quatre lignes de
 * portée (une par touche, la plus grave en bas), une forme par touche, une plume qui avance.
 * L'écran ne décide rien: il dessine le modèle du poste (`simulation/musique/poste.ts`) et lui
 * passe les touches, datées sur l'horloge du son.
 */
import type { Content } from '../../donnees/charger';
import type { AirNote } from '../../donnees/schemas/air';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { ReadonlyWorld } from '../../etat/monde';
import { heldInstrument } from '../../simulation/musique/lecture';
import {
  createDesk,
  type Desk,
  type DeskView,
  type StageSound,
} from '../../simulation/musique/poste';
import { MUSIC, type AssistLevel, type Verdict } from '../../simulation/musique/reglages';
import type { Intent } from '../../simulation/noyau/entrees';
import type { GameEvent } from '../../simulation/noyau/evenements';
import { formatEuros } from '../../simulation/sac/argent';
import { layoutOf, lineAt, notesOnLine, STAFF, xOf, type PageLayout } from './mise-en-page';
import { fillText, MUSIC_TEXTS as T } from './textes';
import './musique.css';

/** Le son tel que l'écran s'en sert: celui du poste, plus la date d'une frappe du clavier. */
export interface StageSoundPort extends StageSound {
  airAt?(timeStampMs: number): number | null;
}

export interface StageOptions {
  readonly layer: HTMLElement;
  readonly content: Content;
  world(): ReadonlyWorld | null;
  local(): PlayerIndex | null;
  readonly send: (intent: Intent) => void;
  readonly keyLabel: (code: string) => string;
  readonly keyTarget: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  /** Son de l'air (`audio/musique/scene.ts`); absent: l'air se joue en silence (démonstration). */
  readonly sound?: StageSoundPort;
  /** Heure de session commune (`duo.net.sessionTimeMs`); absent: l'horloge de la machine. */
  readonly sessionNow?: () => number;
  /** Aide réglable de ce joueur (cahier 2.4); absente: cran normal. */
  readonly assist?: () => AssistLevel;
  readonly reduced?: () => boolean;
  /** Anti-double-appui à l'ouverture du cahier (ms). */
  readonly openGuardMs?: number;
}

export interface StageScreen {
  onEvent(event: GameEvent): void;
  frame(dtMs: number): void;
  isOpen(): boolean;
  dispose(): void;
}

/**
 * Cran de l'aide du joueur pour les mini-jeux. Le réglage n'existe pas encore dans les options du
 * carnet: tout le jeu doit le lire ici, et il vaut « normal » tant que rien n'est branché.
 */
export function assistLevel(source?: () => AssistLevel): AssistLevel {
  return source?.() ?? 0;
}

/** Sans carte son (démonstration, essais): l'horloge de l'air suit l'heure de session. */
export function silentSound(sessionNow: () => number): StageSoundPort {
  let startAt: number | null = null;
  return {
    start(spec) {
      startAt = spec.startAtMs;
    },
    airNow: () => (startAt === null ? null : sessionNow() - startAt),
    note: () => 0,
    sour: () => undefined,
    stop() {
      startAt = null;
    },
  };
}

/** Forme d'une note selon sa touche (grave à aiguë): rond, carré, triangle, losange. */
const SHAPES = [
  '<circle r="12"/>',
  '<rect x="-11" y="-11" width="22" height="22" rx="2"/>',
  '<path d="M0-14L14 10H-14z"/>',
  '<path d="M0-15L13 0 0 15-13 0z"/>',
] as const;
const SMALL_SHAPES = [
  '<circle r="4.5"/>',
  '<rect x="-4" y="-4" width="8" height="8"/>',
  '<path d="M0-5L5.5 4H-5.5z"/>',
  '<path d="M0-6L5 0 0 6-5 0z"/>',
] as const;

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (c) => `&#${String(c.charCodeAt(0))};`);
}

function stars(count: number | null): string {
  if (count === null) return '';
  return `<span class="lpl-mus-stars" aria-label="${String(count)} sur 3">${[1, 2, 3]
    .map((n) => `<i class="${n <= count ? 'on' : ''}"></i>`)
    .join('')}</span>`;
}

export function createStage(options: StageOptions): StageScreen {
  const { content, keyLabel, keyTarget } = options;
  const sessionNow =
    options.sessionNow ?? ((): number => performance.timeOrigin + performance.now());
  const sound = options.sound ?? silentSound(sessionNow);
  const desk: Desk = createDesk({
    content,
    world: () => options.world(),
    local: () => options.local(),
    send: options.send,
    sessionNow,
    assist: () => assistLevel(options.assist),
    sound,
  });
  const root = document.createElement('div');
  root.className = 'lpl-mus';
  root.hidden = true;
  options.layer.append(root);

  let shown: DeskView['kind'] = 'closed';
  let lastHtml = '';
  let openedFor = 0;
  const held = [false, false, false, false];
  /** La partition en cours: ce qui est déjà dessiné, pour ne retoucher que ce qui bouge. */
  let sheet: {
    readonly air: string;
    readonly layout: PageLayout;
    line: number;
    readonly cursor: SVGElement | null;
    readonly word: HTMLElement | null;
    readonly count: HTMLElement | null;
    readonly page: HTMLElement | null;
    readonly mate: HTMLElement | null;
    /** Touches du pied de page et clefs de la portée: elles s'enfoncent avec le clavier. */
    readonly caps: { readonly el: Element; readonly lane: number; down: boolean }[];
    marks: { readonly el: Element; readonly index: number; readonly mine: boolean; v: string }[];
  } | null = null;

  function nameOf(player: PlayerIndex | null): string {
    const world = options.world();
    return player === null || world === null ? '' : world.players[player].name;
  }
  function mate(): PlayerIndex | null {
    const me = options.local();
    return me === null ? null : me === 0 ? 1 : 0;
  }
  function keys(codes: readonly string[]): string {
    return codes.map((code) => `<kbd>${escapeHtml(keyLabel(code))}</kbd>`).join('');
  }

  // --- Cahier ----------------------------------------------------------------------------------
  function bookHtml(view: Extract<DeskView, { kind: 'book' }>): string {
    const world = options.world();
    const me = options.local();
    const instrument =
      world === null || me === null ? null : heldInstrument(content, world, me)?.item;
    const who =
      instrument === null || instrument === undefined
        ? ''
        : escapeHtml(content.items[instrument]?.name ?? '');
    const duo = view.partner
      ? `<p class="lpl-mus-duo on">${escapeHtml(fillText(T.duoWith, { nom: nameOf(mate()) }))}</p>`
      : `<p class="lpl-mus-duo">${escapeHtml(fillText(T.duoHint, { nom: nameOf(mate()) }))}</p>`;
    const rows = view.lines
      .map((line, i) => {
        const classes = ['lpl-mus-row'];
        if (i === view.selected) classes.push('sel');
        if (!line.known) classes.push('unknown');
        else if (!line.allowed) classes.push('locked');
        const voices = line.air.score?.duo === undefined ? T.oneVoice : T.twoVoices;
        const detail = !line.known
          ? T.unknown
          : !line.allowed
            ? T.locked
            : `${T.difficulty[line.air.difficulty]}${view.partner ? `, ${voices}` : ''}`;
        const pips = [1, 2, 3]
          .map((n) => `<i class="${n <= line.air.difficulty ? 'on' : ''}"></i>`)
          .join('');
        return `<li class="${classes.join(' ')}"><span class="rank">${String(i + 1)}</span><span class="name">${line.known ? escapeHtml(line.name) : '...'}</span><span class="pips" aria-hidden="true">${pips}</span><span class="lpl-mus-detail">${escapeHtml(detail)}</span>${stars(line.known ? line.best : null)}</li>`;
      })
      .join('');
    const list =
      view.lines.length === 0 ? `<p class="lpl-mus-empty">${escapeHtml(T.empty)}</p>` : rows;
    return `<section class="lpl-mus-panel lpl-mus-book"><header><h2>${escapeHtml(T.title)}</h2><p class="lpl-mus-who">${who}</p></header>${duo}<ol>${list}</ol><footer><span>${keys(['KeyW', 'KeyS'])} ${T.choose}</span><span>${keys(['Space'])} ${T.play}</span><span>${keys(['Backspace'])} ${T.leave}</span></footer></section>`;
  }

  // --- Partition -------------------------------------------------------------------------------
  function lineSvg(
    view: Extract<DeskView, { kind: 'play' }>,
    layout: PageLayout,
    line: number,
    current: boolean,
  ): string {
    if (line >= layout.lines) return '';
    // La ligne suivante n'est qu'un aperçu: sa voix seulement, pour tenir en petite fenêtre.
    const duo = view.partner !== null && current;
    const height = duo ? STAFF.heightDuo : STAFF.height;
    const parts: string[] = [];
    // Portée: une ligne par touche, sa touche et sa forme en clef.
    STAFF.laneY.forEach((y, lane) => {
      parts.push(
        `<line class="staff" x1="${String(STAFF.left - 14)}" y1="${String(y)}" x2="${String(STAFF.right)}" y2="${String(y)}"/>`,
      );
      if (current)
        parts.push(
          `<g class="clef l${String(lane)}" data-lane="${String(lane)}" transform="translate(40 ${String(y)})"><g class="shape">${SHAPES[lane] ?? ''}</g><text x="0" y="6">${escapeHtml(keyLabel(MUSIC.keys[lane] ?? ''))}</text></g>`,
        );
    });
    // Barres de mesure.
    for (let bar = 0; bar <= layout.barsPerLine; bar++) {
      const x = xOf(layout, line, line * layout.lineMs + bar * layout.barMs);
      const top = STAFF.laneY[3];
      const bottom = STAFF.laneY[0];
      parts.push(
        `<line class="bar${bar === 0 || bar === layout.barsPerLine ? ' end' : ''}" x1="${x.toFixed(1)}" y1="${String(top - 10)}" x2="${x.toFixed(1)}" y2="${String(bottom + 10)}"/>`,
      );
    }
    const drawNote = (entry: { index: number; note: AirNote }, mine: boolean): void => {
      const [at, lane, , length] = entry.note;
      const x = xOf(layout, line, at);
      const y = (mine ? STAFF.laneY : STAFF.mateY)[lane] ?? 0;
      const shape = (mine ? SHAPES : SMALL_SHAPES)[lane] ?? '';
      // Tenue: un trait d'encre le temps que la note sonne.
      const until = Math.min(xOf(layout, line, at + length), STAFF.right);
      const hold =
        mine && until - x > 30
          ? `<line class="hold" x1="14" y1="0" x2="${(until - x).toFixed(1)}" y2="0"/>`
          : '';
      const extras = mine
        ? '<path class="tick early" d="M-4-28l-8 7 8 7"/><path class="tick late" d="M4-28l8 7-8 7"/><path class="cross" d="M-13-13L13 13M13-13L-13 13"/>'
        : '';
      parts.push(
        `<g class="note ${mine ? 'mine' : 'mate'} l${String(lane)}" data-i="${String(entry.index)}" data-v="" transform="translate(${x.toFixed(1)} ${String(y)})">${hold}<g class="shape">${shape}</g>${extras}</g>`,
      );
    };
    if (view.partner !== null && duo) {
      for (const y of STAFF.mateY)
        parts.push(
          `<line class="staff mate" x1="${String(STAFF.left - 14)}" y1="${String(y)}" x2="${String(STAFF.right)}" y2="${String(y)}"/>`,
        );
      for (const entry of notesOnLine(layout, view.partner.notes, line)) drawNote(entry, false);
    }
    for (const entry of notesOnLine(layout, view.mine.notes, line)) drawNote(entry, true);
    if (current)
      parts.push(
        `<g class="cursor"><line x1="0" y1="${String(STAFF.laneY[3] - 22)}" x2="0" y2="${String((duo ? STAFF.mateY[0] : STAFF.laneY[0]) + 14)}"/><path d="M-9 ${String(STAFF.laneY[3] - 34)}h18l-9 14z"/></g>`,
      );
    return `<svg class="lpl-mus-line ${current ? 'now' : 'next'}" viewBox="0 0 ${String(STAFF.width)} ${String(height)}" role="img" aria-hidden="true">${parts.join('')}</svg>`;
  }

  function buildSheet(view: Extract<DeskView, { kind: 'play' }>): void {
    const layout = layoutOf(view.score);
    const line = lineAt(layout, view.airMs);
    const name = content.book.entries[view.air]?.name ?? view.air;
    const partner = view.partner;
    const mateLabel =
      partner === null
        ? ''
        : `<p class="lpl-mus-mate" data-playing="oui">${escapeHtml(fillText(T.partner, { nom: nameOf(mate()) }))}: ${escapeHtml(partner.name)}</p>`;
    root.innerHTML = `<section class="lpl-mus-panel lpl-mus-sheet${partner === null ? '' : ' duo'}"><header><h2>${escapeHtml(name)}</h2><p class="lpl-mus-who">${escapeHtml(view.mine.name)}</p><p class="lpl-mus-pageno"></p></header><div class="lpl-mus-paper"><div class="lpl-mus-now">${lineSvg(view, layout, line, true)}<p class="lpl-mus-count" hidden></p><p class="lpl-mus-word" data-v=""></p></div>${mateLabel}<div class="lpl-mus-next">${lineSvg(view, layout, line + 1, false)}</div></div><footer><span class="lpl-mus-keys">${MUSIC.keys
      .map(
        (code, lane) =>
          `<kbd data-lane="${String(lane)}"><svg viewBox="-16 -16 32 32" aria-hidden="true">${SHAPES[lane] ?? ''}</svg>${escapeHtml(keyLabel(code))}</kbd>`,
      )
      .join('')}</span><span>${keys(['Backspace'])} ${T.leave}</span></footer></section>`;
    lastHtml = '';
    const marks: NonNullable<typeof sheet>['marks'] = [];
    root.querySelectorAll('.lpl-mus-now .note').forEach((el) => {
      marks.push({
        el,
        index: Number(el.getAttribute('data-i')),
        mine: el.classList.contains('mine'),
        v: '',
      });
    });
    sheet = {
      air: view.air,
      layout,
      line,
      cursor: root.querySelector<SVGElement>('.cursor'),
      word: root.querySelector<HTMLElement>('.lpl-mus-word'),
      count: root.querySelector<HTMLElement>('.lpl-mus-count'),
      page: root.querySelector<HTMLElement>('.lpl-mus-pageno'),
      mate: root.querySelector<HTMLElement>('.lpl-mus-mate'),
      caps: [...root.querySelectorAll('.lpl-mus-keys kbd, .clef')].map((el) => ({
        el,
        lane: Number(el.getAttribute('data-lane')),
        down: false,
      })),
      marks,
    };
    if (sheet.page !== null)
      sheet.page.textContent = fillText(T.page, { n: line + 1, total: layout.lines });
  }

  function updateSheet(view: Extract<DeskView, { kind: 'play' }>): void {
    if (sheet?.air !== view.air) buildSheet(view);
    if (sheet === null) return;
    if (lineAt(sheet.layout, view.airMs) !== sheet.line) buildSheet(view);
    const current = sheet;
    const x = Math.max(STAFF.left - 30, xOf(current.layout, current.line, view.airMs));
    current.cursor?.setAttribute('transform', `translate(${x.toFixed(1)} 0)`);
    for (const mark of current.marks) {
      const verdict: Verdict | null =
        (mark.mine ? view.mine.verdicts : view.partner?.verdicts)?.[mark.index] ?? null;
      const value = verdict ?? '';
      if (value === mark.v) continue;
      mark.v = value;
      mark.el.setAttribute('data-v', value);
    }
    // Décompte: les derniers temps avant le premier.
    if (current.count !== null) {
      const beat = 60_000 / view.score.tempo;
      const left = Math.ceil(-view.airMs / beat);
      const text = view.airMs >= 0 ? '' : left > MUSIC.countIn.beats ? T.ready : String(left);
      if (current.count.textContent !== text) current.count.textContent = text;
      current.count.hidden = text === '';
    }
    if (current.word !== null) {
      const last = view.last;
      const fresh = last !== null && view.airMs - last.atMs < 700;
      const text = fresh ? T.verdicts[last.verdict] : '';
      if (current.word.textContent !== text) {
        current.word.textContent = text;
        current.word.dataset.v = fresh ? last.verdict : '';
        if (fresh) {
          const share = (xOf(current.layout, current.line, last.atMs) / STAFF.width) * 100;
          current.word.style.left = `${Math.max(8, Math.min(92, share)).toFixed(1)}%`;
        }
      }
    }
    if (current.mate !== null && view.partner !== null) {
      const playing = view.partner.playing ? 'oui' : 'non';
      if (current.mate.dataset.playing !== playing) current.mate.dataset.playing = playing;
    }
    for (const cap of current.caps) {
      const down = held[cap.lane] === true;
      if (down === cap.down) continue;
      cap.down = down;
      cap.el.classList.toggle('down', down);
    }
  }

  // --- Mot de la fin ---------------------------------------------------------------------------
  function resultHtml(view: Extract<DeskView, { kind: 'result' }>): string {
    const tally = (label: string, result: typeof view.mine): string =>
      `<li><b>${escapeHtml(label)}</b><span>${String(result.just)} ${T.tally.just}</span><span>${String(result.near)} ${T.tally.near}</span><span>${String(result.false)} ${T.tally.false}</span><span>${String(result.missed)} ${T.tally.missed}</span>${stars(result.rating)}</li>`;
    const plural = (forms: readonly [string, string, string], n: number): string =>
      fillText(forms[Math.min(n, 2)] ?? '', { n });
    const name = content.book.entries[view.air]?.name ?? view.air;
    const lines: string[] = [];
    if (view.first) lines.push(`<p class="first">${escapeHtml(T.first)}</p>`);
    if (view.together) lines.push(`<p class="together">${escapeHtml(T.together)}</p>`);
    lines.push(`<p>${escapeHtml(plural(T.listeners, view.listeners))}</p>`);
    if (view.mine.cents > 0)
      lines.push(
        `<p class="hat">${escapeHtml(fillText(T.hat, { somme: formatEuros(view.mine.cents) }))}</p>`,
      );
    else if (view.listeners > 0) lines.push(`<p class="muted">${escapeHtml(T.hatDone)}</p>`);
    if (view.mine.friends > 0)
      lines.push(`<p>${escapeHtml(plural(T.friends, view.mine.friends))}</p>`);
    return `<section class="lpl-mus-panel lpl-mus-result r${String(view.rating)}"><header><h2>${escapeHtml(T.ratings[view.rating])}</h2><p class="lpl-mus-who">${escapeHtml(name)}</p></header><p class="line">${escapeHtml(T.ratingLines[view.rating])}</p><ul class="tallies">${tally(view.other === null ? T.you : nameOf(options.local()), view.mine)}${view.other === null ? '' : tally(nameOf(mate()), view.other)}</ul><div class="gains">${lines.join('')}</div><footer><span>${keys(['Space'])} ${T.close}</span></footer></section>`;
  }

  function render(): void {
    const view = desk.view();
    if (view.kind !== shown) {
      shown = view.kind;
      sheet = null;
      lastHtml = '';
      openedFor = 0;
      held.fill(false);
      root.dataset.kind = view.kind;
    }
    root.hidden = view.kind === 'closed';
    root.dataset.motion = options.reduced?.() === true ? 'reduced' : 'full';
    if (view.kind === 'play') {
      updateSheet(view);
      return;
    }
    let html = '';
    if (view.kind === 'book') html = bookHtml(view);
    else if (view.kind === 'wait')
      html = `<section class="lpl-mus-panel lpl-mus-wait"><header><h2>${escapeHtml(T.title)}</h2></header><p>${escapeHtml(fillText(T.wait, { nom: nameOf(mate()) }))}</p><p class="muted">${escapeHtml(T.waitHint)}</p><footer><span>${keys(['Backspace'])} ${T.leave}</span></footer></section>`;
    else if (view.kind === 'result') html = resultHtml(view);
    if (html !== lastHtml) {
      root.innerHTML = html;
      lastHtml = html;
    }
  }

  function onKey(raw: Event, down: boolean): void {
    if (!(raw instanceof KeyboardEvent)) return;
    const view = desk.view();
    if (view.kind === 'closed') return;
    raw.preventDefault();
    const code = raw.code;
    const lane = MUSIC.keys.indexOf(code);
    if (view.kind === 'play') {
      if (lane >= 0) {
        if (down && !raw.repeat) {
          held[lane] = true;
          desk.press(lane, sound.airAt?.(raw.timeStamp) ?? view.airMs);
        } else if (!down) held[lane] = false;
        return;
      }
      if (down && !raw.repeat && (code === 'Backspace' || code === 'Escape')) desk.leave();
      return;
    }
    if (!down || raw.repeat) return;
    if (code === 'Backspace' || code === 'Escape') {
      desk.leave();
      return;
    }
    if (openedFor < (options.openGuardMs ?? 300)) return;
    if (view.kind === 'book') {
      if (code === 'KeyW' || code === 'ArrowUp') desk.move(-1);
      else if (code === 'KeyS' || code === 'ArrowDown') desk.move(1);
      else if (code === 'Space' || code === 'Enter') desk.confirm();
    } else if (view.kind === 'result' && (code === 'Space' || code === 'Enter')) desk.confirm();
  }
  const onDown = (e: Event): void => {
    onKey(e, true);
  };
  const onUp = (e: Event): void => {
    onKey(e, false);
  };
  keyTarget.addEventListener('keydown', onDown);
  keyTarget.addEventListener('keyup', onUp);

  return {
    onEvent(event) {
      desk.onEvent(event);
    },
    frame(dtMs) {
      openedFor += dtMs;
      desk.frame(dtMs);
      render();
    },
    isOpen: () => desk.isOpen(),
    dispose() {
      keyTarget.removeEventListener('keydown', onDown);
      keyTarget.removeEventListener('keyup', onUp);
      root.remove();
    },
  };
}
