import { create } from 'zustand';

export type SessionPhase = 'idle' | 'waiting' | 'calibrating' | 'recording' | 'done' | 'error';

interface SessionStore {
  phase:         SessionPhase;
  secondsLeft:   number;
  name:          string;
  email:         string;
  bpmHistory:    number[];
  totalSessions: number;
  update:           (data: Partial<Pick<SessionStore, 'phase' | 'secondsLeft' | 'name' | 'email'>>) => void;
  pushBpm:          (bpm: number) => void;
  setTotalSessions: (n: number)   => void;
  reset:            () => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  phase:         'idle',
  secondsLeft:   0,
  name:          '',
  email:         '',
  bpmHistory:    [],
  totalSessions: 0,
  update:           (data) => set((s) => ({ ...s, ...data })),
  pushBpm:          (bpm)  => set((s) => ({ bpmHistory: [...s.bpmHistory, bpm] })),
  setTotalSessions: (n)    => set({ totalSessions: n }),
  reset: () => set((s) => ({
    phase: 'idle', secondsLeft: 0, name: '', email: '', bpmHistory: [],
    totalSessions: s.totalSessions,
  })),
}));
