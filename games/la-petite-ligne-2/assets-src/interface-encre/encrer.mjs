/**
 * Moteur « à la plume »: transforme un dessin source simple (formes remplies, traits) en dessin
 * encré: chaque forme garde son aplat et reçoit un contour d'encre dont l'épaisseur varie (plein
 * et délié selon la direction du trait, plus épais du côté de l'ombre, bas droite), tremble un
 * peu et s'effile aux bouts des traits ouverts. Le calcul se fait dans Chromium (longueurs et
 * points des chemins), le résultat est un SVG autonome, sans trait (`stroke`) ni filtre: il se lit
 * pareil dans Chromium, rsvg-convert et un `<img>`.
 *
 * Conventions de la source (voir `vignettes/_gabarit.svg`):
 * - racine: `viewBox`, `data-trait` (épaisseur maximale du contour, unités du viewBox),
 *   `data-pas` (pas d'échantillonnage), `data-tremble` (amplitude du tremblement), `data-halo`
 *   (liseré clair autour de la silhouette, 0 pour aucun), `data-mode="picto"` (encre en
 *   `currentColor`, rendu sans enveloppe `<svg>`);
 * - une forme remplie (`fill` autre que `none`) est peinte puis cernée; `data-w="0"` la laisse
 *   sans contour (ombre, éclat), `data-w="0.6"` amincit son contour;
 * - un trait (`fill="none"`) devient un trait de plume effilé (détails, hachures);
 * - `data-teinte="#RRGGBB"` (sur la forme ou un groupe): son trait est peint de cette couleur au
 *   lieu de l'encre; sert aux veines du bois, aux reflets et aux hachures douces, qui enrichissent
 *   l'intérieur sans le noircir à 48 px;
 * - `data-clip="<id>"`: l'élément est découpé par la forme `<id>` (ombre qui ne déborde pas);
 * - `data-expr="<nom>"` sur un groupe: calque d'expression (portraits), rendu à part, après le
 *   reste, dans `<g class="expr expr--<nom>">`; `class="bouche"` sur un groupe ou une forme: la
 *   bouche qui bouge pendant le babil.
 */

