// Le gabarit: l'invité envoie ses commandes, l'hôte simule et diffuse des instantanés, l'invité interpole.
import { connect, InputFrameSchema, v } from '@duo/sdk';
import manifest from '../duo-game.json';
import { REGLAGES } from './simulation/reglages';
import {
  AUCUNE_COMMANDE,
  avancer,
  creerMonde,
  type Commandes,
  type Monde,
} from './simulation/monde';

type Action = 'up' | 'down' | 'left' | 'right';

const AstreSchema = v.strictObject({ x: v.number(), y: v.number() });
const InstantaneSchema = v.strictObject({
  tick: v.number(),
  hote: AstreSchema,
  invite: AstreSchema,
});

const canvas = document.getElementById('scene');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('canvas #scene absent');
const context = canvas.getContext('2d');
if (context === null) throw new Error('contexte 2D indisponible');

const duo = await connect<Action>({ manifest });
const commandes = duo.net.channel(0, { mode: 'reliable', schema: InputFrameSchema });
const instantanes = duo.net.channel(1, { mode: 'latest', schema: InstantaneSchema });

let monde: Monde = creerMonde();
let precedent: Monde = structuredClone(monde);
let commandesInvite: Commandes = AUCUNE_COMMANDE;

if (duo.role === 'host') {
  const reprise = duo.saves.loaded?.data;
  const lu = v.safeParse(InstantaneSchema, reprise);
  if (lu.success) monde = lu.output;
  duo.saves.provide(() => ({ label: `Pas ${monde.tick}`, dataSchema: 1, data: monde }));
  commandes.onMessage((frame) => {
    commandesInvite = frame;
  });
} else {
  instantanes.onMessage((etat) => {
    precedent = monde;
    monde = etat;
  });
}

duo.reportLoading(1);
await duo.ready();
duo.input.attach(canvas);

function dessiner(alpha: number): void {
  if (context === null || !(canvas instanceof HTMLCanvasElement)) return;
  const ratio = window.devicePixelRatio;
  const largeur = Math.round(canvas.clientWidth * ratio);
  const hauteur = Math.round(canvas.clientHeight * ratio);
  if (canvas.width !== largeur || canvas.height !== hauteur) {
    canvas.width = largeur;
    canvas.height = hauteur;
  }
  const echelle = Math.min(largeur / REGLAGES.largeur, hauteur / REGLAGES.hauteur);
  context.fillStyle = '#0e1126';
  context.fillRect(0, 0, largeur, hauteur);
  const astres: [typeof monde.hote, typeof monde.hote, string][] = [
    [precedent.hote, monde.hote, duo.host.colorHex],
    [precedent.invite, monde.invite, duo.guest.colorHex],
  ];
  for (const [avant, apres, couleur] of astres) {
    const x = (avant.x + (apres.x - avant.x) * alpha) * echelle;
    const y = (avant.y + (apres.y - avant.y) * alpha) * echelle;
    context.fillStyle = couleur;
    context.beginPath();
    context.arc(x, y, 0.4 * echelle, 0, Math.PI * 2);
    context.fill();
  }
}

duo.loop.start({
  step: ({ dt }) => {
    if (duo.role === 'host') {
      precedent = structuredClone(monde);
      avancer(monde, duo.input.frame(), commandesInvite, dt);
      if (monde.tick % REGLAGES.pasParInstantane === 0) instantanes.send(monde);
    } else {
      commandes.send(duo.input.frame());
    }
  },
  // L'invité interpole entre les deux derniers instantanés; un vrai jeu ajoute un tampon (reseau.md, section 12.1).
  render: ({ alpha }) => {
    dessiner(duo.role === 'host' ? alpha : 1);
  },
});

duo.on('stop', () => {
  duo.dispose();
});
