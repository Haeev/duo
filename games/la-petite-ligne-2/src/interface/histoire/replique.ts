/**
 * Répliques des scènes (`sceneView`, temps `say`): le bandeau bas du dialogue (interface.md, 5.2)
 * repris tel quel (portrait, plaque du nom, texte lettre par lettre, trois lignes par page), plus
 * ce qui est propre à une scène vue à deux: qui a lu (jetons), l'attente de l'autre, la réplique
 * qui ne s'adresse qu'à l'un des deux. Espace (ou Entrée, ou un clic) affiche tout, tourne la
 * page, puis envoie `scene_next`; la réplique passe quand les deux l'ont lue, le délai de la
 * simulation n'est qu'un filet de sécurité. S'y ajoutent le fondu au noir et le titre de la scène.
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { ReadonlyWorld } from '../../etat/monde';
import type { Intent } from '../../simulation/noyau/entrees';
import type { BabbleInfo } from '../dialogue';
import { el, setText, show, toggle } from '../dom';
import { paginate, Typewriter } from '../modeles';
import { portraitMarkup, silhouettePortraitMarkup } from '../portrait';
import { TEXTS, fill } from '../textes';
import { sceneScreenModel, type SceneLineModel, type SceneScreenModel } from './modele';
import { HISTOIRE_SETTINGS } from './reglages';
import { HISTOIRE_TEXTS } from './textes';
import './histoire.css';

const T = HISTOIRE_TEXTS.line;

export interface SceneLineOptions {
  readonly root: HTMLElement;
  readonly content: Content;
  readonly send: (intent: Intent) => void;
  readonly keyLabel: (code: string) => string;
  readonly reduced: () => boolean;
  readonly onBabble: (info: BabbleInfo) => void;
  /** Anti-double-appui à l'arrivée d'une réplique (ms). */
  readonly openGuardMs: number;
  /** Un écran qui prend le clavier est ouvert (dialogue, carnet, fin de chapitre): le bandeau attend. */
  readonly busy: () => boolean;
}

export interface SceneLine {
  frame(world: ReadonlyWorld, me: PlayerIndex, now: number, dtMs: number): void;
  /** Touche lue (vrai: consommée). Espace et Entrée seulement, quand une réplique est à lire. */
  key(code: string, now: number): boolean;
  /** Une réplique à lire ou l'écran noir: ni déplacement ni touche d'action pour le monde. */
  capturing(): boolean;
  /** Une scène se joue hors d'une attente: la bulle d'action se retire. */
  hidesPrompt(): boolean;
  /** Une scène se joue: le HUD se fait discret. */
  inScene(): boolean;
  dispose(): void;
}

function speakerName(line: SceneLineModel): string {
  if (line.speaker.kind === 'narrator') return T.narrator;
  return line.speaker.name;
}

/** Portrait en silhouette des joueurs pas encore révélés (le même pour les deux). */
const HIDDEN_PORTRAIT = 'ombre';

/** Identifiant du portrait: l'habitant, le portrait d'essai des joueurs, ou leur silhouette. */
function portraitId(line: SceneLineModel): string | null {
  if (line.speaker.kind === 'villager') return line.speaker.id;
  if (line.speaker.kind === 'player')
    return line.speaker.hidden ? HIDDEN_PORTRAIT : `joueur-${String(line.speaker.player)}`;
  return null;
}

