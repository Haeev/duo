/* Onglet « Sons et musiques »: écouter tout l'audio de La Petite Ligne (refonte), noter chaque son
   (bien, à revoir) et laisser une remarque, épinglée à l'instant d'écoute si on écrit pendant la lecture.
   Le catalogue vient de `sons/index.json` (fabriqué par `outils/publier-sons.mjs`); les avis et les
   remarques vont dans la collection `remarques`, avec `cible: { type: 'son', id }`, comme les images. */
(function () {
  'use strict';
  if (!window.TDB) return;

  const INDEX = 'sons/index.json';
  const CLE_VOLUME = 'tdb-sons-volume';
  const EPINGLE_MIN = 2; // en secondes: en dessous, un instant n'apporte rien
  const FILTRES = [
    ['tout', 'Tout'],
    ['a-ecouter', 'À écouter'],
    ['a-revoir', 'À revoir'],
    ['nouveaux', 'Nouveaux'],
  ];
  const AVIS = {
    bien: { valeur: 10, libelle: 'Bien', pastille: 'tdb-pastille--ok' },
    'a-revoir': { valeur: 0, libelle: 'À revoir', pastille: 'tdb-pastille--alerte' },
  };
  const STYLE = `
  .sn-intro { max-width: 65ch; }
  .sn-outils { display: grid; gap: 0.9rem 1.25rem; grid-template-columns: minmax(0, 1fr); }
  @media (min-width: 52rem) { .sn-outils { grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); } }
  .sn-bloc { display: flex; flex-direction: column; gap: 0.35rem; min-width: 0; }
  .sn-filtres { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .sn-outils input[type='range'], .sn-lecteur input[type='range'] { width: 100%; accent-color: var(--accent-texte); min-height: 1.75rem; }
  .sn-progres { height: 0.55rem; background: var(--creux); border-radius: 999px; overflow: hidden; }
  .sn-progres > span, .sn-barre > span { display: block; height: 100%; width: 0; background: var(--accent-texte); }
  .sn-section { display: flex; flex-direction: column; gap: 0.6rem; }
  .sn-grille { display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 24rem), 1fr)); }
  .sn-son { display: flex; flex-direction: column; gap: 0.55rem; }
  .sn-son.est-en-cours { border-color: var(--accent-texte); box-shadow: inset 0 0 0 0.0625rem var(--accent-texte); }
  .sn-tete { display: flex; gap: 0.75rem; align-items: center; min-width: 0; }
  .sn-son > .tdb-btn { align-self: flex-start; }
  .sn-jouer { flex: none; min-width: 6.25rem; }
  .sn-nom { margin: 0; flex: 1; min-width: 0; font-family: var(--police-titre); font-size: 1.05rem; line-height: 1.25; overflow-wrap: anywhere; }
  .sn-meta { font-size: 0.85rem; font-variant-numeric: tabular-nums; }
  .sn-ou, .sn-desc { font-size: 0.95rem; overflow-wrap: anywhere; }
  .sn-desc { font-size: 0.9rem; }
  .sn-barre { height: 0.3rem; background: var(--creux); border-radius: 999px; overflow: hidden; }
  .sn-avis { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
  .sn-remarques { display: flex; flex-direction: column; }
  .sn-remarque { display: flex; gap: 0.6rem; align-items: flex-start; padding: 0.55rem 0; border-top: 1px solid var(--filet); }
  .sn-remarque > div { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 0.3rem; }
  .sn-instant { flex: none; min-height: 2.25rem; padding: 0.2rem 0.55rem; font-variant-numeric: tabular-nums; }
  .sn-reponse { border-left: 0.2rem solid var(--accent-texte); padding-left: 0.6rem; }
  .sn-ecrire { display: flex; flex-direction: column; gap: 0.4rem; }
  .sn-coche { display: flex; gap: 0.45rem; align-items: center; font-size: 0.95rem; }
  .sn-coche input { width: 1.15rem; height: 1.15rem; accent-color: var(--accent-texte); }
  .sn-lecteur { position: sticky; bottom: 0; z-index: 5; display: grid; gap: 0.35rem 0.75rem;
    grid-template-columns: minmax(0, 1fr) auto; align-items: center;
    background: var(--panneau-haut); color: var(--texte); border: 1px solid var(--filet-fort);
    border-radius: var(--rayon); box-shadow: 0 0.4rem 1.2rem var(--ombre);
    padding: 0.6rem 0.8rem max(0.6rem, env(safe-area-inset-bottom, 0px)); }
  .sn-lecteur__nom { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sn-lecteur__temps { font-variant-numeric: tabular-nums; font-size: 0.9rem; }
  .sn-lecteur input[type='range'], .sn-lecteur__boutons { grid-column: 1 / -1; }
  .sn-lecteur__boutons { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .sn-lecteur .tdb-btn { min-height: 2.5rem; padding: 0.3rem 0.75rem; }
  `;

  function simple(texte) {
    return String(texte || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();
  }
  function temps(s) {
    const t = Math.max(0, Math.floor(Number(s) || 0));
    return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
  }
  function duree(d) {
    if (!(d > 0)) return '';
    return d < 10 ? String(Math.round(d * 10) / 10).replace('.', ',') + ' s' : temps(Math.round(d));
  }
  function texte(v) {
    return typeof v === 'string' ? v : '';
  }
  /* Le catalogue est un fichier publié avec la page: on le vérifie quand même avant de s'en servir. */
  function lireCatalogue(brut) {
    if (!brut || !Array.isArray(brut.sons) || !Array.isArray(brut.sections)) return null;
    const sections = brut.sections
      .filter((s) => s && typeof s.id === 'string' && typeof s.titre === 'string')
      .map((s) => ({ id: s.id, titre: s.titre }));
    const connues = new Set(sections.map((s) => s.id));
    const sons = brut.sons
      .filter(
        (s) =>
          s &&
          typeof s.id === 'string' &&
          /^[a-z0-9-]+$/.test(s.id) &&
          typeof s.fichier === 'string' &&
          /^[a-z0-9-]+\.mp4$/.test(s.fichier) &&
          connues.has(s.section),
      )
      .map((s) => ({
        id: s.id,
        section: s.section,
        sorte: texte(s.sorte),
        nom: texte(s.nom) || s.id,
        ou: texte(s.ou),
        branche: s.branche !== false,
        description: texte(s.description),
        duree: typeof s.duree === 'number' && isFinite(s.duree) ? s.duree : 0,
        boucle: s.boucle === true,
        variantes: typeof s.variantes === 'number' ? s.variantes : 1,
        fichier: s.fichier,
        nouveau: s.nouveau === true,
      }));
    return { sections, sons, nouveauDepuis: texte(brut.nouveauDepuis) };
  }

  window.TDB.registerTab({
    id: 'sons',
    title: 'Sons et musiques',
    order: 35,
    mount(el, ctx) {
      const { h, vide, date } = ctx.ui;
      if (!document.getElementById('sn-style')) {
        document.head.append(h('style', { id: 'sn-style', text: STYLE }));
      }

      let catalogue = null;
      let etatCatalogue = 'chargement';
      let vueRemarques = { etat: 'chargement', retard: false };
      let remarquesSons = []; // documents de `remarques` qui visent un son
      let filtre = 'tout';
      const cartes = new Map(); // id du son -> { son, article, maj, ... }
      const lecture = { id: null, boucle: true, glisse: false };
      const audio = new Audio();
      audio.preload = 'none';

      /* ---------------- En-tête, outils, liste, lecteur ---------------- */
      const champ = h('input', {
        type: 'search',
        class: 'tdb-champ',
        id: 'sn-recherche',
        placeholder: 'Un mot, par exemple « cloche »',
        autocomplete: 'off',
        oninput: filtrer,
      });
      const boutonsFiltre = FILTRES.map(([cle, libelle]) =>
        h('button', {
          type: 'button',
          class: 'tdb-btn',
          id: 'sn-filtre-' + cle,
          'data-filtre': cle,
          'aria-pressed': cle === filtre ? 'true' : 'false',
          text: libelle,
          onclick: () => {
            filtre = cle;
            boutonsFiltre.forEach((b) =>
              b.setAttribute(
                'aria-pressed',
                b.getAttribute('data-filtre') === cle ? 'true' : 'false',
              ),
            );
            filtrer();
          },
        }),
      );
      let volume = 80;
      try {
        const v = Number(localStorage.getItem(CLE_VOLUME));
        if (localStorage.getItem(CLE_VOLUME) !== null && v >= 0 && v <= 100) volume = v;
      } catch (e) {
        /* stockage indisponible: volume par défaut */
      }
      const champVolume = h('input', {
        type: 'range',
        id: 'sn-volume',
        min: '0',
        max: '100',
        step: '5',
        value: String(volume),
        'aria-valuetext': volume + ' %',
        oninput: () => {
          volume = Number(champVolume.value);
          champVolume.setAttribute('aria-valuetext', volume + ' %');
          libelleVolume.textContent = 'Volume général : ' + volume + ' %';
          audio.volume = volume / 100;
          try {
            localStorage.setItem(CLE_VOLUME, String(volume));
          } catch (e) {
            /* confort seulement */
          }
        },
      });
      audio.volume = volume / 100;
      const libelleVolume = h('label', {
        class: 'tdb-etiquette',
        for: 'sn-volume',
        text: 'Volume général : ' + volume + ' %',
      });
      const progresTexte = h('p', { class: 'tdb-doux', id: 'sn-progres-texte' });
      const progresBarre = h('span', {});
      const progres = h(
        'div',
        {
          class: 'sn-progres',
          role: 'progressbar',
          'aria-labelledby': 'sn-progres-texte',
          'aria-valuemin': '0',
        },
        progresBarre,
      );
      const etatEcriture = h('p', { class: 'tdb-doux', style: 'font-size:0.9rem' });
      const outils = h(
        'div',
        { class: 'tdb-carte sn-outils' },
        h(
          'div',
          { class: 'sn-bloc' },
          h('label', { class: 'tdb-etiquette', for: 'sn-recherche', text: 'Chercher un son' }),
          champ,
          h(
            'div',
            { class: 'sn-filtres', role: 'group', 'aria-label': 'Filtrer les sons' },
            boutonsFiltre,
          ),
        ),
        h(
          'div',
          { class: 'sn-bloc' },
          libelleVolume,
          champVolume,
          progresTexte,
          progres,
          etatEcriture,
        ),
      );
      outils.hidden = true;
      const compte = h('p', { class: 'tdb-doux', role: 'status' });
      const liste = h('div', { class: 'tdb-pile' });

      const lecteurNom = h('p', { class: 'sn-lecteur__nom' });
      const lecteurTemps = h('p', { class: 'sn-lecteur__temps' });
      const position = h('input', {
        type: 'range',
        id: 'sn-position',
        min: '0',
        max: '1',
        step: '0.1',
        value: '0',
        'aria-label': 'Position dans le son',
        oninput: () => {
          if (audio.readyState >= 1) audio.currentTime = Number(position.value);
          majTemps();
        },
        onpointerdown: () => {
          lecture.glisse = true;
        },
        onpointerup: () => {
          lecture.glisse = false;
        },
      });
      const btnPause = h('button', {
        type: 'button',
        class: 'tdb-btn tdb-btn--accent',
        id: 'sn-pause',
        onclick: () => {
          if (audio.paused) reprendre();
          else audio.pause();
        },
      });
      const btnBoucle = h('button', {
        type: 'button',
        class: 'tdb-btn',
        id: 'sn-boucle',
        text: 'En boucle',
        onclick: () => {
          lecture.boucle = !lecture.boucle;
          majLecteur();
        },
      });
      const btnInstant = h('button', {
        type: 'button',
        class: 'tdb-btn',
        id: 'sn-remarque-instant',
        text: 'Remarque à cet instant',
        onclick: () => {
          const c = cartes.get(lecture.id);
          if (c) c.ecrire();
        },
      });
      const btnStop = h('button', {
        type: 'button',
        class: 'tdb-btn',
        id: 'sn-arreter',
        text: 'Arrêter',
        onclick: () => arreter(),
      });
      const lecteur = h(
        'div',
        { class: 'sn-lecteur', role: 'region', 'aria-label': 'Lecteur' },
        lecteurNom,
        lecteurTemps,
        position,
        h('div', { class: 'sn-lecteur__boutons' }, btnPause, btnBoucle, btnInstant, btnStop),
      );
      lecteur.hidden = true;

      el.append(
        h('h2', { class: 'tdb-titre', text: 'Sons et musiques à écouter' }),
        h('p', {
          class: 'tdb-texte sn-intro',
          text: 'Personne dans l’équipe ne peut écouter : ton oreille est le seul contrôle. Écoute chaque son, dis s’il est bien ou à revoir, et écris ce qui te gêne. Si tu écris pendant la lecture d’une musique, ta remarque garde l’instant (par exemple « à 0:12, trop aigu »).',
        }),
        outils,
        compte,
        liste,
        lecteur,
      );

      /* ---------------- Données des remarques ---------------- */
      function remarquesDe(id) {
        return remarquesSons
          .filter((r) => r.cible.id === id && r.forme.sorte !== 'note')
          .sort((a, b) =>
            String(a.creeLe || '') < String(b.creeLe || '')
              ? -1
              : String(a.creeLe || '') > String(b.creeLe || '')
                ? 1
                : a.id < b.id
                  ? -1
                  : 1,
          );
      }
      function avisDe(id) {
        const d = remarquesSons.find((r) => r.id === 'note-son-' + id);
        if (!d || d.forme.sorte !== 'note') return null;
        if (d.forme.avis === 'bien' || d.forme.avis === 'a-revoir') return d.forme.avis;
        return typeof d.forme.valeur === 'number'
          ? d.forme.valeur >= 5
            ? 'bien'
            : 'a-revoir'
          : null;
      }
      function corpsRemarque(forme, id, texteRemarque) {
        return {
          cible: { type: 'son', id },
          forme,
          texte: texteRemarque,
          auteur: ctx.me,
          creeLe: new Date().toISOString(),
          statut: 'ouverte',
          reponseManager: '',
        };
      }
      /* Le noyau (`ctx.notes.add`) ne connaît pas encore le type `son` ni la forme `instant`:
         on écrit le même document que lui, par la file d'écriture partagée de la page. */
      function ajouterRemarque(id, forme, texteRemarque) {
        let ref = null;
        return ctx.data
          .write('remarques/+son', (db) => {
            ref = db.collection('remarques').doc();
            return ref.set(corpsRemarque(forme, id, texteRemarque));
          })
          .then((ok) => (ok && ref ? ref.id : null));
      }
      function donnerAvis(id, avis) {
        const chemin = 'remarques/note-son-' + id;
        const retirer = avisDe(id) === avis;
        return ctx.data
          .write(chemin, (db) =>
            retirer
              ? db.doc(chemin).delete()
              : db
                  .doc(chemin)
                  .set(corpsRemarque({ sorte: 'note', valeur: AVIS[avis].valeur, avis }, id, '')),
          )
          .then((ok) => {
            if (ok)
              ctx.ui.toast(
                retirer
                  ? 'Avis retiré : ce son repasse « à écouter ».'
                  : 'Avis enregistré : ' + AVIS[avis].libelle + '.',
              );
            return ok;
          });
      }
      function supprimer(r) {
        ctx.ui
          .confirm('Supprimer cette remarque ? Elle disparaîtra aussi pour le manager.', {
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

      /* ---------------- Lecture ---------------- */
      function sonCourant() {
        const c = cartes.get(lecture.id);
        return c ? c.son : null;
      }
      function enLecture(id) {
        return lecture.id === id && !audio.paused && !audio.ended;
      }
      function jouer(id, depuis) {
        const c = cartes.get(id);
        if (!c) return;
        if (lecture.id !== id) {
          audio.pause();
          lecture.id = id;
          audio.src = 'sons/' + c.son.fichier;
        }
        audio.loop = lecture.boucle && c.son.boucle;
        audio.volume = volume / 100;
        const placer = () => {
          if (typeof depuis === 'number') audio.currentTime = depuis;
        };
        if (audio.readyState >= 1) placer();
        else audio.addEventListener('loadedmetadata', placer, { once: true });
        const p = audio.play();
        if (p && typeof p.catch === 'function')
          p.catch((e) => {
            if (e && e.name === 'AbortError') return;
            ctx.ui.toast(
              e && e.name === 'NotAllowedError'
                ? 'Le navigateur a bloqué la lecture : touche encore « Écouter ».'
                : 'Ce son ne se lit pas sur cet appareil. Préviens le manager.',
            );
            majLecteur();
          });
        majLecteur();
      }
      function reprendre() {
        if (!lecture.id) return;
        jouer(lecture.id, audio.ended ? 0 : undefined);
      }
      function arreter() {
        const avant = lecture.id;
        lecture.id = null;
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        majLecteur();
        const c = avant && cartes.get(avant);
        if (c && lecteur.contains(document.activeElement)) c.bouton.focus();
      }
      function majTemps() {
        const s = sonCourant();
        const total =
          isFinite(audio.duration) && audio.duration > 0 ? audio.duration : s ? s.duree : 0;
        const t = audio.currentTime || 0;
        lecteurTemps.textContent = temps(t) + ' / ' + temps(total);
        if (!lecture.glisse) {
          position.max = String(Math.max(0.1, Math.round(total * 10) / 10));
          position.value = String(t);
        }
        position.setAttribute('aria-valuetext', temps(t) + ' sur ' + temps(total));
        const c = cartes.get(lecture.id);
        if (c) c.barre.style.width = (total ? Math.min(100, (t / total) * 100) : 0) + '%';
      }
      function majLecteur() {
        const s = sonCourant();
        cartes.forEach((c) => c.majLecture());
        lecteur.hidden = !s;
        if (!s) return;
        lecteurNom.textContent = s.nom;
        btnPause.textContent = audio.paused ? (audio.ended ? 'Réécouter' : 'Reprendre') : 'Pause';
        btnBoucle.hidden = !s.boucle;
        btnBoucle.setAttribute('aria-pressed', lecture.boucle ? 'true' : 'false');
        audio.loop = lecture.boucle && s.boucle;
        btnInstant.hidden = !ctx.canWrite || s.duree < EPINGLE_MIN;
        majTemps();
      }
      audio.addEventListener('timeupdate', majTemps);
      audio.addEventListener('play', majLecteur);
      audio.addEventListener('pause', majLecteur);
      audio.addEventListener('ended', majLecteur);
      audio.addEventListener('error', () => {
        if (!lecture.id || !audio.getAttribute('src')) return;
        ctx.ui.toast('Ce son est introuvable pour le moment. Préviens le manager.');
        arreter();
      });

      /* ---------------- Une carte par son ---------------- */
      function carte(son) {
        const c = { son, ouvert: false, instant: null, editeur: null };
        c.bouton = h('button', {
          type: 'button',
          class: 'tdb-btn tdb-btn--accent sn-jouer',
          'data-jouer': son.id,
          onclick: () => (enLecture(son.id) ? arreter() : jouer(son.id, 0)),
        });
        const meta = h('div', { class: 'tdb-rang sn-meta' });
        c.barreFond = h('div', { class: 'sn-barre', 'aria-hidden': 'true' });
        c.barre = h('span', {});
        c.barreFond.append(c.barre);
        const zoneAvis = h('div', { class: 'sn-avis' });
        const zoneRemarques = h('div', { class: 'sn-remarques' });
        const zoneEcrire = h('div', { class: 'sn-ecrire', hidden: true });
        const coche = h('input', { type: 'checkbox', id: 'sn-epingle-' + son.id, checked: true });
        const cocheLigne = h(
          'label',
          { class: 'sn-coche', for: 'sn-epingle-' + son.id },
          coche,
          h('span', {}),
        );
        const btnEcrire = h('button', {
          type: 'button',
          class: 'tdb-btn tdb-btn--discret',
          id: 'sn-ecrire-' + son.id,
          text: 'Écrire une remarque',
          onclick: () => c.ecrire(),
        });
        c.article = h(
          'article',
          { class: 'tdb-carte sn-son', 'data-son': son.id, 'aria-labelledby': 'sn-nom-' + son.id },
          h(
            'div',
            { class: 'sn-tete' },
            c.bouton,
            h('h4', { class: 'sn-nom', id: 'sn-nom-' + son.id, text: son.nom }),
          ),
          meta,
          c.barreFond,
          h(
            'p',
            { class: 'sn-ou' },
            h('strong', { text: son.branche ? 'Où et quand : ' : 'Dans le jeu : ' }),
            son.ou,
          ),
          son.description ? h('p', { class: 'tdb-doux sn-desc', text: son.description }) : null,
          zoneAvis,
          zoneRemarques,
          btnEcrire,
          zoneEcrire,
        );

        /* Ouvre le champ de remarque; pendant la lecture (ou en pause au milieu), garde l'instant. */
        c.ecrire = function () {
          if (!ctx.canWrite) return;
          const t = audio.currentTime || 0;
          const ici = lecture.id === son.id && son.duree >= EPINGLE_MIN && !audio.ended && t > 0.05;
          c.instant = ici ? Math.round(t * 10) / 10 : null;
          if (ici && !audio.paused) audio.pause();
          if (!c.editeur) {
            c.editeur = ctx.ui.noteEditor(zoneEcrire, {
              id: 'sn-' + son.id,
              label: 'Ta remarque',
              placeholder: 'Par exemple : trop aigu, trop fort, on n’entend pas la clarinette',
              onCancel: () => c.fermer(true),
              onSubmit: (t2) => {
                const forme =
                  c.instant !== null && coche.checked
                    ? { sorte: 'instant', t: c.instant }
                    : { sorte: 'globale' };
                return ajouterRemarque(son.id, forme, t2).then((id) => {
                  if (!id) return false;
                  ctx.ui.toast(
                    forme.sorte === 'instant'
                      ? 'Remarque enregistrée à ' + temps(forme.t) + '.'
                      : 'Remarque enregistrée.',
                  );
                  c.fermer(true);
                  return true;
                });
              },
            });
            zoneEcrire.prepend(cocheLigne);
          }
          coche.checked = c.instant !== null;
          cocheLigne.hidden = c.instant === null;
          cocheLigne.lastChild.textContent =
            c.instant === null ? '' : 'Épingler à ' + temps(c.instant) + ' dans le son';
          const etiquette = zoneEcrire.querySelector('label[for^="tdb-remarque"]');
          if (etiquette)
            etiquette.textContent =
              c.instant === null
                ? 'Ta remarque sur « ' + son.nom + ' »'
                : 'Ta remarque sur « ' + son.nom + ' », à ' + temps(c.instant);
          zoneEcrire.hidden = false;
          btnEcrire.hidden = true;
          c.editeur.focus();
          zoneEcrire.scrollIntoView({ block: 'nearest' });
        };
        c.fermer = function (versBouton) {
          zoneEcrire.hidden = true;
          btnEcrire.hidden = !ctx.canWrite;
          if (c.editeur) c.editeur.clear();
          c.instant = null;
          if (versBouton) btnEcrire.focus();
        };
        c.majLecture = function () {
          const actif = lecture.id === son.id;
          const joue = enLecture(son.id);
          c.article.classList.toggle('est-en-cours', actif);
          c.barreFond.hidden = !actif;
          if (!actif) c.barre.style.width = '0';
          c.bouton.textContent = joue ? 'Arrêter' : 'Écouter';
          c.bouton.setAttribute(
            'aria-label',
            (joue ? 'Arrêter « ' : 'Écouter « ') + son.nom + ' »',
          );
        };
        c.maj = function () {
          const remarques = remarquesDe(son.id);
          const avis = avisDe(son.id);
          c.avis = avis;
          meta.textContent = '';
          // `append` du DOM écrirait les nuls en toutes lettres: on les retire avant.
          [
            h('span', { class: 'tdb-doux', text: duree(son.duree) }),
            son.variantes > 1
              ? h('span', { class: 'tdb-doux', text: son.variantes + ' variantes à la suite' })
              : null,
            son.nouveau
              ? h('span', { class: 'tdb-pastille tdb-pastille--accent', text: 'Nouveau' })
              : null,
            son.branche
              ? null
              : h('span', { class: 'tdb-pastille', text: 'Pas encore dans le jeu' }),
            avis
              ? h('span', {
                  class: 'tdb-pastille ' + AVIS[avis].pastille,
                  text: AVIS[avis].libelle,
                })
              : null,
            remarques.length
              ? h('span', {
                  class: 'tdb-pastille',
                  text: remarques.length + (remarques.length > 1 ? ' remarques' : ' remarque'),
                })
              : null,
          ]
            .filter(Boolean)
            .forEach((e) => meta.append(e));

          const garde =
            zoneAvis.contains(document.activeElement) &&
            document.activeElement.getAttribute('data-avis');
          zoneAvis.textContent = '';
          if (ctx.canWrite) {
            zoneAvis.append(
              h('span', { class: 'tdb-etiquette', id: 'sn-avis-' + son.id, text: 'Ton avis :' }),
              h(
                'div',
                { class: 'sn-avis', role: 'group', 'aria-labelledby': 'sn-avis-' + son.id },
                Object.keys(AVIS).map((cle) =>
                  h('button', {
                    type: 'button',
                    class: 'tdb-btn',
                    'data-avis': cle,
                    'aria-pressed': avis === cle ? 'true' : 'false',
                    text: AVIS[cle].libelle,
                    onclick: () => donnerAvis(son.id, cle),
                  }),
                ),
              ),
            );
            if (garde) {
              const b = zoneAvis.querySelector('[data-avis="' + garde + '"]');
              if (b) b.focus();
            }
          } else if (avis) {
            zoneAvis.append(
              h('p', { class: 'tdb-doux', text: 'Ton avis : ' + AVIS[avis].libelle + '.' }),
            );
          }

          zoneRemarques.textContent = '';
          if (remarques.length)
            zoneRemarques.append(
              h(
                'ol',
                { 'aria-label': 'Tes remarques sur « ' + son.nom + ' »' },
                remarques.map((r) => {
                  const traitee = r.statut === 'traitee';
                  const t =
                    r.forme.sorte === 'instant' && typeof r.forme.t === 'number' ? r.forme.t : null;
                  return h(
                    'li',
                    { class: 'sn-remarque' },
                    t === null
                      ? h('span', { class: 'tdb-pastille', text: 'Globale' })
                      : h('button', {
                          type: 'button',
                          class: 'tdb-btn sn-instant',
                          'aria-label': 'Réécouter à partir de ' + temps(t),
                          text: 'à ' + temps(t),
                          onclick: () => jouer(son.id, Math.max(0, t - 1)),
                        }),
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
                            { class: 'sn-reponse' },
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
                              'aria-label': 'Supprimer la remarque : ' + r.texte,
                              text: 'Supprimer',
                              onclick: () => supprimer(r),
                            }),
                          )
                        : null,
                    ),
                  );
                }),
              ),
            );
          btnEcrire.hidden = !ctx.canWrite || !zoneEcrire.hidden;
          if (!ctx.canWrite && !zoneEcrire.hidden) c.fermer(false);
        };
        c.majLecture();
        c.maj();
        return c;
      }

      /* ---------------- Dessin ---------------- */
      function dessiner() {
        liste.textContent = '';
        cartes.clear();
        if (etatCatalogue === 'erreur') {
          liste.append(
            vide(
              'Liste des sons introuvable',
              'Le fichier des sons n’a pas pu être lu. Recharge la page ; si rien ne change, préviens le manager.',
            ),
          );
          return;
        }
        if (etatCatalogue !== 'pret') {
          liste.append(vide('Chargement des sons…', 'Un instant.'));
          return;
        }
        if (!catalogue.sons.length) {
          liste.append(
            vide(
              'Pas encore de son à écouter',
              'Les musiques et les bruitages du jeu arriveront ici.',
            ),
          );
          return;
        }
        outils.hidden = false;
        catalogue.sections.forEach((s) => {
          const lot = catalogue.sons.filter((x) => x.section === s.id);
          if (!lot.length) return;
          const titre = h('h3', { class: 'tdb-surtitre' });
          const grille = h('div', { class: 'sn-grille' });
          lot.forEach((son) => {
            const c = carte(son);
            cartes.set(son.id, c);
            grille.append(c.article);
          });
          const section = h(
            'section',
            { class: 'sn-section', 'aria-label': s.titre },
            titre,
            grille,
          );
          section.dataset.titre = s.titre;
          liste.append(section);
        });
        filtrer();
      }
      function filtrer() {
        if (etatCatalogue !== 'pret') return;
        const mots = simple(champ.value).split(/\s+/).filter(Boolean);
        let vus = 0;
        liste.querySelectorAll('.sn-section').forEach((section) => {
          let n = 0;
          section.querySelectorAll('.sn-son').forEach((article) => {
            const c = cartes.get(article.getAttribute('data-son'));
            const s = c.son;
            const corps = simple([s.nom, s.ou, s.description, section.dataset.titre].join(' '));
            const ok =
              mots.every((m) => corps.includes(m)) &&
              (filtre === 'tout' ||
                (filtre === 'a-ecouter' && !c.avis) ||
                (filtre === 'a-revoir' && c.avis === 'a-revoir') ||
                (filtre === 'nouveaux' && s.nouveau));
            article.hidden = !ok;
            if (ok) n += 1;
          });
          section.hidden = n === 0;
          section.querySelector('h3').textContent = section.dataset.titre + ' · ' + n;
          vus += n;
        });
        const total = cartes.size;
        compte.textContent =
          vus === total
            ? total + ' sons'
            : vus + (vus > 1 ? ' sons affichés' : ' son affiché') + ' sur ' + total;
        let vide_ = liste.querySelector('.sn-aucun');
        if (!vus && !vide_) {
          vide_ = vide(
            filtre === 'a-ecouter' && !mots.length
              ? 'Tout est écouté et noté'
              : 'Aucun son ne correspond',
            filtre === 'a-ecouter' && !mots.length
              ? 'Merci ! Le manager va lire tes avis et tes remarques.'
              : 'Efface la recherche ou choisis « Tout » pour revoir la liste.',
          );
          vide_.classList.add('sn-aucun');
          liste.append(vide_);
        } else if (vus && vide_) vide_.remove();
      }
      function majProgression() {
        if (etatCatalogue !== 'pret') return;
        const total = cartes.size;
        let notes = 0;
        let aRevoir = 0;
        cartes.forEach((c) => {
          if (c.avis) notes += 1;
          if (c.avis === 'a-revoir') aRevoir += 1;
        });
        const pret = vueRemarques.etat === 'pret';
        progresTexte.textContent = pret
          ? notes +
            ' sur ' +
            total +
            ' écoutés et notés' +
            (aRevoir ? ', dont ' + aRevoir + ' à revoir' : '')
          : 'Tes avis s’afficheront dès que la page aura joint ses données.';
        progres.setAttribute('aria-valuemax', String(total));
        progres.setAttribute('aria-valuenow', String(pret ? notes : 0));
        progresBarre.style.width = (pret && total ? (notes / total) * 100 : 0) + '%';
        etatEcriture.textContent =
          vueRemarques.etat === 'horsligne'
            ? 'Hors ligne : tu peux écouter, mais tes avis et tes remarques ne peuvent pas être enregistrés.'
            : vueRemarques.etat === 'pret' && ctx.db && !ctx.canWrite
              ? 'Lecture seule : tu peux écouter et lire les remarques, pas en ajouter.'
              : vueRemarques.retard && vueRemarques.etat !== 'pret'
                ? 'La base ne répond pas encore. La page se mettra à jour toute seule.'
                : '';
        etatEcriture.hidden = !etatEcriture.textContent;
        window.TDB.setBadge('sons', pret ? total - notes : 0);
      }
      function toutMettreAJour() {
        cartes.forEach((c) => c.maj());
        majProgression();
        majLecteur();
        filtrer();
      }

      /* ---------------- Chargement ---------------- */
      dessiner();
      fetch(INDEX, { cache: 'no-cache' })
        .then((r) => (r.ok ? r.json() : null))
        .then(
          (brut) => {
            catalogue = lireCatalogue(brut);
            etatCatalogue = catalogue ? 'pret' : 'erreur';
            dessiner();
            majProgression();
          },
          () => {
            etatCatalogue = 'erreur';
            dessiner();
          },
        );
      ctx.data.watch('remarques', (vue) => {
        vueRemarques = vue;
        remarquesSons = (vue.docs || []).filter(
          (r) =>
            r &&
            r.cible &&
            r.cible.type === 'son' &&
            typeof r.cible.id === 'string' &&
            r.forme &&
            typeof r.forme.sorte === 'string',
        );
        toutMettreAJour();
      });
      document.addEventListener('tdb:droits', toutMettreAJour);
      Promise.resolve(ctx.ready).then(toutMettreAJour);
    },
  });
})();
