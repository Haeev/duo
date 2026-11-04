// Module `notebook`: carnet de séance (pont 1.1). Ctrl+N ouvre une note par-dessus le jeu, qui
// continue; la note part avec les images du canevas des 10 s d'avant et des 10 s d'après.
//
// Images JPEG à 3 par seconde plutôt qu'une vidéo (MediaRecorder): chaque image se lit seule,
// par une personne comme par le studio, sans outil; un tampon circulaire d'images se coupe
// n'importe où, alors qu'un flux WebM ne se relit qu'avec son premier fragment; l'encodage JPEG
// de `toBlob` se fait hors du fil de la page, et une copie réduite à 640 pixels de large coûte
// peu à chaque capture. La copie se fait juste après le rendu (crochet de la boucle): un
// canevas WebGL sans `preserveDrawingBuffer` n'est lisible que dans cette tâche.
import type { GameMessage, NotebookStatus } from '@duo/protocol';
import type { Notebook, NotebookSource, Unsubscribe } from './api';

/** Réglages du carnet (valeurs fixes de la plateforme, pas du gameplay). */
export const NOTEBOOK_SETTINGS = {
  framesPerSecond: 3,
  frameWidth: 640,
  jpegQuality: 0.6,
  beforeMs: 10_000,
  afterMs: 10_000,
  /** Plafond des images gardées (saisie très longue comprise). */
  maxFrames: 360,
  maxTextLength: 4000,
  traces: 100,
  logs: 60,
  errors: 30,
  sheetColumns: 6,
  sheetRows: 4,
  sheetCellWidth: 320,
  toastMs: 4000,
} as const;

const SHORTCUT_CODE = 'KeyN';

interface Frame {
  /** Numéro d'ordre de la capture: nomme le fichier, le même dans tous les envois. */
  readonly seq: number;
  readonly at: number;
  readonly wall: number;
  readonly caption: string;
  readonly blob: Blob;
}

type Phase = 'avant' | 'saisie' | 'apres';
const PHASE_LABELS: Readonly<Record<Phase, string>> = {
  avant: 'avant',
  saisie: 'saisie',
  apres: 'après',
};

interface PendingNote {
  readonly entry: string;
  readonly openedAt: number;
  readonly openedWall: number;
  readonly caption: string;
  readonly snapshot: unknown;
  sentAt: number;
  /** Images déjà envoyées avec la note. */
  readonly sent: Set<Frame>;
  timer: ReturnType<typeof setTimeout> | undefined;
  finish: (() => Promise<void>) | null;
}

interface Recorded {
  readonly at: string;
  readonly kind: string;
  readonly message: string;
  readonly data?: unknown;
}

export interface NotebookDeps {
  /** `init.notebook` de la plateforme: absent si le carnet n'est pas offert. */
  readonly offer: { readonly enabled: boolean } | undefined;
  readonly send: (message: GameMessage) => void;
  readonly releaseKeys: () => void;
  /** Ce qui identifie la partie dans la note (jeu, version, rôle, joueur). */
  readonly describe: () => Readonly<Record<string, unknown>>;
}

export interface NotebookInternal extends Notebook {
  readonly typing: boolean;
  afterRender(): void;
  receiveResult(requestId: number, status: NotebookStatus): void;
  recordLog(level: string, message: string, data?: unknown): void;
  /** Envoie tout de suite les images d'après des notes en cours (fin de partie). */
  flush(): Promise<void>;
  dispose(): void;
}

function pad(value: number, size = 2): string {
  return String(value).padStart(size, '0');
}

/** Écart à la note en texte de fichier: `moins-09-7s`, `plus-03-4s`. */
export function offsetName(offsetMs: number): string {
  const tenths = Math.round(Math.abs(offsetMs) / 100);
  const sign = offsetMs < 0 ? 'moins' : 'plus';
  return `${sign}-${pad(Math.floor(tenths / 10))}-${tenths % 10}s`;
}

