import MetricsPanel from '@/components/MetricsPanel';
import StatusPanel from '@/components/StatusPanel';
import SceneWrapper from '@/components/SceneWrapper';

export default function Home() {
  return (
    <main className="grid grid-cols-[280px_1fr_280px] h-screen bg-zinc-900 text-white overflow-hidden">
      <MetricsPanel />

      <div className="bg-zinc-950 m-4 rounded-2xl overflow-hidden">
        <SceneWrapper />
      </div>

      <StatusPanel />
    </main>
  );
}
