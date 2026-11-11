// Jeu d'essai des tests de l'application (jamais publié): il parle le pont 1.0 de
// @duo/protocol sans le SDK, comme le ferait @duo/sdk, pour éprouver l'hébergement.
// Touches: Espace compte et envoie à l'autre machine; F termine la séance (fin de
// démo); K fige le jeu (boucle infinie); L lève une erreur non rattrapée.
'use strict';

(function () {
  var state = {
    port: null,
    init: null,
    role: null,
    seed: null,
    players: [],
    save: null,
    saveSlot: null,
    started: false,
    paused: false,
    pausedBy: null,
    stopped: null,
    count: 0,
    peerCount: 0,
    netReceived: 0,
    saveResults: [],
  };
  window.__essai = state;

  var canvas = document.getElementById('scene');
  var context = canvas.getContext('2d');
  var nextRequestId = 1;
  var pendingSaves = {};

  function send(message, transfer) {
    if (state.port === null) return;
    if (transfer) state.port.postMessage(message, transfer);
    else state.port.postMessage(message);
  }

  function writeSave(moment) {
    var bytes = new TextEncoder().encode(JSON.stringify({ count: state.count }));
    var requestId = nextRequestId++;
    return new Promise(function (resolve) {
      pendingSaves[requestId] = resolve;
      // Tampon transféré, comme le fait @duo/sdk: preload-game le recopie vers le principal.
      send(
        {
          type: 'saveWrite',
          requestId: requestId,
          moment: moment,
          label: 'Compteur ' + state.count,
          dataSchema: 1,
          data: bytes.buffer,
        },
        [bytes.buffer],
      );
    });
  }

  function draw() {
    var ratio = window.devicePixelRatio || 1;
    var width = canvas.clientWidth;
    var height = canvas.clientHeight;
    if (canvas.width !== Math.round(width * ratio)) canvas.width = Math.round(width * ratio);
    if (canvas.height !== Math.round(height * ratio)) canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = state.paused ? '#1b2640' : '#22314f';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#3e6b4f';
    context.beginPath();
    context.moveTo(0, height);
    context.lineTo(width * 0.3, height * 0.5);
    context.lineTo(width * 0.55, height * 0.75);
    context.lineTo(width * 0.75, height * 0.55);
    context.lineTo(width, height);
    context.fill();
    context.fillStyle = '#f3f1fa';
    context.font = '28px sans-serif';
    context.fillText('Essai du pont (' + (state.role || '?') + ')', 40, 60);
    context.font = '20px sans-serif';
    context.fillText('Ici : ' + state.count + ' · Autre : ' + state.peerCount, 40, 100);
    context.fillText(
      state.started ? (state.paused ? 'En pause' : 'En jeu') : 'Chargement',
      40,
      132,
    );
    requestAnimationFrame(draw);
  }

  function onMessage(event) {
    var message = event.data;
    if (message === null || typeof message !== 'object') return;
    switch (message.type) {
      case 'init':
        state.init = message;
        state.role = message.role;
        state.seed = message.seed;
        state.players = message.players;
        state.saveSlot = message.saveSlot;
        if (message.save !== null) {
          state.save = new TextDecoder().decode(new Uint8Array(message.save.data));
          try {
            state.count = JSON.parse(state.save).count || 0;
          } catch (error) {
            state.count = 0;
          }
        }
        send({ type: 'loading', progress: 0.5 });
        setTimeout(function () {
          send({ type: 'ready' });
        }, 200);
        break;
      case 'start':
        state.started = true;
        break;
      case 'pause':
        state.paused = true;
        state.pausedBy = message.by;
        break;
      case 'resume':
        state.paused = false;
        break;
      case 'net':
        state.netReceived += 1;
        try {
          var data = JSON.parse(message.data);
          if (typeof data.count === 'number') state.peerCount = data.count;
        } catch (error) {
          state.netReceived -= 1;
        }
        break;
      case 'saveRequest':
        if (state.role === 'host') void writeSave(message.moment);
        break;
      case 'saveResult':
        state.saveResults.push(message.status);
        if (pendingSaves[message.requestId]) {
          pendingSaves[message.requestId](message.status);
          delete pendingSaves[message.requestId];
        }
        break;
      case 'stop': {
        state.stopped = message.reason;
        var exit = state.role === 'host' && message.save ? writeSave('exit') : Promise.resolve();
        // Comme @duo/sdk 1.2 avec `results.provideSummary`: le résumé de la séance part en
        // réponse à l'arrêt, après la sauvegarde de sortie.
        exit.then(function () {
          if (state.role !== 'host') return;
          send({
            type: 'sessionEnd',
            stats: [
              { label: 'Appuis ici', value: String(state.count) },
              { label: 'Appuis là-bas', value: String(state.peerCount) },
            ],
            progress: Math.min(1, state.count / 4),
            finished: false,
          });
        });
        break;
      }
      default:
        break;
    }
  }

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (
      event.source !== window ||
      data === null ||
      typeof data !== 'object' ||
      data.type !== 'duo:bridge-port'
    )
      return;
    if (state.port !== null || event.ports.length === 0) return;
    state.port = event.ports[0];
    state.port.onmessage = onMessage;
    send({ type: 'hello', bridge: '1.0', sdk: 'essai' });
    setInterval(function () {
      send({ type: 'heartbeat' });
      send({ type: 'perf', fps: 60, frameMs: 16.7, stepHz: 60 });
    }, 1000);
  });

  window.addEventListener('error', function (event) {
    send({ type: 'fatal', message: String(event.message) });
  });

  window.addEventListener('keydown', function (event) {
    // Comme le SDK: Échap vue par le jeu devient une demande de pause (dans Duo, le principal l'intercepte avant).
    if (event.code === 'Escape') {
      send({ type: 'pauseRequest' });
      return;
    }
    if (!state.started || state.paused) return;
    if (event.code === 'Space') {
      state.count += 1;
      send({
        type: 'net',
        channel: 0,
        mode: 'reliable',
        data: JSON.stringify({ count: state.count }),
      });
    } else if (event.code === 'KeyF' && state.role === 'host') {
      send({
        type: 'sessionEnd',
        stats: [
          { label: 'Appuis ici', value: String(state.count) },
          { label: 'Appuis là-bas', value: String(state.peerCount) },
        ],
        finished: true,
      });
    } else if (event.code === 'KeyK') {
      for (;;) {
        state.count += 1;
      }
    } else if (event.code === 'KeyL') {
      throw new Error('Erreur volontaire du jeu d’essai');
    }
  });

  requestAnimationFrame(draw);
})();
