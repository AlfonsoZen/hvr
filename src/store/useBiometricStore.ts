import { create } from 'zustand';

export type SensorStatus = 'active' | 'calibrating' | 'error';

export interface BiometricData {
  heartRate: number;
  rmssd: number;
  rrInterval: number;
  sensorStatus: SensorStatus;
  stressIndex: number;
}

interface BiometricStore extends BiometricData {
  updateBiometrics: (data: BiometricData) => void;
}

const initialState: BiometricData = {
  heartRate: 0,
  rmssd: 0,
  rrInterval: 0,
  sensorStatus: 'calibrating',
  stressIndex: 0,
};

export const useBiometricStore = create<BiometricStore>((set) => ({
  ...initialState,
  updateBiometrics: (data) => set(data),
}));
