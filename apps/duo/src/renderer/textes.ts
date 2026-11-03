// Tous les textes de l'interface (ADR 0012, point 3), tels que la spécification UX
// les donne (docs/plateforme/ux/parcours.md): tutoiement, rédaction neutre.
// Les textes s'écrivent avec des espaces ordinaires; `fr` pose les espaces
// insécables, l'apostrophe typographique et les points de suspension (UX 0.3).
// Les noms variables (pseudos) ne sont jamais retouchés.
import type { GameMode, GameToastKind, ToastKind } from '../shared/state';

const NBSP = String.fromCharCode(0xa0);
const NNBSP = String.fromCharCode(0x202f);

/** Typographie française d'un texte littéral. */
export function typo(text: string): string {
  return text
    .replace(/'/g, '’')
    .replace(/\.\.\./g, '…')
    .replace(/« /g, `«${NBSP}`)
    .replace(/ »/g, `${NBSP}»`)
    .replace(/ :/g, `${NBSP}:`)
    .replace(/ ([;!?%])/g, `${NNBSP}$1`);
}

/** Gabarit étiqueté: typographie sur les parties littérales seulement. */
export function fr(strings: TemplateStringsArray, ...values: readonly (string | number)[]): string {
  let out = '';
  strings.forEach((part, index) => {
    out += typo(part);
    if (index < values.length) out += String(values[index]);
  });
  return out;
}

/** « de Sacha », « d’Inès », « d’Hélène » (UX 0.3). */
export function de(name: string): string {
  return /^[aeiouyhàâäéèêëîïôöùûüœæ]/i.test(name) ? `d’${name}` : `de ${name}`;
}

// Espace insécable entre un nombre et son unité: « 1 h 15 » ne se coupe jamais.
function minutes(value: number): string {
  if (value < 60) return `${value}${NBSP}min`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return rest === 0
    ? `${hours}${NBSP}h`
    : `${hours}${NBSP}h${NBSP}${String(rest).padStart(2, '0')}`;
}

/** « 20 à 40 min », « 45 min à 1 h 30 » (UX 0.3: jamais de tiret). */
export function durationRange([min, max]: readonly [number, number]): string {
  if (min === max) return minutes(min);
  if (max < 60) return `${min} à ${max}${NBSP}min`;
  return `${minutes(min)} à ${minutes(max)}`;
}

/** « 3 min 12 s », « 1 h 12 ». */
export function playedDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) return `${hours} h ${String(mins).padStart(2, '0')}`;
  if (mins > 0) return `${mins} min ${secs} s`;
  return `${secs} s`;
}

/** « 0:42 », compteur de la coupure (E12). */
export function clock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const;

