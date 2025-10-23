import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber';
import { MarchingCubes, MarchingCube, Environment, Bounds, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { DNA } from '../../types/dna';

type Ball = { base: [number, number, number]; phase: number; color: THREE.Color };

interface AnimatedCubesProps {
  animated: boolean;
  impactStrength: number;
}

/**
 * Animated metaballs with breathing and wave motion
 * Based on commit 82257b99 (before evolution system)
 * Added: impact animation on click/tap
 */
function AnimatedCubes({ animated, impactStrength }: AnimatedCubesProps) {
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

  // Breathing and wave animation with impact
  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;

    const t = clock.getElapsedTime() * 0.4;
    const a = animated ? 1 : 0;

    // Breathing pulsation effect
    const breathingCycle = clock.getElapsedTime() * 0.3;
    const breathingScale = 1 + Math.sin(breathingCycle) * 0.12;

    // Gentle horizontal rotation (user can rotate freely with OrbitControls)
    groupRef.current.rotation.y = Math.sin(t * 0.5) * 0.1;

    // Impact scale pulse - gentler expansion (0.1 instead of 0.2)
    const impactScale = 1 + impactStrength * 0.1;
    groupRef.current.scale.setScalar(impactScale * breathingScale);

    balls.forEach((ball, i) => {
      const child = groupRef.current!.children[i];
      if (!child) return;

      // Wave motion
      const baseX = ball.base[0] + a * (Math.sin(t * 1.2 + ball.phase) * 0.30 + Math.sin(t * 0.35 + i) * 0.05);
      const baseY = ball.base[1] + a * (Math.cos(t * 0.9 + ball.phase + 1.0) * 0.28 + Math.cos(t * 0.31 + i * 1.7) * 0.05);
      const baseZ = ball.base[2] + a * (Math.sin(t * 0.7 + ball.phase + 2.0) * 0.22 + Math.sin(t * 0.27 + i * 0.7) * 0.04);

      // Apply breathing effect
      child.position.x = baseX;
      child.position.y = baseY;
      child.position.z = baseZ;
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
 * Added: OrbitControls for free rotation + click/tap impact
 */
function MetaballsBreathingInner({ dna, animated = true }: MetaballsBreathingProps) {
  const [impactStrength, setImpactStrength] = useState(0);
  const impactRef = useRef(0);

  // Click/tap handler - trigger impact animation
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    // Gradual ramp up instead of instant jump
    if (impactRef.current < 0.5) {
      impactRef.current = 0.5; // Gentler impact strength
    }
  };

  // Decay impact strength over time with smooth interpolation
  useFrame((state, delta) => {
    // Smoothly ramp up to target
    const targetImpact = impactRef.current;
    const currentImpact = impactStrength;
    const newImpact = currentImpact + (targetImpact - currentImpact) * delta * 5;

    // Strong decay for smooth return
    if (impactRef.current > 0) {
      impactRef.current = Math.max(0, impactRef.current - delta * 0.8); // Much slower decay
      setImpactStrength(newImpact);
    }
  });

  return (
    <group>
      <ambientLight intensity={1} />

      <MarchingCubes
        resolution={80}
        maxPolyCount={60000}
        enableUvs={false}
        enableColors
        onClick={handleClick}
      >
        {/* meshStandardMaterial with vertexColors - same as 82257b99 */}
        <meshStandardMaterial
          vertexColors
          roughness={0}
          metalness={0}
        />

        <AnimatedCubes animated={animated} impactStrength={impactStrength} />
      </MarchingCubes>

      {/* HDRI environment for realistic lighting - same as reference */}
      <Environment files="https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/industrial_workshop_foundry_1k.hdr" />

      {/* OrbitControls for interactive 3D rotation - same as commit 6551cf5a */}
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        rotateSpeed={0.5}
        minPolarAngle={0}
        maxPolarAngle={Math.PI}
      />

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
          gl={{ alpha: true }}
          style={{ background: 'transparent' }}
        >
          <MetaballsBreathingInner dna={dna} animated={animated} />
        </Canvas>
      </div>
    );
  }
);

MetaballsBreathing.displayName = 'MetaballsBreathing';
