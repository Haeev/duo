"""Copie la planche dans le dépôt: livrer.py <dossier de travail> <racine du dépôt>"""
import shutil
import sys
from pathlib import Path
from PIL import Image

here = Path(sys.argv[1])
dest = Path(sys.argv[2]) / 'docs/jeux/jeu-1/gauntlet/captures/qualite-visuelle/decision'
(dest / 'ecrans').mkdir(parents=True, exist_ok=True)
(dest / 'marche').mkdir(parents=True, exist_ok=True)
for f in sorted((here / 'planche').glob('*.webp')):
    shutil.copy(f, dest / f.name)
for f in sorted((here / 'captures').glob('*.png')):
    if f.name.startswith('marche'):
        continue
    Image.open(f).convert('RGB').save(dest / 'ecrans' / (f.stem + '.webp'), 'WEBP', quality=88, method=6)
for f in sorted((here / 'video').glob('*.mp4')):
    shutil.copy(f, dest / 'marche' / f.name)
for name, out in (('contact-z0.webp', 'planche-contact-1366-zoom0.webp'), ('contact-z1.webp', 'planche-contact-1366-zoom1.webp')):
    Image.open(here / name).save(dest / 'marche' / out, 'WEBP', quality=85, method=6)
total = sum(p.stat().st_size for p in dest.rglob('*') if p.is_file())
print(len(list(dest.rglob('*.*'))), 'fichiers', round(total / 1e6, 1), 'Mo')
