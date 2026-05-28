const { createServer } = require('http');
const { parse }        = require('url');
const net              = require('net');
const nodemailer       = require('nodemailer');
const next             = require('next');
const { Server }       = require('socket.io');

const dev      = process.env.NODE_ENV !== 'production';
const port     = parseInt(process.env.PORT      || '3000', 10);
const picoHost = process.env.PICO_HOST          || '192.168.4.1';
const picoPort = parseInt(process.env.PICO_PORT || '8080', 10);
const RECONNECT_MS          = 3000;
const RECORDING_DURATION_MS = 60_000;

const app    = next({ dev });
const handle = app.getRequestHandler();

let io           = null;
let session      = null;
let sessionCount = 0;
const leaderboard = [];

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error('JSON inválido')); }
    });
    req.on('error', reject);
  });
}

// ── Sesión ────────────────────────────────────────────────────────────────────
function cancelSession() {
  if (!session) return;
  if (session.recordingTimer)    clearTimeout(session.recordingTimer);
  if (session.countdownInterval) clearInterval(session.countdownInterval);
  session = null;
}

function processSessionData(data) {
  if (!session || session.phase === 'done') return;
  const { sensorStatus, heartRate } = data;

  if (session.phase === 'waiting' || session.phase === 'calibrating') {
    if (sensorStatus === 'active') { startRecording(); return; }
    const newPhase = sensorStatus === 'no_signal' ? 'waiting' : 'calibrating';
    if (newPhase !== session.phase) {
      session.phase = newPhase;
      io.emit('sessionUpdate', { phase: newPhase, secondsLeft: 60, name: session.name, email: session.email });
    }
    return;
  }

  if (session.phase === 'recording' && sensorStatus === 'active' && heartRate > 0) {
    session.readings.push(data);
  }
}

function startRecording() {
  if (!session) return;
  session.phase          = 'recording';
  session.recordingStart = Date.now();

  io.emit('sessionUpdate', { phase: 'recording', secondsLeft: 60, name: session.name, email: session.email });

  session.countdownInterval = setInterval(() => {
    if (!session || session.phase !== 'recording') return;
    const secondsLeft = Math.max(0, Math.ceil((RECORDING_DURATION_MS - (Date.now() - session.recordingStart)) / 1000));
    io.emit('sessionUpdate', { phase: 'recording', secondsLeft, name: session.name, email: session.email });
  }, 1000);

  session.recordingTimer = setTimeout(async () => {
    clearInterval(session?.countdownInterval);
    await finishSession();
  }, RECORDING_DURATION_MS);
}

async function finishSession() {
  if (!session) return;
  const { name, email, readings } = session;
  session.phase = 'done';
  io.emit('sessionUpdate', { phase: 'done', secondsLeft: 0, name, email });

  let stats = null;
  try {
    stats = calculateStats(readings);
    await sendEmail(name, email, stats);
    console.log(`[email] Enviado a ${email}`);
  } catch (err) {
    console.error(`[email] Error: ${err.message}`);
    io.emit('sessionUpdate', { phase: 'error', secondsLeft: 0, name, email });
  }

  if (stats) {
    leaderboard.push({
      name:      name,
      avgBPM:    stats.avgBPM,
      avgStress: stats.avgStress,
      avgRMSSD:  stats.avgRMSSD,
      ts:        Date.now(),
    });
    leaderboard.sort((a, b) => a.avgStress - b.avgStress);
    io.emit('leaderboardUpdate', leaderboard.slice(0, 10));
  }

  sessionCount++;
  io.emit('sessionCount', sessionCount);
  session = null;
}

function calculateStats(readings) {
  if (readings.length === 0) return null;
  const avg = arr => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  return {
    avgBPM:    avg(readings.map(r => r.heartRate)),
    minBPM:    Math.min(...readings.map(r => r.heartRate)),
    maxBPM:    Math.max(...readings.map(r => r.heartRate)),
    avgRMSSD:  avg(readings.map(r => r.rmssd)),
    avgStress: avg(readings.map(r => r.stressIndex)),
    count:     readings.length,
  };
}

