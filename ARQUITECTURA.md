# Arquitectura del Sistema HRV Dashboard

## Descripción General

Sistema de monitoreo de variabilidad de frecuencia cardíaca (HRV) en tiempo real. Adquiere señales fotopletismográficas (PPG) desde un microcontrolador, procesa los datos para extraer métricas cardíacas y las visualiza en un dashboard web interactivo con modelo 3D reactivo.

---

## Stack Tecnológico

| Capa | Tecnología | Versión | Rol |
|---|---|---|---|
| **Hardware** | Raspberry Pi Pico 2W | — | Microcontrolador con WiFi |
| **Sensor** | GY MAX30102 | — | Sensor fotopletismográfico IR/Rojo |
| **Firmware** | MicroPython | — | Lectura I2C, procesamiento de señal, salida serial |
| **Backend** | Node.js + Socket.io | 4.8.3 | Servidor HTTP + WebSocket |
| **Frontend** | Next.js (App Router) | 16.2.6 | Framework web React |
| **Estado global** | Zustand | 5.0.13 | Store reactivo para datos biométricos |
| **Visualización 3D** | Three.js + React Three Fiber | 0.184 / 9.6.1 | Motor 3D y canvas reactivo |
| **Utilidades 3D** | @react-three/drei | 10.7.7 | Helpers R3F (OrbitControls, useGLTF, Center) |
| **Puente serial** | Python (pyserial + requests) | — | Lectura USB serial → HTTP POST |

---

## Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│  HARDWARE                                                        │
│                                                                  │
│   GY MAX30102                  Raspberry Pi Pico 2W             │
│  ┌──────────┐   I2C (100kHz)  ┌──────────────────────┐         │
│  │ LED IR   │ ──────────────► │ GP0 (SDA) GP1 (SCL)  │         │
│  │ LED Rojo │                 │                        │         │
│  │ Fotodet. │                 │  MicroPython           │         │
│  └──────────┘                 │  · Driver MAX30102     │         │
│                               │  · HRVProcessor        │         │
│                               │  · print(JSON)         │         │
│                               └──────────┬─────────────┘         │
└──────────────────────────────────────────┼─────────────────────┘
                                           │ USB Serial (CDC)
                                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  WINDOWS (host)                                                  │
