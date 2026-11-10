/* Onglet « Questions »: les questions ouvertes en tête, la recommandation du manager bien visible,
   un choix par option, une réponse libre, et l'état « envoyée ». */
(function () {
  'use strict';
  if (!window.TDB) return;
  const TDB = window.TDB;

  function simple(texte) {
    return String(texte || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();
  }
  /* L'option recommandée: celle qui ouvre la recommandation (ou lui est égale), à défaut celle qu'elle contient. */
  function optionRecommandee(q) {
    const reco = simple(q.recommandation);
    if (!reco) return -1;
    let choix = -1;
    let score = 0;
    q.options.forEach((o, i) => {
      const t = simple(o);
      if (!t) return;
      const s =
        reco === t
          ? 3e6
          : reco.startsWith(t)
            ? 2e6 + t.length
            : reco.includes(t)
              ? 1e6 + t.length
              : 0;
      if (s > score) {
        score = s;
        choix = i;
      }
    });
    return choix;
  }
  function propre(q) {
    return Object.assign({}, q, {
      options: (Array.isArray(q.options) ? q.options : []).filter(
        (o) => typeof o === 'string' && o.trim() !== '',
      ),
      statut: q.statut === 'repondue' || q.statut === 'caduque' ? q.statut : 'ouverte',
      reponse: typeof q.reponse === 'string' ? q.reponse : '',
      reponseLibre: typeof q.reponseLibre === 'string' ? q.reponseLibre : '',
    });
  }

  // Le compteur vit dès le chargement de la page, avant la première ouverture de l'onglet.
  TDB.ctx.data.watch('questions', (vue) => {
    TDB.setBadge(
      'questions',
      vue.docs.filter((q) => q.statut !== 'repondue' && q.statut !== 'caduque').length,
    );
  });

  TDB.registerTab({
    id: 'questions',
    title: 'Questions',
    order: 20,
    mount(el, ctx) {
      const { h, vide, date } = ctx.ui;
      let vueCourante = { etat: 'chargement', retard: false, docs: [] };
      const brouillons = new Map(); // id -> { option, texte, edition }
      const envoyeesIci = new Set(); // répondues pendant cette visite: elles gardent leur place en tête
      const cartes = new Map(); // id -> { signature, el }
      let focusApres = null;
      const refaites = new Set(); // cartes reconstruites pendant le dernier rendu

      const zoneOuvertes = h('div', { class: 'tdb-pile' });
      const titreRepondues = h('h2', { class: 'tdb-titre', text: 'Déjà répondues' });
      const zoneRepondues = h('div', { class: 'q-repondues' });
      const etat = h('div');
      el.append(
        h('h2', { class: 'tdb-titre', id: 'q-titre', text: 'Questions du manager' }),
        etat,
        zoneOuvertes,
        titreRepondues,
        zoneRepondues,
      );

      function brouillon(q) {
        let b = brouillons.get(q.id);
        if (!b) {
          b = { option: q.reponse || null, texte: q.reponseLibre || '', edition: false };
          brouillons.set(q.id, b);
        }
        return b;
      }

      function envoyer(q, bouton) {
        const b = brouillon(q);
        const libre = b.texte.trim();
        if (!b.option && !libre) {
          ctx.ui.toast('Choisis une option ou écris ta réponse avant d’envoyer.');
          return;
        }
        const enEdition = b.edition;
        bouton.disabled = true;
        // Posés avant l'écriture: l'instantané de la base peut arriver avant la fin de la promesse.
        envoyeesIci.add(q.id);
        b.edition = false;
        focusApres = q.id;
        ctx.data
          .write('questions/' + q.id, (db) =>
            db.doc('questions/' + q.id).update({
              statut: 'repondue',
              reponse: b.option || '',
              reponseLibre: libre,
              reponduLe: new Date().toISOString(),
            }),
          )
          .then((ok) => {
            bouton.disabled = false;
            if (ok) ctx.ui.toast('Réponse envoyée au manager.');
            else {
              if (q.statut !== 'repondue') envoyeesIci.delete(q.id);
              b.edition = enEdition;
              focusApres = null;
            }
            peindre();
          });
      }

      function formulaire(q) {
        const b = brouillon(q);
        const reco = optionRecommandee(q);
        const idLibre = 'q-' + q.id + '-libre';
        const libre = h('textarea', {
          class: 'tdb-champ',
          id: idLibre,
          rows: '2',
          placeholder: q.options.length
            ? 'Une précision, une condition, une autre idée'
            : 'Écris ta réponse ici',
        });
        libre.value = b.texte;
        libre.addEventListener('input', () => {
          b.texte = libre.value;
        });
        const bouton = h('button', {
          type: 'submit',
          class: 'tdb-btn tdb-btn--accent',
          text: b.edition ? 'Envoyer la modification' : 'Envoyer ma réponse',
        });
        const options = q.options.length
          ? h(
              'fieldset',
              { class: 'q-options' },
              h('legend', { text: 'Ton choix' }),
              q.options.map((o, i) => {
                const radio = h('input', {
                  type: 'radio',
                  name: 'q-' + q.id,
                  id: 'q-' + q.id + '-o' + i,
                  value: o,
                });
                radio.checked = b.option === o;
                radio.addEventListener('change', () => {
                  b.option = o;
                });
                return h(
                  'label',
                  { class: 'q-option' + (i === reco ? ' q-option--reco' : '') },
                  radio,
                  h('span', {}, i === reco ? h('small', { text: 'Recommandé' }) : null, o),
                );
              }),
            )
          : null;
        return h(
          'form',
          {
            class: 'tdb-pile',
            novalidate: true,
            onsubmit: (ev) => {
              ev.preventDefault();
              envoyer(q, bouton);
            },
          },
          options,
          h(
            'div',
            {},
            h('label', {
              class: 'tdb-etiquette',
              for: idLibre,
              text: q.options.length ? 'Autre réponse ou précision (facultatif)' : 'Ta réponse',
            }),
            libre,
          ),
          h(
            'div',
            { class: 'tdb-rang' },
            bouton,
            b.edition
              ? h('button', {
                  type: 'button',
                  class: 'tdb-btn',
                  text: 'Annuler',
                  onclick: () => {
                    brouillons.delete(q.id);
                    focusApres = q.id;
                    peindre();
                  },
                })
              : null,
          ),
        );
      }

      function reponseEnvoyee(q) {
        const b = brouillon(q);
        return h(
          'div',
          { class: 'q-envoyee' },
          h('p', {
            class: 'tdb-surtitre',
            text: q.reponduLe ? 'Réponse envoyée le ' + date(q.reponduLe) : 'Réponse envoyée',
          }),
          q.reponse ? h('p', {}, 'Ton choix : ', h('strong', { text: q.reponse })) : null,
          q.reponseLibre ? h('p', { class: 'tdb-texte', text: q.reponseLibre }) : null,
          q.statut === 'repondue' && ctx.canWrite
            ? h(
                'div',
                {},
                h('button', {
                  type: 'button',
                  class: 'tdb-btn',
                  'data-modifier': q.id,
                  text: 'Modifier ma réponse',
                  onclick: () => {
                    b.option = q.reponse || null;
                    b.texte = q.reponseLibre;
                    b.edition = true;
                    focusApres = q.id;
                    peindre();
                  },
                }),
              )
            : null,
        );
      }

      function corps(q) {
        const b = brouillon(q);
        const morceaux = [h('p', { class: 'q-texte tdb-texte', text: q.texte || '' })];
        if (q.recommandation) {
          morceaux.push(
            h(
              'div',
              { class: 'q-reco' },
              h('p', { class: 'tdb-surtitre', text: 'Recommandation du manager' }),
              h('p', { class: 'tdb-texte', text: q.recommandation }),
            ),
          );
        }
        if (q.statut === 'caduque') {
          morceaux.push(
            h('p', {
              class: 'tdb-doux',
              text: 'Le manager a clos cette question : elle n’attend plus de réponse.',
            }),
          );
          if (q.reponse || q.reponseLibre) morceaux.push(reponseEnvoyee(q));
        } else if (q.statut === 'repondue' && !b.edition) morceaux.push(reponseEnvoyee(q));
        else if (ctx.canWrite) morceaux.push(formulaire(q));
        else
          morceaux.push(
            h('p', {
              class: 'tdb-doux',
              text: 'Lecture seule : tu ne peux pas répondre d’ici pour le moment.',
            }),
          );
        return morceaux;
      }

      function enTete(q) {
        return h(
          'div',
          { class: 'tdb-rang' },
          h('span', { class: 'tdb-surtitre', text: q.sujet || 'Question' }),
          q.poseeLe
            ? h('span', {
                class: 'tdb-doux',
                style: 'font-size:0.9rem',
                text: 'posée le ' + date(q.poseeLe),
              })
            : null,
        );
      }

      function carte(q, repliee) {
        const b = brouillon(q);
        const signature = JSON.stringify([q, repliee, b.edition, ctx.canWrite]);
        const connue = cartes.get(q.id);
        if (connue && connue.signature === signature) return connue.el;
        refaites.add(q.id);
        let elCarte;
        if (repliee) {
          elCarte = h(
            'details',
            { 'data-question': q.id },
            h(
              'summary',
              {},
              h('span', { text: (q.sujet ? q.sujet + ' : ' : '') + (q.texte || '') }),
              q.statut === 'caduque'
                ? h('span', { class: 'tdb-pastille', text: 'Caduque' })
                : h('span', {
                    class: 'tdb-pastille tdb-pastille--ok',
                    text: q.reponse ? 'Répondu : ' + q.reponse : 'Répondu',
                  }),
            ),
            h('div', {}, corps(q)),
          );
          if (connue && connue.el.open) elCarte.open = true;
          if (b.edition) elCarte.open = true;
        } else {
          elCarte = h(
            'article',
            {
              class: 'tdb-carte q-carte' + (q.statut === 'ouverte' ? ' q-carte--ouverte' : ''),
              'data-question': q.id,
            },
            enTete(q),
            corps(q),
          );
        }
        cartes.set(q.id, { signature, el: elCarte });
        return elCarte;
      }

      function poser(zone, elements) {
        const actuels = Array.from(zone.children);
        if (actuels.length === elements.length && actuels.every((e, i) => e === elements[i]))
          return;
        zone.replaceChildren(...elements);
      }

      function peindre() {
        const vue = vueCourante;
        etat.textContent = '';
        if (vue.etat !== 'pret') {
          poser(zoneOuvertes, []);
          poser(zoneRepondues, []);
          titreRepondues.hidden = true;
          etat.append(
            vue.etat === 'horsligne'
              ? vide(
                  'Questions indisponibles hors ligne',
                  'Elles reviendront dès que la page pourra joindre ses données. Rien n’est perdu.',
                )
              : vide(
                  'Chargement des questions…',
                  vue.retard
                    ? 'La base ne répond pas encore. La page se mettra à jour toute seule dès qu’elle répondra.'
                    : 'Un instant.',
                ),
          );
          return;
        }
        const toutes = vue.docs
          .map(propre)
          .sort((a, b) => (a.ordre || 0) - (b.ordre || 0) || (a.id < b.id ? -1 : 1));
        const enTeteListe = toutes.filter(
          (q) => q.statut === 'ouverte' || (q.statut === 'repondue' && envoyeesIci.has(q.id)),
        );
        const repondues = toutes.filter((q) => !enTeteListe.includes(q));
        const ouvertes = toutes.filter((q) => q.statut === 'ouverte').length;
        if (!toutes.length) {
          etat.append(
            vide(
              'Aucune question pour l’instant',
              'Quand le manager aura besoin d’une décision, elle apparaîtra ici avec sa recommandation et un bouton par réponse possible.',
            ),
          );
        } else if (!ouvertes) {
          etat.append(
            h('p', {
              class: 'tdb-pastille tdb-pastille--ok',
              text: 'Tout est répondu, rien ne t’attend',
            }),
          );
        } else {
          etat.append(
            h('p', {
              class: 'tdb-doux',
              text:
                ouvertes === 1
                  ? '1 question attend ta réponse.'
                  : ouvertes + ' questions attendent ta réponse.',
            }),
          );
        }
        refaites.clear();
        poser(
          zoneOuvertes,
          enTeteListe.map((q) => carte(q, false)),
        );
        poser(
          zoneRepondues,
          repondues.map((q) => carte(q, true)),
        );
        titreRepondues.hidden = repondues.length === 0;
        Array.from(cartes.keys()).forEach((id) => {
          if (!toutes.some((q) => q.id === id)) cartes.delete(id);
        });
        if (focusApres && refaites.has(focusApres)) {
          const cible = cartes.get(focusApres);
          focusApres = null;
          const ou =
            cible && cible.el.querySelector('[data-modifier], input:checked, input, textarea');
          if (ou) ou.focus();
        }
      }

      ctx.data.watch('questions', (vue) => {
        vueCourante = vue;
        peindre();
      });
      document.addEventListener('tdb:droits', peindre);
    },
  });
})();
