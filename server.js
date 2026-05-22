const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev });
const handle = app.getRequestHandler();

function parsePicoRequest(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/data') {
      try {
        const data = await parsePicoRequest(req);
        io.emit('biometricData', data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
        console.log(`[pico] ${JSON.stringify(data)}`);
      } catch {
        res.writeHead(400);
        res.end('{"error":"bad request"}');
      }
      return;
    }

    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: { origin: '*' },
  });

  io.on('connection', (socket) => {
    console.log(`[socket.io] client connected: ${socket.id}`);
    socket.on('disconnect', () => {
      console.log(`[socket.io] client disconnected: ${socket.id}`);
    });
  });

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`> Server on http://localhost:${port} (${dev ? 'dev' : 'prod'})`);
    console.log(`> Pico endpoint: POST http://<TU_IP>:${port}/data`);
  });
});
