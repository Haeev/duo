#!/usr/bin/env bash
# Publie la version actuelle d'un jeu (ADR 0010, point 3), pour le manager:
#   bash outils/publier-jeu.sh <id>
# Lit la version de games/<id>/duo-game.json, vérifie que l'arbre est propre,
# que le commit est poussé et que le tag n'existe ni ici ni sur origin, puis
# crée et pousse le tag jeu-<id>-v<version>. Le workflow .github/workflows/jeux.yml
# fait le reste. Pour monter la version avant: pnpm jeu:version <id> patch|minor|major
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: bash outils/publier-jeu.sh <id>   (exemple: la-petite-ligne)" >&2
  exit 2
fi
racine="$(cd "$(dirname "$0")/.." && pwd)"
cd "$racine"

sortie="$(node outils/publication-jeu.mjs tag "$1")"
tag="$(printf '%s\n' "$sortie" | sed -n 's/^tag=//p')"
version="$(printf '%s\n' "$sortie" | sed -n 's/^version=//p')"

if [ -n "$(git status --porcelain)" ]; then
  echo "Arbre de travail modifié: committe ou range tes changements avant de publier." >&2
  git status --short >&2
  exit 1
fi
if git rev-parse -q --verify "refs/tags/$tag" > /dev/null; then
  echo "Le tag $tag existe déjà ici: monte la version (pnpm jeu:version $1 patch)." >&2
  exit 1
fi
if [ -n "$(git ls-remote --tags origin "refs/tags/$tag")" ]; then
  echo "Le tag $tag existe déjà sur origin: monte la version (pnpm jeu:version $1 patch)." >&2
  exit 1
fi
# Le tag doit désigner un commit que GitHub connaît déjà, sur la branche poussée.
amont="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2> /dev/null || true)"
if [ -z "$amont" ]; then
  echo "La branche n'a pas de branche distante: pousse-la d'abord." >&2
  exit 1
fi
git fetch -q origin
if [ -n "$(git rev-list "$amont..HEAD")" ]; then
  echo "Des commits ne sont pas poussés sur $amont: pousse-les d'abord." >&2
  exit 1
fi

git tag -a "$tag" -m "$1 $version"
git push origin "refs/tags/$tag"
echo "Tag $tag poussé. Suivi: onglet Actions du dépôt, workflow « Jeux »."
