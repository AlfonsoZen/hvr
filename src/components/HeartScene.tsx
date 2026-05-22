'use client';

import { useRef, useMemo, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Center } from '@react-three/drei';
import * as THREE from 'three';
import { useBiometricStore } from '@/store/useBiometricStore';

function HeartMesh() {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF('/models/heart.glb');

  const autoScale = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    return maxDim > 0 ? 3.2 / maxDim : 1;
  }, [scene]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const { rrInterval, heartRate } = useBiometricStore.getState();

    if (heartRate === 0) {
      groupRef.current.scale.setScalar(1);
      groupRef.current.rotation.y += 0.001;
      return;
    }

    const interval = Math.max(rrInterval, 300);
    const t = ((clock.getElapsedTime() * 1000) % interval) / interval;
    const pulse = Math.exp(-t * 9) * Math.sin(t * Math.PI * 3.5) * 0.22;
    groupRef.current.scale.setScalar(1 + pulse);
    groupRef.current.rotation.y += 0.004;
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

export default function HeartScene() {
  const [canvasKey, setCanvasKey] = useState(0);

  const handleCreated = useCallback(({ gl }: { gl: THREE.WebGLRenderer }) => {
    gl.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      setTimeout(() => setCanvasKey((k) => k + 1), 800);
    }, false);
  }, []);

  return (
    <Canvas
      key={canvasKey}
      camera={{ position: [0, 0, 5.5], fov: 42 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      dpr={1}
      onCreated={handleCreated}
    >
      <color attach="background" args={['#04040a']} />
      <fog attach="fog" args={['#04040a', 10, 25]} />

      <ambientLight intensity={1.0} />
      <directionalLight position={[3, 5, 4]}   intensity={1.8} color="#fff4f0" />
      <directionalLight position={[-4, 1, -2]} intensity={0.9} color="#a0aaff" />
      <pointLight       position={[0, -3, 3]}  intensity={3.0} color="#ff3355" />

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
  );
}
