// Composants communs de l'identité « Étoile double » (docs/plateforme/identite-visuelle.md, section 11).
import { signal } from '@preact/signals';
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import cielSvg from '../../../../../design/identite/b/ciel.svg?raw';
import iconesSvg from '../../../../../design/identite/b/icones/icones.svg?raw';
import logoUrl from '../../../../../design/identite/b/logo/logo.svg';
import { PLAYER_APPEARANCES, PLAYER_COLORS, type PlayerColor } from '../../shared/players';
import type { GameAction, Profile, Toast } from '../../shared/state';
import { MOUSE_NAMES, gameToastText, keyLabel, t, toastText } from '../textes';
import { readKeyboardLayout, useEscape, useFocusTrap, useInitialFocus } from './keyboard';

export type IconName =
  | 'host'
  | 'join'
  | 'library'
  | 'back'
  | 'ready'
  | 'not-yet'
  | 'warning'
  | 'error'
  | 'success'
  | 'info'
  | 'pause'
  | 'resume'
  | 'keyboard'
  | 'save'
  | 'coop'
  | 'versus'
  | 'close'
  | 'network'
  | 'computer';

// L'attribut de style de la planche serait refusé par la CSP (style-src 'self'): la classe .sprite la masque.
const SPRITE = iconesSvg.replace(' style="display:none"', '');

/** Planche d'icônes, incluse une fois (identité, section 7). */
export function IconSprite(): JSX.Element {
  return <div class="sprite" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SPRITE }} />;
}

export function Icon({ name, size }: { name: IconName; size?: 'small' | 'large' }): JSX.Element {
  return (
    <svg class={`icone${size === undefined ? '' : ` icone-${size}`}`} aria-hidden="true">
      <use href={`#icon-${name}`} />
    </svg>
  );
}

export function Logo(): JSX.Element {
  return <img class="logo" src={logoUrl} alt="Duo" />;
}

/** Ciel figé, cinq étoiles scintillantes au plus (identité, section 3.3). */
export function Sky(): JSX.Element {
  return <div class="ciel" aria-hidden="true" dangerouslySetInnerHTML={{ __html: cielSvg }} />;
}

/** Symbole d'un joueur; à partir de 32 px, en jeton avec son anneau de halo (identité, 4.3). */
export function PlayerSymbol({
  color,
  size = 24,
}: {
  color: PlayerColor;
  size?: number;
}): JSX.Element {
  const appearance = PLAYER_APPEARANCES[color];
  const token = size >= 32;
  // Halo: anneau de rayon 0,47 fois la taille, trait de 3 % de la taille (1,5 px au moins).
  const strokeUnits = (Math.max(1.5, size * 0.03) * 24) / size;
  return (
    <svg
      class="symbole"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ color: `var(--player-${color})` }}
    >
      {token && (
        <circle
          class="halo"
          cx="12"
          cy="12"
          r={11.28}
          fill="none"
          stroke="currentColor"
          stroke-width={strokeUnits}
        />
      )}
      <path
        d={appearance.path}
        fill="currentColor"
        transform={token ? 'translate(4.56 4.56) scale(0.62)' : undefined}
      />
    </svg>
  );
}

export function PlayerName({ profile, self }: { profile: Profile; self: boolean }): JSX.Element {
  return (
    <span class="joueur">
      <PlayerSymbol color={profile.color} />
      <span class="joueur-nom">{profile.pseudo}</span>
      {self && <span class="texte-second"> {t.joueurs.toi}</span>}
    </span>
  );
}

export type ChipKind = 'ready' | 'not-yet' | 'waiting' | 'lost' | 'paused' | 'wants-resume';

export function Chip({ kind, label }: { kind: ChipKind; label: string }): JSX.Element {
  const icon: IconName =
    kind === 'ready' || kind === 'wants-resume'
      ? 'ready'
      : kind === 'lost'
        ? 'warning'
        : kind === 'paused'
          ? 'pause'
          : 'not-yet';
  return (
    <span class={`puce puce-${kind}`}>
      <Icon name={icon} size="small" />
      {label}
    </span>
  );
}

export function PlayerCard(props: {
  profile: Profile;
  self: boolean;
  role?: string | undefined;
  chip?: JSX.Element | undefined;
  testId: string;
}): JSX.Element {
  return (
    <div class="carte-joueur" data-testid={props.testId}>
      <PlayerSymbol color={props.profile.color} size={48} />
      <div class="carte-joueur-texte">
        <span class="carte-joueur-nom">
          {props.profile.pseudo}
          {props.self && <span class="texte-second"> {t.joueurs.toi}</span>}
        </span>
        {props.role !== undefined && <span class="texte-second">{props.role}</span>}
      </div>
      {props.chip}
    </div>
  );
}

