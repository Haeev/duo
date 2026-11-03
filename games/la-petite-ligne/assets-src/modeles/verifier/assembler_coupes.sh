#!/usr/bin/env bash
# Assemble les vues de coupes de planche_beaute.py (mode coupes) en une image de contrôle.
#   bash verifier/assembler_coupes.sh <dossier des rendus> <image.png>
set -euo pipefail
d="$1"
t="$(mktemp -d)"
ls "$d"/coupe_*_nu_av.png | sort > "$t/n.txt"
ls "$d"/coupe_*_chapeau_av.png | sort > "$t/h.txt"
convert $(cat "$t/n.txt") +append "$t/n.png"
convert $(cat "$t/h.txt") +append "$t/h.png"
convert "$t/n.png" "$t/h.png" -append "$2"
rm -rf "$t"
