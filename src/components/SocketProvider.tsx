'use client';

import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useBiometricStore, BiometricData } from '@/store/useBiometricStore';
import { useSessionStore } from '@/store/useSessionStore';
import { useLeaderboardStore, LeaderboardEntry } from '@/store/useLeaderboardStore';

export default function SocketProvider({ children }: { children: React.ReactNode }) {
  const updateBiometrics = useBiometricStore((s) => s.updateBiometrics);
  const updateSession    = useSessionStore((s) => s.update);
  const pushBpm          = useSessionStore((s) => s.pushBpm);
  const setTotalSessions = useSessionStore((s) => s.setTotalSessions);
  const setEntries       = useLeaderboardStore((s) => s.setEntries);

  useEffect(() => {
    const socket = io();

    socket.on('biometricData', (data: BiometricData) => {
      updateBiometrics(data);
      const { phase } = useSessionStore.getState();
      if (phase === 'recording' && data.heartRate > 0) pushBpm(data.heartRate);
    });

    socket.on('sessionUpdate', (data: Parameters<typeof updateSession>[0]) => {
      updateSession(data);
    });

    socket.on('sessionCount', (count: number) => {
      setTotalSessions(count);
    });

    socket.on('leaderboardUpdate', (data: LeaderboardEntry[]) => {
      setEntries(data);
    });

    return () => { socket.disconnect(); };
  }, [updateBiometrics, updateSession, pushBpm, setTotalSessions, setEntries]);

  return <>{children}</>;
}
