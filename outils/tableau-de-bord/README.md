# Tableau de bord du client (page Artifact)

Page web privée où le client suit la refonte de La Petite Ligne: avancement en direct, questions en attente, images à annoter, règles actées, plan et modèles 3D. Le manager la publie avec l'outil Artifact (`capabilities: { db: {}, user: {} }`) et remplit la base; le client répond et annote.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | la page: styles, jetons, noyau `window.TDB` (onglets, données, remarques, dialogues) |
| `avancement.js`, `questions.js`, `images.js`, `regles.js` | les quatre onglets de l'étape 1 |
| `carte.js`, `modeles.js` | plan annotable et visionneuse 3D (autre lot); la page marche sans eux |
| `sons.js`, `sons/` | onglet « Sons et musiques » (ordre 35) et ses fichiers `.mp4` avec `index.json`, fabriqués par `outils/publier-sons.mjs` |
| `images/` | les images de la galerie, publiées à côté de la page |
| `essai/` | banc d'essai local (fausse base en mémoire, données d'essai, captures). Jamais publié |

`index.html` n'a ni `<!DOCTYPE>`, ni `<html>`, ni `<head>`, ni `<body>`: l'outil Artifact les ajoute. Les scripts d'onglets sont chargés en fin de page par `<script src="x.js" defer>`; un script absent ou en erreur ne casse rien, son onglet n'apparaît simplement pas.

## Contrat des onglets

Un onglet est un script classique (pas un module) qui appelle une seule fonction:

