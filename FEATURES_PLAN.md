# Plan de Features — HRV Dashboard DIE FEST 2026

Orden recomendado de implementación: F1 → F2 → F3 → F4 → F5 → F6.
Cada feature es independiente y puede implementarse sin los anteriores.

---

## F1 · Gráfica histórica de BPM en vivo

**Objetivo:** Durante la grabación de la sesión, mostrar una línea de tendencia del BPM dentro del modal — el resultado visual más cercano a un monitor médico real.

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/store/useSessionStore.ts` | Agregar `bpmHistory: number[]` y acción `pushBpm(bpm)` |
| `src/components/SocketProvider.tsx` | Cuando `sessionPhase === 'recording'`, llamar `pushBpm(heartRate)` en cada paquete `biometricData` |
| `src/components/BpmChart.tsx` | **Nuevo.** SVG line chart que lee `bpmHistory` del store |
| `src/components/SessionModal.tsx` | Montar `<BpmChart />` en la pantalla `RecordingScreen` |

### Implementación

**1. Store**
```ts
// useSessionStore.ts — agregar al estado
bpmHistory: number[],
pushBpm: (bpm: number) => void,
// en reset(), limpiar bpmHistory: []
```

**2. SocketProvider**
```ts
socket.on('biometricData', (data) => {
  updateBiometrics(data);
  const { phase } = useSessionStore.getState();
  if (phase === 'recording' && data.heartRate > 0)
    useSessionStore.getState().pushBpm(data.heartRate);
});
```

**3. BpmChart.tsx**
- SVG con viewBox responsive, sin dependencias externas.
- Escala Y automática: `min(bpmHistory) - 10` a `max(bpmHistory) + 10`.
- Línea `<polyline>` sobre fondo de cuadrícula sutil.
- Punto destacado en el último valor.
- Color: rose-400 (`#fb7185`) consistente con el dashboard.

**4. SessionModal — RecordingScreen**
```tsx
<BpmChart />  // debajo del countdown
```

### Estimación
**~4 horas.** El componente SVG es la mayor parte del trabajo.

---

## F2 · Leaderboard de visitantes

**Objetivo:** Ranking de las sesiones completadas en el día (por nivel de calma). Genera línea de gente queriendo participar.

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `server.js` | Agregar array `leaderboard[]`, emitir `leaderboardUpdate` al terminar cada sesión |
| `src/store/useLeaderboardStore.ts` | **Nuevo.** Store con la lista de entradas |
| `src/components/SocketProvider.tsx` | Escuchar evento `leaderboardUpdate` |
| `src/components/Leaderboard.tsx` | **Nuevo.** Panel con la tabla de ranking |
| `src/components/SessionModal.tsx` | Mostrar posición del usuario en la pantalla `DoneScreen` |
| `src/app/page.tsx` | Integrar `<Leaderboard />` en el panel derecho con tab toggle |

### Implementación

**1. server.js — acumular resultados**
```js
const leaderboard = [];  // persiste en memoria durante la sesión del servidor

// Al final de finishSession(), antes de session = null:
if (stats) {
  leaderboard.push({ name, avgBPM: stats.avgBPM, avgStress: stats.avgStress, avgRMSSD: stats.avgRMSSD, ts: Date.now() });
  leaderboard.sort((a, b) => a.avgStress - b.avgStress); // más calmado primero
  io.emit('leaderboardUpdate', leaderboard.slice(0, 10));
}
```

**2. useLeaderboardStore.ts**
```ts
interface Entry { name: string; avgBPM: number; avgStress: number; avgRMSSD: number; }
interface LeaderboardStore {
  entries: Entry[];
  setEntries: (e: Entry[]) => void;
}
```

**3. Leaderboard.tsx**
- Lista de hasta 10 entradas con posición (🥇🥈🥉 para el podio).
- Columnas: nombre, BPM promedio, estrés.
- Fila destacada si coincide con el nombre de la última sesión.
- Glassmorphism consistente con el resto del UI.

**4. StatusPanel — tab toggle**
Botón pequeño "Sensor / Ranking" en el header del panel derecho para alternar entre `<StatusPanel />` y `<Leaderboard />`.

**5. SessionModal — DoneScreen**
```tsx
<p>Tu posición: #3 de {leaderboard.length} participantes</p>
```

### Estimación
**~6 horas.** El tab toggle y el diseño del leaderboard son la mayor parte.

---

## F3 · Contador de sesiones

