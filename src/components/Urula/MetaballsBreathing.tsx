import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MarchingCubes, MarchingCube, Environment, Bounds } from '@react-three/drei';
import * as THREE from 'three';
import type { DNA } from '../../types/dna';

type Ball = { base: [number, number, number]; phase: number; color: THREE.Color };

interface AnimatedCubesProps {
  animated: boolean;
}

/**
 * Animated metaballs with breathing and wave motion
 * Based on commit 82257b99 (before evolution system)
 */
function AnimatedCubes({ animated }: AnimatedCubesProps) {
  // 7 metaballs with reference code colors
  const balls = useMemo<Ball[]>(() => {
    const colors = [
      'indianred',
      'skyblue',
      'teal',
      'orange',
      'hotpink',
      'aquamarine',
      '#F5F5F0' // Milky white for center
    ];

    const positions: [number, number, number][] = [
      [0.00, 0.00, 0.00],   // center
      [0.05, 0.03, 0.02],   // right-top-front
      [-0.04, -0.02, 0.03], // left-bottom-front
      [0.03, -0.04, -0.02], // right-bottom-back
      [-0.06, 0.05, 0.00],  // left-top
      [0.06, 0.00, 0.04],   // right-front
      [0.00, -0.06, -0.03], // bottom-back
    ];

    return positions.map((p, i) => ({
      base: p,
      phase: Math.random() * Math.PI * 2 + i,
      color: new THREE.Color(colors[i])
    }));
  }, []);

  const groupRef = useRef<THREE.Group>(null);

  // Breathing and wave animation
  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    const t = clock.getElapsedTime() * 0.4;
    const a = animated ? 1 : 0;

    // Breathing pulsation effect
    const breathingCycle = clock.getElapsedTime() * 0.3;
    const breathingScale = 1 + Math.sin(breathingCycle) * 0.12;

    balls.forEach((ball, i) => {
      const child = groupRef.current!.children[i];
      if (!child) return;

      // Wave motion
      const baseX = ball.base[0] + a * (Math.sin(t * 1.2 + ball.phase) * 0.30 + Math.sin(t * 0.35 + i) * 0.05);
      const baseY = ball.base[1] + a * (Math.cos(t * 0.9 + ball.phase + 1.0) * 0.28 + Math.cos(t * 0.31 + i * 1.7) * 0.05);
      const baseZ = ball.base[2] + a * (Math.sin(t * 0.7 + ball.phase + 2.0) * 0.22 + Math.sin(t * 0.27 + i * 0.7) * 0.04);

      // Apply breathing effect
      child.position.x = baseX * breathingScale;
      child.position.y = baseY * breathingScale;
      child.position.z = baseZ * breathingScale;
    });
  });

  return (
    <group ref={groupRef}>
      {balls.map((ball, i) => (
        <group key={i} position={ball.base}>
          <MarchingCube strength={0.35} subtract={6} color={ball.color} />
        </group>
      ))}
    </group>
  );
}

interface MetaballsBreathingProps {
  dna: DNA;
  animated?: boolean;
}

/**
 * Breathing metaballs organism
 * Combines commit 82257b99's animation with reference code's colors
 */
function MetaballsBreathingInner({ dna, animated = true }: MetaballsBreathingProps) {
  return (
    <group>
      <ambientLight intensity={1} />

      <MarchingCubes resolution={80} maxPolyCount={60000} enableUvs={false} enableColors>
        {/* meshStandardMaterial with vertexColors - same as 82257b99 */}
        <meshStandardMaterial
          vertexColors
          roughness={0}
          metalness={0}
        />

        <AnimatedCubes animated={animated} />
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
 * Breathing metaballs with beautiful gradients
 * No evolution, no palette - just beautiful animated reference colors
 */
export const MetaballsBreathing = React.forwardRef<any, MetaballsBreathingProps>(
  ({ dna, animated = true }, ref) => {
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0, 0, 5], fov: 25 }}
        >
          {/* Background color - same as reference */}
          <color attach="background" args={['#f0f0f0']} />
          <MetaballsBreathingInner dna={dna} animated={animated} />
        </Canvas>
      </div>
    );
  }
);

MetaballsBreathing.displayName = 'MetaballsBreathing';
