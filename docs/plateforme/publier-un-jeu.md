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

## Publier la refonte de La Petite Ligne (`la-petite-ligne-2`)

La refonte est un jeu à part (ADR 0017): identifiant `la-petite-ligne-2`, nom « La Petite Ligne (refonte) », sa propre release `jeu-la-petite-ligne-2-v<version>`. Le workflow **Jeux** la traite comme n'importe quel jeu: l'entrée du catalogue remplace seulement celle de `la-petite-ligne-2`, l'ancien jeu et les autres restent. Seul le script `test` du paquet tourne (moins de 5 secondes en local), jamais `test:longues`.

Déclenchement à la main, sur la branche à publier (l'identifiant à tirets se lit sans ambiguïté dans le tag):

```text
gh workflow run jeux.yml --ref <branche> -f jeu=la-petite-ligne-2
```

Ajouter `-f sans_tests=true` pour passer les tests (les types restent contrôlés). La version est lue dans `games/la-petite-ligne-2/duo-game.json` au commit de la branche, et le tag `jeu-la-petite-ligne-2-v<version>` est créé par la release. Sans terminal: onglet **Actions** > **Jeux** > **Run workflow**, `jeu` = `la-petite-ligne-2`.

La vignette provisoire (décor de maquette, ruban « REFONTE ») se régénère avec `pnpm --filter ./games/la-petite-ligne-2 run vignette` (nécessite `rsvg-convert`, fourni par `outils/installer-outils.sh`); sources dans `games/la-petite-ligne-2/assets-src/vignette/`. Elle sera remplacée au jalon des assets définitifs.

## Retirer un jeu du catalogue (par exemple l'ancienne `la-petite-ligne`)

À faire quand la refonte a plus à offrir que l'ancien jeu (ADR 0017: à l'Alpha de la refonte, sur décision du client). Rien de tout cela n'a été lancé. Dans l'ordre:

1. **Prévenir chez les joueurs**: publier d'abord une version de la refonte qui reprend ce qui compte (la mémoire des parties de l'ancien jeu ne passe pas dans le nouveau: nouvel identifiant, sauvegardes séparées, à dire au client).
2. **Ne plus embarquer l'ancien jeu dans l'installateur**: `BUNDLED_GAMES` dans `apps/duo/electron-builder.config.mjs` désigne aujourd'hui `games/la-petite-ligne` (jeu copié dans l'application, installé au premier lancement), et `build:app` du `package.json` racine le construit. Les deux changent avant la prochaine version de Duo, sinon l'ancien jeu réapparaît à chaque nouvelle installation. Voir aussi les tests de `apps/duo/scripts/tests/jeux-embarques.test.mjs`.
3. **Retirer l'entrée du catalogue en ligne** (le workflow ne sait qu'ajouter ou remplacer): télécharger `catalogue.json` depuis la release `catalogue`, retirer l'entrée, le remettre, puis relire l'adresse publique:

   ```text
   gh release download catalogue --pattern catalogue.json --dir catalogue
   node -e 'const f=require("fs");const c=JSON.parse(f.readFileSync("catalogue/catalogue.json","utf8"));c.jeux=c.jeux.filter(j=>j.id!=="la-petite-ligne");f.writeFileSync("catalogue/catalogue.json",JSON.stringify(c,null,2)+"\n")'
   gh release upload catalogue catalogue/catalogue.json --clobber
   ```

   Le filtre a été essayé sur un catalogue simulé à trois jeux (il en reste deux). Le workflow ne remettra pas l'ancien jeu: il ne rajoute que le jeu publié.
4. **Garder les releases `jeu-la-petite-ligne-v*`**: elles servent d'archive (retour possible, fichiers `.duogame` pour une copie manuelle). Ne pas les supprimer tant qu'un joueur peut en avoir besoin.
5. **Dossier `games/la-petite-ligne/`**: le supprimer du dépôt dans un commit séparé, après les étapes 2 et 3 (les workflows ne le citent pas, sauf `build:app`), puis relancer `pnpm install` pour mettre à jour `pnpm-lock.yaml` (l'espace de travail prend `games/*` sans liste nommée).
6. **Chez le client**: ce que Duo fait d'un jeu déjà installé qui sort du catalogue n'est pas décrit par l'ADR 0010, et le code de `apps/duo/src/main/games/` n'en retire aucun (pas de désinstallation trouvée): il reste a priori installé et jouable, sans mise à jour. À vérifier sur les vraies machines avant de l'annoncer.
