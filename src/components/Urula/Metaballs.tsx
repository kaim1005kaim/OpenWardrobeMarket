import React, { useRef, useMemo, useImperativeHandle, forwardRef } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { MarchingCubes, MarchingCube, MeshTransmissionMaterial, Environment, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { DNA } from '../../types/dna';

/**
 * Map DNA to visual parameters for Urula metaballs
 * Smoothly interpolates to create seamless evolution
 */
function dnaToVisualParams(dna: DNA, mat_weights?: any) {
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

  // Texture selection: use mat_weights if available, otherwise fallback to DNA.texture
  let textureIndex = 0;
  let textureName = 'Canvas';

  if (mat_weights) {
    // Find dominant texture from mat_weights
    const textureNames = [
      'Canvas', 'Denim', 'Glassribpattern', 'Leather', 'Pinstripe',
      'Ripstop', 'Satin_Silk', 'Suede', 'Velvet', 'Wool'
    ];
    const textureKeys = [
      'canvas', 'denim', 'glassribpattern', 'leather', 'pinstripe',
      'ripstop', 'satin_silk', 'suede', 'velvet', 'wool'
    ];

    let maxWeight = 0;
    textureKeys.forEach((key, idx) => {
      const weight = mat_weights[key] || 0;
      if (weight > maxWeight) {
        maxWeight = weight;
        textureIndex = idx;
        textureName = textureNames[idx];
      }
    });
  } else {
    // Fallback: use DNA.texture field
    textureIndex = Math.floor(dna.texture * 9.99); // 0-9
    const textureNames = [
      'Canvas', 'Denim', 'Glassribpattern', 'Leather', 'Pinstripe',
      'Ripstop', 'Satin_Silk', 'Suede', 'Velvet', 'Wool'
    ];
    textureName = textureNames[textureIndex];
  }

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
  mat_weights?: any; // MaterialWeights from Urula profile
}

interface MetaballsInnerProps extends MetaballsProps {
  onImpact?: () => void;
  onPaletteChange?: () => void;
  innerRef?: React.Ref<UrulaMetaballsHandle>;
}

function MetaballsInner({ dna, mat_weights, animated = true, onImpact, onPaletteChange, innerRef }: MetaballsInnerProps) {
  const visualParams = useMemo(() => dnaToVisualParams(dna, mat_weights), [dna, mat_weights]);
  const groupRef = useRef<THREE.Group>(null);
  const impactRef = useRef(0);
  const paletteChangeRef = useRef(0);

  // Always load textures (used for normalMap in transmission material)
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

  // Create color variations for beautiful gradient blending (inspired by reference code)
  const colorVariations = useMemo(() => {
    const baseHSL = { h: 0, s: 0, l: 0 };
    visualParams.baseColor.getHSL(baseHSL);

    // Create 6 color variations for rich gradients
    return [
      // Base color (indianred equivalent)
      visualParams.baseColor.clone(),
      // Complementary color shift (skyblue equivalent)
      new THREE.Color().setHSL(
        (baseHSL.h + 0.5) % 1,
        baseHSL.s,
        baseHSL.l
      ),
      // Analogous color 1 (teal equivalent)
      new THREE.Color().setHSL(
        (baseHSL.h + 0.6) % 1,
        Math.min(baseHSL.s + 0.2, 1),
        baseHSL.l
      ),
      // Warm shift (orange equivalent)
      new THREE.Color().setHSL(
        (baseHSL.h + 0.08) % 1,
        Math.min(baseHSL.s + 0.15, 1),
        Math.min(baseHSL.l + 0.1, 1)
      ),
      // Saturated variant (hotpink equivalent)
      new THREE.Color().setHSL(
        (baseHSL.h - 0.05 + 1) % 1,
        Math.min(baseHSL.s + 0.3, 1),
        baseHSL.l
      ),
      // Cool desaturated (aquamarine equivalent)
      new THREE.Color().setHSL(
        (baseHSL.h + 0.45) % 1,
        Math.max(baseHSL.s - 0.1, 0.5),
        Math.min(baseHSL.l + 0.15, 0.9)
      ),
    ];
  }, [visualParams.baseColor]);

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

      // Gentle horizontal rotation only (user can rotate freely with OrbitControls)
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
        enableUvs={false}
        enableColors
      >
        {/* 6 metaballs with rich gradient colors (inspired by reference code) */}
        <MarchingCube
          strength={visualParams.strengthBase + visualParams.strengthDelta}
          subtract={6}
          color={colorVariations[0]}
          position={[1, 1, 0.5]}
        />
        <MarchingCube
          strength={(visualParams.strengthBase + visualParams.strengthDelta) * 0.8}
          subtract={6}
          color={colorVariations[1]}
          position={[-1, -1, -0.5]}
        />
        <MarchingCube
          strength={(visualParams.strengthBase + visualParams.strengthDelta) * 0.7}
          subtract={6}
          color={colorVariations[2]}
          position={[2, 2, 0.5]}
        />
        <MarchingCube
          strength={(visualParams.strengthBase + visualParams.strengthDelta) * 0.6}
          subtract={6}
          color={colorVariations[3]}
          position={[-2, -2, -0.5]}
        />
        <MarchingCube
          strength={(visualParams.strengthBase + visualParams.strengthDelta) * 0.5}
          subtract={6}
          color={colorVariations[4]}
          position={[3, 3, 0.5]}
        />
        <MarchingCube
          strength={(visualParams.strengthBase + visualParams.strengthDelta) * 0.4}
          subtract={6}
          color={colorVariations[5]}
          position={[-3, -3, -0.5]}
        />

        {/* Hybrid material: Transmission with texture */}
        <MeshTransmissionMaterial
          vertexColors
          // Texture maps for surface detail
          normalMap={normalMap}
          normalScale={new THREE.Vector2(0.3 * dna.texture, 0.3 * dna.texture)}
          // Transmission properties (fade from glass to opaque)
          transmission={Math.max(0, 1 - dna.texture * 1.5)} // 0=opaque, 1=full glass
          thickness={0.15}
          roughness={visualParams.roughness * dna.texture} // Smooth glass → textured surface
          ior={1.5}
          chromaticAberration={0.06 * (1 - dna.texture * 0.8)} // Less aberration as texture increases
          backside={false}
          // Add subtle metalness for fabric shimmer at higher texture values
          metalness={visualParams.metalness * dna.texture}
          // Blend albedo color for fabric appearance
          color={dna.texture > 0.3 ? new THREE.Color(1, 1, 1) : undefined}
        />
      </MarchingCubes>

      {/* HDRI environment for realistic lighting and reflections */}
      <Environment files="https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/industrial_workshop_foundry_1k.hdr" />

      {/* OrbitControls for interactive 3D rotation */}
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        rotateSpeed={0.5}
        minPolarAngle={0}
        maxPolarAngle={Math.PI}
      />
    </group>
  );
}

/**
 * Urula: DNA-driven metaballs organism
 * Visualizes fashion DNA as a living, breathing entity
 * Reacts to user interactions and evolves with DNA changes
 *
 * Updated: Hybrid MeshTransmissionMaterial with texture blending
 * texture=0: Glass-like appearance with HDRI
 * texture>0: Fabric textures emerge through transmission
 */
export const UrulaMetaballs = forwardRef<UrulaMetaballsHandle, MetaballsProps>(
  ({ dna, mat_weights, animated = true }, ref) => {
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <Canvas
          gl={{ alpha: true, antialias: true }}
          camera={{ position: [0, 0, 5], fov: 50 }}
          style={{ background: 'transparent' }}
        >
          <MetaballsInner dna={dna} mat_weights={mat_weights} animated={animated} innerRef={ref} />
        </Canvas>
      </div>
    );
  }
);

UrulaMetaballs.displayName = 'UrulaMetaballs';