// ── Email ─────────────────────────────────────────────────────────────────────
function buildInterpretation(stats) {
  if (!stats) return 'No se capturaron suficientes datos. Asegúrate de mantener el dedo firme sobre el sensor durante toda la sesión.';
  const { avgBPM, avgRMSSD, avgStress } = stats;
  const parts = [];

  if      (avgBPM < 60)  parts.push('Tu frecuencia cardíaca estuvo por debajo del rango normal en reposo.');
  else if (avgBPM <= 100) parts.push('Tu frecuencia cardíaca se mantuvo dentro del rango normal.');
  else                   parts.push('Tu frecuencia cardíaca estuvo elevada durante la medición.');

  if      (avgRMSSD >= 50) parts.push('Tu variabilidad cardíaca es alta, indicativo de buena recuperación y calma.');
  else if (avgRMSSD >= 30) parts.push('Tu variabilidad cardíaca se encuentra en un rango normal.');
  else                     parts.push('Tu variabilidad cardíaca es baja, lo que puede reflejar estrés o tensión.');

  if      (avgStress <= 3) parts.push('Tu índice de estrés fue bajo.');
  else if (avgStress <= 6) parts.push('Tu índice de estrés fue moderado.');
  else                     parts.push('Tu índice de estrés fue elevado.');

  return parts.join(' ');
}

function buildEmailHtml(name, stats) {
  const interp    = buildInterpretation(stats);
  const avgBPM    = stats?.avgBPM    ?? '—';
  const minBPM    = stats?.minBPM    ?? '—';
  const maxBPM    = stats?.maxBPM    ?? '—';
  const avgRMSSD  = stats?.avgRMSSD  ?? '—';
  const avgStress = stats?.avgStress ?? '—';
  const count     = stats?.count     ?? 0;

  const metricsBlock = stats ? `
      <tr><td style="padding:24px 36px 0">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff5f6;border:1px solid #fecdd3;border-radius:12px">
          <tr><td style="padding:22px 28px">
            <p style="margin:0;font-size:9px;letter-spacing:4px;text-transform:uppercase;color:#f43f5e;font-weight:800">Frecuencia Cardíaca</p>
            <p style="margin:8px 0 4px;font-size:42px;font-weight:900;color:#0f172a;font-family:'Courier New',monospace;line-height:1">${avgBPM}<span style="font-size:16px;font-weight:400;color:#94a3b8;margin-left:6px">bpm</span></p>
            <p style="margin:0;font-size:12px;color:#94a3b8">Mínimo: <strong style="color:#64748b">${minBPM} bpm</strong> &nbsp;·&nbsp; Máximo: <strong style="color:#64748b">${maxBPM} bpm</strong></p>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:12px 36px 0">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="49%" valign="top">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px">
                <tr><td style="padding:20px 22px">
                  <p style="margin:0;font-size:9px;letter-spacing:4px;text-transform:uppercase;color:#64748b;font-weight:800">RMSSD</p>
                  <p style="margin:8px 0 4px;font-size:32px;font-weight:900;color:#0f172a;font-family:'Courier New',monospace;line-height:1">${avgRMSSD}<span style="font-size:12px;font-weight:400;color:#94a3b8;margin-left:4px">ms</span></p>
                  <p style="margin:0;font-size:11px;color:#94a3b8">Variabilidad cardíaca</p>
                </td></tr>
              </table>
            </td>
            <td width="2%"></td>
            <td width="49%" valign="top">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px">
                <tr><td style="padding:20px 22px">
                  <p style="margin:0;font-size:9px;letter-spacing:4px;text-transform:uppercase;color:#64748b;font-weight:800">Estrés</p>
                  <p style="margin:8px 0 4px;font-size:32px;font-weight:900;color:#0f172a;font-family:'Courier New',monospace;line-height:1">${avgStress}<span style="font-size:12px;font-weight:400;color:#94a3b8;margin-left:4px">/10</span></p>
                  <p style="margin:0;font-size:11px;color:#94a3b8">Índice promedio</p>
                </td></tr>
              </table>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:12px 36px 0">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px">
          <tr><td style="padding:20px 24px">
            <p style="margin:0;font-size:9px;letter-spacing:4px;text-transform:uppercase;color:#16a34a;font-weight:800">Interpretación</p>
            <p style="margin:10px 0 0;font-size:14px;color:#374151;line-height:1.7">${interp}</p>
          </td></tr>
        </table>
      </td></tr>` : `
      <tr><td style="padding:24px 36px 0">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px">
          <tr><td style="padding:20px 24px">
            <p style="margin:0;font-size:14px;color:#dc2626;line-height:1.6">${interp}</p>
          </td></tr>
        </table>
      </td></tr>`;

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9">
  <tr><td align="center" style="padding:32px 16px">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden">
      <tr><td style="background:#080510;padding:32px 36px 28px">
        <p style="margin:0 0 8px;font-size:10px;letter-spacing:4px;color:rgba(255,255,255,0.35);text-transform:uppercase;font-weight:700">HRV Monitor · DIE FEST 2026</p>
        <h1 style="margin:0;font-size:24px;color:#ffffff;font-weight:800;letter-spacing:-0.5px">Tu diagnóstico cardíaco</h1>
      </td></tr>
      <tr><td style="padding:28px 36px 0">
        <p style="margin:0;font-size:16px;color:#0f172a;font-weight:600">Hola, ${name} 👋</p>
        <p style="margin:10px 0 0;font-size:14px;color:#64748b;line-height:1.6">
          Registramos tu sesión de variabilidad de frecuencia cardíaca en el stand de Microcomputadoras. Aquí está tu resumen basado en ${count} lecturas de 60 segundos.
        </p>
      </td></tr>
      ${metricsBlock}
      <tr><td style="padding:20px 36px 8px">
        <p style="margin:0;font-size:11px;color:#cbd5e1;line-height:1.6">⚠️ Este análisis es únicamente informativo y no constituye un diagnóstico médico.</p>
      </td></tr>
      <tr><td style="background:#f8fafc;border-top:1px solid #f1f5f9;padding:18px 36px">
        <p style="margin:0;font-size:11px;color:#94a3b8">Generado automáticamente · DIE FEST 2026 · Facultad de Ingeniería, UNAM</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

async function sendEmail(name, email, stats) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"HRV Monitor – DIE FEST" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `Tu diagnóstico HRV, ${name} — DIE FEST 2026`,
    html: buildEmailHtml(name, stats),
  });
}

