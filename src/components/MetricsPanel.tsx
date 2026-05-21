'use client';

import { useBiometricStore } from '@/store/useBiometricStore';

interface MetricCardProps {
  label: string;
  value: number;
  unit: string;
}

function MetricCard({ label, value, unit }: MetricCardProps) {
  return (
    <div className="bg-zinc-800 rounded-2xl p-5 flex flex-col gap-1">
      <span className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">
        {label}
      </span>
      <div className="flex items-end gap-2 mt-1">
        <span className="text-5xl font-bold text-white tabular-nums leading-none">
          {value}
        </span>
        <span className="text-sm text-zinc-400 mb-1">{unit}</span>
      </div>
    </div>
  );
}

export default function MetricsPanel() {
  const heartRate = useBiometricStore((s) => s.heartRate);
  const rmssd = useBiometricStore((s) => s.rmssd);
  const rrInterval = useBiometricStore((s) => s.rrInterval);

  return (
    <aside className="flex flex-col gap-4 p-4">
      <h2 className="text-xs font-semibold tracking-widest text-zinc-500 uppercase px-1">
        Métricas
      </h2>
      <MetricCard label="Frec. Cardíaca" value={heartRate} unit="bpm" />
      <MetricCard label="RMSSD" value={rmssd} unit="ms" />
      <MetricCard label="Intervalo RR" value={rrInterval} unit="ms" />
    </aside>
  );
}
