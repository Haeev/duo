import { createRandom } from '@duo/sdk/sim';
import { describe, expect, it } from 'vitest';
import { StateWatcher, type SoundRequest } from '../../audio/declencheurs';
import { AUDIO_SETTINGS } from '../../audio/reglages';
import type { GameNotification } from '../../etat/types';
import { hudState } from '../modele';
import { toastVisual } from '../notifications';
import { isRefusal, notificationSort, refusalTexts } from '../refus';
import { character, contentAndMap, started } from './aides';

const texts = { missingTemplate: 'Il manque: {missing}' };
const note = (text: string, key: string | null, kind: GameNotification['kind'] = 'message', id = 1): GameNotification => ({
  id,
  kind,
  text,
  hint: null,
  proposal: null,
  key,
  tick: 0,
});

describe('refus (revue S2)', () => {
  it('reconnaît les refus à leur clé, à la raison d’un refus de pose, et aux matériaux manquants', () => {
    for (const key of ['already_taken', 'bag_full', 'not_enough_money', 'placement_wall', 'placement_not_yours', 'corner_not_yours', 'corner_taken']) {
      expect(isRefusal(note('…', key), texts), key).toBe(true);
    }
    expect(isRefusal(note('Il manque: 2 planches, 1 clou', null), texts)).toBe(true);
    expect(notificationSort(note('Déjà pris par Sacha.', 'already_taken'), texts)).toBe('refusal');
  });

  it('laisse les bonnes nouvelles telles quelles', () => {
    for (const key of ['letter_received', 'quest_done', 'crate_deposited', 'corner_set', 'big_purchase_accepted', 'train_arrived']) {
      expect(isRefusal(note('…', key), texts), key).toBe(false);
    }
    expect(notificationSort(note('Du courrier', 'letter_received', 'letter'), texts)).toBe('letter');
    expect(isRefusal(note('Un texte composé', null), texts)).toBe(false);
  });

  it('accepte la sorte `refusal` si la simulation la donne un jour', () => {
    expect(isRefusal({ kind: 'refusal', key: null, text: 'Non.' }, texts)).toBe(true);
  });

  it('montre un refus de pose ou de coin avec le style d’erreur', () => {
    const { content } = contentAndMap();
    const refusal = refusalTexts(content.texts.raw);
    expect(toastVisual(note('Ça s’accroche au mur.', 'placement_wall'), content.texts.messages, refusal)).toMatchObject({ variant: 'error' });
    expect(toastVisual(note('Il manque: 2 planches', null), content.texts.messages, refusal)).toMatchObject({ variant: 'error' });
  });

  it('ne joue plus le carillon `notify` pour un refus, toujours pour une lettre', () => {
    const { content, map } = contentAndMap();
    const sim = started();
    const watcher = new StateWatcher(AUDIO_SETTINGS, createRandom(7));
    const ctx = { world: sim.world, local: 'p1' as const, content, map, peerDb: -6, hasSound: () => true };
    const frame = (): SoundRequest[] => {
      const out: SoundRequest[] = [];
      watcher.update(ctx, 1 / 60, 0, out, []);
      return out;
    };
    frame();
    const me = character(sim, 'p1');
    me.notifications.push(note('Déjà pris par Sacha.', 'already_taken', 'message', 900_001));
    expect(frame().some((r) => r.sound === 'notify')).toBe(false);
    me.notifications.push(note('Du courrier: Un mot', 'letter_received', 'letter', 900_002));
    expect(frame().some((r) => r.sound === 'notify')).toBe(true);
  });
});

describe('état du HUD (revue I1)', () => {
  it('met le HUD en aménagement quand un meuble est en main, sauf sous une couche ouverte', () => {
    expect(hudState(null, true)).toBe('build');
    expect(hudState(null, false)).toBeNull();
    expect(hudState('panel', true)).toBe('panel');
    expect(hudState('dialogue', true)).toBe('dialogue');
    expect(hudState('screen', true)).toBeNull();
  });
});
