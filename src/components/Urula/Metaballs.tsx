import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MarchingCubes, MarchingCube, Environment } from '@react-three/drei';
import * as THREE from 'three';
import type { DNA } from '../../types/dna';

/**
 * Map DNA to visual parameters for Urula metaballs
 */
function dnaToVisualParams(dna: DNA) {
  // Isolation: controls boundary hardness (minimal_maximal)
  // -1 (minimal) -> lower isolation (60) = harder edges
  // +1 (maximal) -> higher isolation (90) = softer, more merged
  const isolation = THREE.MathUtils.lerp(60, 90, (dna.minimal_maximal + 1) / 2);

  // Strength: controls volume (oversized_fitted)
  // -1 (oversized) -> higher strength (+0.2)
  // +1 (fitted) -> lower strength (-0.2)
  const strengthDelta = THREE.MathUtils.lerp(0.2, -0.2, (dna.oversized_fitted + 1) / 2);

  // Roughness: surface finish (relaxed_tailored)
  // -1 (relaxed) -> higher roughness (0.22)
  // +1 (tailored) -> lower roughness (0.06)
  const roughness = THREE.MathUtils.lerp(0.22, 0.06, (dna.relaxed_tailored + 1) / 2);

  // Metalness & envMapIntensity: luxury vs street
  // -1 (street) -> low metalness (0.02), low envMap (0.7)
  // +1 (luxury) -> higher metalness (0.08), higher envMap (1.5)
  const metalness = THREE.MathUtils.lerp(0.02, 0.08, (dna.street_luxury + 1) / 2);
  const envMapIntensity = THREE.MathUtils.lerp(0.7, 1.5, (dna.street_luxury + 1) / 2);

  // Rim light strength (tailored = more defined edges)
  const rimStrength = THREE.MathUtils.lerp(0.3, 0.6, (dna.relaxed_tailored + 1) / 2);

  // Color from DNA hue/sat/light
  const hslColor = new THREE.Color();
  hslColor.setHSL(dna.hue, dna.sat, dna.light);

  return {
    isolation,
    strengthDelta,
    roughness,
    metalness,
    envMapIntensity,
    rimStrength,
    baseColor: hslColor,
  };
}

interface MetaballsProps {
  dna: DNA;
}

function MetaballsInner({ dna }: MetaballsProps) {
  const visualParams = useMemo(() => dnaToVisualParams(dna), [dna]);
  const meshRef = useRef<THREE.Mesh>(null);

  // Animate metaballs slightly for "breathing" effect
  useFrame((state) => {
    if (meshRef.current) {
      const time = state.clock.elapsedTime;
      meshRef.current.rotation.y = Math.sin(time * 0.2) * 0.1;
    }
  });

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={0.6} />
      <pointLight position={[-5, 2, -5]} intensity={0.3} />

      <MarchingCubes
        ref={meshRef}
        resolution={64}
        maxPolyCount={20000}
        isolation={visualParams.isolation}
      >
        {/* Core ball */}
        <MarchingCube
          strength={0.5 + visualParams.strengthDelta}
          subtract={0}
          position={[0, 0, 0]}
        />

        {/* Orbiting satellites for variety */}
        <MarchingCube
          strength={0.3 + visualParams.strengthDelta * 0.5}
          subtract={0}
          position={[0.8, 0.5, 0]}
        />
        <MarchingCube
          strength={0.25 + visualParams.strengthDelta * 0.5}
          subtract={0}
          position={[-0.6, -0.4, 0.3]}
        />
        <MarchingCube
          strength={0.2 + visualParams.strengthDelta * 0.5}
          subtract={0}
          position={[0.2, -0.7, -0.4]}
        />

        <meshStandardMaterial
          color={visualParams.baseColor}
          roughness={visualParams.roughness}
          metalness={visualParams.metalness}
          envMapIntensity={visualParams.envMapIntensity}
        />
      </MarchingCubes>

      <Environment preset="studio" />
    </>
  );
}

/**
 * Urula: DNA-driven metaballs organism
 * Visualizes fashion DNA as a living, breathing entity
 */
export function UrulaMetaballs({ dna }: MetaballsProps) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        gl={{ alpha: true, antialias: true }}
        camera={{ position: [0, 0, 5], fov: 50 }}
        style={{ background: 'transparent' }}
      >
        <color attach="background" args={['#00000000']} />
        <MetaballsInner dna={dna} />
      </Canvas>
    </div>
  );
}
