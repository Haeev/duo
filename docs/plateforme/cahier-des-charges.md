# Cahier des charges: plateforme Duo

| Champ | Valeur |
|---|---|
| Identifiant | `plateforme` |
| Statut | en revue (soumis au client le 2026-10-30) |
| Version du document | 0.3 |
| Dernière mise à jour | 2026-10-30 |

> Rédigé par le manager à partir des réponses du client, complété par l'équipe. Documents liés: parcours et écrans (`docs/plateforme/ux/parcours.md`, wireframes dans `design/maquettes/plateforme-wireframes/`), pistes d'identité visuelle (`docs/plateforme/identite-visuelle-pistes.md`), architecture proposée (`docs/plateforme/architecture.md`), critères d'acceptation (`docs/plateforme/criteres-acceptation.md`). Une fois validé par le client, ce document est le contrat de la plateforme: toute modification passe par le manager et s'inscrit dans l'historique (section 10).

## 1. Résumé

- **Pitch**: une application de bureau qui permet à deux personnes, chacune sur son ordinateur, de lancer en moins d'une minute une partie à deux en réseau local, parmi des jeux créés sur mesure, et qui garde la mémoire de leurs parties.
- **Joueurs**: toujours deux, dans la même pièce, chacun sur sa machine. Pas de mode solo.
- **Machines**: un Mac à puce M1 et un PC sous Windows 11 de configuration inconnue (hypothèse prudente: Intel Core i3 de 2018 avec graphique intégré). Clavier AZERTY et souris, pas de manette.
- **Intention**: proposer une partie doit être aussi simple que de sortir un jeu de société.
- **Piliers**:
  1. Zéro friction: hors premier lancement, moins d'une minute de l'ouverture de Duo au début de la partie, dont 15 secondes de temps machine au plus, sans aucun réglage réseau.
  2. Notre histoire de jeu: sauvegardes communes, historique des parties et des séances, score cumulé.
  3. Une maison commune: des jeux variés (2D, 3D, isométrique) présentés et contrôlés de façon cohérente.

## 2. Parcours principaux

Détaillés dans `docs/plateforme/ux/parcours.md` (20 écrans, textes exacts, touches, états).