/** « hier à 21 h 40 », « 12 octobre à 20 h 05 ». */
export function when(timestamp: number, now: number = Date.now()): string {
  const date = new Date(timestamp);
  const time = `${date.getHours()} h ${String(date.getMinutes()).padStart(2, '0')}`;
  const startOfDay = (value: Date): number =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((startOfDay(new Date(now)) - startOfDay(date)) / 86_400_000);
  if (days === 0) return typo(`aujourd'hui à ${time}`);
  if (days === 1) return `hier à ${time}`;
  return `${date.getDate()} ${MONTHS[date.getMonth()] ?? ''} à ${time}`;
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}${NNBSP}%`;
}

export const t = {
  nav: {
    accueil: 'Accueil',
    bibliotheque: 'Bibliothèque',
    reglages: 'Réglages',
    principale: 'Navigation principale',
  },
  joueurs: {
    toi: '(toi)',
    et: 'et',
    heberge: 'héberge',
    aRejointSalon: 'a rejoint le salon',
  },
  etapes: {
    liste: fr`Profil · Réseau · L'autre ordinateur`,
    lecteur: (step: number): string => `Étape ${step} sur 3`,
  },
  bienvenue: {
    titre: 'Bienvenue dans Duo',
    texte1: 'Duo sert à jouer à deux, sur deux ordinateurs, dans la même pièce.',
    texte2: fr`Trois étapes et c'est prêt : ton profil, le réseau, puis l'autre ordinateur.`,
    commencer: 'Commencer',
  },
  profil: {
    titre: fr`Comment veux-tu t'appeler ?`,
    champ: 'Pseudo',
    aide: fr`C'est le nom que l'autre ordinateur affichera. 16 caractères au plus.`,
    groupe: 'Ta couleur',
    aideCouleur: fr`Chaque couleur a son symbole : vous restez faciles à distinguer, même sans voir les couleurs.`,
    apercu: fr`Aperçu :`,
    erreurVide: fr`Choisis un pseudo d'au moins 1 caractère.`,
    erreurCaractere: fr`Ce caractère n'est pas accepté : utilise des lettres, des chiffres, des espaces, - ou '.`,
    compteur: (count: number): string => `${count} sur 16`,
    retour: 'Retour',
    continuer: 'Continuer',
    prisePar: (name: string): string => `Prise par ${name}`,
  },
  reseau: {
    windows: {
      titre: fr`Windows va te demander d'autoriser Duo`,
      texte: fr`Pour que vos deux ordinateurs se trouvent tout seuls, le pare-feu de Windows doit laisser passer Duo sur le réseau de la maison.`,
      consigne: [
        fr`Dans la fenêtre qui va s'ouvrir :`,
        fr`Laisse « Réseaux privés » coché.`,
        fr`Clique sur « Autoriser ».`,
        fr`Si Windows demande l'accord d'un administrateur, réponds « Oui ».`,
      ],
      attente: 'En attente de ta réponse à Windows…',
    },
    macos: {
      titre: fr`macOS va te demander d'autoriser Duo`,
      texte: fr`Pour que vos deux ordinateurs se trouvent tout seuls, Duo doit pouvoir parler aux appareils de ton réseau local, c'est-à-dire le Wi-Fi de la maison.`,
      consigne: [fr`Dans la fenêtre qui va s'ouvrir, clique sur « Autoriser ».`],
      attente: 'En attente de ta réponse à macOS…',
    },
    rassurer: fr`Duo n'utilise Internet que pour télécharger les jeux. Pendant vos parties, tout reste chez vous.`,
    retour: 'Retour',
    continuer: 'Continuer',
    passer: 'Passer cette étape',
    passerConsequence: fr`Sans cette autorisation, l'autre ordinateur ne te trouvera pas. Tu pourras la donner plus tard dans Réglages > Réseau.`,
  },
  recherche: {
    titre: fr`Cherchons l'autre ordinateur`,
    texte: fr`Ouvre Duo sur l'autre ordinateur : il apparaîtra ici tout seul.`,
    etat: 'Recherche en cours…',
    apres30s: fr`Toujours rien ? Vérifie que Duo est ouvert sur l'autre ordinateur et que les deux sont sur le même Wi-Fi.`,
    terminerSans: fr`Terminer sans l'autre ordinateur`,
    aideTerminerSans: fr`Tu pourras le retrouver plus tard depuis l'accueil.`,
    trouveTitre: (name: string): string => `${name} est là`,
    trouveTexte: 'Vous pouvez jouer ensemble.',
    terminer: 'Terminer',
    memeCouleur: (name: string): string =>
      fr`${name} a déjà cette couleur. Choisis-en une autre pour rester faciles à distinguer :`,
  },
  presence: {
    la: (name: string): string => `${name} est là`,
    absent: (name: string): string => fr`${name} n'est pas visible pour l'instant.`,
    personne: fr`Personne pour l'instant`,
    jouerEnsemble: 'Vous pouvez jouer ensemble.',
  },
  accueil: {
    heberger: 'Héberger',
    hebergerTexte: (name: string | null): string =>
      name === null
        ? fr`Tu choisis le jeu, l'autre ordinateur reçoit l'invitation.`
        : fr`Tu choisis le jeu, ${name} reçoit l'invitation.`,
    hebergerBouton: 'Héberger une partie',
    rejoindre: 'Rejoindre',
    rejoindreVide: (name: string | null): string =>
      fr`Aucune partie ouverte pour l'instant. Quand ${name ?? "l'autre ordinateur"} en ouvrira une, l'invitation apparaîtra ici.`,
    salonTrouve: (name: string): string => fr`${name} a ouvert un salon`,
    rejoindreBouton: 'Rejoindre',
  },
  invitation: {
    titre: (name: string): string => fr`${name} t'invite à jouer`,
    sauvegarde: (detail: string): string => fr`Sauvegarde : ${detail}`,
    nouvellePartie: 'Nouvelle partie',
    rejoindre: 'Rejoindre',
    plusTard: 'Plus tard',
  },
  jeu: {
    mode: (mode: GameMode): string => (mode === 'coop' ? 'Coopération' : 'Affrontement'),
  },
  bibliotheque: {
    titre: 'Bibliothèque',
    sousTitre: (name: string | null): string =>
      fr`Choisis un jeu, puis Entrée pour l'héberger avec ${name ?? "l'autre ordinateur"}.`,
    sousTitreAbsent: (name: string): string =>
      fr`${name} n'est pas visible : tu peux ouvrir le salon, l'invitation partira dès que ${name} sera là.`,
    vide: fr`Aucun jeu n'est installé pour l'instant.`,
    installerFichier: 'Installer un jeu depuis un fichier',
    retour: 'Retour',
  },
  reglages: {
    titre: 'Réglages',
    affichage: 'Affichage',
    pleinEcran: 'Plein écran',
    pleinEcranAide: (key: string): string =>
      fr`La touche ${key} fait la même chose à tout moment, même en partie. Duo s'en souvient au prochain lancement.`,
  },
  salon: {
    entete: (game: string): string => `Salon · ${game}`,
    fermer: 'Fermer le salon',
    quitter: 'Quitter le salon',
    echap: 'Échap',
    cestParti: fr`C'est parti !`,
    pasEncore: 'Pas encore',
    puces: {
      cestParti: fr`C'est parti`,
      pasEncore: 'Pas encore',
      enAttente: 'En attente…',
      connexionPerdue: 'Connexion perdue',
    },
    aide: fr`La partie commence dès que vous avez dit « C'est parti » sur les deux ordinateurs.`,
    aideInvite: (host: string): string =>
      fr`Tu as dit « C'est parti » en rejoignant. On attend ${host}.`,
    attente: (name: string): string => `Invitation envoyée à ${name}.`,
    attenteSansNom: fr`Invitation prête : elle partira dès que l'autre ordinateur sera là.`,
    sauvegarde: 'Sauvegarde',
    continuer: (label: string, at: string): string => fr`Continuer : ${label} (${at})`,
    nouvellePartie: 'Nouvelle partie',
    choisiePar: (host: string, detail: string): string =>
      fr`Sauvegarde choisie par ${host} : ${detail}`,
    sansSauvegarde: fr`Ce jeu ne garde pas de sauvegarde : chaque partie repart de zéro.`,
    commandes: 'Commandes',
    pause: 'Pause',
    nouveautes: {
      titre: 'Quoi de neuf',
      version: (version: string): string => `Version ${version} installée`,
      nouveau: 'Nouveau',
      toutesLesNotes: 'Toutes les notes',
      fenetreTitre: (game: string): string => `Notes de version · ${game}`,
      versionTitre: (version: string, title: string): string =>
        title === '' ? version : `${version} · ${title}`,
      fermer: 'Fermer',
    },
    decompte: (seconds: number): string => `La partie commence dans ${seconds}`,
    connexionPerdue: (name: string): string =>
      fr`Connexion perdue avec ${name}. Duo réessaie tout seul...`,
    fenetreFermer: {
      titre: fr`Fermer le salon ?`,
      texte: (name: string): string => fr`${name} reviendra à l'accueil.`,
      action: 'Fermer le salon',
      retour: 'Rester',
    },
    fenetreQuitter: {
      titre: fr`Quitter le salon ?`,
      texte: (host: string): string =>
        fr`${host} restera dans le salon et pourra t'inviter à nouveau.`,
      action: 'Quitter le salon',
      retour: 'Rester',
    },
  },
  chargement: {
    titre: (game: string): string => `Chargement · ${game}`,
    toi: (value: string): string => fr`Toi : ${value}`,
    autre: (name: string, value: string): string => fr`${name} : ${value}`,
    long: (name: string): string => `Le chargement prend du temps chez ${name}.`,
  },
  partie: {
    indice: fr`Échap : pause`,
  },
  pause: {
    titre: 'Pause',
    parAutre: (name: string): string => `Pause demandée par ${name}.`,
    parToi: 'Tu as mis la partie en pause.',
    parDeux: (name: string, other: string): string => `Pause demandée par ${name} et ${other}.`,
    reprendre: 'Reprendre',
    commandes: 'Commandes',
    retourSalon: 'Retour au salon',
    puces: { enPause: 'En pause', veutReprendre: 'Veut reprendre' },
    aide: fr`La partie reprend quand vous avez choisi « Reprendre » sur les deux ordinateurs.`,
    reprise: (seconds: number): string => `Reprise dans ${seconds}`,
    retourCommandes: 'Retour',
    retourAutre: (name: string): string => `${name} est de retour. Reprenez quand vous voulez.`,
  },
  arret: {
    titre: fr`Arrêter la partie ?`,
    texteParDefaut: 'Ce que vous avez fait depuis la dernière sauvegarde sera perdu.',
    action: 'Arrêter la partie',
    continuer: 'Continuer à jouer',
    continuerAttendre: fr`Continuer d'attendre`,
  },
  coupure: {
    titre: (name: string): string => `Connexion perdue avec ${name}`,
    texte: (name: string): string =>
      fr`La partie est en pause. Elle reprendra là où vous en étiez dès que ${name} sera de retour.`,
    statut: (since: string): string => `Duo réessaie tout seul… depuis ${since}`,
    apres30s: (name: string): string =>
      fr`Vérifiez que Duo est toujours ouvert sur l'ordinateur ${de(name)} et que son Wi-Fi fonctionne.`,
    arreter: 'Arrêter la partie',
  },
  arretJeu: {
    titre: fr`Le jeu s'est arrêté`,
    texte: (game: string): string => fr`${game} a rencontré un problème et s'est fermé.`,
    sauvegardeIntacte: 'Votre dernière sauvegarde est intacte.',
    echecChargement: (game: string, name: string | null): string =>
      name === null
        ? fr`${game} n'a pas pu démarrer. Retour au salon.`
        : fr`${game} n'a pas pu démarrer chez ${name}. Retour au salon.`,
    compris: 'Compris',
  },
  fin: {
    // Texte à valider par ux-ui-designer: la spécification n'a pas encore d'écran de fin de séance.
    titreSeance: 'Séance terminée',
    titrePartie: 'Partie terminée',
    gagne: fr`Tu as gagné !`,
    gagnePar: (name: string): string => `${name} a gagné`,
    egalite: fr`Égalité !`,
    reussite: fr`Vous avez réussi !`,
    echec: 'Pas cette fois',
    sousTitre: (game: string, duration: string): string => `${game} · ${duration}`,
    progression: 'Progression enregistrée.',
    retourSalon: 'Retour au salon',
  },
  quitter: {
    titre: fr`Quitter Duo ?`,
    texte: fr`La partie s'arrêtera pour vous deux.`,
    action: 'Quitter Duo',
    continuer: 'Continuer à jouer',
  },
  notifications: {
    fermer: 'Fermer la notification',
  },
} as const;

