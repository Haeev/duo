import dgram from 'node:dgram';
import http from 'node:http';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import os from 'node:os';
import { WebSocket, WebSocketServer } from 'ws';
import type { RawData } from 'ws';
import { isAcceptedSource, normalizeAddress } from './addresses.ts';
import type { Endpoint } from './addresses.ts';
import { createSystemClock } from './clock.ts';
import type { NetworkConfig } from './config.ts';
import { createCryptoRandom } from './random.ts';
import type {
  Connection,
  ConnectionHandlers,
  DatagramSocket,
  DialFailure,
  Frame,
  NetworkDriver,
  StreamServer,
} from './transport.ts';

export interface NodeDriverOptions {
  readonly config: NetworkConfig;
  /** Adresse d'écoute TCP et UDP: `0.0.0.0` (IPv4 seulement, jamais `::`). */
  readonly listenHost?: string;
  /** Sources 127.0.0.0/8 admises (`--duo-allow-loopback`, deux instances sur une machine). */
  readonly allowLoopback?: boolean;
}

function toFrame(data: RawData, isBinary: boolean): Frame {
  const buffer = Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data as ArrayBuffer);
  return isBinary ? new Uint8Array(buffer) : buffer.toString('utf8');
}

/** Une connexion `ws` vue comme `Connection`; les trames arrivées avant les gestionnaires attendent. */
function wrapSocket(socket: WebSocket, remote: Endpoint, direction: 'outgoing' | 'incoming'): Connection {
  let handlers: ConnectionHandlers | null = null;
  const pending: ((current: ConnectionHandlers) => void)[] = [];
  const deliver = (run: (current: ConnectionHandlers) => void): void => {
    if (handlers === null) pending.push(run);
    else run(handlers);
  };
  socket.on('message', (data, isBinary) => {
    const frame = toFrame(data, isBinary);
    deliver((current) => {
      current.onFrame(frame);
    });
  });
  socket.on('close', (code, reason) => {
    deliver((current) => {
      current.onClose({ code, reason: reason.toString('utf8') });
    });
  });
  // Une erreur est toujours suivie de `close`: rien d'autre à faire ici.
  socket.on('error', () => undefined);
  return {
    remote,
    direction,
    get bufferedAmount() {
      return socket.bufferedAmount;
    },
    setHandlers: (next) => {
      handlers = next;
      for (const run of pending.splice(0)) run(next);
    },
    send: (frame) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(frame);
    },
    close: (code, reason) => {
      if (socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) return;
      const valid = (code >= 1000 && code <= 1003) || (code >= 3000 && code <= 4999) || code === 1013;
      socket.close(valid ? code : 1000, reason.slice(0, 120));
      // Sans réponse de l'autre côté, la fermeture propre de `ws` attendrait 30 s.
      setTimeout(() => {
        if (socket.readyState !== WebSocket.CLOSED) socket.terminate();
      }, 1000).unref();
    },
  };
}

function failureFromError(error: unknown): DialFailure {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  switch (code) {
    case 'ECONNREFUSED':
      return 'refused';
    case 'EHOSTUNREACH':
    case 'ENETUNREACH':
    case 'EHOSTDOWN':
    case 'EADDRNOTAVAIL':
      return 'unreachable';
    case 'ETIMEDOUT':
    case 'ECONNRESET':
      return 'timeout';
    case '':
      // Réponse HTTP qui n'est pas un passage en WebSocket `duo` valide.
      return 'not-duo';
    default:
      return 'error';
  }
}

