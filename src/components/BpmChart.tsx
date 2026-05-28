'use client';

import { useSessionStore } from '@/store/useSessionStore';

export default function BpmChart() {
  const bpmHistory = useSessionStore((s) => s.bpmHistory);

  if (bpmHistory.length < 2) {
    return (
      <div className="w-full flex items-center justify-center" style={{ height: 64 }}>
        <span className="text-[10px] text-white/15 tracking-widest">Iniciando gráfica…</span>
      </div>
    );
  }

  const W   = 240;
  const H   = 64;
  const pad = H * 0.1;

  const minBpm = Math.min(...bpmHistory);
  const maxBpm = Math.max(...bpmHistory);
  const range  = Math.max(maxBpm - minBpm, 8);

  const toX = (i: number) => (i / (bpmHistory.length - 1)) * W;
  const toY = (v: number) => H - pad - ((v - minBpm) / range) * (H - pad * 2);

  const pts = bpmHistory.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  const fill = [`0,${H}`, pts, `${W},${H}`].join(' ');

  const lx = toX(bpmHistory.length - 1);
  const ly = toY(bpmHistory[bpmHistory.length - 1]);

  return (
    <div className="w-full">
      <div className="flex justify-between mb-0.5 px-0.5">
        <span className="text-[8px] text-white/20 font-mono tabular-nums">{minBpm}</span>
        <span className="text-[8px] text-white/20 font-mono tabular-nums">{maxBpm}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
        <defs>
          <linearGradient id="bpmFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#f43f5e" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0"    />
          </linearGradient>
        </defs>

        {/* Grid */}
        {[0.33, 0.66].map((f) => (
          <line key={f} x1="0" y1={H * f} x2={W} y2={H * f}
            stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        ))}

        {/* Fill */}
        <polygon points={fill} fill="url(#bpmFill)" />

        {/* Glow line */}
        <polyline points={pts} fill="none"
          stroke="rgba(244,63,94,0.35)" strokeWidth="3"
          strokeLinejoin="round" strokeLinecap="round"
          style={{ filter: 'drop-shadow(0 0 4px rgba(244,63,94,0.5))' }}
        />
        {/* Sharp line */}
        <polyline points={pts} fill="none"
          stroke="#fb7185" strokeWidth="1.2"
          strokeLinejoin="round" strokeLinecap="round"
        />

        {/* Latest point */}
        <circle cx={lx} cy={ly} r="3" fill="#f43f5e"
          style={{ filter: 'drop-shadow(0 0 5px #f43f5e)' }}
        />
      </svg>
    </div>
  );
}
