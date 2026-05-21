'use client';

import { useBiometricStore, SensorStatus } from '@/store/useBiometricStore';

const STRESS_ALERT_THRESHOLD = 7;

const statusConfig: Record<SensorStatus, { label: string; color: string; dot: string }> = {
  active:      { label: 'Activo',       color: 'text-emerald-400', dot: 'bg-emerald-400' },
  calibrating: { label: 'Calibrando',   color: 'text-amber-400',   dot: 'bg-amber-400'   },
  error:       { label: 'Error',         color: 'text-red-400',     dot: 'bg-red-400'     },
};

export default function StatusPanel() {
  const sensorStatus = useBiometricStore((s) => s.sensorStatus);
  const stressIndex  = useBiometricStore((s) => s.stressIndex);

  const { label, color, dot } = statusConfig[sensorStatus] ?? statusConfig.error;
  const highStress  = stressIndex > STRESS_ALERT_THRESHOLD;
  const isError     = sensorStatus === 'error';
  const showAlert   = highStress || isError;

  return (
    <aside className="flex flex-col gap-4 p-4">
      <h2 className="text-xs font-semibold tracking-widest text-zinc-500 uppercase px-1">
        Estado
      </h2>

      {/* Sensor status */}
      <div className="bg-zinc-800 rounded-2xl p-5 flex flex-col gap-3">
        <span className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">
          Sensor
        </span>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${dot} animate-pulse`} />
          <span className={`text-xl font-semibold ${color}`}>{label}</span>
        </div>
      </div>

      {/* Stress index */}
      <div className="bg-zinc-800 rounded-2xl p-5 flex flex-col gap-2">
        <span className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">
          Índice de estrés
        </span>
        <div className="flex items-end gap-2 mt-1">
          <span className={`text-5xl font-bold tabular-nums leading-none ${highStress ? 'text-red-400' : 'text-white'}`}>
            {stressIndex}
          </span>
          <span className="text-sm text-zinc-400 mb-1">/ 10</span>
        </div>
        {/* Barra de progreso */}
        <div className="w-full h-1.5 bg-zinc-700 rounded-full overflow-hidden mt-1">
          <div
            className={`h-full rounded-full transition-all duration-500 ${highStress ? 'bg-red-400' : 'bg-emerald-400'}`}
            style={{ width: `${(stressIndex / 10) * 100}%` }}
          />
        </div>
      </div>

      {/* Alertas */}
      {showAlert && (
        <div className="bg-red-950 border border-red-700 rounded-2xl p-4 flex flex-col gap-1">
          <span className="text-xs font-semibold tracking-widest text-red-400 uppercase">
            Alerta
          </span>
          {isError && (
            <p className="text-sm text-red-300">Sensor desconectado o con falla.</p>
          )}
          {highStress && !isError && (
            <p className="text-sm text-red-300">
              Nivel de estrés elevado ({stressIndex}/10).
            </p>
          )}
        </div>
      )}
    </aside>
  );
}
