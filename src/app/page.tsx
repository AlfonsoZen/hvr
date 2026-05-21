import MetricsPanel from '@/components/MetricsPanel';
import StatusPanel from '@/components/StatusPanel';
import SceneWrapper from '@/components/SceneWrapper';
import EcgWave from '@/components/EcgWave';

export default function Home() {
  return (
    <main
      className="h-screen overflow-hidden grid grid-rows-[52px_1fr_148px] grid-cols-[264px_1fr_264px]"
      style={{
        background: 'radial-gradient(ellipse 80% 70% at 50% 48%, #1e0408 0%, #04040a 62%)',
      }}
    >
      {/* ── Header ── */}
      <header
        className="col-span-3 flex items-center justify-between px-8"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: '#f43f5e', boxShadow: '0 0 8px #f43f5e' }}
          />
          <span className="text-[11px] font-bold tracking-[0.28em] text-white/60 uppercase">
            HRV Monitor
          </span>
        </div>

        <span className="text-[11px] tracking-[0.4em] text-white/22 uppercase font-medium">
          DIE FEST 2026
        </span>

        {/* espacio para equilibrar el layout */}
        <div className="w-36" />
      </header>

      {/* ── Panels + 3D ── */}
      <MetricsPanel />

      <div className="overflow-hidden">
        <SceneWrapper />
      </div>

      <StatusPanel />

      {/* ── ECG Strip ── */}
      <div
        className="col-span-3 flex flex-col px-8 pt-3 pb-4 gap-1.5"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span className="text-[9px] font-bold tracking-[0.35em] text-white/20 uppercase">
          ECG · Tiempo real
        </span>
        <div className="flex-1 min-h-0">
          <EcgWave />
        </div>
      </div>
    </main>
  );
}