// ── Cliente TCP → Pico ────────────────────────────────────────────────────────
function connectToPico() {
  const tryConnect = () => {
    let buffer = '';
    const sock = new net.Socket();

    console.log(`[pico] Conectando a ${picoHost}:${picoPort}...`);
    sock.connect(picoPort, picoHost);

    sock.on('connect', () => console.log('[pico] Conectado'));

    sock.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const data = JSON.parse(trimmed);
          io.emit('biometricData', data);
          processSessionData(data);
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
      sock.destroy();
    });
  };

  tryConnect();
}

// ── Servidor HTTP + Socket.io ─────────────────────────────────────────────────
app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    const pathname = req.url.split('?')[0];

    if (req.method === 'POST' && pathname === '/session/start') {
      try {
        const { name, email } = await parseBody(req);
        if (!name || !email) throw new Error('name y email requeridos');
        cancelSession();
        session = { name, email, phase: 'waiting', readings: [], recordingTimer: null, countdownInterval: null, recordingStart: 0 };
        io.emit('sessionUpdate', { phase: 'waiting', secondsLeft: 60, name, email });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (req.method === 'POST' && pathname === '/session/cancel') {
      const prev = session;
      cancelSession();
      io.emit('sessionUpdate', { phase: 'idle', secondsLeft: 0, name: prev?.name ?? '', email: prev?.email ?? '' });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
      return;
    }

    handle(req, res, parse(req.url, true));
  });

  io = new Server(httpServer, { cors: { origin: '*' } });

  io.on('connection', (socket) => {
    console.log(`[socket.io] cliente conectado: ${socket.id}`);
    if (session) {
      const secondsLeft = session.phase === 'recording'
        ? Math.max(0, Math.ceil((RECORDING_DURATION_MS - (Date.now() - session.recordingStart)) / 1000))
        : 60;
      socket.emit('sessionUpdate', { phase: session.phase, secondsLeft, name: session.name, email: session.email });
    }
    socket.emit('sessionCount', sessionCount);
    socket.emit('leaderboardUpdate', leaderboard.slice(0, 10));
    socket.on('disconnect', () => console.log(`[socket.io] cliente desconectado: ${socket.id}`));
  });

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`> Servidor en http://localhost:${port} (${dev ? 'dev' : 'prod'})`);
    console.log(`> Pico en ${picoHost}:${picoPort}`);
    connectToPico();
  });
});
