# Cahier des charges: plateforme Duo

| Champ | Valeur |
|---|---|
| Identifiant | `plateforme` |
| Statut | brouillon |
| Version du document | 0.1 |
| Dernière mise à jour | 2026-10-30 |

> Rédigé par le manager à partir des réponses du client, complété par l'équipe (UX, direction artistique, technique, QA). Une fois validé par le client, ce document est le contrat de la plateforme: toute modification passe par le manager et s'inscrit dans l'historique (section 10).

## 1. Résumé

- **Pitch**: une application de bureau qui permet à deux personnes, chacune sur son ordinateur, de lancer en moins d'une minute une partie à deux en réseau local, parmi des jeux créés sur mesure, et qui garde la mémoire de leurs parties.
- **Joueurs**: toujours deux, dans la même pièce, chacun sur sa machine. Pas de mode solo.
- **Machines**: un Mac à puce M1 et un PC sous Windows 11 de configuration inconnue (hypothèse prudente: Intel Core i3 de 2018 avec graphique intégré). Clavier AZERTY et souris, pas de manette.
- **Intention**: proposer une partie doit être aussi simple que de sortir un jeu de société.
- **Piliers**:
  1. Zéro friction: de l'ouverture de l'application au début de la partie en moins d'une minute, sans aucun réglage réseau.
  2. Notre histoire de jeu: sauvegardes communes, historique des parties, score cumulé.
  3. Une maison commune: des jeux variés (2D, 3D, isométrique) présentés et contrôlés de façon cohérente.

## 2. Parcours principaux

Détaillés par ux-ui-designer dans `docs/plateforme/ux/parcours.md`.

1. **Premier lancement**: créer son profil (pseudo, couleur), comprendre puis accepter les autorisations réseau du système, vérifier que l'autre machine est visible.
2. **Lancer une partie**: l'un choisit un jeu (et une sauvegarde s'il y en a) et ouvre le salon; l'autre voit l'invitation apparaître et la rejoint d'une touche; la partie démarre quand les deux sont prêts.
3. **Jouer**: pause demandée par l'un ou l'autre, reprise. Si une machine se déconnecte, la partie se met en pause et reprend à la reconnexion.
4. **Finir**: écran de résultats, mise à jour de l'historique et du score cumulé, rejouer ou revenir au salon.
5. **Consulter** l'historique des parties et les scores.
6. **Régler**: profil, volumes, affichage, touches.
7. **Recevoir un nouveau jeu**: il apparaît dans la bibliothèque sans réinstaller l'application.

## 3. Fonctions de la version 1

### Indispensables

| # | Fonction | Détail |
|---|---|---|
| F01 | Profil | Un profil par machine: pseudo, couleur de joueur. Modifiable. |
| F02 | Découverte et connexion | L'hôte est trouvé automatiquement sur le réseau local; connexion par adresse IP en recours. Diagnostic clair si le pare-feu ou le réseau bloque. |
| F03 | Salon | Les deux profils, leur état (prêt ou non), le jeu et la sauvegarde choisis. Démarrage quand les deux sont prêts. |
| F04 | Bibliothèque | Jeux installés avec vignette, description, type (coopération, affrontement), durée d'une partie, sauvegardes existantes. |
| F05 | Cycle de vie d'un jeu | Chargement, pause, reprise, fin, retour au salon. Un jeu qui plante ramène au salon avec un message, sans fermer l'application. |
| F06 | Déconnexion | Pause automatique, attente de reconnexion, reprise là où la partie en était. |
| F07 | Sauvegardes | Chaque jeu peut enregistrer la progression du duo. Une sauvegarde appartient au duo, existe sur les deux machines et se reprend quelle que soit la machine qui héberge. |
| F08 | Historique | Chaque partie terminée est enregistrée: jeu, date, durée, résultat, scores. |
| F09 | Score cumulé | Victoires de chacun, par jeu et au total, pour les jeux en affrontement; progression commune pour les jeux en coopération. |
| F10 | Réglages | Volumes (général, musique, effets, interface), plein écran ou fenêtre, taille de l'interface, touches de chaque jeu. |
| F11 | Installation | Installateurs macOS (puce Apple) et Windows; guide de premier lancement (alertes de sécurité de macOS et de Windows, pare-feu). |
| F12 | Nouveaux jeux | Ajout et mise à jour d'un jeu sans réinstaller l'application. Internet sert seulement à récupérer les jeux, jamais à jouer. |
| F13 | Compatibilité | Les deux machines vérifient qu'elles ont les mêmes versions (application et jeu); sinon, message clair et marche à suivre. |

