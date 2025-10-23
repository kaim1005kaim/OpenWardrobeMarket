import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { MarchingCubes, MarchingCube, Environment, Bounds } from '@react-three/drei';
import * as THREE from 'three';
import type { DNA } from '../../types/dna';

type Ball = { base: [number, number, number]; phase: number; color: THREE.Color };

interface AnimatedCubesProps {
  animated: boolean;
  impactStrength: number;
  targetRotation: { x: number; y: number };
}

/**
 * Animated metaballs with breathing and wave motion
 * Based on commit 82257b99 (before evolution system)
 * Added: impact animation on click/tap
 */
function AnimatedCubes({ animated, impactStrength, targetRotation }: AnimatedCubesProps) {
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
      [0.045, 0.025, 0.017],  // right-top-front
      [-0.035, -0.018, 0.023], // left-bottom-front
      [0.025, -0.035, -0.017], // right-bottom-back
      [-0.045, 0.04, 0.00],  // left-top
      [0.05, 0.00, 0.033],   // right-front
      [0.00, -0.05, -0.023], // bottom-back
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

    // Apply user rotation from drag
    groupRef.current.rotation.x = targetRotation.x;
    groupRef.current.rotation.y = targetRotation.y + Math.sin(t * 0.5) * 0.1; // Add gentle automatic rotation

    // Impact scale pulse - stronger expansion with viscous feel
    const impactScale = 1 + impactStrength * 0.25; // Stronger expansion: 0.25 (was 0.1)
    groupRef.current.scale.setScalar(impactScale * breathingScale);

    balls.forEach((ball, i) => {
      const child = groupRef.current!.children[i];
      if (!child) return;

      // Wave motion - slightly relaxed
      const baseX = ball.base[0] + a * (Math.sin(t * 1.2 + ball.phase) * 0.23 + Math.sin(t * 0.35 + i) * 0.04);
      const baseY = ball.base[1] + a * (Math.cos(t * 0.9 + ball.phase + 1.0) * 0.21 + Math.cos(t * 0.31 + i * 1.7) * 0.04);
      const baseZ = ball.base[2] + a * (Math.sin(t * 0.7 + ball.phase + 2.0) * 0.17 + Math.sin(t * 0.27 + i * 0.7) * 0.03);

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
  const isDragging = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const rotationVelocity = useRef({ x: 0, y: 0 });
  const targetRotation = useRef({ x: 0, y: 0 });

  const { size, gl } = useThree();

  // Click/tap handler - trigger impact animation with stronger action
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    // Stronger impact with sticky overshoot
    impactRef.current = 1.2; // Stronger initial impact
  };

  // Mouse/touch event handlers for rotation
  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    isDragging.current = true;
    previousMousePosition.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (!isDragging.current) return;

    const deltaX = event.clientX - previousMousePosition.current.x;
    const deltaY = event.clientY - previousMousePosition.current.y;

    rotationVelocity.current.y = deltaX * 0.015;
    rotationVelocity.current.x = deltaY * 0.015;

    previousMousePosition.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  React.useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerUp);

    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [gl]);

  // Decay impact strength over time with sticky, viscous motion
  useFrame((state, delta) => {
    // Smoothly ramp up to target with elastic easing
    const targetImpact = impactRef.current;
    const currentImpact = impactStrength;

    // Faster ramp up for stronger action
    const newImpact = currentImpact + (targetImpact - currentImpact) * delta * 8;

    // Moderate decay for sticky feel with stronger return force
    if (impactRef.current > 0) {
      impactRef.current = Math.max(0, impactRef.current - delta * 0.7); // Slightly faster decay for stronger return
      setImpactStrength(newImpact);
    }

    // Apply rotation velocity with damping
    targetRotation.current.x += rotationVelocity.current.x;
    targetRotation.current.y += rotationVelocity.current.y;

    // Damping
    rotationVelocity.current.x *= 0.95;
    rotationVelocity.current.y *= 0.95;
  });

  return (
    <group position={[0, 0, 0]}>
      <ambientLight intensity={1} />

      <MarchingCubes
        resolution={80}
        maxPolyCount={60000}
        enableUvs={false}
        enableColors
        onClick={handleClick}
        onPointerDown={handlePointerDown}
      >
        {/* meshStandardMaterial with vertexColors - same as 82257b99 */}
        <meshStandardMaterial
          vertexColors
          roughness={0}
          metalness={0}
        />

        <AnimatedCubes animated={animated} impactStrength={impactStrength} targetRotation={targetRotation.current} />
      </MarchingCubes>

      {/* HDRI environment for realistic lighting - same as reference */}
      <Environment files="https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/industrial_workshop_foundry_1k.hdr" />

      {/* Bounds to fit viewport - removed clip to prevent cutoff */}
      <Bounds fit observe margin={1.5}>
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
      <div style={{
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        overflow: 'visible',
        pointerEvents: 'auto'
      }}>
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0, 0, 5], fov: 30, near: 0.01, far: 100 }}
          gl={{ alpha: true }}
          style={{
            background: 'transparent',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            minHeight: '100%'
          }}
        >
          <MetaballsBreathingInner dna={dna} animated={animated} />
        </Canvas>
      </div>
    );
  }
);

MetaballsBreathing.displayName = 'MetaballsBreathing';
