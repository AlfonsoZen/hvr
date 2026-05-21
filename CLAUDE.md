# Contexto General del Proyecto: Dashboard HRV (Heart Rate Variability)

Eres un asistente de desarrollo Full-Stack. Vamos a construir una aplicación web para visualizar datos biométricos en tiempo real provenientes de un microcontrolador (Raspberry Pi Pico 2W) a través de una red local.

El sistema consta de un servidor backend local en Node.js que maneja WebSockets y sirve una aplicación frontend en Next.js. La interfaz mostrará métricas 2D y un modelo 3D reactivo a los datos.

## Stack Tecnológico
* **Backend:** Node.js, Socket.io (Servidor HTTP custom).
* **Frontend:** Next.js (App Router), React.
* **Estado Global:** Zustand (Crucial para manejar el flujo continuo de datos sin re-renderizar el DOM de React innecesariamente).
* **Visualización 3D:** Three.js con `@react-three/fiber` (R3F).

## Reglas Globales Estrictas
1.  **Nomenclatura:** Utiliza `camelCase` para TODAS las variables, nombres de funciones, propiedades de objetos y estados. Sin excepciones.
2.  **Modularidad:** Mantén los componentes pequeños y aislados.
3.  **Pausas:** Ejecuta este documento por etapas. Al terminar una etapa, detente, avísame y espera mi confirmación antes de iniciar la siguiente.

---

## Etapa 1: Setup del Servidor Custom y Mock Data (Node.js + WebSockets)
**Objetivo:** Levantar la infraestructura base y simular el flujo de datos del hardware.

1.  Inicializa un proyecto de Next.js (App Router).
2.  Crea un archivo `server.js` en la raíz. Configura un servidor HTTP de Node.js puro que integre Next.js y un servidor de `socket.io` en el mismo puerto (ej. 3000).
3.  Implementa un simulador (Mock Data) dentro de `server.js`. Crea un `setInterval` que emita un evento WebSocket llamado `biometricData` cada 800ms aproximadamente.
4.  El payload JSON emitido debe tener esta estructura estricta:
    ```javascript
    {
      heartRate: number, // ej. 72
      rmssd: number, // ej. 65
      rrInterval: number, // ej. 830
      sensorStatus: string, // "active" | "calibrating" | "error"
      stressIndex: number // ej. 3
    }
    ```

---

## Etapa 2: Gestión del Estado Global (Zustand)
**Objetivo:** Preparar el frontend para recibir los datos biométricos de forma reactiva y optimizada.

1.  Instala `zustand` y `socket.io-client`.
2.  Crea un store llamado `useBiometricStore`.
3.  Define el estado inicial reflejando las variables del payload (con `camelCase`).
4.  Implementa una función `updateBiometrics(data)` dentro del store para actualizar el estado.
5.  Crea un hook o componente cliente (ej. `SocketProvider`) que se conecte al servidor local, escuche el evento `biometricData` y llame a `updateBiometrics` cada vez que llegue un paquete.

---

## Etapa 3: Estructura del Dashboard UI (Next.js + React)
**Objetivo:** Construir la interfaz de usuario para mostrar las métricas en 2D con un diseño limpio.

1.  En la página principal (`page.tsx`), crea un layout de grid.
2.  Implementa un componente `MetricsPanel` (panel izquierdo) que se suscriba al store de Zustand y muestre: `heartRate`, `rmssd` y `rrInterval`.
3.  Implementa un componente `StatusPanel` (panel derecho) que muestre el `sensorStatus` y genere notificaciones de alerta si `stressIndex` es muy alto o el status es "error".
4.  Deja un contenedor central vacío y amplio con un color de fondo oscuro (placeholder para el lienzo 3D).

---

## Etapa 4: Integración del Motor 3D (React Three Fiber)
**Objetivo:** Incorporar la visualización tridimensional reactiva a los datos.

1.  Instala `three`, `@react-three/fiber` y `@react-three/drei`.
2.  Crea un componente `HeartScene` que contenga un `<Canvas>` de R3F.
3.  Dentro de la escena, añade luces básicas y una malla tridimensional (mesh) temporal (ej. una esfera o una forma abstracta que represente el corazón).
4.  Conecta la malla al `useBiometricStore`.
5.  Utiliza el hook `useFrame` de R3F para animar la escala (latido) del modelo 3D basándote en el valor actual de `heartRate` o `rrInterval`, de forma que el objeto palpite a la velocidad indicada por los datos en tiempo real.
6.  Monta este componente en el contenedor central vacío de la Etapa 3.

---
**Instrucción Final para Claude:** Confirma que has leído y entendido las reglas y la división de etapas. Solo ejecuta la Etapa 1 por ahora y avísame cuando esté lista.