1. **Premier lancement**: créer son profil (pseudo, couleur), comprendre puis accepter les autorisations réseau du système (l'explication vient avant la fenêtre du système), vérifier que l'autre ordinateur est visible.
2. **Lancer une partie**: l'hôte choisit un jeu et une sauvegarde (la plus récente est présélectionnée) et ouvre le salon; l'autre reçoit l'invitation et la rejoint d'une touche; chacun dit « C'est parti ! » et la partie démarre après un décompte de 3 secondes, annulable.
3. **Jouer**: Échap met en pause dans tous les jeux, chez l'un ou chez l'autre; la reprise demande l'accord des deux. Si un ordinateur se déconnecte, la partie se met en pause et reprend à la reconnexion.
4. **Finir**: écran de résultats, mise à jour de l'historique et du score cumulé, rejouer à deux ou revenir au salon.
5. **Consulter** l'historique et les scores.
6. **Régler**: profil, son, affichage, touches.
7. **Recevoir un nouveau jeu**: il apparaît dans la bibliothèque sans réinstaller l'application.
8. **Dépanner**: quand l'autre ordinateur n'apparaît pas, un diagnostic guidé, puis la connexion par adresse.

## 3. Fonctions de la version 1

### Indispensables

| # | Fonction | Détail |
|---|---|---|
| F01 | Profil | Un profil par machine: pseudo de 1 à 16 caractères (lettres accentuées, chiffres, espace, trait d'union, apostrophe; pas d'émoji, pour que tous les jeux puissent l'afficher) et une couleur parmi six, chacune liée à un symbole (rond, carré, triangle, losange, étoile, hexagone). Les deux joueurs n'ont jamais la même couleur. Modifiable sans effet sur l'historique, les scores ni les sauvegardes. |
| F02 | Découverte et connexion | Chaque Duo ouvert s'annonce sur le réseau local: l'autre ordinateur apparaît en 3 secondes au plus, salon ouvert ou non. Connexion par adresse IP en recours, adresse retenue. Le diagnostic teste la visibilité dans les deux sens, nomme la cause quand elle est détectable (réseau classé Public sous Windows, autorisation refusée, aucune connexion au réseau local), ouvre le bon réglage du système et guide pas à pas sinon. |
| F03 | Salon | L'hôte choisit le jeu et la sauvegarde. Les deux profils et leur état (« Pas encore » ou « C'est parti »). Rejoindre depuis l'invitation vaut « C'est parti ». Tout changement de jeu ou de sauvegarde remet les deux joueurs à « Pas encore ». Départ après un décompte de 3 secondes, annulable par l'un ou l'autre. L'hôte lance une partie en 3 actions au plus depuis l'accueil, l'invité la rejoint en 1. |
| F04 | Bibliothèque | Jeux installés avec vignette, description, durée typique d'une partie ou d'une séance, sauvegardes existantes. Pour les scores, chaque jeu se range en coopération ou en affrontement. |
| F05 | Cycle de vie d'un jeu | Chargement, pause (Échap, réservé à la pause dans tous les jeux), reprise quand les deux l'ont demandée, fin, rejouer à deux ou retour au salon. Pas de pause automatique à la perte de focus de la fenêtre (les touches sont relâchées). Un jeu qui plante ou se fige ramène les deux joueurs au salon en 5 secondes au plus (10 s s'il se fige), sans fermer Duo ni perdre la dernière sauvegarde. |
| F06 | Déconnexion | Pause des deux côtés en 3 secondes au plus (aucune pour une micro-coupure), attente sans limite de temps, reconnexion automatique puis reprise à deux, là où la partie en était tant que l'application de l'hôte reste ouverte; sinon, reprise au dernier point de sauvegarde (sauvegarde automatique régulière pour les jeux longs). |
| F07 | Sauvegardes | Chaque jeu enregistre la progression du duo. Une sauvegarde appartient au duo, existe sur les deux machines et se reprend quelle que soit la machine qui héberge. Remplacer une sauvegarde demande confirmation; les trois versions précédentes restent en copies de secours, visibles dans la fiche du jeu. Supprimer une sauvegarde demande confirmation et garde une copie de secours. |
| F08 | Historique | Chaque partie ou séance est enregistrée: jeu, date de début, durée hors pauses, résultat, scores. Les jeux sans fin de partie (comme une simulation de vie) inscrivent des séances. Les deux copies de l'historique se fusionnent: aucune partie n'est perdue. |
| F09 | Score cumulé | Victoires de chacun, par jeu et au total, pour les jeux en affrontement; progression commune pour les jeux en coopération. Calculé à partir de l'historique. |
| F10 | Réglages | Volumes (général, musique, effets, interface); plein écran ou fenêtre (fenêtre agrandie au premier lancement, plein écran en une touche); taille de l'interface 100, 125 ou 150 %; « Réduire les animations » (suit d'abord le réglage du système); touches de chaque jeu, réaffectables. |
| F11 | Installation | Installateurs macOS (puce Apple) et Windows. Guide d'installation hors application (alertes de sécurité de macOS et de Windows, pare-feu), livrable à part d'ingenieur-build et ux-ui-designer. |
| F12 | Nouveaux jeux | Ajout et mise à jour d'un jeu sans réinstaller l'application: téléchargement automatique en arrière-plan, jamais pendant une partie; copie depuis l'autre ordinateur par le réseau local si l'un n'a pas Internet; installation depuis un fichier en recours. Internet sert seulement à récupérer les jeux, jamais à jouer. |
| F13 | Compatibilité | Les versions sont comparées dès que les deux ordinateurs se voient. On joue la version la plus récente d'un jeu présente sur l'une des deux machines: elle est copiée vers l'autre par le réseau local, en une action (« Mettre à jour et rejoindre »). Si l'application elle-même est trop ancienne sur une machine, message clair et marche à suivre. |

### Plus tard

- Records, statistiques détaillées et succès par jeu.
- Export et import des sauvegardes.
- Mise à jour automatique de l'application elle-même (selon les contraintes de signature, voir section 6).

### Hors périmètre

- Mode solo, plus de deux joueurs, jeu par Internet, manettes, comptes en ligne, classements publics.

## 4. Sauvegardes, historique et scores: règles

- Les sauvegardes, l'historique et les scores appartiennent au duo. Ils sont copiés sur les deux machines à chaque écriture.
- Chaque jeu déclare ses emplacements et ses moments de sauvegarde (fin de niveau, sortie de partie, sauvegarde automatique régulière, ou à la demande).
- Aucune perte en cas de plantage ou de coupure: écriture sûre (fichier temporaire puis remplacement) et copies de secours.
- Si les deux copies d'une sauvegarde divergent (une copie a échoué pendant une coupure), la plus avancée dans sa chaîne de révisions l'emporte (et non la plus récente selon les horloges, qui peuvent différer entre les machines); l'autre est gardée en secours et la plateforme le signale. Un simple rattrapage d'une copie en retard ne se signale pas.
- Les sauvegardes d'une ancienne version d'un jeu restent lisibles par les versions suivantes.
- Une machine réinstallée doit pouvoir se rattacher au duo et récupérer ses données depuis l'autre machine (mécanisme à définir dans les ADR).

## 5. Interface et identité

- Identité visuelle: trois pistes proposées par directeur-artistique; le client en choisit une (Q1).
- Identité sonore: définie par sound-designer après le choix de la piste visuelle.
- Interface en français, en tutoyant les joueurs, avec une rédaction neutre: aucun texte ne s'accorde au genre d'un joueur (« Sacha a rejoint », jamais « Sacha est prête »).
- Navigation complète au clavier, souris en complément. Contraste WCAG AA au minimum; les deux joueurs se distinguent aussi pour un daltonien (luminosité et symbole, pas seulement la teinte); option de réduction des animations.
- Aucun défilement jusqu'à 1280x720 points (un écran 1080p à 150 %), défilement vertical seul en dessous; vérifié en 1366x768 et sur Retina.
- Crédits et licences des ressources externes affichés dans un écran « À propos ».

## 6. Contraintes techniques

Synthèse d'architecte-technique, détaillée dans `docs/plateforme/architecture.md`.

- Orientation validée par le client: Electron, TypeScript, Three.js, PixiJS ou Phaser; versions figées par ADR (Electron 45 au 2026-10-30).
- Machine de référence: le PC (hypothèse i3 de 2018, Intel UHD 620, mémoire à confirmer). Lanceur et jeux y tiennent 60 images par seconde, au sens mesurable défini dans `criteres-acceptation.md`, s'ils respectent les budgets de `architecture.md` (150 appels de dessin, 250 000 triangles, 1 Go de mémoire en partie) et si le pilote graphique est à jour; un banc de mesure le vérifie dès le prototype.
- Chaque jeu tourne dans un processus isolé: s'il plante ou se bloque, la plateforme le ferme et ramène les deux joueurs au salon.
- Réseau local uniquement: l'hôte fait autorité, l'invité envoie ses commandes; découverte automatique, saisie d'adresse IP en recours.
- Hors ligne: Duo fonctionne sans Internet, qui sert seulement à télécharger les jeux et les nouvelles versions depuis GitHub, sans compte.
- Nouveaux jeux: paquets signés, installés sans réinstaller l'application.
- Données du duo (sauvegardes, historique, scores) en JSON dans le dossier de l'utilisateur, écriture sûre, copie sur les deux machines.
- Pas de certificat payant: alertes de sécurité au premier lancement, et à chaque nouvelle version de Duo sous macOS; en version 1, mise à jour de l'application par avis et téléchargement manuel.
- Windows: si Smart App Control est actif sur le PC, il bloque Duo et devra être désactivé (à vérifier avec Q4).
- Dépôt GitHub public: nécessaire pour télécharger les jeux sans authentification.

## 7. Critères d'acceptation

132 critères numérotés dans `docs/plateforme/criteres-acceptation.md`, avec leur mode de vérification et leur jalon, une traçabilité vers F01 à F13 et la check-list de recette chez le client. Les hypothèses qu'il liste (H-01 à H-35) sont tranchées par le manager et l'architecte lors de la rédaction des ADR, en suivant ce cahier.

## 8. Jalons

| Jalon | Contenu attendu | Validé le |
|---|---|---|
| Prototype | L'application démarre sur les deux machines, chacune trouve l'autre, le jeu témoin se joue à deux; le banc de mesure tourne sur le PC. | |
| Alpha | Toutes les fonctions de la version 1, interface provisoire. | |
| Bêta | Identités visuelle et sonore appliquées, installateurs, guide d'installation. | |
| 1.0 | Recette réussie chez le client sur les deux machines. | |

Le jeu témoin est un mini-jeu à deux, très simple, qui éprouve toute la chaîne (réseau, entrées, son, rendu, sauvegarde, historique) avant le premier vrai jeu.

## 9. Questions ouvertes et décisions

| # | Question | Options | Recommandation | Décision du client | Date |
|---|---|---|---|---|---|
| Q1 | Piste d'identité visuelle | A Boîte à jeux, B Étoile double, C Deux encres | B: sombre et calme, elle met tous les jeux en valeur et reste confortable le soir | | |
| Q2 | Ton de l'interface | tutoiement, vouvoiement | tutoiement | tutoiement | 2026-10-30 |
| Q3 | Visibilité du dépôt GitHub | public, privé | public | public | 2026-10-30 |
| Q4 | Configuration réelle des machines | relevé guidé. PC: mémoire, disque, carte graphique, version de Windows, état de Smart App Control, réseau Privé ou Public, compte administrateur ou non, nom du dossier utilisateur, définition et mise à l'échelle de l'écran. Mac: modèle et version de macOS | la relever avant le prototype | | |
| Q5 | Parties interrompues (plantage, abandon) | ignorées, ou inscrites « interrompues » dans l'historique | inscrites « interrompues », sans effet sur le score cumulé | | |
| Q6 | Rapport de diagnostic exportable en un clic (journaux, configuration, état réseau et graphique) | l'ajouter en F14, ou non | l'ajouter: seul moyen de comprendre un problème sur des machines que le studio ne voit pas | | |

## 10. Historique

| Date | Version | Changement | Demandé par |
|---|---|---|---|
| 2026-10-30 | 0.1 | Première version, à partir des réponses du client | manager |
| 2026-10-30 | 0.1 | Décisions Q2 (tutoiement) et Q3 (dépôt public) | client |
| 2026-10-30 | 0.2 | Section 6 et reformulations de F02, F06, F13 d'après `architecture.md`; questions Q5 et Q6 | architecte-technique, manager |
| 2026-10-30 | 0.3 | Parcours « Dépanner »; précisions de F01 à F13 d'après la spécification UX et les critères d'acceptation; F13 joue la version la plus récente; règles de conflit par révisions; rédaction neutre et accessibilité; Q4 complétée; soumis au client | ux-ui-designer, qa-testeur, manager |