/** Écart à la note en texte lisible: `-9,7 s`, `+3,4 s`. */
export function offsetLabel(offsetMs: number): string {
  const seconds = (Math.round(offsetMs / 100) / 10).toFixed(1).replace('.', ',');
  return offsetMs < 0 ? `${seconds} s` : `+${seconds} s`;
}

function safeJson(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value ?? null)) as unknown;
  } catch {
    return String(value);
  }
}

function frenchDate(wall: number): string {
  const date = new Date(wall);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} à ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function textOf(value: unknown): string {
  if (value instanceof Error) return value.stack ?? value.message;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function pushLimited<T>(list: T[], item: T, limit: number): void {
  list.push(item);
  if (list.length > limit) list.splice(0, list.length - limit);
}

const encoder = new TextEncoder();

export function createNotebook(deps: NotebookDeps): NotebookInternal {
  const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined';
  const offer = hasDom ? deps.offer : undefined;
  const available = offer !== undefined;
  let enabled = offer?.enabled ?? false;
  let source: NotebookSource | null = null;
  const frames: Frame[] = [];
  const traces: Recorded[] = [];
  const logs: Recorded[] = [];
  const errors: Recorded[] = [];
  const notes = new Set<PendingNote>();
  const pendingResults = new Map<number, (status: NotebookStatus) => void>();
  let nextRequestId = 1;
  let nextSeq = 1;
  let nextEntry = 1;
  let lastCapture = -Infinity;
  let encoding = false;
  let scratch: HTMLCanvasElement | null = null;
  let typing: { note: PendingNote; close: () => void } | null = null;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let toastNode: HTMLElement | null = null;
  const cleanups: (() => void)[] = [];

  const record = (
    list: Recorded[],
    limit: number,
    kind: string,
    message: string,
    data?: unknown,
  ): void => {
    const item: Recorded =
      data === undefined
        ? { at: new Date().toISOString(), kind, message: message.slice(0, 1000) }
        : {
            at: new Date().toISOString(),
            kind,
            message: message.slice(0, 1000),
            data: safeJson(data),
          };
    pushLimited(list, item, limit);
  };

  const caption = (): string => {
    try {
      return source?.caption?.() ?? '';
    } catch {
      return '';
    }
  };

  // Images gardées: les 10 dernières secondes, et tout ce qui touche une note en cours.
  const prune = (now: number): void => {
    let keepFrom = now - NOTEBOOK_SETTINGS.beforeMs - 500;
    for (const note of notes)
      keepFrom = Math.min(keepFrom, note.openedAt - NOTEBOOK_SETTINGS.beforeMs - 500);
    let drop = 0;
    while (drop < frames.length && (frames[drop]?.at ?? 0) < keepFrom) drop++;
    drop = Math.max(drop, frames.length - NOTEBOOK_SETTINGS.maxFrames);
    if (drop > 0) frames.splice(0, drop);
  };

  const capture = (): void => {
    const canvas = source?.canvas() ?? null;
    if (canvas === null || canvas.width === 0 || canvas.height === 0) return;
    const width = Math.min(NOTEBOOK_SETTINGS.frameWidth, canvas.width);
    const height = Math.max(1, Math.round((canvas.height * width) / canvas.width));
    scratch ??= document.createElement('canvas');
    if (scratch.width !== width || scratch.height !== height) {
      scratch.width = width;
      scratch.height = height;
    }
    const context = scratch.getContext('2d');
    if (context === null) return;
    context.drawImage(canvas, 0, 0, width, height);
    const at = performance.now();
    const wall = Date.now();
    const label = caption();
    encoding = true;
    scratch.toBlob(
      (blob) => {
        encoding = false;
        if (blob === null || !enabled) return;
        frames.push({ seq: nextSeq++, at, wall, caption: label, blob });
        prune(performance.now());
      },
      'image/jpeg',
      NOTEBOOK_SETTINGS.jpegQuality,
    );
  };

  const send = (
    entry: string,
    files: { name: string; data: ArrayBuffer }[],
  ): Promise<NotebookStatus> => {
    const requestId = nextRequestId++;
    return new Promise((resolve) => {
      pendingResults.set(requestId, resolve);
      deps.send({ type: 'notebookWrite', requestId, entry, files });
    });
  };

  const toast = (text: string): void => {
    if (!hasDom) return;
    if (toastNode === null) {
      toastNode = document.createElement('div');
      toastNode.setAttribute('role', 'status');
      toastNode.dataset.testid = 'carnet-avis';
      Object.assign(toastNode.style, {
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: '2147483647',
        maxWidth: '360px',
        padding: '10px 14px',
        borderRadius: '10px',
        background: 'rgba(14, 17, 38, 0.92)',
        color: '#F4F1EA',
        font: '500 14px/1.4 system-ui, sans-serif',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
        pointerEvents: 'none',
      });
      document.body.append(toastNode);
    }
    toastNode.textContent = text;
    toastNode.hidden = false;
    if (toastTimer !== undefined) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (toastNode !== null) toastNode.hidden = true;
    }, NOTEBOOK_SETTINGS.toastMs);
  };

  const phaseOf = (note: PendingNote, at: number): Phase =>
    at <= note.openedAt ? 'avant' : at <= note.sentAt ? 'saisie' : 'apres';

  const frameName = (note: PendingNote, frame: Frame): string =>
    `${pad(frame.seq % 10_000, 4)}-${offsetName(frame.at - note.openedAt)}.jpg`;

  const frameFiles = async (
    note: PendingNote,
    list: readonly Frame[],
  ): Promise<{ name: string; data: ArrayBuffer }[]> => {
    for (const frame of list) note.sent.add(frame);
    return Promise.all(
      list.map(async (frame) => ({
        name: frameName(note, frame),
        data: await frame.blob.arrayBuffer(),
      })),
    );
  };

  /** Planche contact: jusqu'à 24 images réparties sur toute la note, légendées par leur écart. */
  const contactSheet = async (
    note: PendingNote,
    list: readonly Frame[],
  ): Promise<ArrayBuffer | null> => {
    const first = list[0];
    if (first === undefined) return null;
    const cells = NOTEBOOK_SETTINGS.sheetColumns * NOTEBOOK_SETTINGS.sheetRows;
    const picked: Frame[] = [];
    for (let i = 0; i < Math.min(cells, list.length); i++) {
      const frame =
        list[Math.round((i * (list.length - 1)) / Math.max(1, Math.min(cells, list.length) - 1))];
      if (frame !== undefined) picked.push(frame);
    }
    const bitmap = await createImageBitmap(first.blob);
    const cellWidth = NOTEBOOK_SETTINGS.sheetCellWidth;
    const cellHeight = Math.round((bitmap.height * cellWidth) / bitmap.width);
    bitmap.close();
    const rows = Math.ceil(picked.length / NOTEBOOK_SETTINGS.sheetColumns);
    const sheet = document.createElement('canvas');
    sheet.width = cellWidth * NOTEBOOK_SETTINGS.sheetColumns;
    sheet.height = cellHeight * rows;
    const context = sheet.getContext('2d');
    if (context === null) return null;
    context.fillStyle = '#0E1126';
    context.fillRect(0, 0, sheet.width, sheet.height);
    for (const [index, frame] of picked.entries()) {
      const image = await createImageBitmap(frame.blob);
      const x = (index % NOTEBOOK_SETTINGS.sheetColumns) * cellWidth;
      const y = Math.floor(index / NOTEBOOK_SETTINGS.sheetColumns) * cellHeight;
      context.drawImage(image, x, y, cellWidth, cellHeight);
      image.close();
      const offset = frame.at - note.openedAt;
      const label = `${offsetLabel(offset)} ${PHASE_LABELS[phaseOf(note, frame.at)]}`;
      context.font = 'bold 15px system-ui, sans-serif';
      const width = context.measureText(label).width + 12;
      context.fillStyle = offset < 0 ? 'rgba(14, 17, 38, 0.8)' : 'rgba(150, 30, 30, 0.85)';
      context.fillRect(x + 4, y + 4, width, 22);
      context.fillStyle = '#FFFFFF';
      context.fillText(label, x + 10, y + 20);
      context.strokeStyle = '#0E1126';
      context.strokeRect(x + 0.5, y + 0.5, cellWidth - 1, cellHeight - 1);
    }
    const blob = await new Promise<Blob | null>((resolve) => {
      sheet.toBlob(resolve, 'image/jpeg', 0.75);
    });
    return blob === null ? null : blob.arrayBuffer();
  };

  const imagesIndex = (note: PendingNote, list: readonly Frame[]): string =>
    `${JSON.stringify(
      list.map((frame) => ({
        fichier: `images/${frameName(note, frame)}`,
        ecartMs: Math.round(frame.at - note.openedAt),
        phase: phaseOf(note, frame.at),
        heure: new Date(frame.wall).toISOString(),
        legende: frame.caption,
      })),
      null,
      2,
    )}\n`;

  const json = (value: unknown): ArrayBuffer =>
    encoder.encode(`${JSON.stringify(value, null, 2)}\n`).buffer;

  const submit = async (note: PendingNote, text: string): Promise<void> => {
    note.sentAt = performance.now();
    const sentWall = Date.now();
    const before = frames.filter((frame) => frame.at >= note.openedAt - NOTEBOOK_SETTINGS.beforeMs);
    const description = deps.describe();
    const sentCaption = caption();
    const lines = [
      'Note du carnet de séance',
      '',
      `Ouverte le ${frenchDate(note.openedWall)}, enregistrée à ${frenchDate(sentWall).slice(-8)} (heure de la machine)`,
      `Jeu: ${textOf(description.jeu)}, rôle: ${textOf(description.role)}, joueur: ${textOf(description.joueur)}`,
      `Dans le jeu à l'ouverture: ${note.caption || '(non fourni)'}`,
      `Dans le jeu à l'envoi: ${sentCaption || '(non fourni)'}`,
      '',
      'Message:',
      text,
      '',
      `Images: ${String(before.filter((f) => f.at <= note.openedAt).length)} avant, ${String(before.filter((f) => f.at > note.openedAt).length)} pendant la saisie, puis 10 s après (planche.jpg et images/).`,
      '',
    ];
    const files = [
      { name: 'note.txt', data: encoder.encode(lines.join('\n')).buffer },
      {
        name: 'etat.json',
        data: json({
          texte: text,
          ouverteLe: new Date(note.openedWall).toISOString(),
          envoyeeLe: new Date(sentWall).toISOString(),
          ...description,
          legendeOuverture: note.caption,
          legendeEnvoi: sentCaption,
          etatOuverture: note.snapshot,
          etatEnvoi: safeJson(source?.snapshot?.()),
          erreurs: errors,
          journal: logs,
          evenements: traces,
        }),
      },
      ...(await frameFiles(note, before)),
    ];
    const status = await send(note.entry, files);
    if (status !== 'ok') {
      notes.delete(note);
      toast(
        status === 'disabled'
          ? 'Le carnet est coupé: note non enregistrée.'
          : "La note n'a pas pu être enregistrée.",
      );
      return;
    }
    toast("Note enregistrée. Encore 10 s d'images, le jeu continue.");
    note.finish = async (): Promise<void> => {
      note.finish = null;
      if (note.timer !== undefined) clearTimeout(note.timer);
      const all = frames.filter(
        (frame) =>
          frame.at >= note.openedAt - NOTEBOOK_SETTINGS.beforeMs &&
          frame.at <= note.sentAt + NOTEBOOK_SETTINGS.afterMs,
      );
      const after = all.filter((frame) => !note.sent.has(frame));
      const sheet = await contactSheet(note, all).catch(() => null);
      const last = [
        ...(await frameFiles(note, after)),
        { name: 'images.json', data: encoder.encode(imagesIndex(note, all)).buffer },
        ...(sheet === null ? [] : [{ name: 'planche.jpg', data: sheet }]),
      ];
      notes.delete(note);
      const done = await send(note.entry, last);
      if (done === 'ok') toast('Note complète dans Documents > Duo > carnet-de-seance.');
    };
    note.timer = setTimeout(() => {
      void note.finish?.();
    }, NOTEBOOK_SETTINGS.afterMs + 400);
  };

  const openNote = (): void => {
    if (typing !== null || source === null) return;
    const note: PendingNote = {
      entry: `n${Date.now().toString(36)}-${(nextEntry++).toString(36)}`,
      openedAt: performance.now(),
      openedWall: Date.now(),
      caption: caption(),
      snapshot: safeJson(source.snapshot?.()),
      sentAt: Infinity,
      sent: new Set(),
      timer: undefined,
      finish: null,
    };
    notes.add(note);
    deps.releaseKeys();
    if (document.pointerLockElement !== null) document.exitPointerLock();
    deps.send({ type: 'notebookTyping', active: true });

    const panel = document.createElement('div');
    panel.dataset.testid = 'carnet-note';
    Object.assign(panel.style, {
      position: 'fixed',
      left: '50%',
      bottom: '24px',
      transform: 'translateX(-50%)',
      zIndex: '2147483647',
      width: 'min(560px, calc(100vw - 32px))',
      padding: '12px 14px',
      borderRadius: '12px',
      background: 'rgba(14, 17, 38, 0.94)',
      color: '#F4F1EA',
      font: '500 14px/1.4 system-ui, sans-serif',
      boxShadow: '0 6px 24px rgba(0, 0, 0, 0.4)',
    });
    const title = document.createElement('div');
    title.textContent = "Note pour le studio (les 10 s d'avant sont gardées)";
    Object.assign(title.style, { fontWeight: '700', marginBottom: '6px' });
    const area = document.createElement('textarea');
    area.dataset.testid = 'carnet-texte';
    area.rows = 3;
    area.maxLength = NOTEBOOK_SETTINGS.maxTextLength;
    area.placeholder = 'Ce que tu vois: un bug, une idée...';
    area.setAttribute('aria-label', 'Note pour le studio');
    Object.assign(area.style, {
      display: 'block',
      boxSizing: 'border-box',
      width: '100%',
      resize: 'none',
      padding: '8px',
      borderRadius: '8px',
      border: '1px solid rgba(244, 241, 234, 0.35)',
      background: 'rgba(255, 255, 255, 0.08)',
      color: 'inherit',
      font: 'inherit',
      outline: 'none',
    });
    const hint = document.createElement('div');
    hint.textContent =
      'Entrée: enregistrer. Maj+Entrée: nouvelle ligne. Échap: annuler. Le jeu continue.';
    Object.assign(hint.style, { opacity: '0.75', fontSize: '12px', marginTop: '6px' });
    panel.append(title, area, hint);

    const close = (): void => {
      typing = null;
      panel.remove();
      deps.send({ type: 'notebookTyping', active: false });
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    };
    area.addEventListener('keydown', (event) => {
      // Les touches de la note ne vont pas au jeu (son interface écoute aussi le clavier).
      event.stopPropagation();
      if (event.code === 'Escape') {
        event.preventDefault();
        notes.delete(note);
        close();
        toast('Note annulée.');
      } else if (
        (event.code === 'Enter' || event.code === 'NumpadEnter') &&
        !event.shiftKey &&
        !event.isComposing
      ) {
        event.preventDefault();
        const text = area.value.trim();
        close();
        if (text === '') {
          notes.delete(note);
          toast("Note vide: rien d'enregistré.");
          return;
        }
        void submit(note, text);
      }
    });
    area.addEventListener('keyup', (event) => {
      event.stopPropagation();
    });
    typing = { note, close };
    document.body.append(panel);
    area.focus();
  };

  const setEnabled = (next: boolean): void => {
    enabled = next;
    if (!next) {
      frames.length = 0;
      typing?.close();
    }
    deps.send({ type: 'notebookEnable', enabled: next });
    toast(
      next
        ? 'Carnet de séance activé: Ctrl+N pour écrire une note.'
        : 'Carnet de séance coupé (Ctrl+Maj+N pour le rallumer).',
    );
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (
      event.code !== SHORTCUT_CODE ||
      !event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.repeat
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    if (event.shiftKey) {
      setEnabled(!enabled);
    } else if (enabled) {
      openNote();
    } else {
      toast('Carnet de séance coupé: Ctrl+Maj+N pour le rallumer.');
    }
  };

  const install = (): void => {
    window.addEventListener('keydown', onKeyDown, { capture: true });
    cleanups.push(() => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
    });
    // Dernières erreurs de la console, recopiées sans rien changer à l'affichage.
    // Seul endroit du SDK qui touche la console: il la lit, il n'y écrit rien de plus.
    /* eslint-disable no-console -- lecture des erreurs de la console pour le carnet */
    for (const level of ['error', 'warn'] as const) {
      const original = console[level].bind(console);
      console[level] = (...args: unknown[]): void => {
        record(errors, NOTEBOOK_SETTINGS.errors, `console.${level}`, args.map(textOf).join(' '));
        original(...args);
      };
      cleanups.push(() => {
        console[level] = original;
      });
    }
    /* eslint-enable no-console -- fin de la lecture de la console */
    const onError = (event: ErrorEvent): void => {
      record(errors, NOTEBOOK_SETTINGS.errors, 'erreur', textOf(event.error ?? event.message));
    };
    const onRejection = (event: PromiseRejectionEvent): void => {
      record(errors, NOTEBOOK_SETTINGS.errors, 'promesse', textOf(event.reason));
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    cleanups.push(() => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    });
  };

  return {
    get available() {
      return available;
    },
    get enabled() {
      return enabled;
    },
    get typing() {
      return typing !== null;
    },
    attach(next) {
      if (!available) return () => undefined;
      const first = source === null;
      source = next;
      if (first) {
        install();
        if (enabled) toast('Carnet de séance actif: Ctrl+N pour noter ce que tu vois.');
      }
      const detach: Unsubscribe = () => {
        if (source === next) source = null;
      };
      return detach;
    },
    trace(event, data) {
      if (!enabled) return;
      record(traces, NOTEBOOK_SETTINGS.traces, 'jeu', event, data);
    },
    afterRender() {
      if (!enabled || source === null || encoding) return;
      const now = performance.now();
      if (now - lastCapture < 1000 / NOTEBOOK_SETTINGS.framesPerSecond) return;
      lastCapture = now;
      try {
        capture();
      } catch {
        // Une capture manquée ne doit jamais gêner la partie.
        encoding = false;
      }
    },
    receiveResult(requestId, status) {
      const resolve = pendingResults.get(requestId);
      pendingResults.delete(requestId);
      resolve?.(status);
    },
    recordLog(level, message, data) {
      if (!enabled) return;
      record(logs, NOTEBOOK_SETTINGS.logs, `log.${level}`, message, data);
    },
    async flush() {
      typing?.close();
      await Promise.all(
        [...notes].map((note) => (note.finish === null ? Promise.resolve() : note.finish())),
      );
    },
    dispose() {
      typing?.close();
      for (const note of notes) if (note.timer !== undefined) clearTimeout(note.timer);
      notes.clear();
      if (toastTimer !== undefined) clearTimeout(toastTimer);
      toastNode?.remove();
      toastNode = null;
      for (const cleanup of cleanups.splice(0).reverse()) cleanup();
      frames.length = 0;
      pendingResults.clear();
      source = null;
    },
  };
}
