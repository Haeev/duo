# Décisions d'architecture (ADR) de la plateforme Duo

Chaque décision structurante de la plateforme a son ADR: contexte, au moins deux options comparées, décision, conséquences (dont ce qui reste à vérifier), statut, date, rédacteur. Les ADR acceptés priment sur les orientations de `CLAUDE.md` et sur `architecture.md`, qui en est la synthèse.

## Règles

- Nom de fichier: `NNNN-titre-court.md`, numéro à quatre chiffres, jamais réattribué.
- Statuts: **proposée** (rédigée, en attente de relecture par le manager), **acceptée**, **remplacée par NNNN**, **abandonnée**. Seul le manager passe un ADR à « acceptée ».
- On ne réécrit pas un ADR accepté: une décision qui change fait l'objet d'un nouvel ADR, qui remplace l'ancien; l'ancien garde son texte et prend le statut « remplacée par NNNN ».
- Un ADR cite les faits vérifiés (versions, documentation, essais) avec leur date, et range dans « À vérifier » ce qui ne l'a pas été.

## Index

| # | Titre | Statut | Rédacteur | Fichier |
|---|---|---|---|---|
| 0001 | Pile technique et versions figées | acceptée | architecte-technique | [0001-pile-technique.md](0001-pile-technique.md) |
| 0002 | Monorepo et outillage | acceptée | architecte-technique (avec ingenieur-build) | [0002-monorepo-outillage.md](0002-monorepo-outillage.md) |
| 0003 | Processus Electron et sécurité | acceptée | architecte-technique (avec dev-plateforme) | [0003-processus-electron-securite.md](0003-processus-electron-securite.md) |
| 0004 | Isolation et hébergement des jeux | acceptée | architecte-technique (avec dev-plateforme) | [0004-isolation-hebergement-jeux.md](0004-isolation-hebergement-jeux.md) |
| 0005 | Contrat des jeux et SDK | acceptée | architecte-technique | [0005-contrat-jeux-sdk.md](0005-contrat-jeux-sdk.md) |
| 0006 | Versions et compatibilité | acceptée | architecte-technique (avec dev-reseau, ingenieur-build) | [0006-versions-compatibilite.md](0006-versions-compatibilite.md) |
| 0007 | Modèle réseau et transport | acceptée | dev-reseau (avec architecte-technique) | [0007-modele-reseau-et-transport.md](0007-modele-reseau-et-transport.md) |
| 0008 | Découverte et pare-feu | acceptée | dev-reseau | [0008-decouverte-et-pare-feu.md](0008-decouverte-et-pare-feu.md) |
| 0009 | Données du duo | acceptée | architecte-technique (avec dev-plateforme, dev-reseau) | [0009-donnees-du-duo.md](0009-donnees-du-duo.md) |
| 0010 | Distribution des jeux | acceptée | architecte-technique (avec ingenieur-build) | [0010-distribution-jeux.md](0010-distribution-jeux.md) |
| 0011 | Installateurs, signature et mises à jour de l'application | acceptée | ingenieur-build | [0011-installateurs-signature-mises-a-jour.md](0011-installateurs-signature-mises-a-jour.md) |
| 0012 | Interface du lanceur | acceptée | architecte-technique (avec dev-plateforme, ux-ui-designer) | [0012-interface-lanceur.md](0012-interface-lanceur.md) |
| 0013 | Stratégie de test et CI | acceptée | architecte-technique (avec qa-testeur, ingenieur-build) | [0013-tests-ci.md](0013-tests-ci.md) |
| 0014 | Moteur 2D par défaut (PixiJS ou Phaser 4) | différée au premier jeu 2D | architecte-technique (avec dev-gameplay-2d) | non rédigé |
| 0015 | Journal et rapport de diagnostic (F14) | acceptée | architecte-technique (avec dev-plateforme) | [0015-journal-rapport-diagnostic.md](0015-journal-rapport-diagnostic.md) |
| 0016 | Intérieurs sur la carte et carte élargie (La Petite Ligne, tour 10) | acceptée | architecte-technique (avec dev-gameplay-3d, dev-reseau, level-designer, tech-artist) | [0016-interieurs-et-carte-elargie-petite-ligne.md](0016-interieurs-et-carte-elargie-petite-ligne.md) |
| 0017 | Refonte de La Petite Ligne dans un nouveau paquet, contenu par gabarits | proposée | architecte-technique (avec ingenieur-build, dev-gameplay-3d, game-designer, level-designer, qa-testeur) | [0017-refonte-petite-ligne-nouveau-paquet.md](0017-refonte-petite-ligne-nouveau-paquet.md) |
| 0018 | Lieux de La Petite Ligne: un seul lieu actif | proposée | architecte-technique (avec dev-gameplay-3d, dev-reseau, level-designer, game-designer) | [0018-lieux-petite-ligne-un-seul-lieu-actif.md](0018-lieux-petite-ligne-un-seul-lieu-actif.md) |
| 0019 | État en tranches sur le réseau (La Petite Ligne) | proposée | architecte-technique (avec dev-reseau, dev-gameplay-3d, qa-testeur) | [0019-etat-en-tranches-petite-ligne.md](0019-etat-en-tranches-petite-ligne.md) |
| 0020 | Ressenti: prédiction du geste chez l'invité, mini-jeux locaux, gestes bornés | proposée | architecte-technique (avec dev-reseau, dev-gameplay-3d, ux-ui-designer, sound-designer, qa-testeur) | [0020-ressenti-prediction-du-geste-petite-ligne.md](0020-ressenti-prediction-du-geste-petite-ligne.md) |
| 0021 | Personnages modulaires de La Petite Ligne, squelette commun de 24 os | proposée | architecte-technique (avec tech-artist, artiste-3d, dev-gameplay-3d, directeur-artistique, dev-reseau) | [0021-personnages-modulaires-squelette-commun.md](0021-personnages-modulaires-squelette-commun.md) |
| 0022 | Grands lieux de La Petite Ligne: une grille, des tuiles de rendu, le plan comme source | proposée | architecte-technique (avec level-designer, dev-gameplay-3d, dev-reseau, tech-artist, qa-testeur) | [0022-grands-lieux-tuiles-plan-source-petite-ligne.md](0022-grands-lieux-tuiles-plan-source-petite-ligne.md) |

« Avec » désigne les membres qui doivent relire l'ADR; ils ne l'ont pas encore fait au 2026-10-30. Les ADR 0007 et 0008 étaient en cours de rédaction par dev-reseau à la date de cet index: leur ligne est à compléter (statut, lien) à leur intégration.

## Documents liés

- `../architecture.md`: synthèse vivante (processus, modules, flux, contrat des jeux, budgets, risques, découpage).
- `resolution-hypotheses.md`: décision retenue pour chacune des hypothèses H-01 à H-35 des critères d'acceptation, l'ADR qui la porte, et les critères à ajuster.
- `../cahier-des-charges.md` (1.0, validé le 2026-10-30): le contrat de la plateforme, que les ADR mettent en œuvre sans le contredire.
