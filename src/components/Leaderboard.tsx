'use client';

import { useLeaderboardStore, LeaderboardEntry } from '@/store/useLeaderboardStore';

const glass: React.CSSProperties = {
  background:          'rgba(255,255,255,0.04)',
  backdropFilter:      'blur(24px)',
  WebkitBackdropFilter:'blur(24px)',
  border:              '1px solid rgba(255,255,255,0.08)',
};

const rankColors: Record<number, string> = {
  1: '#fbbf24',
  2: '#94a3b8',
  3: '#cd7c2f',
};

function stressColor(avgStress: number): string {
  if (avgStress <= 3) return '#34d399';
  if (avgStress <= 6) return '#fb923c';
  return '#f43f5e';
}

function truncateName(name: string, max = 14): string {
  if (name.length <= max) return name;
  return name.slice(0, max - 1) + '…';
}

function EntryRow({ entry, position }: { entry: LeaderboardEntry; position: number }) {
  const rankColor = rankColors[position] ?? 'rgba(255,255,255,0.3)';
  const isFirst   = position === 1;

  return (
    <div
      style={{
        display:       'flex',
        alignItems:    'center',
        gap:           '10px',
        padding:       '8px 12px',
        background:    isFirst ? 'rgba(52,211,153,0.04)' : 'rgba(255,255,255,0.03)',
        borderBottom:  '1px solid rgba(255,255,255,0.04)',
        boxShadow:     isFirst ? 'inset 0 0 12px rgba(52,211,153,0.06)' : 'none',
      }}
    >
      {/* Rank */}
      <span
        style={{
          width:      '22px',
          flexShrink: 0,
          fontSize:   '10px',
          fontWeight: 800,
          fontFamily: 'monospace',
          color:      rankColor,
          textAlign:  'right',
        }}
      >
        #{position}
      </span>

      {/* Name */}
      <span
        style={{
          flex:       1,
          fontSize:   '12px',
          fontWeight: 600,
          color:      'rgba(255,255,255,0.75)',
          overflow:   'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        {truncateName(entry.name)}
      </span>

      {/* BPM */}
      <span
        style={{
          fontSize:   '11px',
          fontFamily: 'monospace',
          color:      'rgba(255,255,255,0.4)',
          whiteSpace: 'nowrap',
        }}
      >
        {entry.avgBPM} bpm
      </span>

      {/* Stress */}
      <span
        style={{
          fontSize:   '11px',
          fontFamily: 'monospace',
          fontWeight: 700,
          color:      stressColor(entry.avgStress),
          whiteSpace: 'nowrap',
          minWidth:   '32px',
          textAlign:  'right',
        }}
      >
        {entry.avgStress}/10
      </span>
    </div>
  );
}

export default function Leaderboard() {
  const entries = useLeaderboardStore((s) => s.entries);

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col" style={glass}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="text-[9px] font-bold tracking-[0.3em] text-white/35 uppercase">
          Ranking
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 px-4 gap-2">
          <span style={{ fontSize: '1.4rem', opacity: 0.25 }}>-</span>
          <p className="text-[11px] text-white/25 text-center tracking-wide">
            Se el primero en medirte
          </p>
        </div>
      ) : (
        <div>
          {entries.map((entry, i) => (
            <EntryRow key={`${entry.name}-${entry.ts}`} entry={entry} position={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
