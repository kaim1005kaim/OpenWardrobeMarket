// MetaballsSoft.tsx
import { useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { MarchingCubes, MarchingCube, Environment } from "@react-three/drei";
import * as THREE from "three";

type Ball = { base: [number, number, number]; phase: number };

function AnimatedCubes({
  animated,
  palette,
}: {
  animated: boolean;
  palette: string[];
}) {
  const balls = useMemo<Ball[]>(
    () =>
      [
        [0.00, 0.00, 0.00],
        [0.05, 0.03, 0.02],
        [-0.04, -0.02, 0.03],
        [0.03, -0.04, -0.02],
        [-0.06, 0.05, 0.00],
        [0.06, 0.00, 0.04],
        [0.00, -0.06, -0.03],
      ].map((p, i) => ({ base: p as [number, number, number], phase: Math.random() * Math.PI * 2 + i })),
    []
  );

  const [positions, setPositions] = useState<[number, number, number][]>([]);

  // useFrame で毎フレーム座標を計算して state 更新
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * 0.4; // 速度を1/3に
    const a = animated ? 1 : 0;

    const newPositions = balls.map((b, i) => {
      const x = b.base[0] + a * (Math.sin(t * 1.2 + b.phase) * 0.30 + Math.sin(t * 0.35 + i) * 0.05);
      const y = b.base[1] + a * (Math.cos(t * 0.9 + b.phase + 1.0) * 0.28 + Math.cos(t * 0.31 + i * 1.7) * 0.05);
      const z = b.base[2] + a * (Math.sin(t * 0.7 + b.phase + 2.0) * 0.22 + Math.sin(t * 0.27 + i * 0.7) * 0.04);
      return [x, y, z] as [number, number, number];
    });

    setPositions(newPositions);
  });

  return (
    <>
      {balls.map((b, i) => (
        <MarchingCube
          key={i}
          strength={1.1}
          subtract={9}
          color={palette[i % palette.length]}
          position={positions[i] || b.base}
        />
      ))}
    </>
  );
}

export default function MetaballsSoft({
  animated = true,
}: {
  width?: number;
  height?: number;
  animated?: boolean;
}) {
  // より鮮やかな色に変更
  const palette = useMemo(
    () => ["#7FEFBD", "#FFB3D9", "#FFD4A3", "#FFF4B8", "#8FFFCC", "#FFB8E6", "#FFD9A8"],
    []
  );

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <Canvas
        gl={{ alpha: true, premultipliedAlpha: false, antialias: true }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
        frameloop="always"
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 2.4], fov: 45 }}
        style={{ width: "100%", height: "100%", background: "transparent" }}
      >
        {/* 環境光は控えめ＋HDRでガラスっぽいハイライト */}
        <ambientLight intensity={0.8} />
        <Environment
          // 軽めの HDR。強い反射が欲しければ envMapIntensity を上げる
          files="https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/industrial_workshop_foundry_1k.hdr"
          background={false}
        />

        <MarchingCubes
          resolution={80}
          maxPolyCount={20000}
          enableUvs={false}
          enableColors
        >
          <meshStandardMaterial
            vertexColors
            roughness={0}
            metalness={0}
          />

          {/* ⑤ "動く/止まる"両対応の多色ボール群 */}
          <AnimatedCubes animated={animated} palette={palette} />
        </MarchingCubes>
      </Canvas>
    </div>
  );
}