/** Notifications (UX 2.5 et 3.6). « a quitté Duo » est provisoire (M-16, variante à écrire). */
export function toastText(kind: ToastKind, name: string): string {
  switch (kind) {
    case 'joined':
      return `${name} a rejoint le salon.`;
    case 'left-salon':
      return `${name} a quitté le salon.`;
    case 'closed-salon':
      return `${name} a fermé le salon.`;
    case 'asked-wait':
      return fr`${name} a demandé d'attendre.`;
    case 'other-save':
      return `${name} a choisi une autre sauvegarde.`;
    case 'back':
      return `${name} est de retour.`;
    case 'stopped-match':
      return `${name} a arrêté la partie.`;
    case 'quit-duo':
      return `${name} a quitté Duo.`;
  }
}

/**
 * Notifications des jeux installés (UX 7.4). La mise à jour s'écrit sans accord
 * avec le nom du jeu, dont le genre n'est pas connu (« La Petite Ligne », « Jeu témoin »).
 */
export function gameToastText(kind: GameToastKind, game: string, version: string): string {
  switch (kind) {
    case 'game-updated':
      return fr`${game} : mise à jour installée (version ${version}).`;
    case 'game-installed':
      return fr`Nouveau jeu : ${game} est dans la bibliothèque.`;
    case 'install-invalid':
      return fr`Ce fichier n'est pas un jeu Duo valide : rien n'a été installé.`;
    case 'install-not-newer':
      return fr`Tu as déjà ${game} en version ${version}, rien à installer.`;
    case 'install-unsupported':
      return fr`${game} demande une version plus récente de Duo.`;
    case 'install-busy':
      return fr`Ferme le salon ou termine la partie avant d'installer un jeu.`;
    case 'install-failed':
      return fr`L'installation n'a pas abouti. Vérifie la place sur le disque, puis réessaie.`;
  }
}

