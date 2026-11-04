#!/usr/bin/env bash
# Planche de décision de l'étape A (qualité visuelle): quatre états des trois témoins dans le vrai moteur.
# Usage, depuis la racine du dépôt: bash games/la-petite-ligne/assets-src/modeles/verifier/decision/planche_decision.sh <dossier de travail> <ancien personnages.glb>
# L'ancien GLB (0.12) s'obtient par: git show 853e0fb^1:games/la-petite-ligne/assets/modeles/personnages.glb > <fichier>
# Deux serveurs Vite: 5948 avec les modèles du dépôt, 5949 avec l'ancien GLB (chacun son cache).
# Rendu logiciel: environ 1 h 30 sur 4 cœurs pour les 42 écrans et les deux marches.
set -euo pipefail
work="$1"
old="$2"
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../../../../.." && pwd)"
game="$root/games/la-petite-ligne"
mkdir -p "$work"
cd "$game"
LPL_PORT=5948 LPL_CACHE="$work/cache-neuf" node_modules/.bin/vite --config "$here/vite.planche.config.ts" > "$work/vite-neuf.log" 2>&1 &
neuf=$!
LPL_PORT=5949 LPL_CACHE="$work/cache-ancien" LPL_ANCIEN="$old" node_modules/.bin/vite --config "$here/vite.planche.config.ts" > "$work/vite-ancien.log" 2>&1 &
ancien=$!
trap 'kill $neuf $ancien' EXIT
sleep 5
python3 "$here/prises.py" "$work"
python3 "$here/prises2.py" "$work" 53.4,35.6 53.1,35.3
node "$here/capture.cjs" "$work/captures" "$work/prises-5948.json" &
node "$here/capture.cjs" "$work/captures" "$work/prises-5949.json"
wait
node "$here/capture.cjs" "$work/captures" "$work/prises2-5948.json" &
node "$here/capture.cjs" "$work/captures" "$work/prises2-5949.json"
wait
python3 "$here/planche.py" "$work/captures" "$work/planche" "$here/crops.json"
python3 "$here/planche_marche.py" "$work/captures/marche-d-neuf-lisse-1366-z0" 380,110,1080,580 0.5 8 "$work/contact-z0.webp"
python3 "$here/planche_marche.py" "$work/captures/marche-d-neuf-lisse-1366-z1" 470,190,910,490 1 6 "$work/contact-z1.webp"
mkdir -p "$work/video"
ffmpeg -hide_banner -loglevel error -y -framerate 10 -i "$work/captures/marche-d-neuf-lisse-1366-z0-%03d.png" -vf "crop=700:470:380:110" -c:v libx264 -pix_fmt yuv420p -crf 22 -movflags +faststart "$work/video/marche-1366-zoom0-neuf-lisse.mp4"
ffmpeg -hide_banner -loglevel error -y -framerate 10 -i "$work/captures/marche-d-neuf-lisse-1366-z1-%03d.png" -vf "crop=440:300:470:190,scale=880:600:flags=neighbor" -c:v libx264 -pix_fmt yuv420p -crf 22 -movflags +faststart "$work/video/marche-1366-zoom1-neuf-lisse-x2.mp4"
python3 "$here/livrer.py" "$work" "$root"
