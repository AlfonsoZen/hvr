'use client';

import { useSessionStore } from '@/store/useSessionStore';

export default function SessionCounter() {
  const total = useSessionStore((s) => s.totalSessions);
  if (total === 0) return null;
  return (
    <span className="text-[9px] text-white/18 tracking-[0.28em] uppercase font-medium">
      {total} {total === 1 ? 'medición' : 'mediciones'} hoy
    </span>
  );
}
