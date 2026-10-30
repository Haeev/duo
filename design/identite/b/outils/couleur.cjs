'use strict';
// Calculs de couleur partagés par les contrôles de l'identité B.
// Contraste WCAG 2.x (luminance relative en sRGB linéarisé), CIELAB D65, écart CIEDE2000,
// simulations du daltonisme de Machado, Oliveira et Fernandes (2009), sévérité 1, en RGB linéaire
// (mêmes matrices que la commande ImageMagick documentée, et que CA-PF-109).

const CVD = {
  protanopie: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopie: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritanopie: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};

const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const encode = (c) => {
  const v = Math.min(Math.max(c, 0), 1);
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
};
const toHex = (linear) => '#' + linear.map((c) => Math.round(encode(c) * 255).toString(16).padStart(2, '0').toUpperCase()).join('');

function luminance(hex) {
  const [r, g, b] = toRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
// couleur semi-transparente (#RRGGBBAA) posée sur un fond opaque
function over(hexa, bg) {
  const a = parseInt(hexa.slice(7, 9), 16) / 255;
  const f = toRgb(hexa.slice(0, 7));
  const b = toRgb(bg);
  return '#' + f.map((c, i) => Math.round((c * a + b[i] * (1 - a)) * 255).toString(16).padStart(2, '0').toUpperCase()).join('');
}
const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
function lab(hex) {
  const [r, g, b] = toRgb(hex).map(toLinear);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const lightness = (hex) => lab(hex)[0];
// niveau de gris tel que le calcule « convert -colorspace Gray » (luma Rec. 709 sur valeurs encodées), en %
const grayIm = (hex) => {
  const [r, g, b] = toRgb(hex);
  return 100 * (0.2126 * r + 0.7152 * g + 0.0722 * b);
};
// niveau de gris de même luminance relative (vision achromate), en hexadécimal
const grayOf = (hex) => {
  const y = luminance(hex);
  return toHex([y, y, y]);
};
function simulate(hex, vision) {
  if (vision === 'normale') return hex.toUpperCase();
  if (vision === 'gris') return grayOf(hex);
  const m = CVD[vision];
  const v = toRgb(hex).map(toLinear);
  return toHex(m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]));
}
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
function deltaE00(hexA, hexB) {
  const [L1, a1, b1] = lab(hexA);
  const [L2, a2, b2] = lab(hexB);
  const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h1p = (deg(Math.atan2(b1, a1p)) + 360) % 360;
  const h2p = (deg(Math.atan2(b2, a2p)) + 360) % 360;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp / 2));
  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) hbp = (h1p + h2p) / 2;
    else hbp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
  }
  const T = 1 - 0.17 * Math.cos(rad(hbp - 30)) + 0.24 * Math.cos(rad(2 * hbp)) + 0.32 * Math.cos(rad(3 * hbp + 6)) - 0.2 * Math.cos(rad(4 * hbp - 63));
  const dTh = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(rad(2 * dTh)) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}

// matrices de couleurs pour ImageMagick (« -color-matrix »), mêmes coefficients
const imMatrix = (vision) => CVD[vision].flat().join(' ');

module.exports = { CVD, contrast, over, lab, lightness, grayIm, grayOf, simulate, deltaE00, luminance, imMatrix };
