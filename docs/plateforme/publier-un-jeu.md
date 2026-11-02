# Publier un jeu

Un jeu se publie sans nouvelle version de Duo (ADR 0010, point 3). La publication crée une release GitHub `jeu-<id>-v<version>` avec le paquet signé `<id>-<version>.duogame`, puis met à jour `catalogue.json` dans la release `catalogue`, que Duo lit pour trouver les nouveaux jeux. Le travail est fait par le workflow `.github/workflows/jeux.yml`.

## Une seule fois: la clé de signature

La clé privée qui signe les paquets vit dans les secrets du dépôt, jamais dans un fichier versionné.

1. Sur GitHub, dans le dépôt `Haeev/duo`: **Settings** > **Secrets and variables** > **Actions** > **New repository secret**.
2. **Name**: `DUO_CLE_PAQUETS`.
3. **Secret**: le contenu complet du fichier PEM fourni par le manager, de la ligne `-----BEGIN PRIVATE KEY-----` à la ligne `-----END PRIVATE KEY-----` comprises.
4. **Add secret**. GitHub ne la réaffiche plus jamais: ranger le fichier PEM dans un gestionnaire de mots de passe (sans lui, changer de clé demande une nouvelle version de Duo), puis supprimer les autres copies (message, téléchargements).

L'identifiant de la clé vaut `duo-2026` par défaut. Pour une autre clé (rotation), il se règle dans **Settings** > **Secrets and variables** > **Actions** > onglet **Variables**, variable `DUO_CLE_PAQUETS_ID`, et la version de Duo qui connaît la nouvelle clé publique doit être publiée avant.

## Publier une version

1. Monter la version du jeu, qui doit être nouvelle (une version publiée ne se republie jamais):
   `pnpm jeu:version <id> patch` (correctif), `minor` (nouveautés) ou `major`. La commande met à jour `games/<id>/duo-game.json` et `games/<id>/package.json`.
2. Écrire le champ `whatsNew` du manifeste: c'est le texte des notes de la release, lu par les joueurs.
3. Committer et pousser la branche.
4. `bash outils/publier-jeu.sh <id>`: le script vérifie que l'arbre est propre, que tout est poussé et que le tag n'existe pas encore, puis crée et pousse le tag `jeu-<id>-v<version>`.

Sans terminal: onglet **Actions** > workflow **Jeux** > **Run workflow**, choisir la branche, saisir l'identifiant du jeu. La version est lue dans le manifeste de la branche choisie, et le tag est créé sur son dernier commit.

## Vérifier

- Onglet **Actions**: le workflow **Jeux** passe au vert (jobs « Jeu, version et tag », « Tests, construction et paquet signé », « Release du jeu », « Catalogue des jeux »).
- Onglet **Releases**: `jeu-<id>-v<version>` contient `<id>-<version>.duogame` et `entree-catalogue.json`; elle n'est pas marquée « Latest » (réservée à l'application).
- `https://github.com/Haeev/duo/releases/download/catalogue/catalogue.json` montre la nouvelle version du jeu.
- Dans Duo, « Chercher de nouveaux jeux »: le jeu se met à jour, sans réinstaller l'application.

## En cas d'échec

| Message ou symptôme | Que faire |
|---|---|
| « La release ... existe déjà » | Cette version est publiée. Monter la version (`pnpm jeu:version <id> patch`), committer, pousser, republier. |
| « tag ...: duo-game.json est en version ... » | Le tag ne correspond pas au manifeste. Supprimer le tag fautif (`git push origin :refs/tags/<tag>` puis `git tag -d <tag>`), corriger, republier. |
| « Secret DUO_CLE_PAQUETS absent » | Ajouter le secret (section ci-dessus), puis relancer le job en échec (**Re-run failed jobs**). |
| Tests ou construction en échec | Corriger le jeu sur la branche. Le tag désigne l'ancien commit: le supprimer (voir plus haut), puis republier. Rien n'a été publié. |
| Release créée mais « Catalogue des jeux » en échec ou annulé | **Run workflow** avec l'identifiant du jeu et la case **Catalogue seul** cochée: le catalogue reprend l'entrée de la release existante, sans rien reconstruire. |
| « ... y est déjà en ..., plus récente que ... » | Le catalogue a déjà une version plus récente du jeu: jamais de retour en arrière (ADR 0006). Pour annuler une version défectueuse, publier une version supérieure. |

Deux publications de jeux en même temps se suivent pour le catalogue (un seul job de catalogue à la fois). Au-delà de deux, GitHub peut annuler un job de catalogue resté en attente: le recours « Catalogue seul » le rattrape.
