'use strict';
/*
  Scènes provisoires des maquettes: ce que montrerait la caméra à la première personne.
  Formes simples en gris (aucun style final); seules les couleurs des profils Duo sont en couleur,
  toujours portées par leur symbole. Les groupes [data-si] ne s'affichent que dans certains états.
  Sens du détail: la pancarte de la porte se lit depuis l'intérieur (« Côté rue »), le rail pend
  au-dessus du comptoir côté service, les tickets montrent leur dos depuis la salle.
*/
(function () {
  const GRIS = { plafond: '#e3e3e3', mur: '#d7d7d7', sol: '#c4c4c4', ligne: '#b2b2b2', meuble: '#9e9e9e', bord: '#6a6a6a', fonce: '#7a7a7a' };

  // Jeton d'un joueur dans la scène: disque de nuit cerclé d'encre, symbole dans sa couleur.
  function jeton(id, x, y, r) {
    const p = window.SYMBOLES_JOUEURS[id];
    const t = r * 1.24;
    return `<g><circle cx="${x}" cy="${y}" r="${r}" fill="#1A1F3D" stroke="#111" stroke-width="3"/>` +
      `<use href="#joueur-${id}" x="${x - t / 2}" y="${y - t / 2}" width="${t}" height="${t}" fill="${p.couleur}"/></g>`;
  }

  function aiguilles(cx, cy, h, m) {
    const ah = (((h % 12) + m / 60) * 30 * Math.PI) / 180;
    const am = (m * 6 * Math.PI) / 180;
    const xh = cx + 28 * Math.sin(ah);
    const yh = cy - 28 * Math.cos(ah);
    const xm = cx + 42 * Math.sin(am);
    const ym = cy - 42 * Math.cos(am);
    return `<line x1="${cx}" y1="${cy}" x2="${xh.toFixed(1)}" y2="${yh.toFixed(1)}" stroke="#222" stroke-width="7" stroke-linecap="round"/>` +
      `<line x1="${cx}" y1="${cy}" x2="${xm.toFixed(1)}" y2="${ym.toFixed(1)}" stroke="#222" stroke-width="4" stroke-linecap="round"/>`;
  }

  function horloge(cx, cy) {
    let graduations = '';
    for (let i = 0; i < 12; i += 1) {
      const a = (i * 30 * Math.PI) / 180;
      graduations += `<line x1="${(cx + 44 * Math.sin(a)).toFixed(1)}" y1="${(cy - 44 * Math.cos(a)).toFixed(1)}" x2="${(cx + 50 * Math.sin(a)).toFixed(1)}" y2="${(cy - 50 * Math.cos(a)).toFixed(1)}" stroke="#444" stroke-width="4"/>`;
    }
    return `<circle cx="${cx}" cy="${cy}" r="56" fill="#f6f6f6" stroke="#555" stroke-width="6"/>${graduations}` +
      `<g data-si="service proposition proposition-ouverte envoyee reprendre absence accueil commandes commandes-envoyee catalogue catalogue-proposer catalogue-attente carte equipe cafes bilans projets reglages">${aiguilles(cx, cy, 11, 20)}</g>` +
      `<g data-si="vide ouverture ouverture-ouverte composer pleine ensemble">${aiguilles(cx, cy, 7, 30)}</g>` +
      `<circle cx="${cx}" cy="${cy}" r="6" fill="#222"/>`;
  }

  function etiquette(x, y, texte) {
    const l = texte.length * 11 + 22;
    return `<g class="etiquette-scene"><rect x="${x}" y="${y}" width="${l}" height="32" rx="6" fill="#ffffff" stroke="#777" stroke-width="2" stroke-dasharray="6 4"/>` +
      `<text x="${x + 11}" y="${y + 22}" font-size="19" fill="#333" font-family="system-ui, sans-serif">${texte}</text></g>`;
  }

  const DEFS = `<defs>
    <pattern id="hachures" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="18" height="18" fill="#ffffff" fill-opacity="0.55"/>
      <line x1="0" y1="0" x2="0" y2="18" stroke="#111" stroke-width="6"/>
    </pattern>
    <clipPath id="clip-sol"><rect x="0" y="500" width="1920" height="580"/></clipPath>
  </defs>`;

  // ---------- 1. Depuis la salle, vers le comptoir (service à table) ----------
  function salleVersComptoir() {
    const tickets = [
      [null], ['orb'], ['crescent'], ['orb'], [null], [null], [null]
    ];
    let rail = `<line x1="560" y1="110" x2="560" y2="128" stroke="#666" stroke-width="4"/><line x1="1380" y1="110" x2="1380" y2="128" stroke="#666" stroke-width="4"/>` +
      `<rect x="540" y="128" width="860" height="10" fill="#6f6f6f"/>`;
    tickets.forEach(([joueur], i) => {
      const x = 580 + i * 110;
      rail += `<rect x="${x}" y="140" width="76" height="110" fill="#fafafa" stroke="#8a8a8a" stroke-width="2"/>` +
        `<rect x="${x + 28}" y="132" width="20" height="16" fill="#555"/>` +
        (joueur ? jeton(joueur, x + 38, 178, 21) : '');
    });
    let tasses = '';
    for (let x = 612; x < 840; x += 26) tasses += `<rect x="${x}" y="268" width="18" height="16" fill="#f2f2f2" stroke="#888" stroke-width="2"/>`;
    let craie = '';
    for (let y = 232; y <= 382; y += 30) craie += `<line x1="185" y1="${y}" x2="345" y2="${y}" stroke="#e9e9e9" stroke-width="5" stroke-linecap="round"/><line x1="395" y1="${y}" x2="440" y2="${y}" stroke="#e9e9e9" stroke-width="5" stroke-linecap="round"/>`;
    return `<svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${DEFS}
      <rect x="0" y="0" width="1920" height="110" fill="${GRIS.plafond}"/>
      <rect x="0" y="100" width="1920" height="14" fill="#c4c4c4"/>
      <rect x="0" y="114" width="1920" height="406" fill="${GRIS.mur}"/>
      <rect x="0" y="520" width="1920" height="560" fill="${GRIS.sol}"/>
      <g stroke="${GRIS.ligne}" stroke-width="3"><line x1="760" y1="520" x2="120" y2="1080"/><line x1="880" y1="520" x2="640" y2="1080"/><line x1="1040" y1="520" x2="1280" y2="1080"/><line x1="1160" y1="520" x2="1800" y2="1080"/></g>
      <rect x="150" y="150" width="320" height="260" fill="#333" stroke="#5c5c5c" stroke-width="10"/>
      <line x1="200" y1="190" x2="420" y2="190" stroke="#f4f4f4" stroke-width="8" stroke-linecap="round"/>${craie}
      <rect x="600" y="300" width="260" height="120" rx="10" fill="#8c8c8c"/>
      <rect x="604" y="284" width="252" height="16" fill="#777"/>
      <g data-si="service proposition proposition-ouverte envoyee reprendre absence vide ouverture ouverture-ouverte accueil commandes commandes-envoyee catalogue catalogue-proposer catalogue-attente carte equipe cafes bilans projets reglages composer pleine ensemble">${tasses}</g>
      <circle cx="660" cy="335" r="15" fill="#e6e6e6"/><circle cx="800" cy="335" r="15" fill="#e6e6e6"/>
      <rect x="645" y="420" width="50" height="16" fill="#666"/><rect x="765" y="420" width="50" height="16" fill="#666"/>
      <line x1="860" y1="340" x2="902" y2="418" stroke="#555" stroke-width="8" stroke-linecap="round"/>
      <polygon points="885,312 945,312 930,272 900,272" fill="#a3a3a3"/><rect x="890" y="312" width="50" height="108" fill="#7b7b7b"/>
      <line x1="980" y1="300" x2="1190" y2="300" stroke="#8a8a8a" stroke-width="6"/>
      <g fill="#ececec" stroke="#888" stroke-width="2"><rect x="995" y="270" width="20" height="30"/><rect x="1030" y="270" width="20" height="30"/><rect x="1065" y="270" width="20" height="30"/></g>
      ${horloge(1505, 225)}
      <rect x="1610" y="200" width="180" height="320" fill="#a9a9a9" stroke="#777" stroke-width="4"/>
      <rect x="1650" y="232" width="100" height="70" fill="#e8e8e8"/>
      <rect x="1646" y="318" width="108" height="32" fill="#f3f3f3" stroke="#777" stroke-width="2"/>
      <text x="1663" y="341" font-size="20" fill="#222" font-family="system-ui, sans-serif">Réserve</text>
      <rect x="260" y="430" width="1400" height="22" fill="#8d8d8d"/>
      <rect x="280" y="452" width="1360" height="158" fill="#a6a6a6"/>
      <g stroke="#969696" stroke-width="3"><line x1="500" y1="452" x2="500" y2="610"/><line x1="740" y1="452" x2="740" y2="610"/><line x1="980" y1="452" x2="980" y2="610"/><line x1="1220" y1="452" x2="1220" y2="610"/><line x1="1460" y1="452" x2="1460" y2="610"/></g>
      <rect x="360" y="372" width="110" height="58" fill="#6f6f6f"/>
      <rect x="1190" y="362" width="250" height="68" fill="#e8e8e8" stroke="#8a8a8a" stroke-width="4"/>
      <g fill="#b9b9b9"><ellipse cx="1235" cy="408" rx="24" ry="10"/><ellipse cx="1295" cy="408" rx="24" ry="10"/><ellipse cx="1355" cy="408" rx="24" ry="10"/><ellipse cx="1405" cy="408" rx="20" ry="10"/></g>
      <g data-si="service proposition proposition-ouverte envoyee reprendre absence accueil commandes commandes-envoyee catalogue catalogue-proposer catalogue-attente carte equipe cafes bilans projets reglages">${rail}</g>
      <g data-si="vide ouverture ouverture-ouverte composer pleine ensemble"><line x1="560" y1="110" x2="560" y2="128" stroke="#666" stroke-width="4"/><line x1="1380" y1="110" x2="1380" y2="128" stroke="#666" stroke-width="4"/><rect x="540" y="128" width="860" height="10" fill="#6f6f6f"/></g>
      <g data-si="service proposition proposition-ouverte envoyee reprendre absence accueil commandes commandes-envoyee catalogue catalogue-proposer catalogue-attente carte equipe cafes bilans projets reglages" fill="#808080">
        <circle cx="560" cy="362" r="34" fill="#7a7a7a"/><path d="M505 410 Q560 392 615 410 L628 640 L492 640 Z"/>
        <circle cx="705" cy="374" r="32" fill="#7a7a7a"/><path d="M652 420 Q705 404 758 420 L770 640 L640 640 Z"/>
      </g>
      <g data-si="service proposition proposition-ouverte envoyee reprendre absence accueil commandes commandes-envoyee catalogue catalogue-proposer catalogue-attente carte equipe cafes bilans projets reglages">
        <rect x="1040" y="470" width="140" height="92" fill="#9a9a9a"/>
        <circle cx="1110" cy="440" r="38" fill="#7a7a7a"/><rect x="1050" y="478" width="120" height="110" rx="26" fill="#888"/>
      </g>
      <ellipse cx="960" cy="596" rx="250" ry="58" fill="#8e8e8e"/>
      <ellipse cx="960" cy="585" rx="250" ry="58" fill="#a4a4a4" stroke="#6a6a6a" stroke-width="4"/>
      <rect x="945" y="640" width="30" height="262" fill="${GRIS.fonce}"/><ellipse cx="960" cy="905" rx="110" ry="24" fill="${GRIS.fonce}"/>
      <rect x="1050" y="566" width="40" height="28" fill="#fff" stroke="#555" stroke-width="2"/><text x="1062" y="588" font-size="20" fill="#111" font-family="system-ui, sans-serif">3</text>
      <ellipse cx="250" cy="812" rx="240" ry="56" fill="#a3a3a3" stroke="#6a6a6a" stroke-width="4"/>
      <g fill="#dedede" stroke="#888" stroke-width="2"><rect x="190" y="772" width="34" height="30"/><rect x="290" y="778" width="34" height="30"/></g>
      <g data-si="service proposition proposition-ouverte envoyee reprendre absence">
        <polygon points="1000,1080 1030,990 1100,985 1090,1080" fill="#9d9d9d"/>
        <polygon points="1500,1080 1500,985 1570,990 1600,1080" fill="#9d9d9d"/>
        <rect x="1030" y="930" width="540" height="96" rx="22" fill="#8a8a8a" stroke="#555" stroke-width="5"/>
        <rect x="1046" y="944" width="508" height="66" rx="14" fill="none" stroke="#6a6a6a" stroke-width="3"/>
        <ellipse cx="1185" cy="962" rx="56" ry="13" fill="#e6e6e6" stroke="#888" stroke-width="2"/>
        <rect x="1150" y="900" width="70" height="60" fill="#f0f0f0" stroke="#777" stroke-width="3"/><ellipse cx="1185" cy="900" rx="35" ry="10" fill="#cfcfcf" stroke="#777" stroke-width="2"/>
        <ellipse cx="1395" cy="958" rx="82" ry="20" fill="#ececec" stroke="#888" stroke-width="2"/><ellipse cx="1395" cy="948" rx="46" ry="13" fill="#b4b4b4"/>
        <ellipse cx="1065" cy="990" rx="34" ry="22" fill="#a9a9a9" stroke="#777" stroke-width="2"/><ellipse cx="1535" cy="990" rx="34" ry="22" fill="#a9a9a9" stroke="#777" stroke-width="2"/>
      </g>
      ${etiquette(1180, 256, 'Rail à tickets (dos)')}${etiquette(160, 420, 'Ardoise')}${etiquette(1180, 520, 'Table 3')}${etiquette(1622, 470, 'Porte de service')}
    </svg>`;
  }

  // ---------- 2. Derrière le comptoir, vers la salle et la porte ----------
  function comptoir() {
    const tickets = [
      ['11', 'Table 1', ['2 cafés crème'], null],
      ['12', 'Table 3', ['1 cappuccino', '1 tarte fruits'], 'orb'],
      ['13', 'Comptoir', ['1 thé vert'], 'crescent'],
      ['14', 'Comptoir', ['1 chocolat'], 'orb'],
      ['15', 'Table 5', ['2 chocolats', '1 pain choc.'], null],
      ['16', 'À emporter', ['1 café crème'], null]
    ];
    const barreRail = `<line x1="540" y1="90" x2="540" y2="120" stroke="#666" stroke-width="4"/><line x1="1380" y1="90" x2="1380" y2="120" stroke="#666" stroke-width="4"/>` +
      `<rect x="520" y="120" width="880" height="12" fill="#6f6f6f"/>`;
    let rail = '';
    tickets.forEach(([n, ou, lignes, joueur], i) => {
      const x = 560 + i * 135;
      rail += `<rect x="${x}" y="136" width="110" height="160" fill="#fdfdfd" stroke="#777" stroke-width="2"/>` +
        `<rect x="${x + 45}" y="126" width="20" height="18" fill="#555"/>` +
        `<text x="${x + 10}" y="168" font-size="26" font-weight="700" fill="#111" font-family="system-ui, sans-serif">${n}</text>` +
        `<text x="${x + 10}" y="196" font-size="17" fill="#222" font-family="system-ui, sans-serif">${ou}</text>` +
        lignes.map((l, j) => `<text x="${x + 10}" y="${224 + j * 24}" font-size="15" fill="#333" font-family="system-ui, sans-serif">${l}</text>`).join('') +
        (joueur ? jeton(joueur, x + 86, 158, 17) : '');
    });
    return `<svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${DEFS}
      <rect x="0" y="0" width="1920" height="90" fill="${GRIS.plafond}"/>
      <rect x="0" y="90" width="1920" height="380" fill="${GRIS.mur}"/>
      <rect x="0" y="470" width="1920" height="610" fill="#c6c6c6"/>
      <g stroke="${GRIS.ligne}" stroke-width="3"><line x1="820" y1="470" x2="300" y2="760"/><line x1="1100" y1="470" x2="1620" y2="760"/></g>
      <rect x="980" y="160" width="400" height="240" fill="#eeeeee" stroke="#9a9a9a" stroke-width="6"/>
      <line x1="1180" y1="160" x2="1180" y2="400" stroke="#9a9a9a" stroke-width="5"/><line x1="980" y1="280" x2="1380" y2="280" stroke="#9a9a9a" stroke-width="5"/>
      <rect x="1520" y="190" width="180" height="280" fill="#a9a9a9" stroke="#777" stroke-width="4"/>
      <rect x="1550" y="215" width="120" height="120" fill="#ececec"/>
      <circle cx="1688" cy="360" r="7" fill="#555"/>
      <line x1="1590" y1="215" x2="1610" y2="288" stroke="#666" stroke-width="2"/><line x1="1630" y1="215" x2="1610" y2="288" stroke="#666" stroke-width="2"/>
      <rect x="1562" y="288" width="96" height="46" fill="#fff" stroke="#444" stroke-width="3"/>
      <text x="1572" y="304" font-size="11" fill="#333" font-family="system-ui, sans-serif">CÔTÉ RUE</text>
      <text data-si="rail caisse" x="1572" y="326" font-size="19" font-weight="700" fill="#111" font-family="system-ui, sans-serif">OUVERT</text>
      <text data-si="preparation ouverture fermeture vide livre livre-vide premier appris chiffres plusieurs demain" x="1574" y="326" font-size="19" font-weight="700" fill="#111" font-family="system-ui, sans-serif">FERMÉ</text>
      <ellipse cx="860" cy="590" rx="95" ry="22" fill="#a0a0a0" stroke="#777" stroke-width="3"/>
      <g data-si="rail caisse"><circle cx="860" cy="520" r="20" fill="#7a7a7a"/><rect x="842" y="538" width="36" height="46" rx="10" fill="#888"/></g>
      <ellipse cx="1240" cy="600" rx="95" ry="22" fill="#a0a0a0" stroke="#777" stroke-width="3"/>
      <g data-si="rail caisse">${barreRail}${rail}</g>
      <g data-si="rail caisse">
        <circle cx="650" cy="430" r="38" fill="#7d7d7d"/><path d="M588 476 Q650 456 712 476 L722 700 L578 700 Z" fill="#8a8a8a"/>
      </g>
      <g data-si="rail caisse vide">
        <rect x="520" y="650" width="260" height="70" fill="#6a6a6a"/>
        <rect x="545" y="540" width="210" height="110" fill="#f0f0f0" stroke="#555" stroke-width="5"/>
        <g data-si="caisse" font-family="system-ui, sans-serif" fill="#111"><text x="558" y="568" font-size="17">Cappuccino 3,00</text><text x="558" y="594" font-size="17">Croissant 1,20</text><text x="558" y="630" font-size="19" font-weight="700">Total 4,20 €</text></g>
        <g data-si="rail vide" font-family="system-ui, sans-serif" fill="#333"><text x="570" y="600" font-size="19">La Tasse Bleue</text></g>
        <rect x="0" y="700" width="1920" height="120" fill="#8f8f8f"/>
        <rect x="0" y="820" width="1920" height="22" fill="#7a7a7a"/>
        <rect x="0" y="842" width="1920" height="238" fill="#6e6e6e"/>
        <g stroke="#5e5e5e" stroke-width="4" fill="none"><rect x="60" y="870" width="380" height="190"/><rect x="480" y="870" width="380" height="190"/><rect x="1060" y="870" width="380" height="190"/><rect x="1480" y="870" width="380" height="190"/></g>
        <rect x="840" y="735" width="240" height="36" rx="6" fill="#a8a8a8"/>
        <rect x="1360" y="600" width="360" height="112" fill="#e8e8e8" stroke="#8a8a8a" stroke-width="4"/>
        <g fill="#b9b9b9"><ellipse cx="1420" cy="680" rx="30" ry="12"/><ellipse cx="1500" cy="680" rx="30" ry="12"/><ellipse cx="1580" cy="680" rx="30" ry="12"/><ellipse cx="1660" cy="680" rx="26" ry="12"/></g>
        ${etiquette(860, 780, 'Passe')}${etiquette(790, 560, 'Caisse')}
      </g>
      ${etiquette(1505, 480, 'Porte, côté salle')}
    </svg>`;
  }

  // ---------- 3. Gros plan sur la machine à espresso (buse vapeur, chauffe-tasses) ----------
  function machine() {
    let tasses = '';
    for (let x = 300; x < 1620; x += 90) tasses += `<rect x="${x}" y="44" width="60" height="46" fill="#f2f2f2" stroke="#888" stroke-width="3"/>`;
    const centre = [780, 470];
    const angle = (t) => ((-135 + (t / 80) * 270) * Math.PI) / 180;
    const pt = (t, r) => [centre[0] + r * Math.sin(angle(t)), centre[1] - r * Math.cos(angle(t))].map((v) => v.toFixed(1));
    const [ax, ay] = pt(58, 40);
    const [bx, by] = pt(65, 40);
    const [nx, ny] = pt(55, 36);
    return `<svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${DEFS}
      <rect x="0" y="0" width="1920" height="1080" fill="${GRIS.mur}"/>
      <rect x="260" y="90" width="1400" height="30" fill="#777"/>
      <g data-si="geste geste-simplifie">${tasses}</g>
      <rect x="220" y="120" width="1480" height="600" rx="24" fill="#8e8e8e" stroke="#6b6b6b" stroke-width="6"/>
      <circle cx="420" cy="250" r="50" fill="#ececec" stroke="#555" stroke-width="5"/><line x1="420" y1="250" x2="446" y2="222" stroke="#222" stroke-width="5"/>
      <circle cx="600" cy="250" r="50" fill="#ececec" stroke="#555" stroke-width="5"/><line x1="600" y1="250" x2="572" y2="226" stroke="#222" stroke-width="5"/>
      <rect x="1000" y="220" width="400" height="70" fill="#a9a9a9"/>
      <rect x="330" y="560" width="170" height="80" fill="#666"/><rect x="560" y="560" width="170" height="80" fill="#666"/>
      <rect x="300" y="900" width="1340" height="60" fill="#6a6a6a"/>
      <circle cx="1320" cy="380" r="34" fill="#5a5a5a"/>
      <path d="M1300 400 L1050 520 L985 600" fill="none" stroke="#4f4f4f" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
      <g data-si="geste geste-simplifie">
        <polygon points="860,560 1100,560 1130,900 830,900" fill="#c9c9c9" stroke="#6b6b6b" stroke-width="6"/>
        <polygon points="860,560 812,538 868,580" fill="#c9c9c9" stroke="#6b6b6b" stroke-width="4"/>
        <ellipse cx="980" cy="560" rx="120" ry="22" fill="#e6e6e6" stroke="#6b6b6b" stroke-width="6"/>
        <ellipse cx="980" cy="566" rx="106" ry="15" fill="#fafafa"/>
        <path d="M1108 620 Q1200 700 1120 820" fill="none" stroke="#6b6b6b" stroke-width="18" stroke-linecap="round"/>
        <g fill="#f4f4f4" fill-opacity="0.92"><circle cx="1020" cy="530" r="26"/><circle cx="1060" cy="498" r="20"/><circle cx="1000" cy="492" r="15"/></g>
        <line x1="800" y1="510" x2="880" y2="590" stroke="#555" stroke-width="7"/>
        <circle cx="${centre[0]}" cy="${centre[1]}" r="48" fill="#fafafa" stroke="#444" stroke-width="5"/>
        <path d="M ${ax} ${ay} A 40 40 0 0 1 ${bx} ${by}" fill="none" stroke="#111" stroke-width="9"/>
        <line x1="${centre[0]}" y1="${centre[1]}" x2="${nx}" y2="${ny}" stroke="#222" stroke-width="4" stroke-linecap="round"/>
        <polygon points="1110,690 1215,680 1400,1080 1240,1080" fill="#9d9d9d"/>
        ${etiquette(560, 410, 'Thermomètre du pichet')}${etiquette(1180, 440, 'Buse vapeur')}
      </g>
      <g data-si="tasses">${etiquette(860, 140, 'Chauffe-tasses (vide)')}</g>
    </svg>`;
  }

  // ---------- 4. La salle en mode aménagement ----------
  function salle() {
    let grille = '';
    [540, 600, 680, 780, 900, 1040].forEach((y) => { grille += `<line x1="0" y1="${y}" x2="1920" y2="${y}"/>`; });
    [-900, -300, 330, 960, 1590, 2220, 2820].forEach((x) => { grille += `<line x1="960" y1="430" x2="${x}" y2="1080"/>`; });
    const chaise = (x, y) => `<rect x="${x}" y="${y}" width="60" height="70" rx="6" fill="#8f8f8f" stroke="#666" stroke-width="3"/>`;
    return `<svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${DEFS}
      <rect x="0" y="0" width="1920" height="500" fill="${GRIS.mur}"/>
      <rect x="700" y="110" width="520" height="290" fill="#eeeeee" stroke="#9a9a9a" stroke-width="8"/>
      <line x1="960" y1="110" x2="960" y2="400" stroke="#9a9a9a" stroke-width="6"/>
      <rect x="0" y="500" width="1920" height="580" fill="${GRIS.sol}"/>
      <g data-si="amenagement amenagement-eau amenagement-ok" clip-path="url(#clip-sol)" stroke="#b0b0b0" stroke-width="2">${grille}</g>
      <rect x="150" y="380" width="200" height="60" fill="#bdbdbd" stroke="#888" stroke-width="3"/>
      <path d="M240 380 L240 340 L280 340" fill="none" stroke="#666" stroke-width="8" stroke-linecap="round"/>
      <g data-si="amenagement-eau">
        <circle cx="250" cy="350" r="54" fill="none" stroke="#111" stroke-width="5" stroke-dasharray="10 7"/>
        <path d="M250 318 Q232 346 232 360 A18 18 0 0 0 268 360 Q268 346 250 318 Z" fill="#111"/>
        <ellipse cx="300" cy="610" rx="340" ry="92" fill="#ffffff" fill-opacity="0.45" stroke="#111" stroke-width="4" stroke-dasharray="14 9"/>
        ${etiquette(330, 300, 'Point d’eau')}
      </g>
      <g data-si="amenagement amenagement-ok porter">
        ${chaise(290, 630)}${chaise(500, 630)}
        <ellipse cx="420" cy="700" rx="170" ry="44" fill="#9e9e9e" stroke="#6a6a6a" stroke-width="4"/>
        ${chaise(1390, 640)}${chaise(1600, 640)}
        <ellipse cx="1520" cy="710" rx="170" ry="44" fill="#9e9e9e" stroke="#6a6a6a" stroke-width="4"/>
      </g>
      <g data-si="amenagement">
        <path d="M1500 1080 Q1330 900 1295 760 Q1270 640 1180 560" fill="none" stroke="#111" stroke-width="5" stroke-dasharray="4 14" stroke-linecap="round"/>
        <ellipse cx="1080" cy="700" rx="160" ry="42" fill="url(#hachures)" stroke="#111" stroke-width="5" stroke-dasharray="16 10"/>
        <rect x="1066" y="742" width="28" height="120" fill="url(#hachures)" stroke="#111" stroke-width="4" stroke-dasharray="10 8"/>
        <line x1="1240" y1="772" x2="1350" y2="772" stroke="#111" stroke-width="4"/><line x1="1240" y1="752" x2="1240" y2="792" stroke="#111" stroke-width="4"/><line x1="1350" y1="752" x2="1350" y2="792" stroke="#111" stroke-width="4"/>
        <rect x="1250" y="798" width="92" height="34" rx="6" fill="#fff" stroke="#111" stroke-width="3"/><text x="1262" y="822" font-size="21" font-weight="700" fill="#111" font-family="system-ui, sans-serif">60 cm</text>
        ${etiquette(1380, 880, 'Chemin des clients')}
      </g>
      <g data-si="amenagement-ok">
        <ellipse cx="960" cy="720" rx="150" ry="40" fill="#ffffff" fill-opacity="0.6" stroke="#111" stroke-width="5"/>
        <rect x="946" y="760" width="28" height="110" fill="#ffffff" fill-opacity="0.6" stroke="#111" stroke-width="4"/>
      </g>
      <g data-si="amenagement-eau">
        <rect x="880" y="590" width="220" height="190" fill="url(#hachures)" stroke="#111" stroke-width="5" stroke-dasharray="16 10"/>
        ${etiquette(890, 800, 'Lave-vaisselle (fantôme)')}
      </g>
      <g data-si="porter">
        <circle cx="1560" cy="520" r="40" fill="#7a7a7a"/>
        <rect x="1505" y="560" width="110" height="200" rx="24" fill="#888"/>
        <rect x="1525" y="590" width="70" height="150" rx="8" fill="${window.SYMBOLES_JOUEURS.crescent.couleur}" stroke="#111" stroke-width="3"/>
        ${jeton('crescent', 1560, 640, 22)}
        <polygon points="380,770 1540,700 1580,790 360,905" fill="#a7a7a7" stroke="#555" stroke-width="6"/>
        <polygon points="360,905 1580,790 1580,850 360,980" fill="#8f8f8f" stroke="#555" stroke-width="6"/>
        <polygon points="300,1080 360,900 470,905 430,1080" fill="#9d9d9d"/>
        <polygon points="720,1080 760,870 860,868 860,1080" fill="#9d9d9d"/>
        ${etiquette(620, 740, 'Comptoir en chêne, porté à deux')}
      </g>
    </svg>`;
  }

  window.SCENES = { salleVersComptoir, comptoir, machine, salle };
})();
