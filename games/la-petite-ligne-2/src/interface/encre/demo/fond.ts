/**
 * Fond provisoire de la démonstration: un pré vu de haut, peint à la main dans les tons du style
 * encré (aplats à deux ou trois tons, traits d'encre, hachures). Il tient la place des captures du
 * moteur (`docs/jeux/jeu-1/refonte/captures/encre-*.png`) tant qu'elles n'existent pas.
 */
const INK = '#1d1a17';

/** Touffe d'herbe: trois coups de plume. */
function tuft(x: number, y: number, s: number): string {
  return `<path d="M${x} ${y}l${-3 * s} ${-9 * s}M${x + 4 * s} ${y}l${s} ${-12 * s}M${x + 8 * s} ${y}l${4 * s} ${-8 * s}" stroke="${INK}" stroke-width="${2.2 * s}" stroke-linecap="round" fill="none"/>`;
}

/** Arbre vu de haut: une ombre en hachures, un houppier anguleux à deux tons. */
function tree(x: number, y: number, r: number, fruit: boolean): string {
  const p = (a: number, k: number): string =>
    `${Math.round(x + Math.cos(a) * r * k)} ${Math.round(y + Math.sin(a) * r * k)}`;
  const ring = [1, 0.82, 1.05, 0.86, 0.98, 0.8, 1.04, 0.88, 1, 0.84, 1.03, 0.86];
  const outer = ring.map((k, i) => p((i / ring.length) * Math.PI * 2, k)).join('L');
  const inner = ring.map((k, i) => p((i / ring.length) * Math.PI * 2 + 0.3, k * 0.55)).join('L');
  const fruits = fruit
    ? [0.4, 2.2, 3.9, 5.3]
        .map(
          (a, i) =>
            `<circle cx="${Math.round(x + Math.cos(a) * r * 0.62)}" cy="${Math.round(y + Math.sin(a) * r * 0.62)}" r="${i % 2 === 0 ? 7 : 6}" fill="#e2573a" stroke="${INK}" stroke-width="3"/>`,
        )
        .join('')
    : '';
  return `<g>
    <path d="M${outer}Z" transform="translate(${r * 0.28} ${r * 0.3})" fill="url(#hach)"/>
    <path d="M${outer}Z" fill="#5f8f5a" stroke="${INK}" stroke-width="6" stroke-linejoin="bevel"/>
    <path d="M${inner}Z" transform="translate(${-r * 0.12} ${-r * 0.14})" fill="#86b06c"/>
    ${fruits}
  </g>`;
}

export function provisionalBackdrop(kind: 'exterieur' | 'interieur'): string {
  if (kind === 'interieur') {
    const planks = Array.from({ length: 12 }, (_, i) => {
      const y = i * 64;
      const cuts = [180 + ((i * 97) % 300), 620 + ((i * 53) % 280), 1010 + ((i * 71) % 250)];
      return `<path d="M0 ${y}H1366" stroke="${INK}" stroke-width="4"/>${cuts
        .map((x) => `<path d="M${x} ${y}v64" stroke="${INK}" stroke-width="3"/>`)
        .join('')}`;
    }).join('');
    return `<svg viewBox="0 0 1366 768" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><pattern id="hach" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)"><path d="M0 4.5H9" stroke="${INK}" stroke-width="2.4" opacity="0.5"/></pattern></defs>
      <rect width="1366" height="768" fill="#d9a871"/>
      ${planks}
      <path d="M0 0H1366V70L0 96Z" fill="url(#hach)"/>
      <path d="M392 262l560-14 22 300-596 18z" fill="url(#hach)" transform="translate(14 16)"/>
      <path d="M392 262l560-14 22 300-596 18z" fill="#c9604a" stroke="${INK}" stroke-width="7" stroke-linejoin="bevel"/>
      <path d="M432 300l482-12 18 226-512 14z" fill="#efb3a2" stroke="${INK}" stroke-width="4"/>
      <path d="M1090 150l150-6 8 150-152 8z" fill="#8a6a4a" stroke="${INK}" stroke-width="7" stroke-linejoin="bevel"/>
      <path d="M1112 172l108-4 4 106-108 6z" fill="#b08a62" stroke="${INK}" stroke-width="3"/>
    </svg>`;
  }
  const tufts = [
    [120, 300, 1],
    [260, 520, 1.2],
    [330, 210, 0.9],
    [520, 640, 1.1],
    [610, 170, 1],
    [860, 610, 1.2],
    [980, 240, 1],
    [1120, 520, 1.1],
    [1240, 330, 0.9],
    [1290, 660, 1],
    [70, 660, 1.1],
    [760, 90, 0.9],
  ]
    .map(([x, y, s]) => tuft(x ?? 0, y ?? 0, s ?? 1))
    .join('');
  return `<svg viewBox="0 0 1366 768" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><pattern id="hach" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)"><path d="M0 4.5H9" stroke="${INK}" stroke-width="2.4" opacity="0.55"/></pattern></defs>
    <rect width="1366" height="768" fill="#9fbf7c"/>
    <path d="M0 520l180-60 210 40 150 110-60 158H0z" fill="#8bb06d"/>
    <path d="M900 0l210 90 256-30V0z" fill="#8bb06d"/>
    <path d="M1010 420l190-50 166 60v338h-300l-90-150z" fill="#b3cf8c"/>
    <path d="M-10 250l250 20 230 90 250-10 260 70 210-30 190 40v96l-200-34-210 30-250-74-250 14-240-92-240-20z" fill="url(#hach)" transform="translate(0 14)"/>
    <path d="M-10 250l250 20 230 90 250-10 260 70 210-30 190 40v96l-200-34-210 30-250-74-250 14-240-92-240-20z" fill="#e6cb98" stroke="${INK}" stroke-width="7" stroke-linejoin="bevel"/>
    <path d="M60 300l170 14 80 30M560 404l150-8 120 34M1020 470l150-20" stroke="#c9a868" stroke-width="8" stroke-linecap="round" fill="none"/>
    <path d="M708 348l44-30 50 12 20 40-38 34-56-8z" fill="url(#hach)" transform="translate(8 9)"/>
    <path d="M708 348l44-30 50 12 20 40-38 34-56-8z" fill="#b9b3a2" stroke="${INK}" stroke-width="6" stroke-linejoin="bevel"/>
    <path d="M724 350l32-20 30 8" stroke="#dcd6c4" stroke-width="7" stroke-linecap="round" fill="none"/>
    ${tufts}
    ${tree(250, 130, 96, false)}
    ${tree(1080, 660, 110, false)}
    ${tree(690, 250, 78, true)}
    <g stroke="${INK}" stroke-width="6" stroke-linecap="square" fill="#c99a62">
      <path d="M930 150l300-28" fill="none"/><path d="M932 176l300-28" fill="none"/>
      <path d="M946 132l8 62-16 2-8-62zM1076 120l8 62-16 2-8-62zM1206 108l8 62-16 2-8-62z"/>
    </g>
  </svg>`;
}
