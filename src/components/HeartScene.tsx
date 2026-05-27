'use client';

import { useRef, useMemo, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Center } from '@react-three/drei';
import * as THREE from 'three';
import { useBiometricStore } from '@/store/useBiometricStore';

// ── Luces animadas ────────────────────────────────────────────────────────────
function AnimatedLights() {
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const dir1Ref    = useRef<THREE.DirectionalLight>(null);
  const dir2Ref    = useRef<THREE.DirectionalLight>(null);
  const pointRef   = useRef<THREE.PointLight>(null);

  useFrame((_, delta) => {
    const { sensorStatus } = useBiometricStore.getState();
    const dimmed = sensorStatus === 'no_signal';
    const speed  = delta * 2;

    if (ambientRef.current)
      ambientRef.current.intensity = THREE.MathUtils.lerp(ambientRef.current.intensity, dimmed ? 0.20 : 1.0,  speed);
    if (dir1Ref.current)
      dir1Ref.current.intensity    = THREE.MathUtils.lerp(dir1Ref.current.intensity,    dimmed ? 0.25 : 1.8,  speed);
    if (dir2Ref.current)
      dir2Ref.current.intensity    = THREE.MathUtils.lerp(dir2Ref.current.intensity,    dimmed ? 0.10 : 0.9,  speed);
    if (pointRef.current)
      pointRef.current.intensity   = THREE.MathUtils.lerp(pointRef.current.intensity,   dimmed ? 0.30 : 3.0,  speed);
  });

  return (
    <>
      <ambientLight     ref={ambientRef} intensity={1.0} />
      <directionalLight ref={dir1Ref}    position={[3, 5, 4]}   intensity={1.8} color="#fff4f0" />
      <directionalLight ref={dir2Ref}    position={[-4, 1, -2]} intensity={0.9} color="#a0aaff" />
      <pointLight       ref={pointRef}   position={[0, -3, 3]}  intensity={3.0} color="#ff3355" />
    </>
  );
}

// ── Modelo 3D ─────────────────────────────────────────────────────────────────
function HeartMesh() {
  const groupRef  = useRef<THREE.Group>(null);
  const baseScale = useRef(1.0);   // transición suave de escala base
  const rotSpeed  = useRef(0.004); // transición suave de velocidad de rotación
  const { scene } = useGLTF('/models/heart.glb');

  const autoScale = useMemo(() => {
    const box  = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    return maxDim > 0 ? 3.2 / maxDim : 1;
  }, [scene]);

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;
    const { rrInterval, heartRate, sensorStatus } = useBiometricStore.getState();
    const lerpSpeed = delta * 2.5;

    if (sensorStatus === 'no_signal') {
      // Encoger y detener rotación
      baseScale.current = THREE.MathUtils.lerp(baseScale.current, 0.80, lerpSpeed);
      rotSpeed.current  = THREE.MathUtils.lerp(rotSpeed.current,  0,    lerpSpeed);
      groupRef.current.scale.setScalar(baseScale.current);
      groupRef.current.rotation.y += rotSpeed.current;
      return;
    }

    // Calibrando o sin datos: tamaño normal, giro lento
    baseScale.current = THREE.MathUtils.lerp(baseScale.current, 1.0, lerpSpeed);

    if (sensorStatus === 'calibrating' || heartRate === 0) {
      rotSpeed.current = THREE.MathUtils.lerp(rotSpeed.current, 0.008, lerpSpeed);
      groupRef.current.scale.setScalar(baseScale.current);
      groupRef.current.rotation.y += rotSpeed.current;
      return;
    }

    // Activo: pulso cardíaco
    const interval = Math.max(rrInterval, 300);
    const t        = ((clock.getElapsedTime() * 1000) % interval) / interval;
    const pulse    = Math.exp(-t * 9) * Math.sin(t * Math.PI * 3.5) * 0.22;
    rotSpeed.current = THREE.MathUtils.lerp(rotSpeed.current, 0.004, lerpSpeed);
    groupRef.current.scale.setScalar(baseScale.current * (1 + pulse));
    groupRef.current.rotation.y += rotSpeed.current;
  });

  return (
    <group ref={groupRef}>
      <Center>
        <primitive object={scene} scale={autoScale} />
      </Center>
    </group>
  );
}

useGLTF.setDecoderPath('/draco/');
useGLTF.preload('/models/heart.glb');

// ── Overlay calibración ───────────────────────────────────────────────────────
function CalibrationOverlay() {
  const sensorStatus           = useBiometricStore((s) => s.sensorStatus);
  const calibrationRemainingMs = useBiometricStore((s) => s.calibrationRemainingMs);

  if (sensorStatus !== 'calibrating') return null;

  const secs = calibrationRemainingMs != null
    ? Math.ceil(calibrationRemainingMs / 1000)
    : null;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div
        className="flex flex-col items-center gap-3 px-8 py-6 rounded-2xl"
        style={{
          background: 'rgba(8,6,12,0.75)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(251,146,60,0.22)',
          boxShadow: '0 0 48px rgba(251,146,60,0.07)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: '#fb923c', boxShadow: '0 0 8px #fb923c' }}
          />
          <span className="text-[10px] font-bold tracking-[0.35em] text-orange-400/70 uppercase">
            Calibrando
          </span>
        </div>

        {secs !== null ? (
          <span
            className="font-mono font-black tabular-nums leading-none"
            style={{
              fontSize: '3rem',
              color: '#fb923c',
              textShadow: '0 0 24px rgba(251,146,60,0.45)',
            }}
          >
            {secs}s
          </span>
        ) : (
          <span className="text-[10px] text-white/30 tracking-wider">
            Buscando latidos estables…
          </span>
        )}

        <p className="text-[10px] text-white/22 tracking-wider text-center">
          Mantén el dedo quieto sobre el sensor
        </p>
      </div>
    </div>
  );
}

// ── Escena principal ──────────────────────────────────────────────────────────
export default function HeartScene() {
  const [canvasKey, setCanvasKey] = useState(0);

  const handleCreated = useCallback(({ gl }: { gl: THREE.WebGLRenderer }) => {
    gl.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      setTimeout(() => setCanvasKey((k) => k + 1), 800);
    }, false);
  }, []);

  return (
    <div className="relative w-full h-full">
      <Canvas
        key={canvasKey}
        camera={{ position: [0, 0, 5.5], fov: 42 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        dpr={1}
        onCreated={handleCreated}
      >
        <color attach="background" args={['#04040a']} />
        <fog attach="fog" args={['#04040a', 10, 25]} />

        <AnimatedLights />
        <HeartMesh />

        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={2.5}
          maxDistance={10}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={(Math.PI * 3) / 4}
        />
      </Canvas>

      <CalibrationOverlay />
    </div>
  );
}
