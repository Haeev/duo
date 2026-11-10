/* Onglet « Règles »: les décisions et règles actées, en lecture, avec une recherche simple.
   C'est l'onglet le plus court: le copier pour en créer un nouveau (voir le README). */
(function () {
  'use strict';
  if (!window.TDB) return;

  function simple(texte) {
    return String(texte || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();
  }

  window.TDB.registerTab({
    id: 'regles',
    title: 'Règles',
    order: 40,
    mount(el, ctx) {
      const { h, vide, date } = ctx.ui;
      let regles = [];
      let vueCourante = { etat: 'chargement', retard: false };

      const champ = h('input', {
        type: 'search',
        class: 'tdb-champ',
        id: 'rg-recherche',
        placeholder: 'Un mot, par exemple « train »',
        autocomplete: 'off',
        oninput: peindre,
      });
      const compte = h('p', { class: 'tdb-doux', role: 'status' });
      const liste = h('div', { class: 'rg-liste' });
      const recherche = h(
        'div',
        { class: 'rg-recherche' },
        h('label', {
          class: 'tdb-etiquette',
          for: 'rg-recherche',
          text: 'Chercher dans les règles',
        }),
        champ,
      );
      el.append(
        h('h2', { class: 'tdb-titre', text: 'Décisions et règles actées' }),
        recherche,
        compte,
        liste,
      );

      function peindre() {
        liste.textContent = '';
        compte.textContent = '';
        const pret = vueCourante.etat === 'pret';
        recherche.hidden = !pret || regles.length === 0;
        if (vueCourante.etat === 'horsligne') {
          liste.append(
            vide(
              'Règles indisponibles hors ligne',
              'La liste reviendra dès que la page pourra joindre ses données.',
            ),
          );
          return;
        }
        if (!pret) {
          liste.append(
            vide(
              'Chargement des règles…',
              vueCourante.retard
                ? 'La base ne répond pas encore. La page se mettra à jour toute seule dès qu’elle répondra.'
                : 'Un instant.',
            ),
          );
          return;
        }
        if (!regles.length) {
          liste.append(
            vide(
              'Aucune règle actée pour l’instant',
              'Chaque décision que tu prends et chaque règle fixée avec le manager sera inscrite ici, pour la retrouver sans fouiller les messages.',
            ),
          );
          return;
        }
        const mots = simple(champ.value).split(/\s+/).filter(Boolean);
        const trouvees = regles.filter((r) => {
          const corps = simple(r.titre + ' ' + r.texte);
          return mots.every((m) => corps.includes(m));
        });
        compte.textContent = mots.length
          ? trouvees.length + ' sur ' + regles.length + (regles.length > 1 ? ' règles' : ' règle')
          : regles.length + (regles.length > 1 ? ' règles' : ' règle');
        if (!trouvees.length) {
          liste.append(
            vide(
              'Aucune règle ne contient ces mots',
              'Essaie un mot plus court, ou efface la recherche pour tout revoir.',
            ),
          );
          return;
        }
        trouvees.forEach((r) => {
          liste.append(
            h(
              'article',
              { class: 'tdb-carte rg-regle' },
              h('h3', {
                class: 'tdb-titre',
                style: 'font-size:1.05rem;overflow-wrap:anywhere',
                text: r.titre || 'Sans titre',
              }),
              r.date
                ? h('p', {
                    class: 'tdb-doux',
                    style: 'font-size:0.9rem',
                    text: 'Actée le ' + date(r.date),
                  })
                : null,
              r.texte ? h('p', { class: 'tdb-texte', text: r.texte }) : null,
            ),
          );
        });
      }

      ctx.data.watch('regles', (vue) => {
        vueCourante = vue;
        regles = vue.docs
          .slice()
          .sort((a, b) => (a.ordre || 0) - (b.ordre || 0) || (a.id < b.id ? -1 : 1));
        peindre();
      });
    },
  });
})();