/** Fenêtre de confirmation: titre en question, conséquence, action et retour (UX 0.6). */
export function Dialog(props: {
  title: string;
  children?: ComponentChildren;
  action?: { label: string; onClick: () => void; testId: string } | undefined;
  back: { label: string; onClick: () => void; testId: string };
  message?: string | undefined;
  /** Le bouton sûr a le focus quand l'action fait perdre quelque chose. */
  focusBack?: boolean;
}): JSX.Element {
  const panel = useRef<HTMLDivElement>(null);
  const actionRef = useInitialFocus<HTMLButtonElement>();
  const backRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(panel);
  useEscape(props.back.onClick);
  useEffect(() => {
    if (props.focusBack === true || props.action === undefined) backRef.current?.focus();
  }, [props.focusBack, props.action]);
  return (
    <div class="voile voile-fenetre">
      <div
        class="panneau fenetre"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="fenetre-titre"
        ref={panel}
        data-message={props.message}
      >
        <h2 id="fenetre-titre" class="titre-2">
          {props.title}
        </h2>
        {props.children}
        <div class="fenetre-actions">
          {props.action !== undefined && (
            <button
              type="button"
              class="bouton bouton-principal"
              ref={actionRef}
              data-testid={props.action.testId}
              onClick={props.action.onClick}
            >
              {props.action.label}
            </button>
          )}
          <button
            type="button"
            class={`bouton ${props.action === undefined ? 'bouton-principal' : 'bouton-secondaire'}`}
            ref={backRef}
            data-testid={props.back.testId}
            onClick={props.back.onClick}
          >
            {props.back.label}
          </button>
        </div>
      </div>
    </div>
  );
}

const keyboardLayout = signal<ReadonlyMap<string, string> | null>(null);
let layoutRequested = false;

function useKeyboardLayout(): ReadonlyMap<string, string> | null {
  if (!layoutRequested) {
    layoutRequested = true;
    void readKeyboardLayout().then((layout) => {
      keyboardLayout.value = layout;
    });
  }
  return keyboardLayout.value;
}

export function KeyCap({ label }: { label: string }): JSX.Element {
  return <kbd class="touche">{label}</kbd>;
}

/** Commandes d'un jeu, libellées selon la disposition réelle du clavier. */
export function ActionList({ actions }: { actions: readonly GameAction[] }): JSX.Element {
  const layout = useKeyboardLayout();
  return (
    <dl class="commandes">
      {actions.map((action) => (
        <div class="commande" key={action.id}>
          <dt>{action.label}</dt>
          <dd>
            {action.keys.map((code) => (
              <KeyCap key={code} label={keyLabel(code, layout)} />
            ))}
            {action.mouse.map((input) => (
              <KeyCap key={input} label={MOUSE_NAMES[input]} />
            ))}
          </dd>
        </div>
      ))}
      <div class="commande">
        <dt>{t.salon.pause}</dt>
        <dd>
          <KeyCap label={t.salon.echap} />
        </dd>
      </div>
    </dl>
  );
}

export function Toasts({ toasts }: { toasts: readonly Toast[] }): JSX.Element {
  return (
    <div class="notifications" aria-live="polite" role="status">
      {toasts.map((toast) => (
        <div class="notification" key={toast.id} data-testid="notification">
          <Icon
            name={
              toast.kind === 'joined' ||
              toast.kind === 'back' ||
              toast.kind === 'game-updated' ||
              toast.kind === 'game-installed'
                ? 'success'
                : 'info'
            }
          />
          <span>
            {'game' in toast
              ? gameToastText(toast.kind, toast.game, toast.version)
              : toastText(toast.kind, toast.name)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Choix de couleur: groupe de boutons radio, flèches pour changer (identité, section 11). */
export function ColorPicker(props: {
  value: PlayerColor;
  onChange: (color: PlayerColor) => void;
  taken: { color: PlayerColor; by: string } | null;
  labelId: string;
}): JSX.Element {
  const refs = useRef(new Map<PlayerColor, HTMLButtonElement>());
  const available = PLAYER_COLORS.filter((color) => color !== props.taken?.color);
  const move = (event: KeyboardEvent, current: PlayerColor): void => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (step === 0) return;
    event.preventDefault();
    const index = available.indexOf(current);
    const next = available[(index + step + available.length) % available.length];
    if (next !== undefined) {
      props.onChange(next);
      refs.current.get(next)?.focus();
    }
  };
  return (
    <div class="choix-couleur" role="radiogroup" aria-labelledby={props.labelId}>
      {PLAYER_COLORS.map((color) => {
        const appearance = PLAYER_APPEARANCES[color];
        const taken = props.taken?.color === color;
        const checked = props.value === color;
        return (
          <button
            key={color}
            type="button"
            role="radio"
            class="choix-couleur-option"
            aria-checked={checked}
            aria-label={
              taken
                ? `${appearance.label}, ${t.profil.prisePar(props.taken?.by ?? '')}`
                : appearance.label
            }
            disabled={taken}
            tabIndex={checked ? 0 : -1}
            data-testid={`couleur-${color}`}
            ref={(element) => {
              if (element === null) refs.current.delete(color);
              else refs.current.set(color, element);
            }}
            onClick={() => {
              props.onChange(color);
            }}
            onKeyDown={(event) => {
              move(event, color);
            }}
          >
            <PlayerSymbol color={color} size={32} />
            <span class="petit">
              {taken ? t.profil.prisePar(props.taken?.by ?? '') : appearance.symbolName}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Secondes restantes d'un décompte, mises à jour quatre fois par seconde. */
export function useCountdown(endsAt: number | null): number | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (endsAt === null) return undefined;
    const timer = setInterval(() => {
      setTick((tick) => tick + 1);
    }, 250);
    return () => {
      clearInterval(timer);
    };
  }, [endsAt]);
  if (endsAt === null) return null;
  // Heure lue à chaque rendu: une valeur gardée depuis le montage fausserait le premier chiffre.
  return Math.min(3, Math.max(1, Math.ceil((endsAt - Date.now()) / 1000)));
}

/** Heure courante, rafraîchie chaque seconde (durées affichées). */
export function useNow(active: boolean): number {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(() => {
      setTick((tick) => tick + 1);
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [active]);
  return Date.now();
}