export function createSceneLine(options: SceneLineOptions): SceneLine {
  const { root, send, keyLabel, reduced, onBabble, openGuardMs, busy } = options;

  // Fondu: sous le bandeau, au-dessus du monde et du HUD.
  const fade = el('div', { class: 'scene-fade', 'aria-hidden': 'true' });
  root.append(fade);

  const titleText = el('b');
  const title = el('div', { class: 'scene-title', role: 'status' }, [
    el('span', { class: 'scene-title__eyebrow', text: T.sceneEyebrow }),
    titleText,
  ]);

  const bust = el('div', { class: 'dlg__bust' });
  const mark = el('span', { class: 'scene-line__mark', 'aria-hidden': 'true' });
  const provisional = el('span', {
    class: 'provisoire provisoire--bust',
    text: TEXTS.dialogue.provisional,
  });
  const plateToken = el('i', { class: 'token' });
  const plateName = el('span');
  const plate = el('div', { class: 'dlg__plate' }, [plateToken, plateName]);
  const only = el('span', { class: 'scene-line__only', text: T.onlyYou });
  const sound = el('span', { class: 'scene-line__sound' });
  const text = el('p', { class: 'dlg__text', 'aria-live': 'polite' });
  const reads = el('ul', { class: 'scene-line__reads' });
  const nextKey = el('span', { class: 'key' });
  const next = el('div', { class: 'dlg__next' }, [nextKey, el('i')]);
  const wait = el('p', { class: 'scene-line__wait', 'aria-live': 'polite' });
  const band = el('section', { class: 'dlg scene-line', 'aria-label': T.label }, [
    bust,
    mark,
    provisional,
    plate,
    only,
    sound,
    text,
    reads,
    next,
    wait,
  ]);

  const otherTitle = el('b');
  const otherHint = el('span');
  const otherCard = el('div', { class: 'scene-other', role: 'status' }, [
    el('i', { class: 'token token--other', 'aria-hidden': 'true' }),
    el('span', { class: 'scene-other__text' }, [otherTitle, otherHint]),
  ]);

  const layer = el('div', { class: 'scene-say' }, [title, otherCard, band]);
  root.append(layer);
  band.hidden = true;
  otherCard.hidden = true;
  title.hidden = true;

  let model: SceneScreenModel | null = null;
  let beatKey = '';
  let sceneKey = '';
  let bustKey = '';
  let titleUntil = 0;
  let openedAt = 0;
  let pages: string[] = [];
  let page = 0;
  /** `scene_next` est parti pour cette réplique: on montre « lu » sans attendre l'hôte. */
  let sent = false;
  let bandShown = false;
  let black = false;
  let speakerId = '';
  const writer = new Typewriter((char) => {
    if (speakerId !== '') onBabble({ villager: speakerId, char });
  });

  function readByMe(line: SceneLineModel): boolean {
    return sent || line.readByMe;
  }

  function startPage(): void {
    writer.start(pages[page] ?? '', reduced());
    setText(text, writer.visible);
  }

  function setupLine(line: SceneLineModel, now: number): void {
    openedAt = now;
    sent = false;
    speakerId = line.speaker.kind === 'villager' ? line.speaker.id : '';
    const id = portraitId(line);
    const nextBust = `${id ?? '-'}:${line.mood}`;
    if (nextBust !== bustKey) {
      bustKey = nextBust;
      bust.innerHTML =
        id === null
          ? ''
          : id === HIDDEN_PORTRAIT
            ? silhouettePortraitMarkup()
            : portraitMarkup(id, line.mood);
    }
    band.dataset.speaker = line.speaker.kind;
    band.dataset.audience = line.audience;
    show(bust, id !== null);
    show(provisional, id !== null);
    setText(plateName, speakerName(line));
    show(plateToken, line.speaker.kind === 'player');
    toggle(plateToken, 'token--other', line.speaker.kind === 'player' && !line.speaker.me);
    setText(mark, line.mark ?? '');
    show(mark, line.mark !== null && id !== null);
    setText(sound, line.sound ?? '');
    show(sound, line.sound !== null);
    show(only, line.audience === 'me');
    setText(nextKey, keyLabel('Space'));
    pages = paginate(line.text);
    page = 0;
    startPage();
  }

  function drawReads(line: SceneLineModel, otherName: string): void {
    const mine = readByMe(line);
    const both = line.audience === 'both';
    reads.hidden = !both;
    if (both) {
      const signature = `${String(mine)}:${String(line.readByOther)}:${otherName}`;
      if (reads.dataset.sig !== signature) {
        reads.dataset.sig = signature;
        reads.replaceChildren(
          el('li', { class: `scene-line__read${mine ? ' scene-line__read--done' : ''}` }, [
            el('i', { class: 'token', 'aria-hidden': 'true' }),
            el('span', { text: `${T.you}\u00a0: ${mine ? T.meRead : T.meReading}` }),
          ]),
          el(
            'li',
            { class: `scene-line__read${line.readByOther ? ' scene-line__read--done' : ''}` },
            [
              el('i', { class: 'token token--other', 'aria-hidden': 'true' }),
              el('span', {
                text: `${otherName}\u00a0: ${line.readByOther ? T.otherRead : T.otherReading}`,
              }),
            ],
          ),
        );
      }
    }
    const lastPage = page + 1 >= pages.length;
    const waiting = mine && both && !line.readByOther;
    show(next, writer.done && !(mine && lastPage));
    toggle(band, 'scene-line--waiting', waiting);
    setText(wait, waiting ? fill(T.waiting, { nom: otherName }) : '');
    show(wait, waiting);
  }

  /** Espace, Entrée ou clic: tout afficher, page suivante, puis « lu ». */
  function advance(now: number): void {
    const line = model?.line ?? null;
    if (line === null || !bandShown || now - openedAt < openGuardMs) return;
    if (!writer.done) {
      writer.revealAll();
      setText(text, writer.visible);
    } else if (page + 1 < pages.length) {
      page += 1;
      startPage();
    } else if (!readByMe(line)) {
      sent = true;
      send({ type: 'scene_next' });
    }
    if (model !== null) drawReads(line, model.otherName);
  }

  let clock = 0;
  band.addEventListener('click', () => {
    advance(clock);
  });

  function hideLine(): void {
    if (bandShown) band.hidden = true;
    bandShown = false;
    otherCard.hidden = true;
  }

  return {
    frame(world, me, now, dtMs) {
      clock = now;
      model = sceneScreenModel(world, options.content, me);
      const blocked = busy();
      layer.classList.toggle('scene-say--busy', blocked);
      if (model === null) {
        hideLine();
        title.hidden = true;
        black = false;
        toggle(fade, 'scene-fade--black', false);
        beatKey = '';
        sceneKey = '';
        return;
      }
      if (model.scene !== sceneKey) {
        sceneKey = model.scene;
        titleUntil = now + HISTOIRE_SETTINGS.sceneTitleMs;
        setText(titleText, model.title);
      }
      show(title, now < titleUntil && !blocked);

      // Fondu: la durée est celle du temps de la scène quand c'en est un.
      black = model.fade === 'black';
      const ms =
        model.fadeSeconds === null
          ? HISTOIRE_SETTINGS.fadeFallbackMs
          : Math.round(model.fadeSeconds * 1000);
      const duration = `${String(ms)}ms`;
      if (fade.style.transitionDuration !== duration) fade.style.transitionDuration = duration;
      toggle(fade, 'scene-fade--black', black);

      const line = model.line;
      const key = `${model.scene}:${String(model.beat)}`;
      if (line === null || blocked) {
        hideLine();
        if (line === null) beatKey = '';
        return;
      }
      if (line.audience === 'other') {
        if (bandShown) band.hidden = true;
        bandShown = false;
        beatKey = key;
        setText(otherTitle, fill(T.otherOnly, { nom: model.otherName }));
        setText(otherHint, fill(T.otherOnlyHint, { nom: model.otherName }));
        show(otherCard, true);
        return;
      }
      otherCard.hidden = true;
      if (key !== beatKey) {
        beatKey = key;
        setupLine(line, now);
      }
      if (!bandShown) {
        bandShown = true;
        band.hidden = false;
      }
      if (writer.advance(dtMs)) setText(text, writer.visible);
      toggle(bust, 'parle', !writer.done);
      drawReads(line, model.otherName);
    },
    key(code, now) {
      if (!bandShown || (code !== 'Space' && code !== 'Enter')) return false;
      advance(now);
      return true;
    },
    capturing() {
      return bandShown || (black && model !== null && !busy());
    },
    hidesPrompt() {
      return model !== null && model.kind !== 'await';
    },
    inScene() {
      return model !== null;
    },
    dispose() {
      fade.remove();
      layer.remove();
    },
  };
}
