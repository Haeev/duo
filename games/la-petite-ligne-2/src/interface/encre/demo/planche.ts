/**
 * Planche des composants du style encré: les classes du jeu, seules, avec leurs états (repos,
 * survol, enfoncé, focus, choisi, vide, refusé). Les états de souris sont forcés par les classes
 * `survol` et `enfonce`, que `encre.css` traite comme `:hover` et `:active`.
 */
import { formatEuros } from '../../../simulation/sac/argent';
import { azertyLabel } from '../../index';
import { itemThumb, spriteMarkup } from '../../pictos';
import './planche.css';

const ic = (id: string): string =>
  `<svg class="ic" aria-hidden="true"><use href="#lpl-i-${id}"/></svg>`;
const key = (code: string): string => `<span class="key">${azertyLabel(code)}</span>`;
const price = (cents: number, extra = ''): string =>
  `<span class="pastille shop-tile__price ${extra}"><span class="coin coin--sm"></span>${formatEuros(cents)}</span>`;

function frame(name: string, shape: string, label: string, dark = false): string {
  return `<div class="pl-cadre${dark ? ' pl-cadre--clair' : ''}" style="border-image: var(--cadre-${name}) var(--bi-${shape})">${label}</div>`;
}

function group(title: string, body: string, className = ''): string {
  return `<section class="pl-groupe ${className}"><h2>${title}</h2><div class="pl-rang">${body}</div></section>`;
}

const state = (label: string, body: string): string =>
  `<figure class="pl-etat">${body}<figcaption>${label}</figcaption></figure>`;

