#!/usr/bin/env bash
# Contrôle des tirets interdits (CLAUDE.md): ne doit rien afficher. Lancer depuis la racine du dépôt.
grep -rnI -e $'\xe2\x80\x94' -e $'\xe2\x80\x93' --exclude-dir=.git --exclude-dir=node_modules . || true
