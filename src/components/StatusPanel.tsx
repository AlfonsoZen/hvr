'use client';

import { useState } from 'react';
import { useBiometricStore, SensorStatus } from '@/store/useBiometricStore';
import Leaderboard from '@/components/Leaderboard';

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.08)',
};

const statusConfig: Record<SensorStatus, { label: string; color: string }> = {
  active:      { label: 'Activo',     color: '#34d399' },
  calibrating: { label: 'Calibrando', color: '#fb923c' },
  error:       { label: 'Error',      color: '#f43f5e' },
  no_signal:   { label: 'Sin señal',  color: '#6b7280' },
};

function StressArc({ value }: { value: number }) {
  const r = 46;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - value / 10);
  const color = value > 7 ? '#f43f5e' : value > 4 ? '#fb923c' : '#34d399';

  return (
    <svg viewBox="0 0 120 120" className="w-full max-w-[144px] mx-auto" aria-hidden>
      <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
      <circle
        cx="60" cy="60" r={r}
        fill="none"
        stroke={color}
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform="rotate(-90 60 60)"
        style={{
          transition: 'stroke-dashoffset 0.6s cubic-bezier(.4,0,.2,1), stroke 0.4s ease',
          filter: `drop-shadow(0 0 10px ${color})`,
        }}
      />
      <text x="60" y="55" textAnchor="middle" fill="white" fontSize="27" fontWeight="800" fontFamily="monospace">
        {value}
      </text>
      <text x="60" y="71" textAnchor="middle" fill="rgba(255,255,255,0.28)" fontSize="9" fontFamily="inherit" letterSpacing="3">
        ESTRÉS / 10
      </text>
    </svg>
  );
}

const tabWrapperStyle: React.CSSProperties = {
  background:   'rgba(255,255,255,0.04)',
  border:       '1px solid rgba(255,255,255,0.07)',
  borderRadius: '10px',
  padding:      '3px',
  display:      'flex',
  gap:          '2px',
};

function tabBtnStyle(active: boolean): React.CSSProperties {
  return {
    flex:         1,
    padding:      '5px 0',
    borderRadius: '7px',
    border:       'none',
    cursor:       'pointer',
    fontSize:     '9px',
    fontWeight:   700,
    letterSpacing:'0.2em',
    textTransform:'uppercase',
    transition:   'background 0.2s, color 0.2s',
    background:   active ? 'rgba(255,255,255,0.08)' : 'transparent',
    color:        active ? 'rgba(255,255,255,0.7)'  : 'rgba(255,255,255,0.25)',
  };
}

export default function StatusPanel() {
  const [tab, setTab] = useState<'status' | 'ranking'>('status');

  const sensorStatus           = useBiometricStore((s) => s.sensorStatus);
  const stressIndex            = useBiometricStore((s) => s.stressIndex);
  const calibrationRemainingMs = useBiometricStore((s) => s.calibrationRemainingMs);

  const { label, color } = statusConfig[sensorStatus];

  const isAlert = stressIndex > 7 || sensorStatus === 'error' || sensorStatus === 'no_signal';

  const alertMessage = (() => {
    if (sensorStatus === 'error')     return 'Sensor desconectado o con falla.';
    if (sensorStatus === 'no_signal') return 'Coloca el dedo sobre el sensor.';
    return `Nivel de estrés crítico (${stressIndex}/10).`;
  })();

  const calibrationSecs =
    sensorStatus === 'calibrating' && calibrationRemainingMs != null
      ? Math.ceil(calibrationRemainingMs / 1000)
      : null;

  return (
    <aside className="flex flex-col justify-center gap-3 px-4 py-6">
      {/* Tab toggle */}
      <div style={tabWrapperStyle}>
        <button style={tabBtnStyle(tab === 'status')}  onClick={() => setTab('status')}>Sensor</button>
        <button style={tabBtnStyle(tab === 'ranking')} onClick={() => setTab('ranking')}>Ranking</button>
      </div>

      {tab === 'ranking' ? (
        <Leaderboard />
      ) : (
        <>
          {/* Sensor status */}
          <div className="rounded-2xl px-5 py-4 flex flex-col gap-2.5" style={glass}>
            <span className="text-[9px] font-bold tracking-[0.3em] text-white/35 uppercase">Sensor</span>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: color,
                    boxShadow: `0 0 10px ${color}`,
                    animation: sensorStatus === 'active' ? 'pulse 2s infinite' : 'none',
                  }}
                />
                <span className="text-sm font-semibold" style={{ color }}>{label}</span>
              </div>
              {calibrationSecs !== null && (
                <span className="text-[10px] font-mono text-white/30 tabular-nums">
                  {calibrationSecs}s
                </span>
              )}
            </div>
          </div>

          {/* Stress arc */}
          <div className="rounded-2xl px-4 pt-4 pb-5 flex flex-col" style={glass}>
            <span className="text-[9px] font-bold tracking-[0.3em] text-white/35 uppercase mb-3">
              Índice de Estrés
            </span>
            <StressArc value={stressIndex} />
          </div>

          {/* Alert banner */}
          {isAlert && (
            <div
              className="rounded-2xl px-4 py-3"
              style={{
                background: sensorStatus === 'no_signal'
                  ? 'rgba(107,114,128,0.08)'
                  : 'rgba(244,63,94,0.08)',
                border: sensorStatus === 'no_signal'
                  ? '1px solid rgba(107,114,128,0.28)'
                  : '1px solid rgba(244,63,94,0.28)',
              }}
            >
              <span
                className="text-[9px] font-bold tracking-[0.3em] uppercase block mb-1"
                style={{ color: sensorStatus === 'no_signal' ? '#9ca3af' : '#fb7185' }}
              >
                {sensorStatus === 'no_signal' ? 'Sin señal' : 'Alerta'}
              </span>
              <p
                className="text-xs leading-relaxed"
                style={{ color: sensorStatus === 'no_signal' ? 'rgba(156,163,175,0.8)' : 'rgba(251,113,133,0.8)' }}
              >
                {alertMessage}
              </p>
            </div>
          )}
        </>
      )}
    </aside>
  );
}