function refuse(socket: Duplex, status: number, text: string): void {
  socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

/** Pilote réseau de production: `ws`, `node:http`, `node:dgram`, `node:os`. */
export function createNodeDriver(options: NodeDriverOptions): NetworkDriver {
  const { config } = options;
  const listenHost = options.listenHost ?? '0.0.0.0';
  const allowLoopback = options.allowLoopback ?? false;

  const listen: NetworkDriver['listen'] = ({ port, onConnection }) =>
    new Promise<StreamServer>((resolve, reject) => {
      const server = http.createServer((_request, response) => {
        response.writeHead(404, { 'Content-Length': '0' });
        response.end();
      });
      server.headersTimeout = config.httpHeadersTimeoutMs;
      server.requestTimeout = config.handshakeTimeoutMs;
      const wss = new WebSocketServer({
        noServer: true,
        perMessageDeflate: false,
        maxPayload: config.maxFrameBytes,
        handleProtocols: (protocols) => (protocols.has(config.subprotocol) ? config.subprotocol : false),
      });
      const recent = new Map<string, number[]>();
      server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
        socket.on('error', () => undefined);
        const remote = normalizeAddress(request.socket.remoteAddress ?? '');
        if (!isAcceptedSource(remote, allowLoopback)) {
          // Hors du réseau local: aucune réponse.
          socket.destroy();
          return;
        }
        // Une page web envoie toujours `Origin`: refus, y compris par rebond DNS.
        if (request.headers.origin !== undefined) {
          refuse(socket, 403, 'Forbidden');
          return;
        }
        const protocols = (request.headers['sec-websocket-protocol'] ?? '')
          .split(',')
          .map((entry) => entry.trim());
        if (request.url !== config.paths.link || !protocols.includes(config.subprotocol)) {
          refuse(socket, 404, 'Not Found');
          return;
        }
        const now = Date.now();
        const times = (recent.get(remote) ?? []).filter((at) => now - at < 1000);
        times.push(now);
        recent.set(remote, times);
        if (recent.size > 256) recent.clear();
        if (times.length > config.connectionsPerSecondPerAddress) {
          refuse(socket, 503, 'Service Unavailable');
          return;
        }
        wss.handleUpgrade(request, socket, head, (ws) => {
          onConnection(wrapSocket(ws, { host: remote, port: request.socket.remotePort ?? 0 }, 'incoming'));
        });
      });
      server.once('error', reject);
      server.listen(port, listenHost, () => {
        server.off('error', reject);
        server.on('error', () => undefined);
        resolve({
          port,
          close: () =>
            new Promise<void>((done) => {
              for (const client of wss.clients) client.terminate();
              wss.close();
              server.close(() => {
                done();
              });
              server.closeAllConnections();
            }),
        });
      });
    });

  const bindDatagram: NetworkDriver['bindDatagram'] = ({ port, onMessage, onError }) =>
    new Promise<DatagramSocket>((resolve, reject) => {
      const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      socket.on('message', (message, info) => {
        onMessage(new Uint8Array(message), { host: normalizeAddress(info.address), port: info.port });
      });
      socket.once('error', reject);
      socket.bind(port, listenHost, () => {
        socket.off('error', reject);
        socket.on('error', onError);
        socket.setBroadcast(true);
        let closed = false;
        resolve({
          port,
          send: (data, endpoint) => {
            if (closed) return;
            socket.send(data, endpoint.port, endpoint.host, (error) => {
              if (error !== null) onError(error);
            });
          },
          close: () => {
            if (closed) return;
            closed = true;
            socket.close();
          },
        });
      });
    });

  return {
    clock: createSystemClock(),
    random: createCryptoRandom(),
    interfaces: () => os.networkInterfaces(),
    listen,
    bindDatagram,
    dialer: {
      dial: (endpoint, timeoutMs, callbacks) => {
        let settled = false;
        const url = `ws://${endpoint.host}:${endpoint.port}${config.paths.link}`;
        const socket = new WebSocket(url, config.subprotocol, {
          perMessageDeflate: false,
          maxPayload: config.maxFrameBytes,
          // Notre minuteur sonne d'abord: `timeout` plutôt qu'une erreur sans code de `ws`.
          handshakeTimeout: timeoutMs + 1000,
          followRedirects: false,
        });
        const fail = (failure: DialFailure): void => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          socket.terminate();
          callbacks.onFail(failure);
        };
        const timer = setTimeout(() => {
          fail('timeout');
        }, timeoutMs);
        socket.once('unexpected-response', () => {
          fail('not-duo');
        });
        socket.once('error', (error) => {
          fail(failureFromError(error));
        });
        socket.once('open', () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (socket.protocol !== config.subprotocol) {
            socket.terminate();
            callbacks.onFail('not-duo');
            return;
          }
          callbacks.onOpen(wrapSocket(socket, endpoint, 'outgoing'));
        });
        return () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          socket.terminate();
        };
      },
    },
  };
}
