/** Textes de l'écran de livraison et du carnet (commande de la semaine, courrier). Tutoiement. */
import type { OrderPay } from '../../donnees/schemas/commande';

export const ORDER_TEXTS = {
  title: 'Commande de la semaine',
  due: 'À livrer samedi, jour {jour}',
  dueToday: 'À livrer aujourd’hui, avant le départ du train',
  pay: {
    chest: 'Payé à la livraison, au coffre commun',
    deliverer: 'Payé à la livraison, dans ta bourse',
  } satisfies Record<OrderPay, string>,
  columns: { asked: 'Demandé', have: 'Tu as', price: 'Prix' },
  bag: 'sac {n}',
  store: 'consigne {n}',
  each: '{prix} pièce',
  delivered: 'Livré',
  deliveredOf: '{n} sur {max}',
  deliver: 'Livrer',
  deliverAll: 'Tout livrer',
  nothing: 'Il t’en manque',
  paid: '+{montant} aujourd’hui',
  empty: 'Rien à livrer cette semaine.',
  mailTitle: 'Courrier',
  mailWaiting: 'Prendre le courrier ({n})',
  mailNone: 'Pas de courrier en attente.',
  mailRead: 'Lettres reçues',
  enclosed: 'Dans l’enveloppe : {objet}',
  from: 'De : {nom}',
  keys: {
    pick: 'Choisir',
    act: 'Livrer, prendre, lire',
    all: 'Tout livrer',
    close: 'Fermer',
    back: 'Reposer la lettre',
  },
  carnet: {
    head: 'Commande du samedi, jour {jour}',
    headToday: 'Commande du samedi : le train est là',
    line: '{objet} × {n}',
    lineDone: '{objet} : c’est livré',
    mail: 'Courrier au train : {n}',
  },
  notice: 'Nouvelle commande du samedi au carnet',
  provisional: 'Provisoire : écran en attente de sa maquette',
  aria: {
    row: '{objet}: {livre} livrés sur {demande}, {prix} pièce, tu en as {as}',
  },
} as const;

/** Refus de l'écran de livraison (clés de la simulation). */
export const ORDER_REFUSALS: Readonly<Record<string, string>> = {
  'order-closed': 'Le train n’est pas là',
  'order-nothing': 'Il t’en manque',
  'order-line-done': 'Déjà livré',
  'order-unknown-line': 'Pas dans la commande',
  'mail-none': 'Pas de courrier',
};
