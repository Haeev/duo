/* Onglet « Avancement » (accueil): pourcentage global, étapes pondérées, ce qui tourne, ce qui bloque, journal. */
(function () {
  'use strict';
  if (!window.TDB) return;

  const SORTES = {
    livraison: 'Livraison',
    decision: 'Décision',
    correctif: 'Correctif',
    info: 'Info',
  };

  function pourcent(n) {
    return typeof n === 'number' && isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
  }
  function textes(liste) {
    return Array.isArray(liste)
      ? liste.filter((t) => typeof t === 'string' && t.trim() !== '')
      : [];
  }

  window.TDB.registerTab({
    id: 'avancement',
    title: 'Avancement',
    order: 10,
    mount(el, ctx) {
      const { h, vide, date } = ctx.ui;
      const zoneRappel = h('div', { hidden: true });
      const zoneEtat = h('div', { class: 'tdb-pile' });
      const zoneJournal = h('div', { class: 'tdb-pile' });
      el.append(zoneRappel, zoneEtat, zoneJournal);

      function attente(vue, quoi, horsLigne) {
        if (vue.etat === 'horsligne')
          return vide(horsLigne, 'Tout reviendra dès que la page pourra joindre ses données.');
        return vide(
          'Chargement ' + quoi + '…',
          vue.retard
            ? 'La base ne répond pas encore. Rien à faire : la page se mettra à jour toute seule dès qu’elle répondra.'
            : 'Un instant.',
        );
      }

      ctx.data.watch('questions', (vue) => {
        const n = vue.docs.filter((q) => q.statut !== 'repondue' && q.statut !== 'caduque').length;
        zoneRappel.textContent = '';
        zoneRappel.hidden = n === 0;
        if (n === 0) return;
        zoneRappel.append(
          h(
            'div',
            { class: 'tdb-carte av-rappel' },
            h('p', {
              class: 'tdb-titre',
              text:
                n === 1 ? '1 question attend ta réponse' : n + ' questions attendent ta réponse',
            }),
            h('button', {
              type: 'button',
              class: 'tdb-btn tdb-btn--accent',
              id: 'av-vers-questions',
              text: 'Répondre',
              onclick: () => window.TDB.go('questions'),
            }),
          ),
        );
      });

      ctx.data.watch('etat/avancement', (vue) => {
        zoneEtat.textContent = '';
        if (vue.etat !== 'pret') {
          zoneEtat.append(attente(vue, 'de l’avancement', 'Avancement indisponible hors ligne'));
          return;
        }
        const a = vue.data;
        if (!a) {
          zoneEtat.append(
            vide(
              'Pas encore de point d’avancement',
              'Dès que le manager en publie un, tu verras ici le pourcentage global, une barre par étape, ce qui tourne et ce qui bloque.',
            ),
          );
          return;
        }
        const global = pourcent(a.pourcent);
        const etapes = (Array.isArray(a.etapes) ? a.etapes : []).filter(
          (e) => e && typeof e.nom === 'string',
        );
        const totalPoids = etapes.reduce((s, e) => s + (e.poids > 0 ? e.poids : 0), 0);

        let quand = '';
        if (a.majLe) {
          const jour = date(a.majLe);
          quand = a.heureParis
            ? jour.split(' à ')[0] + ' à ' + a.heureParis + ', heure de Paris'
            : jour + (jour.includes(' à ') ? ', heure de Paris' : '');
        } else if (a.heureParis) quand = a.heureParis + ', heure de Paris';

        const ligne = h('div', {
          class: 'av-ligne',
          role: 'img',
          'aria-label': 'La ligne des étapes, chacune large comme son poids',
        });
        etapes.forEach((e) => {
          const troncon = h('div', { class: 'av-troncon', title: e.nom }, h('span'));
          troncon.style.flex = (e.poids > 0 ? e.poids : 1) + ' 1 0';
          troncon.firstChild.style.width = (pourcent(e.pourcent) || 0) + '%';
          ligne.append(troncon);
        });

        zoneEtat.append(
          h(
            'div',
            { class: 'tdb-carte tdb-pile' },
            h(
              'div',
              { class: 'av-tete' },
              h(
                'p',
                { class: 'av-nombre' },
                global === null ? '?' : String(global),
                h('small', { text: ' %' }),
              ),
              h(
                'div',
                { class: 'tdb-pile', style: 'gap:0.3rem' },
                h('h2', { class: 'tdb-surtitre', text: 'Avancement global' }),
                quand ? h('p', { text: 'À jour le ' + quand }) : null,
                a.resume ? h('p', { class: 'tdb-texte tdb-doux', text: a.resume }) : null,
              ),
            ),
            etapes.length ? ligne : null,
          ),
        );

        if (etapes.length) {
          zoneEtat.append(
            h(
              'div',
              { class: 'tdb-carte tdb-pile' },
              h('h2', { class: 'tdb-titre', text: 'Étapes' }),
              h(
                'ol',
                { class: 'av-etapes' },
                etapes.map((e) => {
                  const p = pourcent(e.pourcent) || 0;
                  const part =
                    totalPoids > 0 && e.poids > 0 ? Math.round((e.poids / totalPoids) * 100) : null;
                  const barre = h(
                    'div',
                    {
                      class: 'av-barre',
                      role: 'progressbar',
                      'aria-label': e.nom,
                      'aria-valuemin': '0',
                      'aria-valuemax': '100',
                      'aria-valuenow': p,
                    },
                    h('span'),
                  );
                  barre.firstChild.style.width = p + '%';
                  return h(
                    'li',
                    { class: 'av-etape' + (p >= 100 ? ' av-etape--finie' : '') },
                    h(
                      'span',
                      { class: 'av-etape__nom' },
                      e.nom,
                      part === null
                        ? null
                        : h('span', {
                            class: 'tdb-doux',
                            style: 'font-weight:400',
                            text: ' · compte pour ' + part + ' %',
                          }),
                    ),
                    h('span', { class: 'av-etape__val', text: p >= 100 ? 'Fini' : p + ' %' }),
                    barre,
                  );
                }),
              ),
            ),
          );
        }

        const enCours = textes(a.enCours);
        const bloque = textes(a.bloque);
        zoneEtat.append(
          h(
            'div',
            { class: 'av-deux' },
            h(
              'div',
              { class: 'tdb-carte' },
              h('h2', { class: 'tdb-titre', text: 'En cours' }),
              enCours.length
                ? h(
                    'ul',
                    { class: 'av-liste' },
                    enCours.map((t) => h('li', {}, h('span', { text: t }))),
                  )
                : h('p', { class: 'tdb-doux', text: 'Rien ne tourne en ce moment.' }),
            ),
            h(
              'div',
              { class: 'tdb-carte' },
              h('h2', { class: 'tdb-titre', text: 'Bloqué' }),
              bloque.length
                ? h(
                    'ul',
                    { class: 'av-liste av-liste--bloque' },
                    bloque.map((t) => h('li', {}, h('span', { text: t }))),
                  )
                : h('p', { class: 'tdb-doux', text: 'Rien ne bloque.' }),
            ),
            h(
              'div',
              { class: 'tdb-carte' },
              h('h2', { class: 'tdb-titre', text: 'Version publiée' }),
              h('p', {
                class: a.versionPubliee ? 'img-note' : 'tdb-doux',
                style: 'margin-top:0.6rem;overflow-wrap:anywhere',
                text: a.versionPubliee || 'Aucune version publiée pour l’instant.',
              }),
            ),
          ),
        );
      });

      ctx.data.watch('journal', (vue) => {
        zoneJournal.textContent = '';
        const carte = h(
          'div',
          { class: 'tdb-carte tdb-pile' },
          h('h2', { class: 'tdb-titre', text: 'Journal des livraisons' }),
        );
        zoneJournal.append(carte);
        if (vue.etat !== 'pret') {
          carte.append(attente(vue, 'du journal', 'Journal indisponible hors ligne'));
          return;
        }
        const fil = vue.docs
          .slice()
          .sort((x, y) => (String(x.quand || '') < String(y.quand || '') ? 1 : -1));
        if (!fil.length) {
          carte.append(
            h('p', {
              class: 'tdb-doux',
              text: 'Le journal est vide. Chaque livraison s’ajoutera ici, la plus récente en haut.',
            }),
          );
          return;
        }
        carte.append(
          h(
            'ol',
            { class: 'av-journal' },
            fil.map((j) =>
              h(
                'li',
                {},
                h(
                  'div',
                  { class: 'tdb-pile', style: 'gap:0.3rem;align-items:flex-start' },
                  h('span', { class: 'av-journal__quand', text: date(j.quand) }),
                  j.sorte
                    ? h('span', { class: 'tdb-pastille', text: SORTES[j.sorte] || j.sorte })
                    : null,
                ),
                h(
                  'div',
                  { class: 'tdb-pile', style: 'gap:0.2rem' },
                  h('h3', {
                    style: 'font-size:1rem;overflow-wrap:anywhere',
                    text: j.titre || 'Sans titre',
                  }),
                  j.texte ? h('p', { class: 'tdb-texte tdb-doux', text: j.texte }) : null,
                ),
              ),
            ),
          ),
        );
      });
    },
  });
})();
