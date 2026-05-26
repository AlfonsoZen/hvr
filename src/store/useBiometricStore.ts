import { create } from 'zustand';

export type SensorStatus = 'active' | 'calibrating' | 'error' | 'no_signal';

export interface BiometricData {
  heartRate: number;
  rmssd: number;
  rrInterval: number;
  sensorStatus: SensorStatus;
  stressIndex: number;
  message?: string;
  calibrationRemainingMs?: number;
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
  message: undefined,
  calibrationRemainingMs: undefined,
};

export const useBiometricStore = create<BiometricStore>((set) => ({
  ...initialState,
  updateBiometrics: (data) =>
    set({
      heartRate:              data.heartRate,
      rmssd:                  data.rmssd,
      rrInterval:             data.rrInterval,
      sensorStatus:           data.sensorStatus,
      stressIndex:            data.stressIndex,
      message:                data.message,
      calibrationRemainingMs: data.calibrationRemainingMs,
    }),
}));