**Objetivo:** Mostrar cuántas personas se han medido en el día. Un solo número que da sensación de evento activo.

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `server.js` | Incrementar `sessionCount` al terminar sesión, incluirlo en `leaderboardUpdate` o emitir `sessionCount` separado |
| `src/store/useSessionStore.ts` | Agregar campo `totalSessions: number` |
| `src/components/SocketProvider.tsx` | Actualizar `totalSessions` al recibir el evento |
| `src/app/page.tsx` | Mostrar contador en el header |

### Implementación

**1. server.js**
```js
let sessionCount = 0;

// En finishSession(), después de calcular stats:
sessionCount++;
io.emit('sessionCount', sessionCount);
```

**2. useSessionStore.ts**
```ts
totalSessions: 0,
setTotalSessions: (n: number) => set({ totalSessions: n }),
```

**3. Header en page.tsx**
```tsx
// Entre el título y el botón SessionModal
<span className="text-[10px] text-white/25 tracking-widest">
  {totalSessions > 0 ? `${totalSessions} mediciones hoy` : ''}
</span>
```

### Estimación
**~1 hora.** El cambio más pequeño del conjunto.

---

## F4 · HRV Score unificado

**Objetivo:** Un número de 0–100 que combina RMSSD y stressIndex en una métrica digerible para el público no técnico.

### Fórmula

```
hrv_score = clamp(
  (min(rmssd, 80) / 80) * 60 +   ← RMSSD aporta 60 puntos
  ((10 - stressIndex) / 10) * 40, ← Estrés aporta 40 puntos
  0, 100
)
```

| Rango | Etiqueta | Color |
|---|---|---|
| 0 – 30 | Estrés alto | `#f43f5e` |
| 31 – 60 | Moderado | `#fb923c` |
| 61 – 80 | Buena calma | `#34d399` |
| 81 – 100 | Excelente | `#34d399` + glow |

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/lib/hrvScore.ts` | **Nuevo.** Función pura `calcHrvScore(rmssd, stressIndex): number` |
| `src/components/HrvScore.tsx` | **Nuevo.** Gauge visual (arco SVG similar al de estrés) |
| `src/components/StatusPanel.tsx` | Reemplazar o complementar el arco de estrés con `<HrvScore />` |

### Implementación

**1. lib/hrvScore.ts**
```ts
export function calcHrvScore(rmssd: number, stressIndex: number): number {
  const r = Math.min(rmssd, 80) / 80 * 60;
  const s = ((10 - stressIndex) / 10) * 40;
  return Math.round(Math.max(0, Math.min(100, r + s)));
}

export function scoreLabel(score: number): { label: string; color: string } {
  if (score > 80) return { label: 'Excelente',   color: '#34d399' };
  if (score > 60) return { label: 'Buena calma', color: '#34d399' };
  if (score > 30) return { label: 'Moderado',    color: '#fb923c' };
  return               { label: 'Estrés alto',  color: '#f43f5e' };
}
```

**2. HrvScore.tsx**
- Arco SVG de 270° (reutilizar lógica de `StressArc` en StatusPanel).
- Número grande en el centro + etiqueta debajo.
- Transición CSS en `stroke-dashoffset`.

**3. StatusPanel.tsx**
- Agregar `<HrvScore />` como nueva tarjeta encima del arco de estrés existente.
- O reemplazar el arco de estrés por el score (decisión de diseño).

### Estimación
**~3 horas.** El arco SVG es prácticamente idéntico al existente.

---

## F5 · Modo biofeedback / guía de respiración

**Objetivo:** Una animación guía al usuario a respirar (4s inhala, 6s exhala). La gráfica de BPM muestra en tiempo real cómo responde el HRV. Demuestra la utilidad clínica del sistema.

### Arquitetura

El modo biofeedback reemplaza la vista 3D del centro mientras está activo. Se activa con un botón en el header y puede combinarse con una sesión de grabación.

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/store/useAppStore.ts` | **Nuevo.** Store mínimo con `mode: 'normal' \| 'biofeedback'` |
| `src/components/BreathingGuide.tsx` | **Nuevo.** Animación SVG + BpmChart + instrucciones |
| `src/components/SceneWrapper.tsx` | Renderizar `<BreathingGuide />` en vez de `<HeartScene />` cuando `mode === 'biofeedback'` |
| `src/app/page.tsx` | Botón toggle en el header |

### Implementación

**1. BreathingGuide.tsx**

