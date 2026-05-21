'use client';

import { useBiometricStore, SensorStatus } from '@/store/useBiometricStore';

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
};

function StressArc({ value }: { value: number }) {
  const r = 46;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - value / 10);
  const color = value > 7 ? '#f43f5e' : value > 4 ? '#fb923c' : '#34d399';

  return (
    <svg viewBox="0 0 120 120" className="w-full max-w-[144px] mx-auto" aria-hidden>
      {/* Track */}
      <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
      {/* Arc */}
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

export default function StatusPanel() {
  const sensorStatus = useBiometricStore((s) => s.sensorStatus);
  const stressIndex  = useBiometricStore((s) => s.stressIndex);

  const { label, color } = statusConfig[sensorStatus];
  const isAlert = stressIndex > 7 || sensorStatus === 'error';

  return (
    <aside className="flex flex-col justify-center gap-3 px-4 py-6">
      {/* Sensor status */}
      <div className="rounded-2xl px-5 py-4 flex flex-col gap-2.5" style={glass}>
        <span className="text-[9px] font-bold tracking-[0.3em] text-white/35 uppercase">Sensor</span>
        <div className="flex items-center gap-2.5">
          <span
            className="w-2 h-2 rounded-full animate-pulse flex-shrink-0"
            style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
          />
          <span className="text-sm font-semibold" style={{ color }}>{label}</span>
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
            background: 'rgba(244,63,94,0.08)',
            border: '1px solid rgba(244,63,94,0.28)',
          }}
        >
          <span className="text-[9px] font-bold tracking-[0.3em] text-rose-400/70 uppercase block mb-1">
            Alerta
          </span>
          <p className="text-xs text-rose-300/80 leading-relaxed">
            {sensorStatus === 'error'
              ? 'Sensor desconectado o con falla.'
              : `Nivel de estrés crítico (${stressIndex}/10).`}
          </p>
        </div>
      )}
    </aside>
  );
}
