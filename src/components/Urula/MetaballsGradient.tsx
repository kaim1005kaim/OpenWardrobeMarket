import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MarchingCubes, MarchingCube, Environment, Bounds } from '@react-three/drei';
import * as THREE from 'three';
import type { DNA } from '../../types/dna';

/**
 * Animated metaball with color
 * Moves in a circular/orbital pattern without physics
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
  const ref = useRef<any>();
  const offset = useMemo(() => Math.random() * Math.PI * 2, []);
  const colorObj = useMemo(() => new THREE.Color(color), [color]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime() * speed + offset;

    // Circular motion around initial position
    ref.current.position.x = position[0] + Math.sin(t * 0.5) * 0.3;
    ref.current.position.y = position[1] + Math.cos(t * 0.7) * 0.3;
    ref.current.position.z = position[2] + Math.sin(t * 0.3) * 0.2;
  });

  return (
    <group ref={ref} position={position}>
      <MarchingCube strength={strength} subtract={6} color={colorObj} />
    </group>
  );
}

/**
 * Pointer-following metaball
 */
function Pointer({ color = 'orange' }: { color?: string }) {
  const ref = useRef<any>();
  const colorObj = useMemo(() => new THREE.Color(color), [color]);

  useFrame(({ pointer, viewport }) => {
    if (!ref.current) return;
    const { width, height } = viewport.getCurrentViewport();
    ref.current.position.x = pointer.x * (width / 2);
    ref.current.position.y = pointer.y * (height / 2);
  });

  return (
    <group ref={ref}>
      <MarchingCube strength={0.5} subtract={10} color={colorObj} />
    </group>
  );
}

interface MetaballsGradientProps {
  dna: DNA;
  animated?: boolean;
}

/**
 * Gradient metaballs with smooth color transitions
 * Based on reference code - physics-free version
 */
function MetaballsGradientInner({ dna, animated = true }: MetaballsGradientProps) {
  // Extract colors from DNA
  const baseColor = useMemo(() => {
    const color = new THREE.Color();
    color.setHSL(dna.hue, dna.sat, dna.light);
    return color;
  }, [dna.hue, dna.sat, dna.light]);

  // Generate 6 metaballs with color variations
  const metaballs = useMemo(() => {
    const colors = [
      'indianred',
      'skyblue',
      'teal',
      'orange',
      'hotpink',
      'aquamarine'
    ];

    const positions: [number, number, number][] = [
      [1, 1, 0.5],
      [-1, -1, -0.5],
      [2, 2, 0.5],
      [-2, -2, -0.5],
      [3, 3, 0.5],
      [-3, -3, -0.5]
    ];

    return colors.map((color, i) => ({
      color,
      position: positions[i],
      strength: 0.35,
      speed: 0.5 + Math.random() * 0.5
    }));
  }, []);

  return (
    <group>
      <ambientLight intensity={1} />

      <MarchingCubes resolution={80} maxPolyCount={10000} enableUvs={false} enableColors>
        {/* meshStandardMaterial with vertexColors for gradient effect */}
        <meshStandardMaterial
          vertexColors
          roughness={0}
          metalness={0}
        />

        {/* Animated metaballs */}
        {metaballs.map((ball, i) => (
          <MetaBall
            key={i}
            color={ball.color}
            position={ball.position}
            strength={ball.strength}
            speed={animated ? ball.speed : 0}
          />
        ))}

        {/* Pointer-following metaball */}
        <Pointer color="orange" />
      </MarchingCubes>

      {/* HDRI environment for realistic lighting */}
      <Environment files="https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/industrial_workshop_foundry_1k.hdr" />

      {/* Bounds to fit viewport */}
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
 */
export const MetaballsGradient = React.forwardRef<any, MetaballsGradientProps>(
  ({ dna, animated = true }, ref) => {
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0, 0, 5], fov: 25 }}
          gl={{ alpha: true, antialias: true }}
          style={{ background: '#f0f0f0' }}
        >
          <MetaballsGradientInner dna={dna} animated={animated} />
        </Canvas>
      </div>
    );
  }
);
