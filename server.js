const { createServer } = require('http');
const { parse } = require('url');
const net = require('net');
const next = require('next');
const { Server } = require('socket.io');

const dev      = process.env.NODE_ENV !== 'production';
const port     = parseInt(process.env.PORT      || '3000',        10);
const picoHost = process.env.PICO_HOST          || '192.168.4.1';
const picoPort = parseInt(process.env.PICO_PORT || '8080',        10);
const RECONNECT_MS = 3000;

const app    = next({ dev });
const handle = app.getRequestHandler();

// ── Cliente TCP → Pico ───────────────────────────────────────────────────────
function connectToPico(io) {
  const tryConnect = () => {
    let buffer = '';
    const sock = new net.Socket();

    console.log(`[pico] Conectando a ${picoHost}:${picoPort}...`);
    sock.connect(picoPort, picoHost);

    sock.on('connect', () => {
      console.log(`[pico] Conectado`);
    });

    sock.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // conservar línea incompleta

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const data = JSON.parse(trimmed);
          io.emit('biometricData', data);
          console.log(`[pico] ${JSON.stringify(data)}`);
        } catch {
          console.warn(`[pico] JSON inválido: ${trimmed}`);
        }
      }
    });

    sock.on('close', () => {
      console.log(`[pico] Desconectado. Reintentando en ${RECONNECT_MS}ms...`);
      setTimeout(tryConnect, RECONNECT_MS);
    });

    sock.on('error', (err) => {
      console.error(`[pico] Error TCP: ${err.message}`);
      sock.destroy(); // dispara 'close' → reintento
    });
  };

  tryConnect();
}

// ── Servidor HTTP + Socket.io ────────────────────────────────────────────────
app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: { origin: '*' },
  });

  io.on('connection', (socket) => {
    console.log(`[socket.io] cliente conectado: ${socket.id}`);
    socket.on('disconnect', () => {
      console.log(`[socket.io] cliente desconectado: ${socket.id}`);
    });
  });

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`> Servidor en http://localhost:${port} (${dev ? 'dev' : 'prod'})`);
    console.log(`> Conectando a Pico en ${picoHost}:${picoPort}`);
    connectToPico(io);
  });
});
