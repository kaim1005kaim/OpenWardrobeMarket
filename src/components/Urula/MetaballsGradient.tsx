import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MarchingCubes, MarchingCube, Environment, Bounds } from '@react-three/drei';
import * as THREE from 'three';
import type { DNA } from '../../types/dna';

/**
 * Animated metaball with color
 * Moves gently with subtle floating motion (no physics)
 */
function MetaBall({
  color,
  position,
  strength = 0.35,
  speed = 1
}: {
  color: string;
  position: [number, number, number];
  strength?: number;
  speed?: number;
}) {
  const colorObj = useMemo(() => new THREE.Color(color), [color]);

  return (
    <group position={position}>
      <MarchingCube strength={strength} subtract={6} color={colorObj} />
    </group>
  );
}

interface MetaballsGradientProps {
  dna: DNA;
  animated?: boolean;
}

/**
 * Gradient metaballs with smooth color transitions
 * Based on reference code - exact reproduction without physics
 */
function MetaballsGradientInner({ dna, animated = true }: MetaballsGradientProps) {
  return (
    <group>
      <ambientLight intensity={1} />

      <MarchingCubes resolution={80} maxPolyCount={10000} enableUvs={false} enableColors>
        {/* meshStandardMaterial with vertexColors for gradient effect - same as reference */}
        <meshStandardMaterial
          vertexColors
          roughness={0}
          metalness={0}
        />

        {/* 6 metaballs - exact same positions and colors as reference code */}
        <MetaBall color="indianred" position={[1, 1, 0.5]} strength={0.35} />
        <MetaBall color="skyblue" position={[-1, -1, -0.5]} strength={0.35} />
        <MetaBall color="teal" position={[2, 2, 0.5]} strength={0.35} />
        <MetaBall color="orange" position={[-2, -2, -0.5]} strength={0.35} />
        <MetaBall color="hotpink" position={[3, 3, 0.5]} strength={0.35} />
        <MetaBall color="aquamarine" position={[-3, -3, -0.5]} strength={0.35} />
      </MarchingCubes>

      {/* HDRI environment for realistic lighting - same as reference */}
      <Environment files="https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/industrial_workshop_foundry_1k.hdr" />

      {/* Bounds to fit viewport - same as reference */}
      <Bounds fit clip observe margin={1}>
        <mesh visible={false}>
          <boxGeometry />
        </mesh>
      </Bounds>
    </group>
  );
}

/**
 * Gradient metaballs organism
 * Smooth color transitions with beautiful gradients
 * Exact reproduction of reference code visual
 */
export const MetaballsGradient = React.forwardRef<any, MetaballsGradientProps>(
  ({ dna, animated = true }, ref) => {
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0, 0, 5], fov: 25 }}
        >
          {/* Background color - same as reference */}
          <color attach="background" args={['#f0f0f0']} />
          <MetaballsGradientInner dna={dna} animated={animated} />
        </Canvas>
      </div>
    );
  }
);
