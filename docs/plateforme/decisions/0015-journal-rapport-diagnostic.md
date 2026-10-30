# ADR 0015: Journal et rapport de diagnostic

| Champ | Valeur |
|---|---|
| Statut | proposée (ADR ajouté pour F14, absent de la liste initiale de `architecture.md` 0.1) |
| Date | 2026-10-30 |
| Rédacteur | architecte-technique |
| À relire par | dev-plateforme, dev-reseau (état du réseau), ux-ui-designer (aperçu), qa-testeur (critères de F14) |
| Fonctions du cahier | F14 (Q6), F02 (diagnostic), F05 (plantage d'un jeu) |
| Liens | ADR 0003 (module `diagnostics`), 0004 (plantages), 0013 (prérequis 5 et 6) |

## Contexte

F14 (cahier 1.0): « Export en un clic d'un rapport (journaux, configuration de la machine, état du réseau et du rendu graphique, versions) à envoyer au studio. Aucune donnée personnelle en dehors des pseudos; le joueur voit ce que contient le rapport avant de l'enregistrer. » Les machines du client ne sont pas accessibles depuis le studio: ce rapport et le journal qu'il contient sont le seul moyen de comprendre un problème chez lui, et c'est aussi le journal qui fournit les délais et le temps machine mesurés à la recette (prérequis 5 de qa-testeur). La spécification UX prévoit trois points d'entrée: « Enregistrer un rapport pour le studio » (E13, fichier dans Téléchargements), « Copier le rapport pour le studio » (E17) et « Copier les informations pour le studio » (Réglages > À propos).

Pièges connus: un nom d'ordinateur contient souvent un prénom (« MacBook Air de Camille »), un chemin le nom du compte (`C:\Users\Hélène Dupont`), une adresse IPv6 peut contenir l'adresse matérielle de la carte réseau, et un rapport de plantage natif (minidump) contient de la mémoire du processus, donc n'importe quoi.

## Options

| Option | Pour | Contre |
|---|---|---|
| A. Rapport texte lisible, assemblé par le principal, montré dans un aperçu, puis enregistré ou copié | le joueur lit exactement ce qui part (F14); un seul fichier, à joindre à un message; facile à lire pour le studio | les minidumps n'y entrent pas: un plantage natif s'analyse par ses raisons et le journal, pas par sa mémoire |
| B. Archive zip avec journaux bruts, minidumps et configuration | tout est là | illisible pour le joueur, donc contraire à F14; données personnelles possibles dans les minidumps |
| C. Envoi automatique à un service | aucun geste du joueur | pas de serveur, hors ligne, consentement: exclu |

## Décision

**Option A.**

### 1. Journal

- Écrit par le principal seul, en JSON Lines (`logs/duo-AAAA-MM-JJ.jsonl`), une ligne par événement: date ISO 8601, horloge monotone en millisecondes, niveau, module, événement, détails. Les vues envoient leurs entrées par l'IPC et le pont (module `log` du SDK); les erreurs de console des vues sont captées par l'événement `console-message`.
- Événements de session (prérequis 5): démarrage et lanceur prêt, présence de l'autre machine, salon, prêt, départ, chargement, pause, coupure, reconnexion, reprise, fin, sauvegarde écrite et copiée, copie et installation d'un jeu, plantage ou blocage d'un jeu, avec leur durée quand elle a un sens.
- Rotation: 7 fichiers au plus et 5 Mo par fichier.
- **Nettoyage à l'écriture**: le dossier personnel devient `~`; ni nom d'ordinateur, ni nom du compte, ni adresse matérielle, ni nom de réseau Wi-Fi, ni adresse IPv6, ni adresse publique (Duo n'en connaît aucune). Les identifiants de machine et de duo sont remplacés par une empreinte courte (6 caractères hexadécimaux du SHA-256 de l'identifiant et de l'identifiant du duo): les rapports des deux machines restent rapprochables sans identifiant réutilisable ailleurs. Une fonction unique de nettoyage, testée par des marqueurs (nom d'ordinateur, compte, chemin, adresse matérielle de test), sert au journal et au rapport.

### 2. Rapport

- Fichier texte UTF-8, sections titrées:
  1. versions: Duo, protocole, pont, format des données, Electron, Chromium, Node, jeux installés;
  2. machine: système et version, architecture, modèle et nombre de cœurs du processeur, mémoire totale, type de disque si le système le dit, écrans (définition, facteur d'échelle);
  3. rendu: `app.getGPUInfo('basic')` et `app.getGPUFeatureStatus()`, rendu matériel ou logiciel, dernières mesures de l'affichage des performances;
  4. réseau: interfaces actives (nom générique, type, adresses IPv4 privées), autorisations et profil réseau tels que les voit le diagnostic (ADR 0008), état de la liaison et du dernier diagnostic;
  5. duo: pseudos, présence de l'autre machine, partie en cours ou dernière partie;
  6. événements récents: les 2 000 dernières lignes du journal, et les raisons des derniers plantages (sans leur contenu mémoire).
- Taille: 2 Mo au plus.
- **Aperçu avant enregistrement** (F14): le principal assemble le rapport, la vue plateforme l'affiche dans une fenêtre qui défile, avec « Enregistrer dans Téléchargements » et « Copier ». Rien n'est écrit ni copié avant ce choix.
- **Enregistrer**: `app.getPath('downloads')`, nom `duo-rapport-AAAA-MM-JJ-HHhMM.txt` (sans écraser un fichier existant), puis M-36 avec le nom du fichier.
- **Copier**: même rapport, limité aux 300 dernières lignes du journal pour rester collable dans un message; M-36.
- Les trois points d'entrée de la spécification UX ouvrent le même aperçu.

### 3. Rapports de plantage natifs

`crashReporter` reste local, sans envoi (ADR 0003). Les minidumps n'entrent jamais dans le rapport; seuls leur nombre, leur date et la raison du plantage y figurent. Ils sont supprimés au bout de 30 jours.

## Conséquences

- Le rapport se lit comme un document: le joueur sait ce qu'il envoie, le studio le lit sans outil.
- Le nettoyage s'applique dès l'écriture du journal: aucun fichier du dossier `logs/` ne contient de donnée personnelle hors des pseudos.
- « En un clic »: un clic ouvre l'aperçu, un second enregistre ou copie. ux-ui-designer et le manager diront si ce second clic convient au client (F14 exige que le joueur voie le contenu avant l'enregistrement).
- qa-testeur doit écrire les critères de F14 (roadmap): aperçu avant tout enregistrement, contenu par section, absence des marqueurs de données personnelles, taille.

### À vérifier

- Contenu réel de `app.getGPUInfo('basic')` sur le PC (Intel UHD 620) et sur le Mac: champs utiles au diagnostic du rendu logiciel.
- Accès au dossier Téléchargements sous macOS: aucune autorisation n'est attendue pour l'application elle-même, à confirmer sur une version signée ad hoc.