/** Le calcul, exécuté dans la page (aucune dépendance au monde de Node). */
function inkInPage(opts) {
  const svg = document.querySelector('svg');
  const num = (name, fallback) => {
    const v = svg.getAttribute(name);
    return v === null ? fallback : Number(v);
  };
  const W = num('data-trait', 4);
  const step = num('data-pas', W / 6);
  const tremble = num('data-tremble', W * 0.08);
  const halo = num('data-halo', 0);
  const picto = svg.getAttribute('data-mode') === 'picto';
  const ink = picto ? 'currentColor' : (svg.getAttribute('data-encre') ?? '#231A17');
  const P = opts.prefix;
  const digits = opts.digits;
  const f = (n) => {
    const r = Number(n.toFixed(digits));
    return Object.is(r, -0) ? '0' : String(r);
  };
  const SENTINEL = 'rgb(1, 2, 3)';
  svg.style.color = SENTINEL;

  let seed = 0;
  for (const c of opts.id) seed = (Math.imul(seed ^ c.charCodeAt(0), 16777619) + 7) >>> 0;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  /** Bruit lisse le long du trait (trois sinus de phases tirées), entre -1 et 1 environ. */
  const makeNoise = (period) => {
    const parts = [1, 2.3, 4.1].map((k, i) => ({
      fq: (2 * Math.PI * k) / period,
      ph: rand() * 6.283,
      a: 1 / (i + 1),
    }));
    return (s) => parts.reduce((acc, p) => acc + p.a * Math.sin(s * p.fq + p.ph), 0) / 1.83;
  };

  const LIGHT = [0.6, 0.8]; // vers l'ombre: la lumière vient d'en haut à gauche
  const NIB = [Math.SQRT1_2, -Math.SQRT1_2]; // bec de plume tenu à 45 degrés

  const hex = (rgb) => {
    if (rgb === SENTINEL) return 'currentColor';
    const m = rgb.match(/\d+(\.\d+)?/g);
    if (m === null) return rgb;
    return `#${m
      .slice(0, 3)
      .map((v) => Number(v).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()}`;
  };

  const rootInv = svg.getScreenCTM().inverse();
  const matrixOf = (el) => rootInv.multiply(el.getScreenCTM());
  const matAttr = (m) =>
    m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1 && m.e === 0 && m.f === 0
      ? ''
      : ` transform="matrix(${[m.a, m.b, m.c, m.d, m.e, m.f].map((v) => f(v)).join(' ')})"`;

  /** Copie peinte d'une forme: géométrie seule, couleur résolue, repère de la racine. */
  const paintClone = (el, extra = '') => {
    const c = el.cloneNode(false);
    for (const a of [...c.attributes]) {
      const keep = [
        'fill-rule',
        'd',
        'cx',
        'cy',
        'r',
        'rx',
        'ry',
        'x',
        'y',
        'width',
        'height',
        'points',
      ];
      if (!keep.includes(a.name) && !(a.name.startsWith('x') || a.name.startsWith('y')))
        c.removeAttribute(a.name);
    }
    const cs = getComputedStyle(el);
    c.setAttribute('fill', hex(cs.fill));
    if (Number(cs.fillOpacity) < 1) c.setAttribute('fill-opacity', f(Number(cs.fillOpacity)));
    const html = c.outerHTML.replace(' xmlns="http://www.w3.org/2000/svg"', '');
    return html.replace(/^<(\w+)/, `<$1${matAttr(matrixOf(el))}${extra}`);
  };

  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const norm = (v) => {
    const l = Math.hypot(v[0], v[1]) || 1;
    return [v[0] / l, v[1] / l];
  };
  const area = (poly) => {
    let s = 0;
    for (let i = 0; i < poly.length; i += 1) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      s += a[0] * b[1] - b[0] * a[1];
    }
    return s / 2;
  };
  const polyD = (poly) => {
    const p = area(poly) < 0 ? poly.slice().reverse() : poly;
    let d = `M${f(p[0][0])} ${f(p[0][1])}`;
    let last = p[0];
    for (let i = 1; i < p.length; i += 1) {
      if (dist(p[i], last) < opts.minSeg && i < p.length - 1) continue;
      d += `L${f(p[i][0])} ${f(p[i][1])}`;
      last = p[i];
    }
    return `${d}Z`;
  };
  const disc = (c, r) => {
    const pts = [];
    for (let k = 0; k < 8; k += 1) {
      const a = (k / 8) * 2 * Math.PI + 0.39;
      pts.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]);
    }
    return pts;
  };

  /** Contour encré d'un élément: un chemin rempli (règle nonzero, polygones orientés pareil). */
  const inkOf = (el, k, fillShape) => {
    const m = matrixOf(el);
    const L = el.getTotalLength();
    if (!(L > 0)) return '';
    const n = Math.max(4, Math.ceil(L / step));
    const raw = [];
    for (let i = 0; i <= n; i += 1) {
      const q = el.getPointAtLength((i / n) * L);
      raw.push([m.a * q.x + m.c * q.y + m.e, m.b * q.x + m.d * q.y + m.f]);
    }
    const realStep = (L / n) * Math.hypot(m.a, m.b);
    // Sous-chemins: un saut dans l'échantillonnage sépare deux morceaux.
    const subs = [[raw[0]]];
    for (let i = 1; i < raw.length; i += 1) {
      if (dist(raw[i], raw[i - 1]) > realStep * 2.5) subs.push([]);
      subs.at(-1).push(raw[i]);
    }
    const polys = [];
    for (let pts of subs) {
      if (pts.length < 2) continue;
      const closed = pts.length > 4 && dist(pts[0], pts.at(-1)) < realStep * 1.5;
      if (closed) pts = pts.slice(0, -1);
      const N = pts.length;
      const at = (i) => pts[closed ? (i + N) % N : Math.max(0, Math.min(N - 1, i))];
      const dirIn = (i) => norm([at(i)[0] - at(i - 1)[0], at(i)[1] - at(i - 1)[1]]);
      const dirOut = (i) => norm([at(i + 1)[0] - at(i)[0], at(i + 1)[1] - at(i)[1]]);
      const corners = [];
      for (let i = closed ? 0 : 1; i < (closed ? N : N - 1); i += 1) {
        const a = dirIn(i);
        const b = dirOut(i);
        if (a[0] * b[0] + a[1] * b[1] < Math.cos((36 * Math.PI) / 180)) corners.push(i);
      }
      const sign = closed ? (area(pts) > 0 ? 1 : -1) : 0;
      const total = N * realStep;
      const noiseW = makeNoise(W * 9);
      const noiseP = makeNoise(W * 14);
      const taperLen = Math.min(total * 0.32, W * 3.2);
      const widthAt = (i, t, s) => {
        const nib = Math.abs(t[0] * NIB[1] - t[1] * NIB[0]);
        let shade = 0.2;
        if (closed) {
          const nOut = sign > 0 ? [t[1], -t[0]] : [-t[1], t[0]];
          shade = 0.45 * Math.max(0, nOut[0] * LIGHT[0] + nOut[1] * LIGHT[1]);
        }
        let w = W * k * (0.5 + 0.3 * nib + shade) * (1 + 0.16 * noiseW(s));
        if (!closed && !fillShape) {
          const e = Math.min(s, total - s);
          w *= Math.min(1, 0.22 + (0.78 * e) / taperLen);
        }
        return w;
      };
      // Morceaux entre deux coins: chacun est un ruban simple; les coins reçoivent un disque.
      const ribbon = (idx) => {
        const left = [];
        const right = [];
        for (let j = 0; j < idx.length; j += 1) {
          const i = idx[j];
          const p = at(i);
          let t;
          if (j === 0 && !(closed && corners.length === 0)) t = dirOut(i);
          else if (j === idx.length - 1 && !(closed && corners.length === 0)) t = dirIn(i);
          else t = norm([at(i + 1)[0] - at(i - 1)[0], at(i + 1)[1] - at(i - 1)[1]]);
          const s = ((i + N) % N) * realStep;
          const w = widthAt(i, t, s);
          const nn = [-t[1], t[0]];
          const off = tremble * noiseP(s);
          const c = [p[0] + nn[0] * off, p[1] + nn[1] * off];
          left.push([c[0] + (nn[0] * w) / 2, c[1] + (nn[1] * w) / 2]);
          right.push([c[0] - (nn[0] * w) / 2, c[1] - (nn[1] * w) / 2]);
          if (corners.includes(i) && j === 0) polys.push(disc(c, w / 2));
        }
        return { left, right };
      };
      if (closed && corners.length === 0) {
        const idx = [...Array(N).keys()];
        const { left, right } = ribbon(idx);
        polys.push([...left, left[0], right[0], ...right.slice(1).reverse(), right[0]]);
        continue;
      }
      const order = closed
        ? [...Array(N + 1).keys()].map((j) => (j + corners[0]) % N)
        : [...Array(N).keys()];
      let run = [order[0]];
      for (let j = 1; j < order.length; j += 1) {
        run.push(order[j]);
        if (corners.includes(order[j]) || j === order.length - 1) {
          if (run.length > 1) {
            const { left, right } = ribbon(run);
            polys.push([...left, ...right.reverse()]);
          }
          run = [order[j]];
        }
      }
    }
    return polys.map(polyD).join('');
  };

  const elements = [
    ...svg.querySelectorAll('path,circle,ellipse,rect,line,polyline,polygon'),
  ].filter((el) => el.closest('defs') === null && el.closest('clipPath') === null);
  const defs = [];
  const base = [];
  const layers = new Map();
  for (const el of elements) {
    const exprHost = el.closest('[data-expr]');
    const expr = exprHost === null ? null : exprHost.getAttribute('data-expr');
    const wHost = el.closest('[data-w]');
    const k = wHost === null ? 1 : Number(wHost.getAttribute('data-w'));
    const fill = getComputedStyle(el).fill;
    const filled = fill !== 'none';
    const parts = [];
    if (filled) parts.push(paintClone(el));
    if (k > 0) {
      const d = inkOf(el, k, filled);
      // `data-teinte`: le trait prend une couleur du nuancier au lieu de l'encre (veines, reflets).
      const tintHost = el.closest('[data-teinte]');
      const color = tintHost === null || picto ? ink : tintHost.getAttribute('data-teinte');
      if (d !== '') parts.push(`<path fill="${color}" d="${d}"/>`);
    }
    const clipHost = el.closest('[data-clip]');
    let markup = parts.join('');
    if (clipHost !== null) {
      const id = clipHost.getAttribute('data-clip');
      const target = svg.getElementById(id);
      if (target === null) throw new Error(`data-clip: forme « ${id} » absente`);
      const cid = `${P}c-${id}`;
      if (!defs.some((dd) => dd.includes(`id="${cid}"`)))
        defs.push(`<clipPath id="${cid}">${paintClone(target)}</clipPath>`);
      markup = `<g clip-path="url(#${cid})">${markup}</g>`;
    }
    const item = { markup, mouth: el.closest('.bouche') };
    if (expr === null) base.push(item);
    else layers.set(expr, [...(layers.get(expr) ?? []), item]);
  }
  /** Assemble une suite d'éléments; ceux d'une même bouche restent dans un seul groupe. */
  const join = (list) => {
    let out = '';
    for (let i = 0; i < list.length; i += 1) {
      const { markup, mouth } = list[i];
      const prev = i > 0 ? list[i - 1].mouth : null;
      const next = i + 1 < list.length ? list[i + 1].mouth : null;
      if (mouth !== null && mouth !== prev) out += '<g class="bouche">';
      out += markup;
      if (mouth !== null && mouth !== next) out += '</g>';
    }
    return out;
  };
  const exprMarkup = [...layers]
    .map(([name, list]) => `<g class="expr expr--${name}">${join(list)}</g>`)
    .join('');
  if (picto) return join(base) + exprMarkup;
  const vb = svg.getAttribute('viewBox');
  const haloMarkup =
    halo > 0
      ? `<use href="#${P}d" fill="none" stroke="${svg.getAttribute('data-halo-couleur') ?? '#D9CAAE'}" stroke-width="${halo}" stroke-linejoin="round"/>`
      : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${defs.length > 0 ? `<defs>${defs.join('')}</defs>` : ''}${haloMarkup}<g id="${P}d">${join(base)}</g>${exprMarkup}</svg>`;
}

/**
 * Encre une source SVG (texte) dans une page Playwright déjà ouverte. `prefix` préfixe les
 * identifiants internes (découpes, liseré); `digits` arrondit les coordonnées.
 */
export async function encrer(page, source, { id, prefix = 'e-', digits = 1, minSeg = 0.6 }) {
  const vb = source.match(/viewBox="([^"]+)"/);
  if (vb === null) throw new Error(`${id}: viewBox absent`);
  const [, , w, h] = vb[1].split(/\s+/).map(Number);
  const sized = source.replace('<svg', `<svg width="${w}" height="${h}"`);
  await page.setContent(`<!doctype html><body style="margin:0">${sized}</body>`);
  return page.evaluate(inkInPage, { id, prefix, digits, minSeg });
}
