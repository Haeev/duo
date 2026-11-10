/* Banc d'essai: fausse capacité `db` en mémoire, à l'interface de db.d.ts, et faux `window.claude.use`.
   Injecté par capturer.cjs avant la page. Ne jamais charger ce fichier depuis index.html. */
(function () {
  'use strict';
  const docs = new Map(); // chemin -> corps
  const ecoutes = new Set();
  const META = Object.freeze({ fromCache: false, hasPendingWrites: false });

  function segments(chemin, pair) {
    const s = String(chemin).split('/');
    if (s.some((x) => !/^[A-Za-z0-9_\-.~:@+]+$/.test(x)) || (s.length % 2 === 0) !== pair)
      throw new TypeError('chemin invalide: ' + chemin);
    return s;
  }
  function geler(v) {
    return JSON.parse(JSON.stringify(v), (_, x) =>
      x && typeof x === 'object' ? Object.freeze(x) : x,
    );
  }
  function photoDoc(chemin) {
    const corps = docs.get(chemin);
    const fige = corps === undefined ? undefined : geler(corps);
    return {
      id: chemin.split('/').pop(),
      exists: corps !== undefined,
      data: () => fige,
      metadata: META,
    };
  }
  function prevenir() {
    ecoutes.forEach((e) => setTimeout(e, 0));
  }
  function refuser(code) {
    return Promise.reject({ code, message: code });
  }
  function docRef(chemin, options) {
    segments(chemin, true);
    const ecrire = (action) => {
      if (options.refusEcriture) return refuser('invalid_argument');
      action();
      prevenir();
      return Promise.resolve();
    };
    return {
      id: chemin.split('/').pop(),
      path: chemin,
      get: () => Promise.resolve(photoDoc(chemin)),
      set: (data) => ecrire(() => docs.set(chemin, JSON.parse(JSON.stringify(data)))),
      update: (data) =>
        docs.has(chemin)
          ? ecrire(() =>
              docs.set(
                chemin,
                Object.assign({}, docs.get(chemin), JSON.parse(JSON.stringify(data))),
              ),
            )
          : refuser('invalid_argument'),
      delete: () => ecrire(() => docs.delete(chemin)),
      acquire: () => Promise.resolve({ acquired: true }),
      onSnapshot(suite) {
        let avant = null;
        const e = () => {
          const texte = JSON.stringify(docs.get(chemin) ?? null);
          if (texte === avant) return;
          avant = texte;
          suite(photoDoc(chemin));
        };
        ecoutes.add(e);
        setTimeout(e, options.delai);
        return () => ecoutes.delete(e);
      },
      collection: (sous) => collectionRef(chemin + '/' + sous, options),
    };
  }
  function requete(chemin, options, filtres, tri, borne) {
    const lire = () => {
      const prefixe = chemin + '/';
      let liste = Array.from(docs.keys())
        .filter((c) => c.startsWith(prefixe) && !c.slice(prefixe.length).includes('/'))
        .sort()
        .map(photoDoc);
      filtres.forEach(([champ, op, valeur]) => {
        liste = liste.filter((d) => {
          const v = d.data()[champ];
          return op === '=='
            ? v === valeur
            : op === '!='
              ? v !== valeur
              : op === '<'
                ? v < valeur
                : op === '<='
                  ? v <= valeur
                  : op === '>'
                    ? v > valeur
                    : op === '>='
                      ? v >= valeur
                      : op === 'in'
                        ? valeur.includes(v)
                        : true;
        });
      });
      if (tri) {
        const sens = tri[1] === 'desc' ? -1 : 1;
        liste.sort((a, b) =>
          a.data()[tri[0]] < b.data()[tri[0]]
            ? -sens
            : a.data()[tri[0]] > b.data()[tri[0]]
              ? sens
              : 0,
        );
      }
      if (borne) liste = liste.slice(0, borne);
      return {
        docs: liste,
        size: liste.length,
        empty: liste.length === 0,
        docChanges: () => [],
        metadata: META,
      };
    };
    return {
      where: (champ, op, valeur) =>
        requete(chemin, options, filtres.concat([[champ, op, valeur]]), tri, borne),
      orderBy: (champ, dir) => requete(chemin, options, filtres, [champ, dir || 'asc'], borne),
      limit: (n) => requete(chemin, options, filtres, tri, n),
      get: () => Promise.resolve(lire()),
      onSnapshot(suite) {
        let avant = null;
        const e = () => {
          const p = lire();
          const texte = JSON.stringify(p.docs.map((d) => [d.id, d.data()]));
          if (texte === avant) return;
          avant = texte;
          suite(p);
        };
        ecoutes.add(e);
        setTimeout(e, options.delai);
        return () => ecoutes.delete(e);
      },
    };
  }
  let compteur = 0;
  function collectionRef(chemin, options) {
    segments(chemin, false);
    const q = requete(chemin, options, [], null, 0);
    q.path = chemin;
    q.doc = (id) =>
      docRef(chemin + '/' + (id || 'essai' + String(++compteur).padStart(4, '0')), options);
    q.add = (data) => {
      const ref = q.doc();
      return ref.set(data).then(() => ref);
    };
    return q;
  }

  /* scenario: 'plein' | 'vide' | 'horsligne' | 'lecture' | 'lent' */
  window.__essai = {
    docs,
    installer(scenario, donnees) {
      const options = { delai: 20, refusEcriture: scenario === 'lecture' };
      if (scenario === 'plein' || scenario === 'lecture')
        Object.keys(donnees || {}).forEach((c) => docs.set(c, donnees[c]));
      const db = { doc: (c) => docRef(c, options), collection: (c) => collectionRef(c, options) };
      const user = {
        id: () => Promise.resolve('lecteur-essai'),
        can: () => Promise.resolve(scenario !== 'lecture'),
        isOwner: () => Promise.resolve(false),
        canEdit: () => Promise.resolve(false),
      };
      window.claude = {
        use(nom) {
          if (scenario === 'lent') return new Promise(() => {});
          if (scenario === 'horsligne') return Promise.resolve(null);
          return new Promise((ok) =>
            setTimeout(() => ok(nom === 'db' ? db : nom === 'user' ? user : null), 30),
          );
        },
      };
    },
  };
})();