│                                                                  │
│   serial_bridge.py                                              │
│  ┌──────────────────────────────┐                               │
│  │ pyserial → lee líneas JSON   │                               │
│  │ requests.post() cada 800ms   │ ──────────────────────────►  │
│  └──────────────────────────────┘   HTTP POST /data             │
│                                     localhost:3000               │
│   netsh portproxy                                               │
│  ┌──────────────────────────────┐                               │
│  │ 0.0.0.0:3000 → WSL2:3000    │                               │
│  └──────────────────────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  WSL2 — Node.js server.js (puerto 3000)                         │
│                                                                  │
│  ┌─────────────────────────────────────────────────────┐        │
│  │  POST /data  →  io.emit('biometricData', payload)   │        │
│  │  GET  /*     →  Next.js handler                     │        │
│  └─────────────────────────────────────────────────────┘        │
│                          │ Socket.io WebSocket                   │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  BROWSER — Next.js App                                           │
│                                                                  │
│  SocketProvider (useEffect)                                      │
│  └─► socket.on('biometricData') → Zustand store                 │
│                                                                  │
│  ┌────────────────────────────────────────────────────┐         │
│  │              useBiometricStore (Zustand)            │         │
│  │  heartRate · rmssd · rrInterval · sensorStatus     │         │
│  │  stressIndex                                        │         │
│  └──────┬───────────────┬───────────────┬─────────────┘         │
│         │               │               │                        │
│    MetricsPanel    StatusPanel     HeartScene + EcgWave          │
│    (BPM, RMSSD,   (estado sensor,  (Three.js / R3F,             │
│     RR interval)   arco de estrés)  animación por rrInterval)   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Flujo de Datos

### 1. Adquisición (Firmware MicroPython)

El sensor GY MAX30102 se comunica con la Pico mediante el protocolo **I2C** (dirección `0x57`, 100 kHz). Cada 10ms se lee el FIFO del sensor, que provee valores crudos de los fotodetectores IR y Rojo (ADC de 18 bits, ~4096 nA escala completa).

### 2. Procesamiento de Señal (MicroPython — `HRVProcessor`)

La señal IR cruda se procesa localmente en la Pico:

| Métrica | Método de cálculo |
|---|---|
| **BPM** | Detección de picos en buffer circular de 150 muestras. `60,000 / promedio(intervalos RR)` |
| **Intervalo RR** | Diferencia de timestamps entre picos consecutivos (ms) |
| **RMSSD** | Raíz cuadrada de la media de los cuadrados de diferencias sucesivas de RR |
| **Índice de estrés** | Función inversa del RMSSD (RMSSD alto → estrés bajo) en escala 1–10 |
| **sensorStatus** | `"active"` si 40 ≤ BPM ≤ 180, `"calibrating"` en otro caso |

**Parámetros del algoritmo:**
- `IR_FINGER_THRESHOLD = 3,000` — detección de contacto con dedo
- `MIN_PEAK_DISTANCE = 550 ms` — evita doble conteo de la muesca dicrótica
- `BUFFER_SIZE = 150` muestras para cálculo de media dinámica

### 3. Transmisión (USB Serial → HTTP)

La Pico imprime el payload JSON por `stdout` (USB CDC serial) cada 800ms:

```json
{
  "heartRate": 72,
  "rmssd": 45,
  "rrInterval": 833,
  "sensorStatus": "active",
  "stressIndex": 5
}
```

`serial_bridge.py` corre en Windows, lee cada línea del puerto COM y hace un **HTTP POST** a `localhost:3000/data`.

### 4. Distribución en tiempo real (Socket.io)

`server.js` recibe el POST en el endpoint `/data` y lo reemite inmediatamente a todos los clientes conectados mediante **Socket.io WebSocket** (`io.emit('biometricData', data)`).

### 5. Renderizado reactivo (React + Zustand)

`SocketProvider` escucha el evento `biometricData` y llama a `updateBiometrics()` del store Zustand. Los componentes suscritos se actualizan sin re-render completo del árbol React:

- **MetricsPanel**: valores numéricos en tiempo real
- **StatusPanel**: estado del sensor + arco SVG de estrés con transición CSS
- **HeartScene**: animación de escala (`useFrame`) sincronizada con `rrInterval`
- **EcgWave**: waveform PPG simulado en Canvas 2D, cadencia según `rrInterval`

---

## Estructura de Archivos Relevantes

```
hrv/
├── server.js                  # Servidor Node.js (HTTP + Socket.io)
├── serial_bridge.py           # Puente USB serial → HTTP (Windows)
├── main.py                    # Firmware MicroPython (Pico 2W)
├── max30102.py                # Driver I2C para GY MAX30102
├── public/
│   ├── models/heart.glb       # Modelo 3D del corazón
│   └── draco/                 # Decoder Draco (compresión GLTF, local)
└── src/
    ├── app/
    │   ├── layout.tsx          # Monta SocketProvider globalmente
    │   └── page.tsx            # Layout grid: header + 3 columnas + ECG
    ├── components/
    │   ├── SocketProvider.tsx  # Conexión Socket.io → Zustand
    │   ├── MetricsPanel.tsx    # Panel izquierdo: BPM, RMSSD, RR
    │   ├── StatusPanel.tsx     # Panel derecho: sensor status + arco estrés
    │   ├── HeartScene.tsx      # Canvas 3D con modelo GLB animado
    │   ├── SceneWrapper.tsx    # Dynamic import (ssr:false) para R3F
    │   └── EcgWave.tsx         # Canvas 2D: waveform ECG en tiempo real
    └── store/
        └── useBiometricStore.ts # Store Zustand + tipos TypeScript
```

---

## Protocolo I2C — GY MAX30102

| Parámetro | Valor |
|---|---|
| Dirección I2C | `0x57` |
| Frecuencia bus | 100 kHz |
| Pines Pico 2W | SDA → GP0 (pin 1), SCL → GP1 (pin 2) |
| Modo operación | SpO2 (LED Rojo + IR simultáneos) |
| Tasa de muestreo | 100 sps (sin promediado) |
| Ancho de pulso LED | 411 µs (ADC 18 bits) |
| Corriente LEDs | ~19 mA (registro `0x5F`) |

---

## Decisiones de Diseño Relevantes

**¿Por qué USB Serial en vez de WiFi para la entrega de Micros?**
La comunicación serial USB (CDC) es inherente al uso del microcontrolador y no depende de infraestructura de red. Permite demostrar el uso correcto del hardware de manera aislada y confiable.

**¿Por qué Zustand en vez de Context API de React?**
Los datos biométricos llegan a 1.25 Hz de forma continua. Zustand actualiza el store sin propagar re-renders a todo el árbol de componentes, lo que es crítico para mantener el framerate del canvas 3D.

**¿Por qué `useFrame` con `getState()` en vez de un hook de React?**
`useFrame` corre fuera del ciclo de render de React. Usar `useBiometricStore.getState()` directamente (sin hook) permite leer el valor más reciente sin suscribir el componente 3D al store, evitando remounts del Canvas en cada actualización.

**¿Por qué se copian los decoders Draco a `/public`?**
Los modelos exportados desde Sketchfab usan compresión Draco. `useGLTF` de drei carga el decoder desde un CDN de Google por defecto; en entornos sin internet estable esto causa pérdida del contexto WebGL. Al servir el decoder localmente se elimina esa dependencia.
