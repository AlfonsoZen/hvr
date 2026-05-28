import { create } from 'zustand';

export interface LeaderboardEntry {
  name:      string;
  avgBPM:    number;
  avgStress: number;
  avgRMSSD:  number;
  ts:        number;
}

interface LeaderboardStore {
  entries:    LeaderboardEntry[];
  setEntries: (entries: LeaderboardEntry[]) => void;
}

export const useLeaderboardStore = create<LeaderboardStore>((set) => ({
  entries:    [],
  setEntries: (entries) => set({ entries }),
}));
