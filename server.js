const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev });
const handle = app.getRequestHandler();

// Mock data helpers
const sensorStatuses = ['active', 'active', 'active', 'calibrating', 'error'];

function generateBiometricData() {
  const heartRate = Math.round(60 + Math.random() * 40);
  const rrInterval = Math.round(60000 / heartRate + (Math.random() * 50 - 25));
  return {
    heartRate,
    rmssd: Math.round(20 + Math.random() * 80),
    rrInterval,
    sensorStatus: sensorStatuses[Math.floor(Math.random() * sensorStatuses.length)],
    stressIndex: Math.round(1 + Math.random() * 9),
  };
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
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

  setInterval(() => {
    const data = generateBiometricData();
    io.emit('biometricData', data);
  }, 800);

  httpServer.listen(port, () => {
    console.log(`> Server running on http://localhost:${port} (${dev ? 'dev' : 'prod'})`);
  });
});
