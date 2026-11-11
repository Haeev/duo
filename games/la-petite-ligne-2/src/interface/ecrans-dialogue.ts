/**
 * Écrans ouverts par une réplique de dialogue (champ `opens` du nœud, `donnees/_gabarits/
 * dialogue.jsonc`). La réplique se lit comme une autre; la touche qui passerait à la suite ouvre
 * l'écran chez ce joueur seulement, et sa fermeture envoie `talk_next`: le dialogue reprend. Rien
 * ne nomme un dialogue ici. Un écran de plus: son nom dans `DIALOGUE_SCREEN_IDS` (schéma du
 * dialogue) et son ouverture dans la table donnée à `createDialogueScreens`.
 */
import type { DialogueScreenId } from '../donnees/schemas/dialogue';
import type { TalkView } from '../simulation/dialogues/conversation';
import type { Intent } from '../simulation/noyau/entrees';

/** Un écran de l'interface qu'un dialogue peut ouvrir. */
export interface DialogueScreen {
  /** Ouvre l'écran; `false` s'il ne peut pas s'ouvrir (le dialogue continue alors sans lui). */
  open(): boolean;
  isOpen(): boolean;
}

export type DialogueScreenTable = Readonly<Record<DialogueScreenId, DialogueScreen>>;

export interface DialogueScreens {
  /** L'envoi à donner à la fenêtre de dialogue: il retient `talk_next` le temps de l'écran. */
  send(intent: Intent): void;
  /** À chaque image: l'écran ouvert par la réplique s'est fermé, le dialogue avance. */
  frame(): void;
}

function pageKey(view: TalkView): string {
  return `${view.villager}:${view.node}`;
}

export function createDialogueScreens(
  screens: DialogueScreenTable,
  /** La page de dialogue affichée chez ce joueur (`talkView`), `null`: aucune. */
  current: () => TalkView | null,
  send: (intent: Intent) => void,
): DialogueScreens {
  /** Page dont l'écran est ouvert, et cet écran. */
  let shown: { key: string; screen: DialogueScreen } | null = null;
  return {
    send(intent) {
      const next = intent.type === 'talk_next';
      // Écran ouvert: la réplique attend sa fermeture, une touche de suite ne la saute pas.
      if (next && shown !== null) return;
      const view = next ? current() : null;
      const wanted = view?.opens ?? null;
      if (view === null || wanted === null) {
        send(intent);
        return;
      }
      const screen = screens[wanted];
      if (screen.open()) shown = { key: pageKey(view), screen };
      else send(intent);
    },
    frame() {
      if (shown === null || shown.screen.isOpen()) return;
      const view = current();
      // Le dialogue a pu se fermer entre-temps (reprise, coupure): rien à faire avancer.
      if (view !== null && pageKey(view) === shown.key) send({ type: 'talk_next' });
      shown = null;
    },
  };
}
