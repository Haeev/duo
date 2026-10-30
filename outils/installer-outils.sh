#!/usr/bin/env bash
# Boîte à outils de production du studio Duo, pour l'environnement cloud (Ubuntu 24.04).
#
# Autonome: ce fichier peut être collé tel quel dans le « Setup script » de l'environnement
# cloud (installation faite une fois puis mise en cache), ou lancé en session:
#   bash outils/installer-outils.sh
# Relançable sans risque: ce qui est déjà installé est sauté.
#
# Installe:
#   - Blender 5.2 en module Python (bpy), mido, Pillow, scipy, pedalboard, dans
#     /opt/duo-outils/venv, avec la commande `duo-python` pour s'en servir;
#   - FluidSynth et la banque d'instruments General MIDI FluidR3_GM (licence MIT);
#   - rsvg-convert (SVG vers PNG).
set -uo pipefail

OUTILS_DIR="${DUO_OUTILS_DIR:-/opt/duo-outils}"
VENV="$OUTILS_DIR/venv"
SF2=/usr/share/sounds/sf2/FluidR3_GM.sf2
PAQUETS_PY=("bpy==5.2.3" "mido==1.3.3" "pillow==13.0.0" "scipy==1.18.1" "pedalboard==0.9.26")
SUDO=""
[ "$(id -u)" -ne 0 ] && SUDO="sudo"

installer_systeme() {
  if command -v fluidsynth >/dev/null && [ -f "$SF2" ] && command -v rsvg-convert >/dev/null; then
    echo "déjà installé"
    return 0
  fi
  $SUDO apt-get update -qq &&
    DEBIAN_FRONTEND=noninteractive $SUDO apt-get install -y -qq fluidsynth fluid-soundfont-gm librsvg2-bin
}

installer_python() {
  $SUDO mkdir -p "$OUTILS_DIR" || return 1
  if [ ! -x "$VENV/bin/python" ]; then
    $SUDO python3 -m venv "$VENV" || return 1
  fi
  $SUDO "$VENV/bin/pip" install -q --disable-pip-version-check "${PAQUETS_PY[@]}" || return 1
  # Un lanceur et non un lien symbolique: appelé via un lien, Python ne trouve plus
  # le pyvenv.cfg du venv et démarre sans ses paquets.
  printf '#!/bin/sh\nexec "%s/bin/python" "$@"\n' "$VENV" | $SUDO tee /usr/local/bin/duo-python >/dev/null &&
    $SUDO chmod +x /usr/local/bin/duo-python
}

# En parallèle: le téléchargement de bpy domine (environ 2 minutes), sous la limite
# de 5 minutes au-delà de laquelle l'environnement cloud ne met plus en cache.
JOURNAL_SYS=$(mktemp)
JOURNAL_PY=$(mktemp)
installer_systeme >"$JOURNAL_SYS" 2>&1 &
PID_SYS=$!
installer_python >"$JOURNAL_PY" 2>&1 &
PID_PY=$!
wait "$PID_SYS"
ETAT_SYS=$?
wait "$PID_PY"
ETAT_PY=$?

echo "== Boîte à outils Duo =="
if [ "$ETAT_SYS" -eq 0 ]; then
  echo "Système: OK ($(fluidsynth --version 2>/dev/null | head -n 1), $(rsvg-convert --version 2>/dev/null))"
else
  echo "Système: ÉCHEC (code $ETAT_SYS)"
  tail -n 5 "$JOURNAL_SYS"
fi
if [ "$ETAT_PY" -eq 0 ] && duo-python -c "import bpy, mido, PIL, scipy, pedalboard" 2>/dev/null; then
  duo-python - <<'EOF'
import importlib.metadata as md
import bpy
print("Python: OK (" + ", ".join(f"{p} {md.version(p)}" for p in ("bpy", "mido", "pillow", "scipy", "pedalboard")) + ")")
print(f"Blender: {bpy.app.version_string}")
EOF
else
  echo "Python: ÉCHEC (code $ETAT_PY)"
  tail -n 5 "$JOURNAL_PY"
fi
for outil in ffmpeg convert xvfb-run node; do
  command -v "$outil" >/dev/null && echo "Présent: $outil" || echo "Absent: $outil"
done
rm -f "$JOURNAL_SYS" "$JOURNAL_PY"

# Toujours 0: un échec d'installation ne doit pas empêcher la session de démarrer;
# il est signalé ci-dessus et l'équipe peut relancer ce script.
exit 0
