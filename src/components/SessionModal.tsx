'use client';

import { useState } from 'react';
import { useSessionStore }    from '@/store/useSessionStore';
import { useBiometricStore }  from '@/store/useBiometricStore';
import { useLeaderboardStore } from '@/store/useLeaderboardStore';
import BpmChart               from '@/components/BpmChart';

const glass: React.CSSProperties = {
  background:          'rgba(8,6,12,0.92)',
  backdropFilter:      'blur(32px)',
  WebkitBackdropFilter:'blur(32px)',
  border:              '1px solid rgba(255,255,255,0.08)',
  boxShadow:           '0 24px 64px rgba(0,0,0,0.6)',
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── Pantallas ─────────────────────────────────────────────────────────────────
function FormScreen({ onSubmit }: { onSubmit: (name: string, email: string) => Promise<void> }) {
  const [name,       setName]       = useState('');
  const [email,      setEmail]      = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  const handleSubmit = async () => {
    if (!name.trim())           { setError('Ingresa tu nombre'); return; }
    if (!isValidEmail(email))   { setError('Correo inválido');   return; }
    setSubmitting(true);
    setError('');
    try {
      await onSubmit(name.trim(), email.trim().toLowerCase());
    } catch {
      setError('No se pudo iniciar la sesión. Intenta de nuevo.');
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '10px', padding: '10px 14px',
    color: 'white', fontSize: '14px', outline: 'none',
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[9px] font-bold tracking-[0.3em] text-white/35 uppercase mb-2">Nombre</p>
        <input
          style={inputStyle}
          type="text"
          placeholder="Tu nombre"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          autoFocus
        />
      </div>
      <div>
        <p className="text-[9px] font-bold tracking-[0.3em] text-white/35 uppercase mb-2">Correo electrónico</p>
        <input
          style={inputStyle}
          type="email"
          placeholder="tu@correo.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />
      </div>

      {error && (
        <p className="text-[11px] text-rose-400/80">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-1 w-full rounded-xl py-3 text-[11px] font-bold tracking-[0.25em] uppercase transition-opacity"
        style={{
          background: 'rgba(244,63,94,0.12)',
          border:     '1px solid rgba(244,63,94,0.28)',
          color:      '#fb7185',
          opacity:    submitting ? 0.5 : 1,
          cursor:     submitting ? 'not-allowed' : 'pointer',
        }}
      >
        {submitting ? 'Iniciando…' : 'Comenzar sesión →'}
      </button>
    </div>
  );
}

function WaitingScreen() {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center animate-pulse"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
      >
        <span style={{ fontSize: '1.6rem' }}>☝️</span>
      </div>
      <div className="text-center">
        <p className="text-white/80 font-semibold text-sm">Coloca el dedo</p>
        <p className="text-white/35 text-[12px] mt-1">sobre el sensor para comenzar</p>
      </div>
    </div>
  );
}

function CalibratingScreen() {
  const calibrationRemainingMs = useBiometricStore(s => s.calibrationRemainingMs);
  const secs = calibrationRemainingMs != null ? Math.ceil(calibrationRemainingMs / 1000) : null;

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#fb923c', boxShadow: '0 0 8px #fb923c' }} />
        <span className="text-[10px] font-bold tracking-[0.35em] text-orange-400/70 uppercase">Calibrando</span>
      </div>
      {secs !== null ? (
        <span className="font-mono font-black tabular-nums" style={{ fontSize: '3rem', color: '#fb923c', textShadow: '0 0 20px rgba(251,146,60,0.4)', lineHeight: 1 }}>
          {secs}s
        </span>
      ) : (
        <span className="text-[11px] text-white/30 tracking-wider">Buscando latidos estables…</span>
      )}
      <p className="text-[10px] text-white/25 tracking-wider text-center">Mantén el dedo quieto sobre el sensor</p>
    </div>
  );
}

function RecordingScreen({ secondsLeft }: { secondsLeft: number }) {
  const progress = ((60 - secondsLeft) / 60) * 100;

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#f43f5e', boxShadow: '0 0 8px #f43f5e' }} />
        <span className="text-[10px] font-bold tracking-[0.35em] text-rose-400/70 uppercase">Grabando</span>
      </div>
      <span className="font-mono font-black tabular-nums" style={{ fontSize: '3rem', color: '#f43f5e', textShadow: '0 0 20px rgba(244,63,94,0.4)', lineHeight: 1 }}>
        {secondsLeft}s
      </span>
      <div className="w-full"><BpmChart /></div>
      {/* Barra de progreso */}
      <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(244,63,94,0.12)' }}>
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${progress}%`, background: 'linear-gradient(to right, #f43f5e, #fb923c)' }}
        />
      </div>
      <p className="text-[10px] text-white/25 tracking-wider">No muevas el dedo</p>
    </div>
  );
}

function DoneScreen({ email }: { email: string }) {
  const entries  = useLeaderboardStore((s) => s.entries);
  const sesName  = useSessionStore((s) => s.name);
  const position = entries.findIndex((e) => e.name === sesName) + 1;
  const total    = entries.length;

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)' }}
      >
        <span style={{ color: '#34d399', fontSize: '1.4rem' }}>✓</span>
      </div>
      <div className="text-center">
        <p className="text-white/80 font-semibold text-sm">¡Diagnóstico enviado!</p>
        <p className="text-white/35 text-[11px] mt-1">Revisa tu correo en</p>
        <p className="text-emerald-400/70 text-[12px] font-mono mt-0.5 break-all">{email}</p>
      </div>
      {position > 0 && (
        <div
          className="mt-1 px-4 py-2 rounded-xl text-center"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <p className="text-[9px] font-bold tracking-[0.3em] text-white/30 uppercase mb-1">Tu posicion</p>
          <p className="text-sm font-bold" style={{ color: '#fbbf24' }}>
            #{position} <span className="text-white/30 font-normal text-[11px]">de {total} participantes</span>
          </p>
        </div>
      )}
    </div>
  );
}

function ErrorScreen() {
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(244,63,94,0.10)', border: '1px solid rgba(244,63,94,0.22)' }}
      >
        <span style={{ color: '#f43f5e', fontSize: '1.4rem' }}>✗</span>
      </div>
      <div className="text-center">
        <p className="text-white/80 font-semibold text-sm">Error al enviar el correo</p>
        <p className="text-white/30 text-[11px] mt-1 leading-relaxed">Verifica las credenciales<br />de Gmail en el servidor.</p>
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export default function SessionModal() {
  const [open, setOpen] = useState(false);
  const phase       = useSessionStore(s => s.phase);
  const secondsLeft = useSessionStore(s => s.secondsLeft);
  const sessionEmail = useSessionStore(s => s.email);
  const reset       = useSessionStore(s => s.reset);

  const activePhases = ['waiting', 'calibrating', 'recording'];
  const isActive     = activePhases.includes(phase);

  const handleOpen = () => setOpen(true);

  const handleClose = async () => {
    if (isActive) {
      await fetch('/session/cancel', { method: 'POST' });
    }
    reset();
    setOpen(false);
  };

  const handleSubmit = async (name: string, email: string) => {
    const res = await fetch('/session/start', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, email }),
    });
    if (!res.ok) throw new Error('Error del servidor');
  };

  const titles: Record<string, string> = {
    idle:        'Obtén tu diagnóstico HRV',
    waiting:     'Sesión iniciada',
    calibrating: 'Sesión iniciada',
    recording:   'Sesión en progreso',
    done:        '¡Listo!',
    error:       'Algo salió mal',
  };

  return (
    <>
      {/* Botón trigger */}
      <button
        onClick={handleOpen}
        className="text-[10px] font-bold tracking-[0.22em] uppercase px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
        style={{
          background: 'rgba(244,63,94,0.10)',
          border:     '1px solid rgba(244,63,94,0.22)',
          color:      '#fb7185',
        }}
      >
        {phase === 'recording' ? `Grabando ${secondsLeft}s` : 'Diagnóstico HRV'}
      </button>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)' }}
            onClick={isActive ? undefined : handleClose}
          />

          {/* Panel */}
          <div
            className="relative z-10 w-full max-w-xs mx-4 rounded-2xl p-6"
            style={glass}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-[9px] font-bold tracking-[0.3em] text-white/30 uppercase mb-1">HRV Monitor</p>
                <p className="text-sm font-semibold text-white/80">{titles[phase]}</p>
              </div>
              <button
                onClick={handleClose}
                className="text-white/25 hover:text-white/60 transition-colors text-lg leading-none ml-4 mt-0.5"
              >
                ✕
              </button>
            </div>

            {/* Contenido */}
            {phase === 'idle'        && <FormScreen onSubmit={handleSubmit} />}
            {phase === 'waiting'     && <WaitingScreen />}
            {phase === 'calibrating' && <CalibratingScreen />}
            {phase === 'recording'   && <RecordingScreen secondsLeft={secondsLeft} />}
            {phase === 'done'        && <DoneScreen email={sessionEmail} />}
            {phase === 'error'       && <ErrorScreen />}

            {/* Botón cerrar en estados finales */}
            {(phase === 'done' || phase === 'error') && (
              <button
                onClick={handleClose}
                className="mt-4 w-full rounded-xl py-2.5 text-[11px] font-bold tracking-[0.25em] uppercase"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
              >
                Cerrar
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
