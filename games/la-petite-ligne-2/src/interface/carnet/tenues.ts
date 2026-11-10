/**
 * Onglet Tenues : seulement le point d'entrée vers l'éditeur de personnage (écrit par un autre
 * lot). Le bouton appelle `openEditor`; l'emplacement `[data-slot="editeur-personnage"]` est
 * celui où l'éditeur pourra se loger (aperçu en pied, rayons) sans toucher au carnet.
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { ReadonlyWorld } from '../../etat/monde';
import { el, icon } from '../dom';
import type { Tab, TabDeps } from './onglet';
import { CARNET_TEXTS } from './textes';

const T = CARNET_TEXTS.outfits;

export interface OutfitsModel {
  readonly name: string;
  /** Le personnage est déjà créé (sinon l'éditeur est celui de la première partie). */
  readonly created: boolean;
  readonly label: string;
}

export function outfitsModel(world: ReadonlyWorld, local: PlayerIndex): OutfitsModel {
  const me = world.players[local];
  return { name: me.name, created: me.look !== null, label: T.open };
}

export const OUTFIT_SLOT = 'editeur-personnage';

export function createOutfitsTab(deps: TabDeps, openEditor: () => void): Tab {
  return {
    render(world, local) {
      const model = outfitsModel(world, local);
      const slot = el(
        'div',
        { class: 'tenues-slot', 'data-slot': OUTFIT_SLOT, 'aria-label': T.slot },
        [icon('tenue', 'ic tenues-slot__ic'), el('p', { text: T.hint })],
      );
      const open = el('button', { class: 'btn btn--primary', tabindex: '-1' }, [
        el('span', { class: 'key', text: deps.keyLabel('Enter') }),
        model.label,
      ]);
      open.addEventListener('click', openEditor);
      return {
        left: [slot],
        right: [
          el('div', { class: 'detail detail--tenues' }, [
            icon('tenue', 'ic vide__ic'),
            el('h2', { text: T.title }),
            open,
          ]),
        ],
        full: false,
      };
    },
    signature(world, local) {
      return JSON.stringify(outfitsModel(world, local));
    },
    key(code) {
      if (code !== 'Enter') return false;
      openEditor();
      return true;
    },
    hints() {
      return [{ codes: ['Enter'], label: T.keys }];
    },
    closed() {
      // Rien à mémoriser.
    },
  };
}
