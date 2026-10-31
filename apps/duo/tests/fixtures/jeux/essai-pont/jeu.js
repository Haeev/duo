// Jeu d'essai des tests de l'application (jamais publié): il parle le pont 1.0
// de l'ADR 0005 sans le SDK, pour éprouver l'hébergement des jeux.
// Touches: Espace compte et envoie à l'autre machine; K fige le jeu (boucle
// infinie); L lève une erreur non rattrapée.
'use strict';

(function () {
  var state = {
    port: null,
    role: null,
    players: [],
    seed: null,
    save: null,
    started: false,
    paused: false,
    stopped: null,
    count: 0,
    peerCount: 0,
    netReceived: 0,
  };
  window.__essai = state;

  var canvas = document.getElementById('scene');
  var context = canvas.getContext('2d');

  function send(message) {
    if (state.port !== null) state.port.postMessage(message);
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
    context.fillText(state.started ? (state.paused ? 'En pause' : 'En jeu') : 'Chargement', 40, 132);
    requestAnimationFrame(draw);
  }

  function onMessage(event) {
    var message = event.data;
    if (message === null || typeof message !== 'object') return;
    switch (message.type) {
      case 'init':
        state.role = message.role;
        state.players = message.players;
        state.seed = message.seed;
        state.save = message.save === null ? null : new TextDecoder().decode(new Uint8Array(message.save.data));
        if (state.save !== null) {
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
        break;
      case 'resume':
        state.paused = false;
        break;
      case 'net':
        state.netReceived += 1;
        if (message.data && typeof message.data.count === 'number') state.peerCount = message.data.count;
        break;
      case 'saveRequest':
        break;
      case 'stop':
        state.stopped = message.reason;
        if (message.save) {
          var bytes = new TextEncoder().encode(JSON.stringify({ count: state.count }));
          send({ type: 'saveWrite', moment: 'exit', label: 'Compteur ' + state.count, dataSchema: 1, data: bytes.buffer }, [bytes.buffer]);
        }
        send({ type: 'sessionEnd', progress: { count: state.count } });
        break;
      default:
        break;
    }
  }

  window.addEventListener('message', function (event) {
    if (event.source !== window || event.data !== 'duo:bridge' || event.ports.length === 0) return;
    state.port = event.ports[0];
    state.port.onmessage = onMessage;
    setInterval(function () {
      send({ type: 'heartbeat' });
    }, 1000);
  });

  window.addEventListener('error', function (event) {
    send({ type: 'fatal', message: String(event.message) });
  });

  window.addEventListener('keydown', function (event) {
    if (!state.started || state.paused) return;
    if (event.code === 'Space') {
      state.count += 1;
      send({ type: 'net', channel: 0, mode: 'reliable', data: { count: state.count } });
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
