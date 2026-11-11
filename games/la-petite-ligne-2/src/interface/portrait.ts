/**
 * Portrait d'un habitant ou d'un joueur. Les portraits dessinés à la plume sont dans
 * `assets/commun/interface/portraits/<id>.svg` (générés depuis `assets-src/interface-encre/
 * portraits/`): trois calques d'expression (neutre, content, soucieux) et une bouche (`.bouche`)
 * qui bouge pendant l'écriture (classe `parle`). L'expression se choisit par `mood`, ou par un
 * ancêtre: `data-expr="content|soucieux"`, ou l'humeur du marchand (`shop-bust--joy`, `--yes`,
 * `--no`); voir `plume.css`. Sans dessin, un substitut est généré depuis l'identifiant
 * (teintes stables) et se marque « provisoire » dans la fenêtre de dialogue.
 */
import { hueOf } from './pictos';
import './plume.css';

export type PortraitMood = 'neutre' | 'content' | 'soucieux';

const DRAWN = import.meta.glob<string>('../../assets/commun/interface/portraits/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const DRAWN_BY_ID = new Map(
  Object.entries(DRAWN).map(([path, svg]) => [path.slice(path.lastIndexOf('/') + 1, -4), svg]),
);

/** Les joueurs partagent le portrait d'essai `joueur` tant que l'éditeur n'en dessine pas. */
const PLAYER_IDS = /^(joueur|player)(-\d+)?$/;

let serial = 0;

/** Vrai si l'identifiant a un portrait dessiné (sinon: substitut provisoire). */
export function hasDrawnPortrait(id: string): boolean {
  return DRAWN_BY_ID.has(PLAYER_IDS.test(id) ? 'joueur' : id);
}

/**
 * Portrait d'un joueur dont l'apparence n'est pas encore révélée (avant la photo du prologue): un
 * buste d'une seule teinte sombre, sans traits, le même pour les deux joueurs.
 */
export function silhouettePortraitMarkup(): string {
  const fill = `fill="${SHADOW}" stroke="${SHADOW}" stroke-width="5" stroke-linejoin="bevel"`;
  return `<svg class="lpl-por lpl-por--ombre" viewBox="0 0 190 230" aria-hidden="true">
  <path d="M12 232l16-54 46-22h44l44 20 18 56z" ${fill}/>
  <path d="M80 128h32l2 32-18 14-18-14z" ${fill}/>
  <path d="M50 72l16-28 32-9 30 10 13 30-4 38-21 27-24 4-28-10-14-27z" ${fill}/>
</svg>`;
}

const SHADOW = '#2b2a36';
const SKINS = ['#f1c9a5', '#e0ac85', '#c68863', '#9a6646', '#6f4630'] as const;
const INK = '#2a2522';

export function portraitMarkup(id: string, mood?: PortraitMood): string {
  const drawn = DRAWN_BY_ID.get(PLAYER_IDS.test(id) ? 'joueur' : id);
  if (drawn !== undefined) {
    // Deux portraits dans la page (buste et miniature): chacun ses identifiants internes.
    serial += 1;
    const expr = mood === undefined ? '' : ` data-expr="${mood}"`;
    return drawn
      .trim()
      .replace(/__P__/g, `lpl-p${String(serial)}-`)
      .replace('<svg ', `<svg class="lpl-por"${expr} aria-hidden="true" `);
  }
  const h = hueOf(id);
  const skin = SKINS[h % SKINS.length] ?? SKINS[0];
  const hair = `hsl(${(h * 7) % 360} 35% ${20 + (h % 30)}%)`;
  const cloth = `hsl(${(h * 13) % 360} 40% 50%)`;
  const long = h % 2 === 0;
  const pen = (width: number): string =>
    `stroke="${INK}" stroke-width="${String(width)}" stroke-linejoin="bevel" stroke-linecap="round"`;
  const line = pen(5);
  const shade = `fill="${INK}" opacity="0.2"`;
  return `<svg viewBox="0 0 190 230" aria-hidden="true">
  ${long ? `<path d="M40 156l-6-74 22-48 42-14 42 14 20 52-6 70z" fill="${hair}" ${line}/>` : ''}
  <path d="M12 232l16-54 46-22h44l44 20 18 56z" fill="${cloth}" ${line}/>
  <path d="M118 156l44 20 18 56h-46z" ${shade}/>
  <path d="M74 158l22 24 22-24" fill="none" ${line}/>
  <path d="M80 128h32l2 32-18 14-18-14z" fill="${skin}" ${line}/>
  <path d="M80 140l32 6 1 14-17 14z" ${shade}/>
  <path d="M50 72l16-28 32-9 30 10 13 30-4 38-21 27-24 4-28-10-14-27z" fill="${skin}" ${line}/>
  <path d="M128 45l13 30-4 38-21 27 4-34 8-33z" ${shade}/>
  <path d="M44 86l6-38 28-23 34-2 27 17 9 42-17-20-26-9-25 4-20 9z" fill="${hair}" ${line}/>
  <path d="M112 23l27 17 9 42-17-20z" ${shade}/>
  <path d="M68 82l16-4M106 78l16 4M96 98l-4 13h8M86 150l8 8M94 148l8 10" fill="none" ${pen(4)}/>
  <circle cx="78" cy="94" r="5" fill="${INK}"/><circle cx="113" cy="94" r="5" fill="${INK}"/>
  <path d="M60 106l12-2 2 10-10 3z" fill="#e58f7c" opacity="0.6"/><path d="M118 104l12 2-4 11-10-3z" fill="#e58f7c" opacity="0.6"/>
  <ellipse class="bouche" cx="96" cy="124" rx="9" ry="5" fill="#7a2e2a" ${pen(3)}/>
</svg>`;
}
