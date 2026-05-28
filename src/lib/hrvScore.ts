export function calcHrvScore(rmssd: number, stressIndex: number): number {
  const rmssdPart  = (Math.min(rmssd, 80) / 80) * 60;
  const stressPart = ((10 - stressIndex) / 10) * 40;
  return Math.round(Math.max(0, Math.min(100, rmssdPart + stressPart)));
}

export function scoreLabel(score: number): { label: string; color: string } {
  if (score > 80) return { label: 'Excelente',   color: '#34d399' };
  if (score > 60) return { label: 'Buena calma', color: '#34d399' };
  if (score > 30) return { label: 'Moderado',    color: '#fb923c' };
  return               { label: 'Estrés alto',  color: '#f43f5e' };
}