```js
window.TDB.registerTab({
  id: 'carte', // lettres ASCII et tirets; c'est aussi le `#carte` de l'adresse
  title: 'Carte', // libellé de l'onglet
  order: 50, // tri croissant: avancement 10, questions 20, images 30, sons 35, regles 40
  mount(el, ctx) {
    // appelé UNE fois, à la première ouverture; `el` est le conteneur de l'onglet
  },
});
```

`mount` peut renvoyer une promesse. S'il lève une erreur, la page affiche un message dans l'onglet et continue. Identifiants interdits par claude.ai: `settings`, `sidebar`, `customize`, `upgrade`, `downloads`, `comment-*`.

### `ctx`

| Membre | Valeur |
|---|---|
| `ctx.db` | l'espace de noms `db` de claude.ai, ou `null` (hors ligne, aperçu). Vaut `null` tant que `ctx.ready` n'est pas résolue |
| `ctx.ready` | promesse résolue (avec `ctx.db`) quand la base est connue. Ne rejette jamais |
| `ctx.me` | identifiant du lecteur (chaîne) ou `null`; connu après `ctx.ready` |
| `ctx.canWrite` | `false` si le lecteur ne peut pas écrire (hors ligne, lecture seule); connu après `ctx.ready` |

### `ctx.notes`: les remarques du client

`type` vaut `image`, `carte` ou `modele`; `id` est l'identifiant de l'image, de la carte ou du modèle.

| Appel | Effet |
|---|---|
| `ctx.notes.list(type, id)` | tableau des remarques connues à cet instant, les plus anciennes d'abord (synchrone; `await` marche aussi). Vide tant que la base n'a pas répondu |
| `ctx.notes.watch(type, id, fn)` | appelle `fn(liste)` tout de suite puis à chaque changement; renvoie la fonction qui arrête l'écoute |
| `ctx.notes.add({ cible: { type, id }, forme, texte })` | crée la remarque (auteur, date et statut `ouverte` ajoutés par la page). Promesse de l'identifiant créé, ou de `null` si l'écriture a échoué (le message à l'écran est déjà affiché). Ne rejette jamais |
| `ctx.notes.resolve(id)` | passe la remarque à `traitee`. Promesse d'un booléen |
| `ctx.notes.remove(id)` | supprime la remarque, SANS confirmation: demander avant avec `ctx.ui.confirm`. Promesse d'un booléen |

Une remarque de la liste: `{ id, cible: { type, id }, forme, texte, auteur, creeLe, statut, reponseManager }`.

`forme` vaut:

- `{ sorte: 'point', x, y }`: coordonnées de 0 à 1 dans l'image ou la carte, origine en haut à gauche;
- `{ sorte: 'trait', points: [[x, y], …] }`: mêmes coordonnées;
- `{ sorte: 'point3d', position: [x, y, z], normale: [x, y, z] }`: repère du modèle;
- `{ sorte: 'globale' }`: remarque sur l'ensemble.

Une forme inconnue ou mal formée est refusée par `add` (résultat `null`).

### `ctx.ui`: dialogues dans la page

`alert`, `confirm` et `prompt` du navigateur ne s'affichent jamais dans un Artifact.

| Appel | Effet |
|---|---|
| `ctx.ui.toast(texte)` | message bref en bas de page, lu par les lecteurs d'écran |
| `ctx.ui.confirm(texte, { ok, annuler })` | dialogue modal; promesse de `true` (confirmé) ou `false` (annulé, Échap). Les libellés sont facultatifs («&nbsp;Confirmer&nbsp;», «&nbsp;Annuler&nbsp;») |
| `ctx.ui.noteEditor(el, { onSubmit, onCancel, label, placeholder, bouton, valeur })` | pose dans `el` un champ de remarque avec ses boutons. `onSubmit(texte)` reçoit le texte non vide; s'il renvoie une promesse, le champ attend, puis se vide sauf si elle donne `false`. Ctrl+Entrée envoie, Échap appelle `onCancel`. Renvoie `{ el, focus(), clear(), destroy() }` |

### Ajouts au contrat (facultatifs, utilisés par les onglets de l'étape 1)

- `ctx.data.watch(chemin, fn)`: écoute partagée d'une collection (`'questions'`) ou d'un document (`'etat/avancement'`). Un seul abonnement `onSnapshot` par chemin pour toute la page. `fn` reçoit `{ etat, docs, data, retard }`: `etat` vaut `chargement`, `pret` ou `horsligne`; `docs` est le tableau `{ id, …champs }` d'une collection; `data` le contenu d'un document (ou `null`); `retard` passe à `true` si la base n'a pas répondu en 10 s. Renvoie la fonction d'arrêt.
- `ctx.data.write(chemin, (db) => promesse)`: écriture en file (une à la fois par document), promesse d'un booléen; en cas d'échec le message à l'écran est déjà affiché.
- Événement `tdb:droits` sur `document`: `ctx.canWrite` vient de changer (base connue, écriture refusée); redessiner ses commandes.
- `ctx.notes.rating(type, id)` et `ctx.notes.setRating({ type, id }, note)`: la note du client sur 10.
- `ctx.ui.h(balise, attributs, ...enfants)`: fabrique un élément (texte posé par `textContent`); `ctx.ui.vide(titre, texte)`: bloc d'état vide; `ctx.ui.date(valeur)`: date en français, heure de Paris.
- `window.TDB.setBadge(id, n)`: compteur dans le libellé d'un onglet (0 l'efface).
- `window.TDB.go(id)`: ouvre un onglet.

### Styles à disposition

Tout onglet hérite des polices et des couleurs. N'utiliser que les jetons, jamais une couleur écrite en dur: les deux thèmes (sombre et clair) en dépendent.

- Couleurs: `--fond`, `--panneau`, `--panneau-haut`, `--creux`, `--texte`, `--texte-doux`, `--filet`, `--accent` (aplat bouton d'or), `--sur-accent`, `--accent-texte` (l'accent quand il sert de texte ou de trait), `--ok`, `--alerte`, `--ombre`.
- Polices: `--police-titre` (Grandstander), `--police-texte` (Nunito Sans). Rayons: `--rayon`, `--rayon-petit`.
- Classes: `.tdb-btn` (bouton), `.tdb-btn--accent` (action principale), `.tdb-btn--discret`, `.tdb-carte` (panneau), `.tdb-pastille` (étiquette d'état; variantes `--ok`, `--alerte`, `--accent`), `.tdb-vide` (état vide), `.tdb-titre` (titre de section).
- Un onglet qui a besoin d'autres styles ajoute sa propre balise `<style>` dans `mount`, avec des classes préfixées par son identifiant.

## Schéma des données (base `db`)

Le manager écrit ce qui vient de lui; le client écrit ses réponses et ses remarques. La page vit avec une base vide: aucune donnée de départ n'est écrite dans `index.html`. Tout texte est affiché par `textContent`.

| Chemin | Champs | Écrit par |
|---|---|---|
| `etat/avancement` | `{ pourcent, majLe, heureParis, resume, etapes: [{ nom, poids, pourcent }], enCours: [texte], bloque: [texte], versionPubliee }` | manager |
| `journal/<id>` | `{ quand, titre, texte, sorte }` (le plus récent en haut) | manager |
| `questions/<id>` | `{ ordre, poseeLe, sujet, texte, recommandation, options: [texte], statut: 'ouverte' \| 'repondue' \| 'caduque', reponse, reponseLibre, reponduLe }` | manager, puis client (`statut`, `reponse`, `reponseLibre`, `reponduLe`) |
| `images/<id>` | `{ ordre, titre, fichier, famille, noteManager, justification, date, reference }` | manager |
| `remarques/<id>` | `{ cible: { type, id }, forme, texte, auteur, creeLe, statut: 'ouverte' \| 'traitee', reponseManager }` | client, puis manager (`statut`, `reponseManager`) |
| `regles/<id>` | `{ ordre, titre, texte, date }` | manager |

Précisions:

- Dates (`majLe`, `quand`, `poseeLe`, `date`, `creeLe`, `reponduLe`): chaîne ISO 8601 (`2026-11-10` ou `2026-11-10T17:40:00Z`). Une chaîne qui n'est pas une date est affichée telle quelle. `heureParis` est un texte libre déjà mis en forme («&nbsp;18 h 40&nbsp;»).
- `pourcent`: nombre de 0 à 100. `poids`: nombre positif quelconque; la page le ramène à une part du total.
- `journal.sorte`: `livraison`, `decision`, `correctif` ou `info` (autre valeur: affichée telle quelle).
- `questions.recommandation`: texte libre. L'option mise en avant est celle dont le texte est égal à la recommandation, ou placé à son début (à défaut, contenu dans elle; la plus longue si plusieurs): écrire par exemple `options: ['Oui', 'Non']` et `recommandation: 'Oui: cela évite de refaire la carte.'`.
- `questions.reponse`: le texte exact de l'option choisie, ou `''` si le client n'a écrit qu'une réponse libre.
- `images.fichier`: chemin relatif sous `images/` (`scene/gare-v3.webp`), lettres, chiffres, `-`, `_`, `.` et `/` seulement. `images.famille`: `scene`, `personnages`, `interface` ou `plan` (autre valeur: famille affichée à la suite sous son propre nom).
- Note du client sur une image: document `remarques/note-<type>-<id>` avec `forme: { sorte: 'note', valeur }` (0 à 10) et un `texte` vide. `ctx.notes.list` et `watch` ne renvoient pas ces documents.
- Sons: `cible: { type: 'son', id }` (identifiant de `sons/index.json`). Remarque: `forme: { sorte: 'instant', t }` (secondes dans le son) ou `{ sorte: 'globale' }`. Avis: `remarques/note-son-<id>` avec `forme: { sorte: 'note', valeur: 10 | 0, avis: 'bien' | 'a-revoir' }`. Le noyau (`ctx.notes.add`, `setRating`) refuse encore ce type et cette forme: `sons.js` écrit ces documents lui-même par `ctx.data.write`; le manager répond comme pour les images (`statut`, `reponseManager`).

## Ajouter un onglet

1. Copier `regles.js` (le plus court) sous le nom du nouvel onglet, par exemple `sons.js`.
2. Changer `id`, `title` et `order` dans l'appel à `registerTab`.
3. Dans `mount`, écouter ses données avec `ctx.data.watch('sons', (vue) => { … })` et dessiner avec `ctx.ui.h`.
4. Traiter les trois états de `vue.etat` (`chargement`, `pret` avec une liste vide, `horsligne`) avec `ctx.ui.vide`.
5. Ajouter `<script src="sons.js" defer></script>` à la fin de `index.html`, avec les autres.
6. Ajouter la collection au tableau du schéma ci-dessus.
7. Ajouter des données d'essai dans `essai/donnees.js`, puis lancer `node outils/tableau-de-bord/essai/capturer.cjs` et regarder les captures.
8. Publier le nouveau script avec la page.

## Ajouter un son ou republier les sons

1. Livrer le son dans le jeu (`assets/commun/son/`) et sa ligne dans `sons.json`, `evenements.json` ou `musique.json`, comme d'habitude.
2. Lui donner un nom français dans `outils/sons-sources.json` (`noms`); un effet va dans la liste `sons` de sa famille (sinon il tombe dans « Autres effets »).
3. Si un nouvel événement le déclenche, écrire sa phrase dans `evenements` (clé `événement condition=valeur`, ou l'événement seul).
4. Lancer `node outils/tableau-de-bord/outils/publier-sons.mjs` (`--tout` pour tout réencoder). Il refuse s'il manque un nom ou une phrase, ou si l'ensemble dépasse 25 Mo.
5. Lire le bilan (nombre, poids, sons pas encore branchés), puis publier `sons.js` et le dossier `sons/` avec la page.

Rien n'est inventé: « où et quand » vient des règles du jeu; sans règle ni signal émis, l'index dit « pas encore branché ». « Nouveau » suit la date du premier commit du fichier (`nouveauDepuis`).

## Essai local

`node outils/tableau-de-bord/essai/capturer.cjs [dossier de sortie]` sert le dossier sur un port local, enveloppe `index.html` dans le squelette de claude.ai, injecte une fausse base en mémoire (`essai/bouchon.js`, `essai/donnees.js`) et capture chaque écran en 1366x768 et 400x800, thème sombre et thème clair. Le script échoue si la console sort une erreur ou si la page déborde en largeur.

Le dossier est hors d'ESLint et de TypeScript (`outils/eslint.config.js`): ce sont des scripts classiques de navigateur, contrôlés par ce banc. Prettier, lui, s'applique (`npx prettier --write outils/tableau-de-bord`).

## Publication (manager)

Publier `index.html` avec les scripts d'onglets et les dossiers `images/` et `sons/`. Le dossier `essai/` et ce README ne se publient pas. Après la première publication, remplir la base (`etat/avancement`, `questions`, `images`, `regles`, `journal`).