const KEY_NAMES: Readonly<Record<string, string>> = {
  Space: 'Espace',
  Enter: 'Entrée',
  Escape: 'Échap',
  Tab: 'Tab',
  Backspace: 'Retour arrière',
  ShiftLeft: 'Maj',
  ShiftRight: 'Maj',
  ControlLeft: 'Ctrl',
  ControlRight: 'Ctrl',
  AltLeft: 'Alt',
  AltRight: 'Alt Gr',
  MetaLeft: 'Cmd',
  MetaRight: 'Cmd',
  ArrowUp: 'Flèche haut',
  ArrowDown: 'Flèche bas',
  ArrowLeft: 'Flèche gauche',
  ArrowRight: 'Flèche droite',
};

export const MOUSE_NAMES = {
  left: 'Clic gauche',
  right: 'Clic droit',
  middle: 'Clic molette',
  'wheel-up': 'Molette vers le haut',
  'wheel-down': 'Molette vers le bas',
} as const;

/**
 * Libellé d'une touche (`KeyboardEvent.code`) selon la disposition réelle du clavier
 * (`navigator.keyboard.getLayoutMap()`): `KeyW` s'affiche Z sur un clavier AZERTY.
 */
export function keyLabel(code: string, layout: ReadonlyMap<string, string> | null): string {
  const named = KEY_NAMES[code];
  if (named !== undefined) return named;
  const fromLayout = layout?.get(code);
  if (fromLayout !== undefined && fromLayout.trim() !== '') return fromLayout.toUpperCase();
  const letter = /^Key([A-Z])$/.exec(code)?.[1];
  if (letter !== undefined) return letter;
  const digit = /^Digit(\d)$/.exec(code)?.[1];
  return digit ?? code;
}

/** Raccourci du plein écran: celui du menu sur Mac, F11 ailleurs (fenêtre principale). */
export function fullscreenKey(platform: 'darwin' | 'win32' | 'linux'): string {
  return platform === 'darwin' ? 'Ctrl+Cmd+F' : 'F11';
}
