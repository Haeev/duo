// Maquettes seulement: portraits provisoires en SVG (le jeu les tirera des modèles 3D ou
// de vignettes de l'artiste). Ils fixent ce que le portrait doit dire: cinq expressions
// lisibles en 48 px, le foulard à la couleur et au symbole du profil Duo.
// Usage dans une page: <span class="lpl-portrait" data-portrait="camille" data-expression="good"></span>
(function () {
  // Couleurs de palette.py (CHAR_ROWS et PLAYER_PRESETS).
  const PERSONNAGES = {
    camille: {
      skin: '#E8BE9A',
      shade: '#D29D7B',
      hair: '#6B4A33',
      top: '#5C7FA6',
      trim: '#EDE6D3',
      scarf: 'var(--lpl-player-self)',
      style: 'short',
      bg: '#D9E3EC',
    },
    sacha: {
      skin: '#B9825C',
      shade: '#9C6646',
      hair: '#2E2622',
      top: '#B5663F',
      trim: '#EDE6D3',
      scarf: 'var(--lpl-player-other)',
      style: 'tied',
      bg: '#EADBCF',
    },
    firmin: {
      skin: '#E3B48F',
      shade: '#C99273',
      hair: '#B9B4AC',
      top: '#2F3F5C',
      trim: '#3E5070',
      scarf: '#E9E3D3',
      style: 'cap',
      bg: '#DCE1E8',
    },
    odette: {
      skin: '#F0C7A6',
      shade: '#D9A585',
      hair: '#8D7F78',
      top: '#9C4F67',
      trim: '#F2EBDD',
      scarf: '#E7B04E',
      style: 'bun',
      bg: '#F1E1E3',
    },
    basile: {
      skin: '#D7A27C',
      shade: '#BC8463',
      hair: '#E4E0D8',
      top: '#A8B6A0',
      trim: '#8E5B37',
      scarf: '#C2563F',
      style: 'beard',
      bg: '#E8E0D0',
    },
    jeanne: {
      skin: '#F1C8A3',
      shade: '#DBA684',
      hair: '#B5652F',
      top: '#F2D46B',
      trim: '#557FB0',
      scarf: '#D9584F',
      style: 'braids',
      bg: '#F3EAC8',
    },
  };

  const CHEVEUX = {
    short: (c) =>
      `<path d="M30 46c-2-14 8-24 20-24s22 9 20 24c-4-7-10-10-20-10s-16 3-20 10z" fill="${c}"/>`,
    messy: (c) =>
      `<path d="M29 48c-3-15 7-27 21-27 13 0 23 10 21 26l-5-6-3 5-5-8-4 6-5-7-4 7-5-6-3 6z" fill="${c}"/>`,
    tied: (c) =>
      `<circle cx="50" cy="20" r="8" fill="${c}"/><path d="M30 47c-2-15 8-25 20-25s22 10 20 25c-3-8-10-12-20-12s-17 4-20 12z" fill="${c}"/>`,
    cap: (c) =>
      `<path d="M31 46c0-4 2-6 4-7h30c2 1 4 3 4 7z" fill="${c}"/><path d="M30 38c0-10 9-16 20-16s20 6 20 16z" fill="#2F3F5C"/><rect x="30" y="34" width="40" height="5" fill="#B33A33"/><path d="M48 38h26c0 3-3 5-8 5H50z" fill="#28344C"/>`,
    bun: (c) =>
      `<circle cx="50" cy="19" r="9" fill="${c}"/><path d="M30 48c-2-15 8-26 20-26s22 11 20 26c-2-9-9-13-20-13s-18 4-20 13z" fill="${c}"/>`,
    beard: (c) =>
      `<path d="M31 44c0-12 8-20 19-20s19 8 19 20c-4-5-10-7-19-7s-15 2-19 7z" fill="${c}"/>`,
    braids: (c) =>
      `<path d="M30 47c-2-15 8-25 20-25s22 10 20 25c-3-8-10-12-20-12s-17 4-20 12z" fill="${c}"/><path d="M29 46c-4 8-4 16-1 22h6c-2-7-1-14 1-20zM71 46c4 8 4 16 1 22h-6c2-7 1-14-1-20z" fill="${c}"/><circle cx="31" cy="70" r="3" fill="#557FB0"/><circle cx="69" cy="70" r="3" fill="#557FB0"/>`,
  };

  // Cinq expressions (forme du jour, PE-04), du plus bas au plus haut.
  const VISAGES = {
    low: '<path d="M38 50q4 -2 8 0M54 50q4 -2 8 0" stroke="#2A2522" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M38 47l7 -2M62 47l-7 -2" stroke="#2A2522" stroke-width="2" stroke-linecap="round"/><path d="M44 63q6 -4 12 0" stroke="#7A3D37" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
    ok: '<circle cx="42" cy="51" r="2.8" fill="#2A2522"/><circle cx="58" cy="51" r="2.8" fill="#2A2522"/><path d="M44 62h12" stroke="#7A3D37" stroke-width="2.6" stroke-linecap="round"/>',
    good: '<circle cx="42" cy="51" r="3" fill="#2A2522"/><circle cx="58" cy="51" r="3" fill="#2A2522"/><path d="M43 60q7 5 14 0" stroke="#7A3D37" stroke-width="2.8" fill="none" stroke-linecap="round"/>',
    great:
      '<circle cx="42" cy="50" r="3.2" fill="#2A2522"/><circle cx="58" cy="50" r="3.2" fill="#2A2522"/><circle cx="43" cy="49" r="1" fill="#fff"/><circle cx="59" cy="49" r="1" fill="#fff"/><path d="M42 58q8 9 16 0z" fill="#7A3D37"/><circle cx="36" cy="58" r="3.4" fill="#E99A8E" opacity="0.8"/><circle cx="64" cy="58" r="3.4" fill="#E99A8E" opacity="0.8"/>',
    radiant:
      '<path d="M38 52q4 -5 8 0M54 52q4 -5 8 0" stroke="#2A2522" stroke-width="2.8" fill="none" stroke-linecap="round"/><path d="M41 57q9 12 18 0z" fill="#7A3D37"/><path d="M45 61q5 3 10 0" fill="#E99A8E"/><circle cx="35" cy="59" r="4" fill="#E99A8E"/><circle cx="65" cy="59" r="4" fill="#E99A8E"/><path d="M78 26l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#E8C77A" stroke="#2A2522" stroke-width="1.2"/>',
  };

  const NOMS_EXPRESSIONS = {
    low: 'petite forme',
    ok: 'ça va',
    good: 'en forme',
    great: 'pleine forme',
    radiant: 'forme rayonnante',
  };

  function portrait(id, expression, coiffure) {
    const p = PERSONNAGES[id];
    if (!p) return '';
    const style = coiffure || p.style;
    const visage = VISAGES[expression] || VISAGES.good;
    const barbe =
      style === 'beard'
        ? `<path d="M34 56c2 16 8 22 16 22s14-6 16-22c-4 4-9 5-16 5s-12-1-16-5z" fill="${p.hair}"/><path d="M42 60q8 -4 16 0" stroke="${p.hair}" stroke-width="5" stroke-linecap="round"/>`
        : '';
    const moustache =
      id === 'firmin' ? `<path d="M41 58q9 -5 18 0q-9 3 -18 0z" fill="${p.hair}"/>` : '';
    const taches =
      id === 'jeanne'
        ? '<g fill="#B5652F" opacity="0.6"><circle cx="38" cy="57" r="1"/><circle cx="41" cy="59" r="1"/><circle cx="62" cy="57" r="1"/><circle cx="59" cy="59" r="1"/></g>'
        : '';
    const foulard = `<path d="M33 79c5 4 11 6 17 6s12-2 17-6l3 7c-6 4-13 6-20 6s-14-2-20-6z" fill="${p.scarf}" stroke="#2A2522" stroke-width="1.6"/>`;
    return (
      `<svg viewBox="0 0 100 100" role="img" aria-label="${NOMS_EXPRESSIONS[expression] || ''}">` +
      `<rect width="100" height="100" fill="${p.bg}"/>` +
      `<path d="M14 104c2-18 16-28 36-28s34 10 36 28z" fill="${p.top}"/>` +
      `<path d="M40 76h20l-2 10H42z" fill="${p.trim}"/>` +
      `<rect x="44" y="64" width="12" height="14" fill="${p.shade}"/>` +
      `<ellipse cx="50" cy="50" rx="19" ry="21" fill="${p.skin}"/>` +
      `<ellipse cx="31" cy="53" rx="3.5" ry="5" fill="${p.shade}"/><ellipse cx="69" cy="53" rx="3.5" ry="5" fill="${p.shade}"/>` +
      CHEVEUX[style](p.hair) +
      visage +
      taches +
      barbe +
      moustache +
      foulard +
      `</svg>`
    );
  }

  window.lplPortrait = portrait;

  function remplir(racine) {
    racine.querySelectorAll('[data-portrait]').forEach((el) => {
      const svg = portrait(el.dataset.portrait, el.dataset.expression, el.dataset.hair);
      const jeton = el.querySelector(':scope > .lpl-token');
      el.innerHTML = svg;
      if (jeton) el.append(jeton);
    });
  }
  window.lplRemplirPortraits = remplir;
  remplir(document);
})();
