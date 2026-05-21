'use client';

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useBiometricStore } from '@/store/useBiometricStore';

function HeartMesh() {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current || !glowRef.current) return;

    const { rrInterval } = useBiometricStore.getState();
    const interval = Math.max(rrInterval, 300);
    const t = ((clock.getElapsedTime() * 1000) % interval) / interval;

    // Impulso rápido al inicio de cada ciclo, decae suavemente
    const pulse = Math.exp(-t * 9) * Math.sin(t * Math.PI * 3.5) * 0.22;
    const scale = 1 + pulse;

    meshRef.current.scale.setScalar(scale);
    glowRef.current.scale.setScalar(scale * 1.18);

    // Rotación lenta constante
    meshRef.current.rotation.y += 0.004;
    glowRef.current.rotation.y += 0.004;
  });

  return (
    <group>
      {/* Halo exterior translúcido */}
      <mesh ref={glowRef}>
        <icosahedronGeometry args={[1.5, 1]} />
        <meshStandardMaterial
          color="#fb7185"
          emissive="#e11d48"
          emissiveIntensity={0.6}
          transparent
          opacity={0.08}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Malla principal */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1.5, 1]} />
        <meshStandardMaterial
          color="#e11d48"
          emissive="#9f1239"
          emissiveIntensity={0.5}
          roughness={0.25}
          metalness={0.55}
          wireframe={false}
        />
      </mesh>

      {/* Capa wireframe encima */}
      <mesh>
        <icosahedronGeometry args={[1.52, 1]} />
        <meshBasicMaterial color="#fb7185" wireframe transparent opacity={0.12} />
      </mesh>
    </group>
  );
}

export default function HeartScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5.5], fov: 42 }}
      gl={{ antialias: true }}
      dpr={[1, 2]}
    >
      <color attach="background" args={['#09090b']} />
      <fog attach="fog" args={['#09090b', 8, 20]} />

      <ambientLight intensity={0.25} />
      <pointLight position={[4, 4, 4]} intensity={30} color="#ff4d6d" />
      <pointLight position={[-4, -3, -4]} intensity={15} color="#818cf8" />
      <pointLight position={[0, -4, 2]} intensity={10} color="#fb923c" />

      <HeartMesh />

      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={(Math.PI * 3) / 4}
        autoRotate={false}
      />
    </Canvas>
  );
}
