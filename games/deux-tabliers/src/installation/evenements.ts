// Événements du chantier « installation » (hôte vers les deux machines: son, interface).
// Un type par son (`donnees/sons.json`): le rideau qui monte ou retombe, la chauffe, le carton.
import { v } from '@duo/sdk';

const Player = v.picklist([0, 1]);
const Name = v.pipe(v.string(), v.maxLength(60));
const Text = v.pipe(v.string(), v.maxLength(400));

export const INSTALLATION_EVENTS = [
  /** Le rideau de la porte remonte (à deux), puis ceux des vitrines. */
  v.strictObject({ type: v.literal('installation-shutter-up'), furniture: Name }),
  /** Le rideau retombe: seul, trop lourd; ou baissé pour la nuit. */
  v.strictObject({ type: v.literal('installation-shutter-down'), furniture: Name }),
  /** La machine raccordée commence à chauffer. */
  v.strictObject({ type: v.literal('installation-heat'), furniture: Name }),
  /** La soupape siffle: la machine est chaude. */
  v.strictObject({ type: v.literal('installation-hot'), furniture: Name }),
  /** Un carton de l'installation s'ouvre. */
  v.strictObject({
    type: v.literal('installation-unpack'),
    player: Player,
    furniture: Name,
    item: Name,
  }),
  /** Un geste fait (drap, courrier, balai, vitre, chaises, outil, raccord, carton rendu). */
  v.strictObject({
    type: v.literal('installation-gesture'),
    player: Player,
    gesture: v.picklist([
      'sheet',
      'mail',
      'sweep',
      'wipe',
      'chairs',
      'tool',
      'connect',
      'return',
      'buy',
    ]),
    furniture: Name,
  }),
  /** Un message dans le téléphone (courrier, Gaby, crédit). */
  v.strictObject({ type: v.literal('installation-message'), from: Name, text: Text }),
  /** Gaby a posé ses cartons sur le trottoir. */
  v.strictObject({ type: v.literal('installation-delivery'), cartons: v.number() }),
] as const;
