// Salon (E08), hôte et invité: les deux joueurs, le jeu, la sauvegarde, le départ
// quand c'est dit des deux côtés, puis le compte à rebours (UX section 2).
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { AppState, Profile, SalonNews, SalonView } from '../../shared/state';
import { send } from '../bridge';
import { durationRange, fr, t, when } from '../textes';
import { ActionList, Chip, Dialog, Icon, PlayerCard, Sky, useCountdown } from '../ui/components';
import { useEscape, useInitialFocus } from '../ui/keyboard';
import { UpdateBanner, gateFor, gateReason } from '../ui/update-banner';

function versionGapText(gap: NonNullable<SalonView['versionGap']>, peer: string): string {
  switch (gap.kind) {
    case 'host-stale':
      return fr`Le jeu vient d'être mis à jour en version ${gap.selfVersion}. Ferme le salon et rouvre-le pour jouer ensemble.`;
    case 'self-older':
      return fr`Tu as la version ${gap.selfVersion}, ${peer} a la version ${gap.hostVersion}. Mets ton jeu à jour pour jouer ensemble.`;
    case 'host-older':
      return fr`Tu as la version ${gap.selfVersion}, ${peer} a la version ${gap.hostVersion}. ${peer} doit mettre son jeu à jour pour jouer ensemble.`;
  }
}

function readyChip(ready: boolean): JSX.Element {
  return ready ? (
    <Chip kind="ready" label={t.salon.puces.cestParti} />
  ) : (
    <Chip kind="not-yet" label={t.salon.puces.pasEncore} />
  );
}

function peerChip(salon: SalonView): JSX.Element {
  switch (salon.peerSeat) {
    case 'waiting':
      return <Chip kind="waiting" label={t.salon.puces.enAttente} />;
    case 'lost':
      return <Chip kind="lost" label={t.salon.puces.connexionPerdue} />;
    case 'joined':
      return readyChip(salon.peerReady);
  }
}

function SaveBlock({ salon, hostName }: { salon: SalonView; hostName: string }): JSX.Element {
  const game = salon.game;
  if (game.saves === null) {
    return <p class="texte-second">{t.salon.sansSauvegarde}</p>;
  }
  const save = salon.save;
  if (salon.role === 'guest') {
    const detail =
      salon.saveChoice === 'continue' && save !== null
        ? `${save.label}, ${when(save.writtenAt)}`
        : t.salon.nouvellePartie;
    return <p data-testid="salon-sauvegarde-invite">{t.salon.choisiePar(hostName, detail)}</p>;
  }
  const options: { value: 'continue' | 'new'; label: string }[] = [];
  if (save !== null)
    options.push({ value: 'continue', label: t.salon.continuer(save.label, when(save.writtenAt)) });
  options.push({ value: 'new', label: t.salon.nouvellePartie });
  return (
    <div class="choix-sauvegarde" role="radiogroup" aria-label={t.salon.sauvegarde}>
      {options.map((option) => (
        <label class="option-sauvegarde" key={option.value}>
          <input
            type="radio"
            name="sauvegarde"
            value={option.value}
            checked={salon.saveChoice === option.value}
            data-testid={`sauvegarde-${option.value}`}
            onChange={() => {
              void send('salon:save-choice', { choice: option.value });
            }}
          />
          <span>{option.label}</span>
        </label>
      ))}
      {game.saves.help !== null && <p class="petit texte-second">{game.saves.help}</p>}
    </div>
  );
}

