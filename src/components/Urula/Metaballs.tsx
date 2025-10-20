import React, { useRef, useMemo, useImperativeHandle, forwardRef } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { MarchingCubes, MarchingCube, Environment } from '@react-three/drei';
import * as THREE from 'three';
import type { DNA } from '../../types/dna';

/**
 * Map DNA to visual parameters for Urula metaballs
 * Smoothly interpolates to create seamless evolution
 */
function dnaToVisualParams(dna: DNA) {
  // Strength multiplier: controls volume and boundary (minimal_maximal + oversized_fitted)
  // Minimal = smaller strength, Maximal = larger strength
  // Oversized = larger strength, Fitted = smaller strength
  const strengthBase = THREE.MathUtils.lerp(0.3, 0.6, (dna.minimal_maximal + 1) / 2);
  const strengthDelta = THREE.MathUtils.lerp(0.15, -0.15, (dna.oversized_fitted + 1) / 2);

  // Roughness: surface finish (relaxed_tailored)
  const roughness = THREE.MathUtils.lerp(0.22, 0.06, (dna.relaxed_tailored + 1) / 2);

  // Metalness & envMapIntensity: luxury vs street
  const metalness = THREE.MathUtils.lerp(0.02, 0.08, (dna.street_luxury + 1) / 2);
  const envMapIntensity = THREE.MathUtils.lerp(0.7, 1.5, (dna.street_luxury + 1) / 2);

  // Color from DNA hue/sat/light
  const hslColor = new THREE.Color();
  hslColor.setHSL(dna.hue, dna.sat, dna.light);

  // Texture index: maps 0-1 to 10 discrete texture choices
  // 0: Canvas, 1: Denim, 2: Glassribpattern, 3: Leather, 4: Pinstripe
  // 5: Ripstop, 6: Satin_Silk, 7: Suede, 8: Velvet, 9: Wool
  const textureIndex = Math.floor(dna.texture * 9.99); // 0-9
  const textureNames = [
    'Canvas', 'Denim', 'Glassribpattern', 'Leather', 'Pinstripe',
    'Ripstop', 'Satin_Silk', 'Suede', 'Velvet', 'Wool'
  ];
  const textureName = textureNames[textureIndex];

  return {
    strengthBase,
    strengthDelta,
    roughness,
    metalness,
    envMapIntensity,
    baseColor: hslColor,
    textureIndex,
    textureName,
  };
}

export interface UrulaMetaballsHandle {
  triggerImpact: () => void;
  changePalette: () => void;
}

interface MetaballsProps {
  dna: DNA;
  animated?: boolean;
}

interface MetaballsInnerProps extends MetaballsProps {
  onImpact?: () => void;
  onPaletteChange?: () => void;
  innerRef?: React.Ref<UrulaMetaballsHandle>;
}

function MetaballsInner({ dna, animated = true, onImpact, onPaletteChange, innerRef }: MetaballsInnerProps) {
  const visualParams = useMemo(() => dnaToVisualParams(dna), [dna]);
  const groupRef = useRef<THREE.Group>(null);
  const impactRef = useRef(0);
  const paletteChangeRef = useRef(0);

  // Load texture maps
  const albedoMap = useLoader(
    THREE.TextureLoader,
    `/texture/${visualParams.textureName}_albedo.png`
  );
  const normalMap = useLoader(
    THREE.TextureLoader,
    `/texture/${visualParams.textureName}_nomal.png`
  );

  // Configure texture wrapping and filtering
  useMemo(() => {
    if (albedoMap) {
      albedoMap.wrapS = albedoMap.wrapT = THREE.RepeatWrapping;
      albedoMap.repeat.set(2, 2);
    }
    if (normalMap) {
      normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
      normalMap.repeat.set(2, 2);
    }
  }, [albedoMap, normalMap]);

  useImperativeHandle(innerRef, () => ({
    triggerImpact: () => {
      impactRef.current = 1;
      onImpact?.();
    },
    changePalette: () => {
      paletteChangeRef.current = 1;
      onPaletteChange?.();
    },
  }));

  // Animate metaballs with breathing and reactions
  useFrame((state, delta) => {
    if (groupRef.current && animated) {
      const time = state.clock.elapsedTime;

      // Gentle rotation
      groupRef.current.rotation.y = Math.sin(time * 0.2) * 0.1;

      // Breathing scale animation
      const breathScale = 1 + Math.sin(time * 0.5) * 0.05;
      groupRef.current.scale.setScalar(breathScale);

      // Impact decay with scale pulse
      if (impactRef.current > 0) {
        const impactScale = 1 + impactRef.current * 0.2;
        groupRef.current.scale.setScalar(impactScale);
        impactRef.current = Math.max(0, impactRef.current - delta * 2);
      }

      // Palette change decay with color shift
      if (paletteChangeRef.current > 0) {
        paletteChangeRef.current = Math.max(0, paletteChangeRef.current - delta * 1.5);
      }
    }
  });

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={0.6} />
      <pointLight position={[-5, 2, -5]} intensity={0.3} />

      <MarchingCubes
        resolution={64}
        maxPolyCount={20000}
      >
        {/* Core ball */}
        <MarchingCube
          strength={visualParams.strengthBase + visualParams.strengthDelta}
          subtract={0}
          position={[0, 0, 0]}
        />

        {/* Orbiting satellites for variety */}
        <MarchingCube
          strength={(visualParams.strengthBase + visualParams.strengthDelta) * 0.6}
          subtract={0}
          position={[0.8, 0.5, 0]}
        />
        <MarchingCube
          strength={(visualParams.strengthBase + visualParams.strengthDelta) * 0.5}
          subtract={0}
          position={[-0.6, -0.4, 0.3]}
        />
        <MarchingCube
          strength={(visualParams.strengthBase + visualParams.strengthDelta) * 0.4}
          subtract={0}
          position={[0.2, -0.7, -0.4]}
        />

        <meshStandardMaterial
          map={albedoMap}
          normalMap={normalMap}
          color={visualParams.baseColor}
          roughness={visualParams.roughness}
          metalness={visualParams.metalness}
          envMapIntensity={visualParams.envMapIntensity}
          normalScale={new THREE.Vector2(0.3, 0.3)}
        />
      </MarchingCubes>

      <Environment preset="studio" />
    </group>
  );
}

/**
 * Urula: DNA-driven metaballs organism
 * Visualizes fashion DNA as a living, breathing entity
 * Reacts to user interactions and evolves with DNA changes
 */
export const UrulaMetaballs = forwardRef<UrulaMetaballsHandle, MetaballsProps>(
  ({ dna, animated = true }, ref) => {
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <Canvas
          gl={{ alpha: true, antialias: true }}
          camera={{ position: [0, 0, 5], fov: 50 }}
          style={{ background: 'transparent' }}
        >
          <MetaballsInner dna={dna} animated={animated} innerRef={ref} />
        </Canvas>
      </div>
    );
  }
);

UrulaMetaballs.displayName = 'UrulaMetaballs';
