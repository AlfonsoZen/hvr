'use client';

import dynamic from 'next/dynamic';

const HeartScene = dynamic(() => import('@/components/HeartScene'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-full">
      <span className="text-zinc-700 text-sm tracking-widest uppercase animate-pulse">
        Cargando...
      </span>
    </div>
  ),
});

export default function SceneWrapper() {
  return <HeartScene />;
}