// Encadré discret sous la sauvegarde: la version installée ici, le `whatsNew` du
// manifeste et, si le jeu fournit ses notes, le lien vers leur liste complète.
function NewsBlock({
  news,
  onOpenNotes,
}: {
  news: SalonNews;
  onOpenNotes: () => void;
}): JSX.Element | null {
  const summary = news.whatsNew !== '' ? news.whatsNew : (news.notes?.[0]?.title ?? '');
  return (
    <div class="carte carte-nouveautes" data-testid="salon-nouveautes">
      <div class="nouveautes-entete">
        <h2 class="surtitre">{t.salon.nouveautes.titre}</h2>
        {news.isNew && (
          <span class="pastille-nouveau" data-testid="salon-nouveau">
            {t.salon.nouveautes.nouveau}
          </span>
        )}
      </div>
      <p class="petit texte-second">{t.salon.nouveautes.version(news.version)}</p>
      {summary !== '' && <p class="petit">{summary}</p>}
      {news.notes !== null && news.notes.length > 0 && (
        <button
          type="button"
          class="lien petit"
          data-testid="salon-toutes-les-notes"
          onClick={onOpenNotes}
        >
          {t.salon.nouveautes.toutesLesNotes}
        </button>
      )}
    </div>
  );
}

function NotesDialog({
  game,
  news,
  onClose,
}: {
  game: string;
  news: SalonNews;
  onClose: () => void;
}): JSX.Element {
  return (
    <Dialog
      title={t.salon.nouveautes.fenetreTitre(game)}
      back={{ label: t.salon.nouveautes.fermer, testId: 'notes-fermer', onClick: onClose }}
    >
      <div class="notes-liste" data-testid="notes-liste" tabIndex={0}>
        {(news.notes ?? []).map((note) => (
          <section key={note.version} class="note-version">
            <h3 class="titre-3">{t.salon.nouveautes.versionTitre(note.version, note.title)}</h3>
            <ul>
              {note.changes.map((change, index) => (
                <li key={index}>{change}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}

export function Salon({
  state,
  salon,
  profile,
}: {
  state: AppState;
  salon: SalonView;
  profile: Profile;
}): JSX.Element {
  const peer = state.peer.status === 'unknown' ? null : state.peer.profile;
  const peerName = peer?.pseudo ?? '';
  const host = salon.role === 'host';
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const seconds = useCountdown(salon.countdownEndsAt);
  const gap = salon.versionGap;
  const reason = gateReason(gateFor(salon.game, state.updateCheck));
  const blocked = reason !== null || gap !== null;
  const main = useInitialFocus<HTMLButtonElement>(
    `${salon.game.id}:${seconds === null ? 'salon' : 'decompte'}`,
  );

  const leave = (): void => {
    if (host) void send('salon:close', null);
    else void send('salon:leave', null);
  };
  const askLeave = (): void => {
    if (host && salon.peerSeat === 'waiting') leave();
    else setConfirmLeave(true);
  };
  useEscape(
    confirmLeave || notesOpen
      ? null
      : seconds !== null
        ? () => {
            void send('salon:ready', { ready: false });
          }
        : askLeave,
  );

  const selfCard = (
    <PlayerCard
      profile={profile}
      self
      role={host ? t.joueurs.heberge : undefined}
      chip={readyChip(salon.selfReady)}
      testId="salon-carte-toi"
    />
  );
  const peerCard =
    peer === null ? null : (
      <PlayerCard
        profile={peer}
        self={false}
        role={
          host
            ? salon.peerSeat === 'joined'
              ? t.joueurs.aRejointSalon
              : undefined
            : t.joueurs.heberge
        }
        chip={peerChip(salon)}
        testId="salon-carte-autre"
      />
    );

  return (
    <div class="scene scene-ciel">
      <Sky />
      <header class="barre-haut barre-salon">
        <button
          type="button"
          class="bouton bouton-secondaire"
          data-testid="salon-sortir"
          onClick={askLeave}
        >
          <Icon name="back" />
          {host ? t.salon.fermer : t.salon.quitter}
          <kbd class="touche">{t.salon.echap}</kbd>
        </button>
        <h1 class="titre-2">{t.salon.entete(salon.game.name)}</h1>
      </header>
      <main class="contenu salon" data-testid={host ? 'ecran-salon-hote' : 'ecran-salon-invite'}>
        <div class="salon-gauche">
          <div class="paire-joueurs">
            {selfCard}
            {peerCard}
          </div>
          {salon.peerSeat === 'waiting' && (
            <p class="texte-second" data-testid="salon-attente">
              {peer === null ? t.salon.attenteSansNom : t.salon.attente(peerName)}
            </p>
          )}
          {salon.peerSeat === 'lost' && (
            <p class="texte-erreur">
              <Icon name="warning" /> {t.salon.connexionPerdue(peerName)}
            </p>
          )}
          <UpdateBanner game={salon.game} />
          {gap !== null && (
            <p class="texte-erreur" data-testid="salon-versions">
              <Icon name="warning" /> {versionGapText(gap, peerName)}
            </p>
          )}
          <button
            type="button"
            class={`bouton bouton-grand ${salon.selfReady ? 'bouton-secondaire' : 'bouton-principal'}`}
            ref={main}
            aria-pressed={salon.selfReady}
            disabled={blocked && !salon.selfReady}
            data-testid="salon-pret"
            onClick={() => {
              void send('salon:ready', { ready: !salon.selfReady });
            }}
          >
            {salon.selfReady ? t.salon.pasEncore : t.salon.cestParti}
          </button>
          <p class="texte-second" data-testid="salon-aide">
            {reason ?? (host || !salon.selfReady ? t.salon.aide : t.salon.aideInvite(peerName))}
          </p>
          <div class="carte">
            <h2 class="surtitre">{t.salon.commandes}</h2>
            <ActionList actions={salon.game.actions} />
          </div>
        </div>
        <aside class="salon-droite">
          <div class="carte carte-jeu">
            <img class="vignette-image" src={salon.game.thumbnailUrl} alt="" aria-hidden="true" />
            <div>
              <h2 class="titre-3">{salon.game.name}</h2>
              <p class="texte-second">
                {t.jeu.mode(salon.game.mode)} · {durationRange(salon.game.durationMinutes)}
              </p>
            </div>
          </div>
          <div class="carte">
            <h2 class="surtitre">{t.salon.sauvegarde}</h2>
            <SaveBlock salon={salon} hostName={host ? profile.pseudo : peerName} />
          </div>
          <NewsBlock
            news={salon.news}
            onOpenNotes={() => {
              setNotesOpen(true);
            }}
          />
        </aside>
      </main>
      {seconds !== null && (
        <div class="voile decompte" role="status" data-testid="decompte">
          <p class="corps-grand">{t.salon.decompte(seconds)}</p>
          <p class="chiffre-decompte" key={seconds} aria-hidden="true">
            {seconds}
          </p>
          <button
            type="button"
            class="bouton bouton-secondaire"
            ref={main}
            data-testid="decompte-pas-encore"
            onClick={() => {
              void send('salon:ready', { ready: false });
            }}
          >
            {t.salon.pasEncore} <kbd class="touche">{t.salon.echap}</kbd>
          </button>
        </div>
      )}
      {notesOpen && seconds === null && (
        <NotesDialog
          game={salon.game.name}
          news={salon.news}
          onClose={() => {
            setNotesOpen(false);
          }}
        />
      )}
      {confirmLeave && (
        <Dialog
          title={host ? t.salon.fenetreFermer.titre : t.salon.fenetreQuitter.titre}
          action={{
            label: host ? t.salon.fenetreFermer.action : t.salon.fenetreQuitter.action,
            testId: 'fenetre-action',
            onClick: () => {
              setConfirmLeave(false);
              leave();
            },
          }}
          back={{
            label: host ? t.salon.fenetreFermer.retour : t.salon.fenetreQuitter.retour,
            testId: 'fenetre-retour',
            onClick: () => {
              setConfirmLeave(false);
            },
          }}
          focusBack
        >
          <p>
            {host ? t.salon.fenetreFermer.texte(peerName) : t.salon.fenetreQuitter.texte(peerName)}
          </p>
        </Dialog>
      )}
    </div>
  );
}
