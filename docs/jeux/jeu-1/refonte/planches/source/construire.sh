#!/usr/bin/env bash
# Régénère les planches: SVG par planches.py, PNG par rsvg-convert (outils/installer-outils.sh).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
out="$here/.."
python3 "$here/planches.py" "$out"
python3 "$here/planches_v02.py" "$out"
for f in "$out"/*.svg; do rsvg-convert "$f" -o "${f%.svg}.png"; done