El ciclo es: 4s inhala → 6s exhala → repetir (10s total).

```tsx
// Círculo SVG animado con CSS keyframes:
// scale 0.6 → 1.0 en 4s (inhala)
// scale 1.0 → 0.6 en 6s (exhala)
// Texto: "Inhala..." / "Exhala..."
```
```css
@keyframes inhale { from { transform: scale(0.6); } to { transform: scale(1.0); } }
@keyframes exhale { from { transform: scale(1.0); } to { transform: scale(0.6); } }
```

- Círculo exterior con glow rose/blue alternando con la fase.
- Texto de instrucción centrado: "Inhala..." → "Exhala...".
- `<BpmChart />` (F1) debajo mostrando la tendencia en tiempo real.
- Botón "Salir" regresa a `mode: 'normal'`.

**2. useAppStore.ts**
```ts
export const useAppStore = create<{ mode: 'normal' | 'biofeedback'; setMode: ... }>
```

**3. SceneWrapper.tsx**
```tsx
const mode = useAppStore(s => s.mode);
if (mode === 'biofeedback') return <BreathingGuide />;
return <HeartScene />;
```

### Nota de diseño
El efecto más impactante ocurre cuando el usuario respira siguiendo la guía y el observador ve la gráfica de BPM estabilizarse en tiempo real. Preparar un "pitch" de 30 segundos explicando esto al jurado.

### Estimación
**~8 horas.** La animación CSS + la integración del chart son la mayor parte. Requiere F1 (BpmChart) como prerequisito.

**Prerequisito:** F1

---

## F6 · Modo kiosk / TV

**Objetivo:** Una ruta `/kiosk` diseñada para proyectarse en pantalla grande junto al stand. Muestra el leaderboard, el corazón 3D y el contador de sesiones sin interacción.

### Arquitetura

Nueva página Next.js que reutiliza los stores y componentes existentes. No tiene botones ni formularios. Se actualiza en tiempo real por Socket.io (que ya está en el layout global).

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/app/kiosk/page.tsx` | **Nuevo.** Layout fullscreen para TV |
| `src/app/kiosk/layout.tsx` | **Nuevo.** Layout sin header, body 100vh oscuro |
| `src/components/HeartScene.tsx` | Sin cambios (se reutiliza) |
| `src/components/Leaderboard.tsx` | Sin cambios (se reutiliza, requiere F2) |

### Layout propuesto

```
┌──────────────────────────────────────────────────────┐
│  HRV Monitor · DIE FEST 2026      [N] mediciones hoy │
├───────────────────────┬──────────────────────────────┤
│                       │                              │
│   Corazón 3D          │   Leaderboard               │
│   (HeartScene)        │   #1 Alfonso     BPM 68     │
│                       │   #2 Omar        BPM 71     │
│                       │   #3 ...                    │
│                       │                              │
├───────────────────────┴──────────────────────────────┤
│  "¿Quién tiene el corazón más tranquilo?"            │
│  Acércate al stand y mídete · HRV_PICO · 12345678   │
└──────────────────────────────────────────────────────┘
```

### Implementación

**kiosk/layout.tsx**
```tsx
export default function KioskLayout({ children }) {
  return (
    <html className="h-full">
      <body className="h-full bg-[#04040a]">
        <SocketProvider>{children}</SocketProvider>
      </body>
    </html>
  );
}
```

**kiosk/page.tsx**
- Grid 2 columnas: `HeartScene` a la izquierda, `Leaderboard` grande a la derecha.
- Footer fijo con el CTA y el nombre de la red WiFi.
- Fuente más grande en todo (`text-lg` base, números en `text-6xl`).
- Sin OrbitControls en HeartScene (solo animación automática) — pasar prop `interactive={false}`.

### Estimación
**~5 horas.** Principalmente layout y ajustes visuales. El 80% es copiar y reescalar componentes existentes.

**Prerequisito:** F2 (Leaderboard)

---

## Resumen

| Feature | Esfuerzo | Impacto demo | Prerequisitos |
|---|---|---|---|
| F1 · Gráfica BPM en vivo | 4h | Alto | — |
| F2 · Leaderboard | 6h | Alto | — |
| F3 · Contador de sesiones | 1h | Medio | — |
| F4 · HRV Score | 3h | Medio | — |
| F5 · Biofeedback | 8h | Muy alto | F1 |
| F6 · Kiosk / TV | 5h | Alto | F2 |
| **Total** | **~27h** | | |