### Plus tard

- Records, statistiques détaillées et succès par jeu.
- Export et import des sauvegardes.
- Mise à jour automatique de l'application elle-même (selon les contraintes de signature, voir section 6).

### Hors périmètre

- Mode solo, plus de deux joueurs, jeu par Internet, manettes, comptes en ligne, classements publics.

## 4. Sauvegardes, historique et scores: règles

- Les sauvegardes, l'historique et les scores appartiennent au duo. Ils sont copiés sur les deux machines à chaque écriture.
- Chaque jeu déclare ses emplacements de sauvegarde et ses moments de sauvegarde (fin de niveau, sortie de partie, ou à la demande).
- Aucune perte en cas de plantage ou de coupure: écriture sûre (fichier temporaire puis remplacement) et conservation de la version précédente.
- Si les deux copies divergent (une copie a échoué pendant une coupure), la plus récente l'emporte, l'autre est gardée en secours, et la plateforme le signale.

## 5. Interface et identité

- Identité visuelle: trois pistes proposées par directeur-artistique (`docs/plateforme/identite-visuelle-pistes.md`); le client en choisit une.
- Identité sonore: définie par sound-designer après le choix de la piste visuelle.
- Interface en français, navigation complète au clavier, souris en complément.
- Lisible sur un écran de portable en 1366x768 comme sur un écran 1920x1080 ou Retina.

## 6. Contraintes techniques

Synthèse d'architecte-technique, détaillée dans `docs/plateforme/architecture.md`.

- Orientation validée par le client: Electron, TypeScript, Three.js, Phaser ou PixiJS.
- Machine de référence: le PC (hypothèse Intel Core i3 de 2018, graphique intégré). Le lanceur et les jeux y tiennent 60 images par seconde.
- Hors ligne: Duo fonctionne sans Internet, avec le seul réseau local.
- Pas de certificat de signature payant: alertes de sécurité au premier lancement, documentées pas à pas.
- Dépôt GitHub public: les fichiers publiés se téléchargent sans authentification.

## 7. Critères d'acceptation

Rédigés par qa-testeur dans `docs/plateforme/criteres-acceptation.md`.

## 8. Jalons

| Jalon | Contenu attendu | Validé le |
|---|---|---|
| Prototype | L'application démarre sur les deux machines, chacune trouve l'autre, le jeu témoin se joue à deux. | |
| Alpha | Toutes les fonctions de la version 1, interface provisoire. | |
| Bêta | Identités visuelle et sonore appliquées, installateurs, guide d'installation. | |
| 1.0 | Recette réussie chez le client sur les deux machines. | |

Le jeu témoin est un mini-jeu à deux, très simple, qui éprouve toute la chaîne (réseau, entrées, son, rendu, sauvegarde, historique) avant le premier vrai jeu.

## 9. Questions ouvertes et décisions

| # | Question | Options | Recommandation | Décision du client | Date |
|---|---|---|---|---|---|
| Q1 | Piste d'identité visuelle | A, B, C | voir les planches du directeur artistique | | |
| Q2 | Ton de l'interface | tutoiement, vouvoiement | tutoiement, plus chaleureux pour un usage à deux | | |
| Q3 | Visibilité du dépôt GitHub | public, privé | public: compilation automatique et téléchargement des jeux plus simples | | |
| Q4 | Configuration réelle du PC | à relever dans le Gestionnaire des tâches | la vérifier avant le prototype | | |

## 10. Historique

| Date | Version | Changement | Demandé par |
|---|---|---|---|
| 2026-10-30 | 0.1 | Première version, à partir des réponses du client | manager |
