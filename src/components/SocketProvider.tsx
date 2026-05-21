'use client';

import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useBiometricStore, BiometricData } from '@/store/useBiometricStore';

export default function SocketProvider({ children }: { children: React.ReactNode }) {
  const updateBiometrics = useBiometricStore((state) => state.updateBiometrics);

  useEffect(() => {
    const socket = io();

    socket.on('biometricData', (data: BiometricData) => {
      updateBiometrics(data);
    });

    return () => {
      socket.disconnect();
    };
  }, [updateBiometrics]);

  return <>{children}</>;
}
