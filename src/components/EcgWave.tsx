'use client';

import { useRef, useEffect } from 'react';
import { useBiometricStore } from '@/store/useBiometricStore';

function ecgSample(phase: number): number {
  if (phase > 0.08 && phase < 0.18)
    return Math.sin(((phase - 0.08) / 0.10) * Math.PI) * 0.15;
  if (phase > 0.26 && phase < 0.30)
    return -Math.sin(((phase - 0.26) / 0.04) * Math.PI) * 0.10;
  if (phase > 0.30 && phase < 0.38)
    return Math.sin(((phase - 0.30) / 0.08) * Math.PI);
  if (phase > 0.38 && phase < 0.44)
    return -Math.sin(((phase - 0.38) / 0.06) * Math.PI) * 0.15;
  if (phase > 0.50 && phase < 0.70)
    return Math.sin(((phase - 0.50) / 0.20) * Math.PI) * 0.22;
  return 0;
}

export default function EcgWave() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    let phaseMs = 0;
    let lastTs = performance.now();
    let buffer: number[] = [];
    let rafId: number;

    function resize() {
      canvas!.width = canvas!.offsetWidth;
      canvas!.height = canvas!.offsetHeight;
      buffer = new Array(canvas!.width).fill(0);
    }

    resize();
    window.addEventListener('resize', resize);

    function frame(ts: number) {
      const dt = Math.min(ts - lastTs, 64); // cap para tabs en background
      lastTs = ts;

      const { rrInterval } = useBiometricStore.getState();
      phaseMs = (phaseMs + dt) % Math.max(rrInterval, 300);
      const sample = ecgSample(phaseMs / Math.max(rrInterval, 300));

      buffer.shift();
      buffer.push(sample);

      const w = canvas!.width;
      const h = canvas!.height;
      const mid = h / 2;
      const amp = h * 0.42;

      ctx.clearRect(0, 0, w, h);

      // Grid sutil
      ctx.strokeStyle = 'rgba(244,63,94,0.07)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 60) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();

      // Capa glow
      ctx.shadowBlur = 16;
      ctx.shadowColor = '#f43f5e';
      ctx.strokeStyle = 'rgba(244,63,94,0.30)';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      buffer.forEach((v, i) => {
        const y = mid - v * amp;
        i === 0 ? ctx.moveTo(i, y) : ctx.lineTo(i, y);
      });
      ctx.stroke();

      // Línea nítida
      ctx.shadowBlur = 6;
      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      buffer.forEach((v, i) => {
        const y = mid - v * amp;
        i === 0 ? ctx.moveTo(i, y) : ctx.lineTo(i, y);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;

      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
}
