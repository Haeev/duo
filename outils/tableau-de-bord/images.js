/* Onglet « Images »: galerie par famille, puis visionneuse avec zoom, déplacement, épingles,
   traits à main levée, note globale et note du client sur 10. */
(function () {
  'use strict';
  if (!window.TDB) return;

  const FAMILLES = [
    ['scene', 'Scène encrée'],
    ['personnages', 'Personnages'],
    ['interface', 'Interface'],
    ['plan', 'Plan'],
  ];
  const ZOOM_MAX = 8;
  const SEUIL_GLISSE = 6; // en pixels: en dessous, c'est un clic
  const POINTS_MAX = 120;
  const SVG = 'http://www.w3.org/2000/svg';

  function chemin(fichier) {
    if (
      typeof fichier !== 'string' ||
      !/^[A-Za-z0-9_\-./]+$/.test(fichier) ||
      fichier.includes('..') ||
      fichier.startsWith('/')
    )
      return null;
    return 'images/' + fichier;
  }
  function note10(n) {
    return typeof n === 'number' && isFinite(n)
      ? String(Math.round(n * 10) / 10).replace('.', ',') + '/10'
      : null;
  }

  window.TDB.registerTab({
    id: 'images',
    title: 'Images',
    order: 30,
    mount(el, ctx) {
      const { h, vide, date } = ctx.ui;
      let vueImages = { etat: 'chargement', retard: false, docs: [] };
      let images = []; // dans l'ordre de la galerie

      /* ---------------- Galerie ---------------- */
      const galerie = h('div', { class: 'tdb-pile' });
      el.append(h('h2', { class: 'tdb-titre', text: 'Images à regarder et à annoter' }), galerie);

      function vignette(img) {
        const src = chemin(img.fichier);
        const cadre = h('span', { class: 'img-vignette__cadre' });
        if (src) {
          const im = h('img', { src, alt: '', loading: 'lazy' });
          im.addEventListener('error', () => {
            im.remove();
            cadre.append(h('span', { text: 'Image introuvable' }));
          });
          cadre.append(im);
        } else cadre.append(h('span', { text: 'Image introuvable' }));
        if (img.reference === true)
          cadre.append(
            h('span', { class: 'tdb-pastille tdb-pastille--accent', text: 'Référence' }),
          );
        const remarques = ctx.notes.list('image', img.id);
        const ouvertes = remarques.filter((r) => r.statut !== 'traitee').length;
        const maNote = ctx.notes.rating('image', img.id);
        return h(
          'button',
          {
            type: 'button',
            class: 'img-vignette',
            'data-image': img.id,
            onclick: () => ouvrir(img.id),
          },
          cadre,
          h('span', {
            class: 'img-vignette__titre',
            style: 'display:block',
            text: img.titre || 'Sans titre',
          }),
          h(
            'span',
            { class: 'tdb-rang', style: 'font-size:0.9rem' },
            note10(img.noteManager)
              ? h(
                  'span',
                  {},
                  'Manager : ',
                  h('span', { class: 'img-note', text: note10(img.noteManager) }),
                )
              : null,
            maNote === null
              ? null
              : h('span', {}, 'Toi : ', h('span', { class: 'img-note', text: note10(maNote) })),
            remarques.length
              ? h('span', {
                  class: 'tdb-pastille',
                  text:
                    remarques.length +
                    (remarques.length > 1 ? ' remarques' : ' remarque') +
                    (ouvertes ? '' : ', traitées'),
                })
              : null,
          ),
          img.justification
            ? h('span', { class: 'img-vignette__just', text: img.justification })
            : null,
        );
      }

      function peindreGalerie() {
        const focus =
          document.activeElement &&
          document.activeElement.getAttribute &&
          document.activeElement.getAttribute('data-image');
        galerie.textContent = '';
        if (vueImages.etat === 'horsligne') {
          galerie.append(
            vide(
              'Images indisponibles hors ligne',
              'La galerie reviendra dès que la page pourra joindre ses données.',
            ),
          );
          return;
        }
        if (vueImages.etat !== 'pret') {
          galerie.append(
            vide(
              'Chargement de la galerie…',
              vueImages.retard
                ? 'La base ne répond pas encore. La page se mettra à jour toute seule dès qu’elle répondra.'
                : 'Un instant.',
            ),
          );
          return;
        }
        if (!images.length) {
          galerie.append(
            vide(
              'Pas encore d’image à regarder',
              'Les scènes encrées, les personnages, les écrans et les plans arriveront ici, chacun avec la note du manager. Tu pourras ouvrir une image, cliquer à un endroit précis et y écrire ta remarque.',
            ),
          );
          return;
        }
        const connues = FAMILLES.map((f) => f[0]);
        const autres = Array.from(
          new Set(images.map((i) => i.famille).filter((f) => !connues.includes(f))),
        );
        FAMILLES.concat(autres.map((f) => [f, f || 'Autres'])).forEach(([cle, nom]) => {
          const lot = images.filter((i) => i.famille === cle);
          if (!lot.length) return;
          galerie.append(
            h(
              'section',
              {},
              h('h3', { class: 'tdb-surtitre', text: nom + ' · ' + lot.length }),
              h('div', { class: 'img-grille' }, lot.map(vignette)),
            ),
          );
        });
        if (focus) {
          const b = galerie.querySelector('[data-image="' + CSS.escape(focus) + '"]');
          if (b) b.focus();
        }
      }

      /* ---------------- Visionneuse ---------------- */
      const etat = {
        id: null,
        iw: 0,
        ih: 0,
        zoom: 1,
        tx: 0,
        ty: 0,
        mode: 'point',
        brouillon: null,
        choisie: null,
        liste: [],
        arret: null,
        dernierEchap: 0,
        marques: [],
      };
      const pointeurs = new Map();
      let geste = null;
      let pince = null;

      const titre = h('h2', { id: 'vis-titre' });
      const rang = h('span', { class: 'tdb-doux', style: 'font-variant-numeric:tabular-nums' });
      const btnPrec = h('button', {
        type: 'button',
        class: 'tdb-btn',
        id: 'vis-prec',
        text: 'Précédente',
        onclick: () => voisine(-1),
      });
      const btnSuiv = h('button', {
        type: 'button',
        class: 'tdb-btn',
        id: 'vis-suiv',
        text: 'Suivante',
        onclick: () => voisine(1),
      });
      const btnFermer = h('button', {
        type: 'button',
        class: 'tdb-btn',
        id: 'vis-fermer',
        text: 'Fermer',
        onclick: () => fermer(),
      });
      const image = h('img', { class: 'vis__img', alt: '', draggable: 'false' });
      const traits = document.createElementNS(SVG, 'svg');
      traits.setAttribute('class', 'vis__traits');
      traits.setAttribute('aria-hidden', 'true');
      const epingles = h('div', {});
      const manque = h('p', { class: 'vis__manque', hidden: true });
      const btnPoint = h('button', {
        type: 'button',
        class: 'tdb-btn',
        id: 'vis-mode-point',
        text: 'Épingle',
        onclick: () => choisirMode('point'),
      });
      const btnTrait = h('button', {
        type: 'button',
        class: 'tdb-btn',
        id: 'vis-mode-trait',
        text: 'Trait',
        onclick: () => choisirMode('trait'),
      });
      const outils = h(
        'div',
        { class: 'vis__outils' },
        btnPoint,
        btnTrait,
        h('button', {
          type: 'button',
          class: 'tdb-btn',
          id: 'vis-zoom-moins',
          'aria-label': 'Dézoomer',
          text: '−',
          onclick: () => zoomer(1 / 1.4),
        }),
        h('button', {
          type: 'button',
          class: 'tdb-btn',
          id: 'vis-zoom-plus',
          'aria-label': 'Zoomer',
          text: '+',
          onclick: () => zoomer(1.4),
        }),
        h('button', {
          type: 'button',
          class: 'tdb-btn',
          id: 'vis-ajuster',
          text: 'Ajuster',
          onclick: () => ajuster(),
        }),
      );
      const scene = h(
        'div',
        { class: 'vis__scene', tabindex: '0', role: 'group', 'aria-describedby': 'vis-aide' },
        image,
        traits,
        epingles,
        h('span', { class: 'vis__viseur' }),
        manque,
        outils,
      );
      const zoneInfos = h('section', {});
      const zoneBrouillon = h('section', { hidden: true });
      const aide = h('p', { class: 'tdb-doux', id: 'vis-aide', style: 'font-size:0.9rem' });
      const zoneRemarques = h('section', {});
      const zoneNote = h('section', {});
      const zoneGlobale = h('section', {});
      const cote = h(
        'div',
        { class: 'vis__cote' },
        zoneInfos,
        zoneBrouillon,
        aide,
        zoneRemarques,
        zoneNote,
        zoneGlobale,
      );
      const dialogue = h(
        'dialog',
        { class: 'vis', 'aria-labelledby': 'vis-titre' },
        h(
          'div',
          { class: 'vis__grille' },
          h('div', { class: 'vis__tete' }, titre, rang, btnPrec, btnSuiv, btnFermer),
          scene,
          cote,
        ),
      );
      el.append(dialogue);

      const editeurBrouillon = ctx.ui.noteEditor(zoneBrouillon, {
        id: 'vis-brouillon',
        label: 'Ta remarque à cet endroit',
        onCancel: () => abandonner(true),
        onSubmit: (texte) => {
          const b = etat.brouillon;
          if (!b || !etat.id) return false;
          return ctx.notes
            .add({ cible: { type: 'image', id: etat.id }, forme: b, texte })
            .then((id) => {
              if (!id) return false;
              etat.choisie = id;
              abandonner(true);
              ctx.ui.toast(b.sorte === 'trait' ? 'Trait enregistré.' : 'Épingle enregistrée.');
              return true;
            });
        },
      });
      ctx.ui.noteEditor(zoneGlobale, {
        id: 'vis-globale',
        label: 'Note globale sur l’image',
        placeholder: 'Ton impression d’ensemble',
        bouton: 'Enregistrer la note globale',
        onSubmit: (texte) =>
          ctx.notes
            .add({ cible: { type: 'image', id: etat.id }, forme: { sorte: 'globale' }, texte })
            .then((id) => {
              if (id) ctx.ui.toast('Note globale enregistrée.');
              return Boolean(id);
            }),
      });

      function courante() {
        return images.find((i) => i.id === etat.id) || null;
      }

      /* Géométrie: l'image est posée par translate + scale; les marques restent à taille fixe. */
      function echelle() {
        const r = scene.getBoundingClientRect();
        if (!etat.iw || !etat.ih || !r.width || !r.height) return 0;
        return Math.min(r.width / etat.iw, r.height / etat.ih) * etat.zoom;
      }
      function cadrer() {
        const r = scene.getBoundingClientRect();
        const s = echelle();
        if (!s) return;
        const w = etat.iw * s;
        const hh = etat.ih * s;
        etat.tx = w <= r.width ? (r.width - w) / 2 : Math.min(0, Math.max(r.width - w, etat.tx));
        etat.ty =
          hh <= r.height ? (r.height - hh) / 2 : Math.min(0, Math.max(r.height - hh, etat.ty));
        image.style.width = etat.iw + 'px';
        image.style.transform = 'translate(' + etat.tx + 'px,' + etat.ty + 'px) scale(' + s + ')';
        placer();
      }
      function versEcran(x, y) {
        const s = echelle();
        return [etat.tx + x * etat.iw * s, etat.ty + y * etat.ih * s];
      }
      function versImage(px, py) {
        const s = echelle();
        return s ? [(px - etat.tx) / (etat.iw * s), (py - etat.ty) / (etat.ih * s)] : [-1, -1];
      }
      function zoomer(facteur, px, py) {
        const r = scene.getBoundingClientRect();
        const cx = px === undefined ? r.width / 2 : px;
        const cy = py === undefined ? r.height / 2 : py;
        const avant = versImage(cx, cy);
        etat.zoom = Math.max(1, Math.min(ZOOM_MAX, etat.zoom * facteur));
        const s = echelle();
        etat.tx = cx - avant[0] * etat.iw * s;
        etat.ty = cy - avant[1] * etat.ih * s;
        cadrer();
      }
      function ajuster() {
        etat.zoom = 1;
        cadrer();
      }

      /* Marques: épingles (rondes) et traits (étiquette carrée), numérotés dans l'ordre de création. */
      function choisir(id, versListe) {
        etat.choisie = id;
        etat.marques.forEach(
          (m) => m.bouton && m.bouton.classList.toggle('est-choisie', m.id === id),
        );
        zoneRemarques.querySelectorAll('[data-remarque]').forEach((li) => {
          const oui = li.getAttribute('data-remarque') === id;
          li.classList.toggle('est-choisie', oui);
          if (oui && versListe) li.scrollIntoView({ block: 'nearest' });
        });
      }
      function construireMarques() {
        epingles.textContent = '';
        traits.textContent = '';
        etat.marques = [];
        let numero = 0;
        const poser = (forme, opts) => {
          const m = { id: opts.id, forme, bouton: null, lignes: [] };
          if (forme.sorte === 'trait') {
            const g = document.createElementNS(SVG, 'g');
            if (opts.traitee) g.setAttribute('class', 'traitee');
            ['dessous', 'dessus'].forEach((c) => {
              const l = document.createElementNS(SVG, 'polyline');
              l.setAttribute('class', c);
              g.appendChild(l);
              m.lignes.push(l);
            });
            traits.appendChild(g);
          }
          if (opts.brouillon) {
            m.bouton = h('span', {
              class:
                'vis__epingle vis__epingle--brouillon' +
                (forme.sorte === 'trait' ? ' vis__epingle--trait' : ''),
              text: '+',
            });
          } else {
            m.bouton = h('button', {
              type: 'button',
              class:
                'vis__epingle' +
                (forme.sorte === 'trait' ? ' vis__epingle--trait' : '') +
                (opts.traitee ? ' vis__epingle--traitee' : '') +
                (opts.id === etat.choisie ? ' est-choisie' : ''),
              'aria-label':
                (forme.sorte === 'trait' ? 'Trait ' : 'Épingle ') +
                opts.numero +
                (opts.traitee ? ', traitée' : '') +
                ' : ' +
                opts.texte,
              text: opts.numero,
              onclick: () => choisir(opts.id, true),
              onfocus: () => montrer(m),
            });
          }
          epingles.appendChild(m.bouton);
          etat.marques.push(m);
        };
        etat.liste.forEach((r) => {
          if (r.forme.sorte !== 'point' && r.forme.sorte !== 'trait') return;
          numero += 1;
          r.numero = numero;
          poser(r.forme, { id: r.id, numero, traitee: r.statut === 'traitee', texte: r.texte });
        });
        if (etat.brouillon) poser(etat.brouillon, { id: null, brouillon: true });
        placer();
      }
      /* Une marque qui reçoit le focus hors du cadre (image zoomée) est ramenée au centre. */
      function montrer(m) {
        const r = scene.getBoundingClientRect();
        const ancre = m.forme.sorte === 'trait' ? m.forme.points[0] : [m.forme.x, m.forme.y];
        const p = versEcran(ancre[0], ancre[1]);
        if (p[0] >= 24 && p[0] <= r.width - 24 && p[1] >= 24 && p[1] <= r.height - 24) return;
        etat.tx += r.width / 2 - p[0];
        etat.ty += r.height / 2 - p[1];
        cadrer();
      }
      function placer() {
        etat.marques.forEach((m) => {
          const ancre = m.forme.sorte === 'trait' ? m.forme.points[0] : [m.forme.x, m.forme.y];
          const p = versEcran(ancre[0], ancre[1]);
          m.bouton.style.left = p[0] + 'px';
          m.bouton.style.top = p[1] + 'px';
          if (m.lignes.length) {
            const pts = m.forme.points
              .map((q) =>
                versEcran(q[0], q[1])
                  .map((v) => Math.round(v * 10) / 10)
                  .join(','),
              )
              .join(' ');
            m.lignes.forEach((l) => l.setAttribute('points', pts));
          }
        });
      }

      /* Panneau latéral */
      function peindreInfos() {
        const img = courante();
        zoneInfos.textContent = '';
        if (!img) return;
        titre.textContent = img.titre || 'Sans titre';
        const i = images.indexOf(img);
        rang.textContent = i + 1 + ' / ' + images.length;
        btnPrec.disabled = images.length < 2;
        btnSuiv.disabled = images.length < 2;
        zoneInfos.append(
          h(
            'div',
            { class: 'tdb-rang' },
            img.reference === true
              ? h('span', { class: 'tdb-pastille tdb-pastille--accent', text: 'Référence' })
              : null,
            note10(img.noteManager)
              ? h(
                  'span',
                  {},
                  'Note du manager : ',
                  h('span', { class: 'img-note', text: note10(img.noteManager) }),
                )
              : null,
            img.date
              ? h('span', { class: 'tdb-doux', style: 'font-size:0.9rem', text: date(img.date) })
              : null,
          ),
          img.justification ? h('p', { class: 'tdb-texte', text: img.justification }) : null,
        );
      }
      function peindreAide() {
        aide.textContent = !ctx.canWrite
          ? 'Lecture seule : tu peux regarder, zoomer et lire les remarques, pas en ajouter.'
          : etat.mode === 'trait'
            ? 'Mode trait : glisse sur l’image pour entourer ou souligner un endroit, puis écris ta remarque.'
            : 'Clique sur l’image pour poser une épingle. Glisse pour déplacer, molette ou boutons pour zoomer. Au clavier : flèches pour déplacer, + et − pour zoomer, Entrée pour épingler le centre.';
        btnPoint.hidden = !ctx.canWrite;
        btnTrait.hidden = !ctx.canWrite;
        btnPoint.setAttribute('aria-pressed', etat.mode === 'point' ? 'true' : 'false');
        btnTrait.setAttribute('aria-pressed', etat.mode === 'trait' ? 'true' : 'false');
        scene.dataset.mode = etat.mode;
        zoneGlobale.hidden = !ctx.canWrite;
      }
      function peindreRemarques() {
        const dansListe = zoneRemarques.contains(document.activeElement);
        zoneRemarques.textContent = '';
        zoneRemarques.append(
          h('h3', {
            class: 'tdb-titre',
            style: 'font-size:1.05rem',
            text: etat.liste.length ? 'Tes remarques · ' + etat.liste.length : 'Tes remarques',
          }),
        );
        if (!etat.liste.length) {
          zoneRemarques.append(
            h('p', {
              class: 'tdb-doux',
              text: 'Aucune remarque sur cette image. Les épingles, les traits et les notes globales s’afficheront ici, avec la réponse du manager.',
            }),
          );
        } else {
          zoneRemarques.append(
            h(
              'ol',
              { class: 'vis__remarques' },
              etat.liste.map((r) => {
                const traitee = r.statut === 'traitee';
                const marque =
                  r.forme.sorte === 'globale'
                    ? h('span', { class: 'tdb-pastille', text: 'Globale' })
                    : h('span', {
                        class:
                          'vis__epingle' +
                          (r.forme.sorte === 'trait' ? ' vis__epingle--trait' : '') +
                          (traitee ? ' vis__epingle--traitee' : ''),
                        'aria-hidden': 'true',
                        text: r.numero,
                      });
                return h(
                  'li',
                  {
                    class: 'vis__remarque' + (r.id === etat.choisie ? ' est-choisie' : ''),
                    'data-remarque': r.id,
                    onclick: () => choisir(r.id, false),
                  },
                  marque,
                  h(
                    'div',
                    {},
                    h('p', { class: 'tdb-texte', text: r.texte }),
                    h(
                      'div',
                      { class: 'tdb-rang' },
                      h('span', {
                        class: 'tdb-pastille' + (traitee ? ' tdb-pastille--ok' : ''),
                        text: traitee ? 'Traitée' : 'Ouverte',
                      }),
                      r.creeLe
                        ? h('span', {
                            class: 'tdb-doux',
                            style: 'font-size:0.85rem',
                            text: date(r.creeLe),
                          })
                        : null,
                    ),
                    r.reponseManager
                      ? h(
                          'div',
                          { class: 'vis__reponse' },
                          h('p', { class: 'tdb-surtitre', text: 'Réponse du manager' }),
                          h('p', { class: 'tdb-texte', text: r.reponseManager }),
                        )
                      : null,
                    ctx.canWrite
                      ? h(
                          'div',
                          {},
                          h('button', {
                            type: 'button',
                            class: 'tdb-btn tdb-btn--discret',
                            'aria-label': 'Supprimer la remarque : ' + r.texte,
                            text: 'Supprimer',
                            onclick: (ev) => {
                              ev.stopPropagation();
                              supprimer(r);
                            },
                          }),
                        )
                      : null,
                  ),
                );
              }),
            ),
          );
        }
        if (dansListe) scene.focus();
      }
      function supprimer(r) {
        ctx.ui
          .confirm('Supprimer cette remarque ? Elle disparaîtra aussi pour le manager.', {
            ok: 'Supprimer',
            annuler: 'Garder',
          })
          .then((oui) => {
            if (!oui) return;
            ctx.notes.remove(r.id).then((ok) => {
              if (ok) ctx.ui.toast('Remarque supprimée.');
            });
          });
      }
      function peindreNote() {
        const garde = zoneNote.contains(document.activeElement)
          ? document.activeElement.getAttribute('data-note')
          : null;
        const valeur = etat.id ? ctx.notes.rating('image', etat.id) : null;
        zoneNote.textContent = '';
        zoneNote.append(
          h('h3', {
            class: 'tdb-titre',
            id: 'vis-note-titre',
            style: 'font-size:1.05rem',
            text: 'Ta note sur 10',
          }),
        );
        if (!ctx.canWrite) {
          zoneNote.append(
            h('p', {
              class: 'tdb-doux',
              text: valeur === null ? 'Pas encore notée.' : 'Ta note : ' + note10(valeur),
            }),
          );
          return;
        }
        const boutons = [];
        for (let n = 1; n <= 10; n++) {
          boutons.push(
            h('button', {
              type: 'button',
              class: 'tdb-btn',
              id: 'vis-note-' + n,
              'data-note': n,
              'aria-pressed': valeur === n ? 'true' : 'false',
              'aria-label': n + ' sur 10',
              tabindex: (valeur === null ? n === 1 : valeur === n) ? '0' : '-1',
              text: n,
              onclick: () => {
                ctx.notes.setRating({ type: 'image', id: etat.id }, n).then((ok) => {
                  if (ok) ctx.ui.toast('Note enregistrée : ' + n + '/10.');
                });
              },
            }),
          );
        }
        const groupe = h(
          'div',
          {
            class: 'vis__notes',
            role: 'group',
            'aria-labelledby': 'vis-note-titre',
            style: 'display:grid;grid-template-columns:repeat(10,minmax(0,1fr))',
          },
          boutons,
        );
        groupe.addEventListener('keydown', (ev) => {
          const i = boutons.indexOf(document.activeElement);
          const j =
            ev.key === 'ArrowRight'
              ? i + 1
              : ev.key === 'ArrowLeft'
                ? i - 1
                : ev.key === 'Home'
                  ? 0
                  : ev.key === 'End'
                    ? 9
                    : null;
          if (i === -1 || j === null) return;
          ev.preventDefault();
          boutons[Math.max(0, Math.min(9, j))].focus();
        });
        zoneNote.append(
          groupe,
          h('p', {
            class: 'tdb-doux',
            style: 'font-size:0.9rem',
            text:
              valeur === null
                ? 'Pas encore notée.'
                : 'Ta note : ' + note10(valeur) + '. Clique un autre chiffre pour la changer.',
          }),
        );
        if (garde) {
          const b = zoneNote.querySelector('[data-note="' + garde + '"]');
          if (b) b.focus();
        }
      }

      /* Brouillon d'épingle ou de trait */
      function proposer(forme) {
        if (!ctx.canWrite) return;
        etat.brouillon = forme;
        zoneBrouillon.hidden = false;
        zoneBrouillon.querySelector('label').textContent =
          forme.sorte === 'trait' ? 'Ta remarque sur ce trait' : 'Ta remarque à cet endroit';
        construireMarques();
        editeurBrouillon.focus();
        zoneBrouillon.scrollIntoView({ block: 'nearest' });
      }
      function abandonner(versScene) {
        if (!etat.brouillon && zoneBrouillon.hidden) return;
        etat.brouillon = null;
        etat.dernierEchap = Date.now();
        zoneBrouillon.hidden = true;
        editeurBrouillon.clear();
        construireMarques();
        if (versScene) scene.focus();
      }
      function choisirMode(mode) {
        etat.mode = mode;
        peindreAide();
      }

      /* Pointeur: clic = épingle, glisser = déplacer (ou tracer en mode trait), deux doigts = zoom. */
      function local(ev) {
        const r = scene.getBoundingClientRect();
        return [ev.clientX - r.left, ev.clientY - r.top];
      }
      function borne(v) {
        return Math.max(0, Math.min(1, v));
      }
      scene.addEventListener('pointerdown', (ev) => {
        if (
          ev.target.closest('button') ||
          (ev.pointerType === 'mouse' && ev.button !== 0) ||
          !etat.iw
        )
          return;
        const p = local(ev);
        pointeurs.set(ev.pointerId, p);
        try {
          scene.setPointerCapture(ev.pointerId);
        } catch (e) {
          /* pointeur déjà relâché */
        }
        if (pointeurs.size === 1) {
          const i = versImage(p[0], p[1]);
          geste = {
            x0: p[0],
            y0: p[1],
            tx0: etat.tx,
            ty0: etat.ty,
            bouge: false,
            points: etat.mode === 'trait' && ctx.canWrite ? [[borne(i[0]), borne(i[1])]] : null,
          };
          if (geste.points) {
            etat.brouillon = null;
            zoneBrouillon.hidden = true;
          }
        } else if (pointeurs.size === 2) {
          const pts = Array.from(pointeurs.values());
          geste = null;
          pince = {
            d0: Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]) || 1,
            zoom0: etat.zoom,
          };
        }
      });
      scene.addEventListener('pointermove', (ev) => {
        if (!pointeurs.has(ev.pointerId)) return;
        const p = local(ev);
        pointeurs.set(ev.pointerId, p);
        if (pince && pointeurs.size === 2) {
          const pts = Array.from(pointeurs.values());
          const d = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]) || 1;
          zoomer(
            (pince.zoom0 * d) / pince.d0 / etat.zoom,
            (pts[0][0] + pts[1][0]) / 2,
            (pts[0][1] + pts[1][1]) / 2,
          );
          return;
        }
        if (!geste) return;
        const dx = p[0] - geste.x0;
        const dy = p[1] - geste.y0;
        if (!geste.bouge && Math.hypot(dx, dy) > SEUIL_GLISSE) geste.bouge = true;
        if (!geste.bouge) return;
        if (geste.points) {
          const i = versImage(p[0], p[1]);
          const q = [borne(i[0]), borne(i[1])];
          const dernier = geste.points[geste.points.length - 1];
          if (Math.hypot(q[0] - dernier[0], q[1] - dernier[1]) > 0.004) {
            geste.points.push(q);
            etat.brouillon = { sorte: 'trait', points: geste.points };
            construireMarques();
          }
        } else {
          scene.classList.add('est-deplacee');
          etat.tx = geste.tx0 + dx;
          etat.ty = geste.ty0 + dy;
          cadrer();
        }
      });
      function lacher(ev, annule) {
        if (!pointeurs.has(ev.pointerId)) return;
        const p = pointeurs.get(ev.pointerId);
        pointeurs.delete(ev.pointerId);
        scene.classList.remove('est-deplacee');
        if (pointeurs.size < 2) pince = null;
        const g = geste;
        geste = null;
        if (!g || annule) {
          if (g && g.points) abandonner(false);
          return;
        }
        if (g.points) {
          if (g.points.length < 2) {
            etat.brouillon = null;
            construireMarques();
            ctx.ui.toast('Glisse sur l’image pour tracer un trait.');
            return;
          }
          let pts = g.points;
          if (pts.length > POINTS_MAX) {
            const pas = (pts.length - 1) / (POINTS_MAX - 1);
            pts = Array.from({ length: POINTS_MAX }, (_, k) => pts[Math.round(k * pas)]);
          }
          proposer({ sorte: 'trait', points: pts });
        } else if (!g.bouge) {
          const i = versImage(p[0], p[1]);
          if (i[0] < 0 || i[0] > 1 || i[1] < 0 || i[1] > 1) return;
          proposer({ sorte: 'point', x: i[0], y: i[1] });
        }
      }
      scene.addEventListener('pointerup', (ev) => lacher(ev, false));
      scene.addEventListener('pointercancel', (ev) => lacher(ev, true));
      scene.addEventListener(
        'wheel',
        (ev) => {
          if (!etat.iw) return;
          ev.preventDefault();
          const p = local(ev);
          zoomer(ev.deltaY < 0 ? 1.2 : 1 / 1.2, p[0], p[1]);
        },
        { passive: false },
      );
      scene.addEventListener('keydown', (ev) => {
        if (ev.target !== scene || !etat.iw) return;
        const pas = 60;
        const r = scene.getBoundingClientRect();
        if (ev.key === '+' || ev.key === '=') zoomer(1.4);
        else if (ev.key === '-') zoomer(1 / 1.4);
        else if (ev.key === '0') ajuster();
        else if (ev.key === 'ArrowLeft') etat.tx += pas;
        else if (ev.key === 'ArrowRight') etat.tx -= pas;
        else if (ev.key === 'ArrowUp') etat.ty += pas;
        else if (ev.key === 'ArrowDown') etat.ty -= pas;
        else if (ev.key === 'Enter' || ev.key === ' ') {
          const i = versImage(r.width / 2, r.height / 2);
          if (ctx.canWrite && i[0] >= 0 && i[0] <= 1 && i[1] >= 0 && i[1] <= 1)
            proposer({ sorte: 'point', x: i[0], y: i[1] });
        } else return;
        ev.preventDefault();
        cadrer();
      });
      // Garde-fou: le cadre ne défile jamais de lui-même (focus d'une marque hors champ).
      scene.addEventListener('scroll', () => {
        scene.scrollLeft = 0;
        scene.scrollTop = 0;
      });
      if (typeof ResizeObserver === 'function') new ResizeObserver(() => cadrer()).observe(scene);

      /* Ouverture, navigation, fermeture */
      function charger() {
        const img = courante();
        if (!img) return;
        const src = chemin(img.fichier);
        etat.iw = 0;
        etat.ih = 0;
        etat.zoom = 1;
        etat.brouillon = null;
        etat.choisie = null;
        zoneBrouillon.hidden = true;
        editeurBrouillon.clear();
        manque.hidden = true;
        image.hidden = true;
        const absente = () => {
          manque.textContent =
            'Cette image est introuvable pour le moment. Tu peux quand même laisser une note globale ; préviens le manager si elle ne revient pas.';
          manque.hidden = false;
        };
        image.onload = () => {
          etat.iw = image.naturalWidth;
          etat.ih = image.naturalHeight;
          image.hidden = false;
          cadrer();
        };
        image.onerror = absente;
        if (src) image.src = src;
        else absente();
        if (etat.arret) etat.arret();
        etat.arret = ctx.notes.watch('image', img.id, (liste) => {
          etat.liste = liste.map((r) => Object.assign({}, r));
          construireMarques();
          peindreRemarques();
          peindreNote();
        });
        peindreInfos();
        peindreAide();
      }
      function ouvrir(id) {
        etat.id = id;
        etat.mode = 'point';
        if (typeof dialogue.showModal === 'function') dialogue.showModal();
        else dialogue.setAttribute('open', '');
        charger();
        cadrer();
        scene.focus();
      }
      function voisine(sens) {
        const i = images.findIndex((x) => x.id === etat.id);
        if (i === -1 || images.length < 2) return;
        etat.id = images[(i + sens + images.length) % images.length].id;
        charger();
      }
      function fermer() {
        const id = etat.id;
        if (etat.arret) etat.arret();
        etat.arret = null;
        etat.id = null;
        image.removeAttribute('src');
        if (dialogue.open) dialogue.close();
        const b = id && galerie.querySelector('[data-image="' + CSS.escape(id) + '"]');
        if (b) b.focus();
      }
      // Échap: annule d'abord le brouillon en cours, sinon ferme la visionneuse.
      dialogue.addEventListener('cancel', (ev) => {
        ev.preventDefault();
        if (etat.brouillon) abandonner(true);
        else if (Date.now() - etat.dernierEchap > 250) fermer();
      });
      dialogue.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Escape' || ev.defaultPrevented) return;
        ev.preventDefault();
        if (etat.brouillon) abandonner(true);
        else if (Date.now() - etat.dernierEchap > 250) fermer();
      });

      /* Données */
      ctx.data.watch('images', (vue) => {
        vueImages = vue;
        const connues = FAMILLES.map((f) => f[0]);
        const poids = (i) =>
          connues.indexOf(i.famille) === -1 ? connues.length : connues.indexOf(i.famille);
        images = vue.docs
          .filter((i) => i && typeof i.id === 'string')
          .sort(
            (a, b) =>
              poids(a) - poids(b) ||
              String(a.famille || '').localeCompare(String(b.famille || '')) ||
              (a.ordre || 0) - (b.ordre || 0) ||
              (a.id < b.id ? -1 : 1),
          );
        peindreGalerie();
        if (etat.id) {
          if (courante()) peindreInfos();
          else {
            fermer();
            ctx.ui.toast('Cette image vient d’être retirée par le manager.');
          }
        }
      });
      ctx.notes.watch('image', '', () => {
        if (vueImages.etat === 'pret' && !dialogue.open) peindreGalerie();
      });
      dialogue.addEventListener('close', () => {
        if (vueImages.etat === 'pret') peindreGalerie();
      });
      document.addEventListener('tdb:droits', () => {
        peindreGalerie();
        if (etat.id) {
          peindreAide();
          peindreRemarques();
          peindreNote();
        }
      });
    },
  });
})();