export function mountSheet(root: HTMLElement): void {
  const layer = document.createElement('div');
  layer.className = 'lpl-ui planche';
  const apple = itemThumb('pomme', 'Pomme');
  const axe = itemThumb('hache', 'Hache');
  const swatches = [
    ['--paper-raised', 'Papier'],
    ['--paper', 'Page'],
    ['--paper-sunken', 'Creux'],
    ['--ink', 'Encre'],
    ['--ink-muted', 'Encre douce'],
    ['--accent', 'Accent'],
    ['--stamp', 'Refus'],
    ['--primary', 'Fait'],
    ['--soft-green', 'Tilleul'],
    ['--soft-sky', 'Ciel'],
    ['--soft-ochre', 'Ocre'],
    ['--soft-rose', 'Rose'],
    ['--night', 'Nuit'],
  ]
    .map(
      ([name, label]) =>
        `<figure class="pl-teinte"><i style="background: var(${name ?? ''})"></i><figcaption>${label ?? ''}</figcaption></figure>`,
    )
    .join('');

  layer.innerHTML = `${spriteMarkup()}
  <header class="pl-tete"><h1>Style encré : planche des composants</h1></header>
  <div class="pl-grille">
  ${group(
    'Cadres',
    [
      frame('grand-papier-ombre', 'grand-ombre', 'Panneau'),
      frame('moyen-papier-ombre', 'moyen-ombre', 'Bulle'),
      frame('petit-papier', 'petit', 'Carte'),
      frame('petit-creux', 'petit', 'Creux'),
      frame('petit-tirets', 'petit', 'Vide'),
      frame('petit-accent-ombre', 'petit-ombre', 'Choisi'),
      frame('moyen-ciel', 'moyen', 'Vitrine'),
      frame('moyen-nuit-ombre', 'moyen-ombre', 'Nuit', true),
      frame('petit-encre', 'petit', 'Plein', true),
    ].join(''),
    'pl-groupe--large',
  )}
  ${group(
    'Boutons',
    [
      state('Repos', `<button class="btn" tabindex="-1">${key('KeyT')}Donner</button>`),
      state('Survol', `<button class="btn survol" tabindex="-1">${key('KeyT')}Donner</button>`),
      state('Enfoncé', `<button class="btn enfonce" tabindex="-1">${key('KeyT')}Donner</button>`),
      state(
        'Principal',
        `<button class="btn btn--primary" tabindex="-1">${key('Enter')}Suivre</button>`,
      ),
      state(
        'Focus',
        `<button class="btn btn--primary focus" tabindex="-1">${key('Enter')}Suivre</button>`,
      ),
      state(
        'Refusé',
        `<div class="pl-pile"><button class="shop-btn shop-btn--off" tabindex="-1">${key('Enter')}Acheter</button><p class="shop-why">${ic('refus')}Il te manque ${formatEuros(350)}</p></div>`,
      ),
    ].join(''),
    'pl-groupe--large',
  )}
  ${group(
    'Onglets',
    [
      `<button class="signet" tabindex="-1" aria-selected="false">${ic('sac')}<span>Sac</span></button>`,
      `<button class="signet" tabindex="-1" aria-selected="true">${ic('plume')}<span>Quêtes</span></button>`,
      `<button class="signet survol" tabindex="-1" aria-selected="false">${ic('gens')}<span>Habitants</span></button>`,
      `<button class="signet signet--soon" tabindex="-1" aria-selected="false">${ic('carte')}<span>Carte</span></button>`,
      `<button class="shop-bigtab" tabindex="-1" aria-selected="true">${ic('sac')}Acheter</button>`,
      `<button class="shop-bigtab" tabindex="-1" aria-selected="false">${ic('coffre')}Vendre</button>`,
    ].join(''),
  )}
  ${group(
    'Touches (AZERTY)',
    `<span class="pl-touches">${['KeyW', 'KeyA', 'KeyS', 'KeyD'].map(key).join('')}</span>
     <span class="pl-touches">${['KeyQ', 'KeyE'].map(key).join('')}</span>
     <span class="pl-touches">${['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].map(key).join('')}</span>
     <span class="pl-touches">${['KeyG', 'KeyC', 'Space', 'Enter', 'Backspace'].map(key).join('')}</span>`,
  )}
  ${group(
    'Vignettes',
    [
      state(
        'Repos',
        `<button class="tile" tabindex="-1">${apple}<span class="tile__badge pastille">4</span></button>`,
      ),
      state('Survol', `<button class="tile survol" tabindex="-1">${apple}</button>`),
      state(
        'Focus',
        `<button class="tile focus" tabindex="-1">${apple}<span class="tile__badge pastille pastille--full">10</span></button>`,
      ),
      state('Tenue', `<button class="tile tile--held" tabindex="-1">${axe}</button>`),
      state('Vide', `<button class="tile tile--empty" tabindex="-1"></button>`),
      state(
        'À vendre',
        `<button class="shop-tile shop-tile--ok" tabindex="-1">${apple}${price(120)}</button>`,
      ),
      state(
        'Trop cher',
        `<button class="shop-tile shop-tile--too-expensive" tabindex="-1">${axe}${price(4500, 'shop-tile__price--no')}</button>`,
      ),
      state(
        'Refusée',
        `<button class="shop-tile shop-tile--refused" tabindex="-1">${axe}<svg class="ic shop-tile__no" aria-hidden="true"><use href="#lpl-i-refus"/></svg></button>`,
      ),
    ].join(''),
    'pl-groupe--large',
  )}
  ${group(
    'Bulles et réponses',
    [
      `<div class="prompt">${key('Space')}<span class="prompt__verb">Cueillir</span></div>`,
      `<div class="prompt prompt--no">${key('Space')}<span class="prompt__verb">Ramasser</span><span class="prompt__why">Poches pleines</span></div>`,
      `<div class="dlg__plate">La cheffe de gare</div>`,
      `<div class="pl-pile"><button class="choice" tabindex="-1">Ça ira, merci.</button><button class="choice focus" tabindex="-1">Oui, avec plaisir !</button><button class="choice choice--fails" tabindex="-1"><span class="barre">${ic('goutte')}</span>Je sors du bain.</button></div>`,
    ].join(''),
    'pl-groupe--large',
  )}
  ${group(
    'Étapes et besoins',
    [
      state(
        'Suite de quête',
        `<span class="perles"><i class="perle perle--done"></i><i class="perle perle--done"></i><i class="perle perle--current"></i><i class="perle perle--todo"></i><i class="perle perle--todo"></i></span>`,
      ),
      state('Besoin', `<div class="need" style="--val: 72">${ic('bol')}</div>`),
      state('Bas', `<div class="need need--low" style="--val: 18">${ic('lune')}</div>`),
      state('Bonus', `<div class="need need--bonus" style="--val: 96">${ic('goutte')}</div>`),
      state(
        'Bourse',
        `<span class="purse"><span class="coin"></span>${formatEuros(21_450)}</span>`,
      ),
      state(
        'Joueurs',
        `<span class="pl-touches"><i class="token"></i><i class="token token--other"></i></span>`,
      ),
    ].join(''),
  )}
  ${group('Couleurs', swatches)}
  </div>`;
  root.append(layer);
}
