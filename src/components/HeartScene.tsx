'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Center } from '@react-three/drei';
import * as THREE from 'three';
import { useBiometricStore } from '@/store/useBiometricStore';

function HeartMesh() {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef  = useRef<THREE.Mesh>(null);
  const { scene } = useGLTF('/models/heart.glb');

  // Normaliza el modelo a ~2.5 unidades sin importar las unidades del GLB original
  const autoScale = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    return maxDim > 0 ? 2.5 / maxDim : 1;
  }, [scene]);

  useFrame(({ clock }) => {
    if (!groupRef.current || !glowRef.current) return;

    const { rrInterval } = useBiometricStore.getState();
    const interval = Math.max(rrInterval, 300);
    const t = ((clock.getElapsedTime() * 1000) % interval) / interval;

    const pulse = Math.exp(-t * 9) * Math.sin(t * Math.PI * 3.5) * 0.22;
    const scale = 1 + pulse;

    groupRef.current.scale.setScalar(scale);
    glowRef.current.scale.setScalar(scale * 1.25);
    groupRef.current.rotation.y += 0.004;
    glowRef.current.rotation.y += 0.004;
  });

  return (
    <group>
      {/* Halo atmosférico */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[1.6, 32, 32]} />
        <meshStandardMaterial
          color="#ff1a40"
          emissive="#e11d48"
          emissiveIntensity={0.8}
          transparent
          opacity={0.07}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Modelo real */}
      <group ref={groupRef}>
        <Center>
          <primitive object={scene} scale={autoScale} />
        </Center>
      </group>
    </group>
  );
}

useGLTF.preload('/models/heart.glb');

export default function HeartScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5.5], fov: 42 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      dpr={1}
    >
      <color attach="background" args={['#04040a']} />
      <fog attach="fog" args={['#04040a', 10, 25]} />

      <ambientLight intensity={1.2} />
      <directionalLight position={[4, 6, 4]}    intensity={2}   color="#ff3355" />
      <directionalLight position={[-4, -2, -4]} intensity={1}   color="#6366f1" />
      <pointLight       position={[0, 4, 2]}    intensity={8}   color="#ff6680" />

      <HeartMesh />

      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={(Math.PI * 3) / 4}
      />
    </Canvas>
  );
}
