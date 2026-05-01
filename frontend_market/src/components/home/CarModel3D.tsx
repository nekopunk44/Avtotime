import React, { Suspense, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Center, OrbitControls, Stage } from '@react-three/drei';
import * as THREE from 'three';

useGLTF.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

const MODELS = [
  { path: '/auto/hoonicorn-compressed.glb', rotationSpeed: 0.22, adjustCamera: 0.75, environment: 'city' as const, intensity: 0.5, country: 'US' },
  { path: '/auto/lexus-compressed.glb',    rotationSpeed: 0.2,  adjustCamera: 0.75, environment: 'city' as const, intensity: 0.6, country: 'JP' },
  { path: '/auto/ford-compressed.glb',     rotationSpeed: 0.18, adjustCamera: 0.75, environment: 'city'  as const, intensity: 0.5, country: 'US' },
  { path: '/auto/mercedes-compressed.glb', rotationSpeed: 0.2,  adjustCamera: 0.7,  environment: 'city'  as const, intensity: 0.5, country: 'DE' },
];

function CarMesh({ path, rotationSpeed }: { path: string; rotationSpeed: number }) {
  const { scene } = useGLTF(path);
  const ref = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * rotationSpeed;
  });

  return (
    <group ref={ref}>
      <Center>
        <primitive object={scene} />
      </Center>
    </group>
  );
}

interface CarModel3DProps {
  onCountryChange?: (country: string) => void;
}

export const CarModel3D: React.FC<CarModel3DProps> = ({ onCountryChange }) => {
  const [index, setIndex] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const switchTo = (nextIndex: number) => {
    setOpacity(0);
    setTimeout(() => {
      setIndex(nextIndex);
      setOpacity(1);
    }, 400);
  };

  const resetTimer = (nextIndex?: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % MODELS.length;
        setOpacity(0);
        setTimeout(() => setOpacity(1), 400);
        return next;
      });
    }, 20000);
    if (nextIndex !== undefined) switchTo(nextIndex);
  };

  useEffect(() => {
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    onCountryChange?.(MODELS[index].country);
  }, [index, onCountryChange]);

  const current = MODELS[index];

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', opacity, transition: 'opacity 0.4s ease' }}>
      <Canvas
        camera={{ position: [0, 1, 5], fov: 45 }}
        style={{ width: '100%', height: '100%' }}
        gl={{ alpha: true, antialias: false, powerPreference: 'high-performance' }}
        dpr={[1, 1.25]}
      >
        <Suspense fallback={null}>
          <Stage
            key={current.path}
            environment={current.environment}
            intensity={current.intensity}
            shadows={false}
            adjustCamera={current.adjustCamera}
          >
            <CarMesh path={current.path} rotationSpeed={current.rotationSpeed} />
          </Stage>
        </Suspense>

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2.2}
        />
      </Canvas>

      <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
        <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-black/65 px-3 py-2 text-white shadow-lg backdrop-blur-sm">
          {MODELS.map((model, modelIndex) => (
            <button
              key={model.path}
              type="button"
              onClick={() => resetTimer(modelIndex)}
              className={`h-2.5 w-2.5 rounded-full transition-all ${
                modelIndex === index ? 'bg-white' : 'bg-white/35 hover:bg-white/60'
              }`}
              aria-label={`Показать 3D модель ${modelIndex + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
