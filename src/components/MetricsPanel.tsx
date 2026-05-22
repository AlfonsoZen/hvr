'use client';

import { useBiometricStore } from '@/store/useBiometricStore';

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.08)',
};

const glassAccent: React.CSSProperties = {
  ...glass,
  border: '1px solid rgba(244,63,94,0.25)',
  boxShadow: '0 0 40px rgba(244,63,94,0.08), inset 0 1px 0 rgba(255,255,255,0.06)',
};

function HeroCard({ value }: { value: number }) {
  return (
    <div className="rounded-2xl px-5 py-5 flex flex-col gap-1" style={glassAccent}>
      <span className="text-[9px] font-bold tracking-[0.3em] text-white/35 uppercase">
        Frecuencia Cardíaca
      </span>
      <div className="flex items-end gap-2 mt-1">
        <span
          className="font-mono font-black tabular-nums leading-none text-rose-400"
          style={{
            fontSize: '4.5rem',
            textShadow: '0 0 20px rgba(244,63,94,0.35)',
          }}
        >
          {value}
        </span>
        <span className="text-sm text-white/30 mb-2 font-medium">bpm</span>
      </div>
      <div
        className="w-full h-px mt-1"
        style={{ background: 'linear-gradient(to right, transparent, rgba(244,63,94,0.5), transparent)' }}
      />
    </div>
  );
}

function MetricCard({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-2xl px-5 py-4 flex flex-col gap-1" style={glass}>
      <span className="text-[9px] font-bold tracking-[0.3em] text-white/35 uppercase">{label}</span>
      <div className="flex items-end gap-1.5 mt-0.5">
        <span className="font-mono font-bold tabular-nums leading-none text-white text-4xl">
          {value}
        </span>
        <span className="text-xs text-white/30 mb-1">{unit}</span>
      </div>
    </div>
  );
}

export default function MetricsPanel() {
  const heartRate  = useBiometricStore((s) => s.heartRate);
  const rmssd      = useBiometricStore((s) => s.rmssd);
  const rrInterval = useBiometricStore((s) => s.rrInterval);

  return (
    <aside className="flex flex-col justify-center gap-3 px-4 py-6">
      <HeroCard value={heartRate} />
      <MetricCard label="RMSSD" value={rmssd} unit="ms" />
      <MetricCard label="Intervalo RR" value={rrInterval} unit="ms" />
    </aside>
  );
}
