'use strict';
// Aides partagées par les planches de l'identité B (servies par outils/rendre-planches.cjs).
window.Duo = {
  async json(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return r.json();
  },
  async inclure(url, cible) {
    const r = await fetch(url);
    cible.insertAdjacentHTML('beforeend', await r.text());
  },
  // jeton de joueur: symbole coloré, avec halo en anneau à partir de 32 px (règle de l'identité)
  jeton(joueur, taille, { halo = taille >= 32, couleur } = {}) {
    const c = couleur || joueur.color;
    const t = Math.max(1.5, taille * 0.03);
    const r = taille * 0.47;
    const s = halo ? 0.62 : 1;
    const o = (taille * (1 - s)) / 2;
    return `<svg width="${taille}" height="${taille}" viewBox="0 0 ${taille} ${taille}" aria-hidden="true">${halo ? `<circle cx="${taille / 2}" cy="${taille / 2}" r="${r - t / 2}" fill="none" stroke="${c}" stroke-width="${t}" style="opacity: var(--player-halo-opacity)"/>` : ''}<svg x="${o}" y="${o}" width="${taille * s}" height="${taille * s}" viewBox="0 0 24 24"><path fill="${c}" d="${joueur.path}"/></svg></svg>`;
  },
  fr(n, d = 1) {
    return Number(n).toFixed(d).replace('.', ',');
  },
};
