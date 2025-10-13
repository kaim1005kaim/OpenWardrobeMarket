// MetaballsSoft.tsx
import { useMemo, useState, useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { MarchingCubes, MarchingCube, Environment } from "@react-three/drei";
import * as THREE from "three";

type Ball = { base: [number, number, number]; phase: number };

interface AnimatedCubesProps {
  animated: boolean;
  palette: string[];
  impactTrigger: number;
}

// 5種類のアニメーションパターン
type AnimationType = 'explosion' | 'wave' | 'spiral' | 'pulse' | 'scatter';

function AnimatedCubes({
  animated,
  palette,
  impactTrigger,
}: AnimatedCubesProps) {
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
  const impactTimeRef = useRef(0);
  const lastImpactTrigger = useRef(0);
  const animationTypeRef = useRef<AnimationType>('explosion');

  // イージング関数 (easeOutCubic) - 滑らかな減速
  const easeOutCubic = (x: number): number => {
    return 1 - Math.pow(1 - x, 3);
  };

  // イージング関数 (easeInOutCubic) - 滑らかな加速と減速
  const easeInOutCubic = (x: number): number => {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  };

  // impactTriggerが変わったら衝撃開始 + ランダムなアニメーションを選択
  useEffect(() => {
    if (impactTrigger > lastImpactTrigger.current) {
      impactTimeRef.current = performance.now();
      lastImpactTrigger.current = impactTrigger;

      // ランダムにアニメーションタイプを選択
      const types: AnimationType[] = ['explosion', 'wave', 'spiral', 'pulse', 'scatter'];
      animationTypeRef.current = types[Math.floor(Math.random() * types.length)];
    }
  }, [impactTrigger]);

  // useFrame で毎フレーム座標を計算して state 更新
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * 0.4;
    const a = animated ? 1 : 0;

    // 衝撃からの経過時間（ミリ秒）
    const timeSinceImpact = performance.now() - impactTimeRef.current;
    const impactDuration = 1000; // 1000msに延長してゆっくりに
    const linearProgress = Math.max(0, 1 - timeSinceImpact / impactDuration);
    // 滑らかなイージング（バネなし）
    const impactStrength = linearProgress > 0 ? easeInOutCubic(1 - linearProgress) * linearProgress : 0;

    const newPositions = balls.map((b, i) => {
      const baseX = b.base[0] + a * (Math.sin(t * 1.2 + b.phase) * 0.30 + Math.sin(t * 0.35 + i) * 0.05);
      const baseY = b.base[1] + a * (Math.cos(t * 0.9 + b.phase + 1.0) * 0.28 + Math.cos(t * 0.31 + i * 1.7) * 0.05);
      const baseZ = b.base[2] + a * (Math.sin(t * 0.7 + b.phase + 2.0) * 0.22 + Math.sin(t * 0.27 + i * 0.7) * 0.04);

      let offsetX = 0, offsetY = 0, offsetZ = 0;

      if (impactStrength > 0) {
        const angle = (i / balls.length) * Math.PI * 2;

        switch (animationTypeRef.current) {
          case 'explosion': {
            // 中心から外側へ爆発
            const direction = new THREE.Vector3(baseX, baseY, baseZ).normalize();
            offsetX = direction.x * impactStrength * 0.5;
            offsetY = direction.y * impactStrength * 0.5;
            offsetZ = direction.z * impactStrength * 0.2;
            break;
          }
          case 'wave': {
            // 波紋のように順番に膨張
            const delay = i * 0.15;
            const waveStrength = Math.max(0, impactStrength - delay);
            offsetY = Math.sin(waveStrength * Math.PI) * 0.45;
            offsetX = Math.cos(angle) * waveStrength * 0.4;
            offsetZ = Math.sin(angle) * waveStrength * 0.15;
            break;
          }
          case 'spiral': {
            // らせん状に回転しながら膨張
            const spiralAngle = angle + impactStrength * Math.PI * 2;
            offsetX = Math.cos(spiralAngle) * impactStrength * 0.5;
            offsetZ = Math.sin(spiralAngle) * impactStrength * 0.2;
            offsetY = impactStrength * 0.45 * Math.sin(i * 0.8);
            break;
          }
          case 'pulse': {
            // 脈動（全体が大きくなって小さくなる）
            const pulseScale = 1 + Math.sin(impactStrength * Math.PI) * 0.45;
            offsetX = baseX * (pulseScale - 1);
            offsetY = baseY * (pulseScale - 1);
            offsetZ = baseZ * (pulseScale - 1) * 0.3;
            break;
          }
          case 'scatter': {
            // ランダムな方向に飛び散る
            const scatterX = Math.sin(b.phase + i * 0.7);
            const scatterY = Math.cos(b.phase + i * 1.3);
            const scatterZ = Math.sin(b.phase + i * 2.1);
            offsetX = scatterX * impactStrength * 0.5;
            offsetY = scatterY * impactStrength * 0.5;
            offsetZ = scatterZ * impactStrength * 0.2;
            break;
          }
        }
      }

      // 全軸を安全な範囲に制限して画面外に出ないように
      const finalX = Math.max(-0.6, Math.min(0.6, baseX + offsetX));
      const finalY = Math.max(-0.6, Math.min(0.6, baseY + offsetY));
      const finalZ = Math.max(-0.4, Math.min(0.4, baseZ + offsetZ));

      return [finalX, finalY, finalZ] as [number, number, number];
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

export interface MetaballsSoftHandle {
  triggerImpact: () => void;
  changePalette: () => void;
}

interface MetaballsSoftProps {
  width?: number;
  height?: number;
  animated?: boolean;
  onInteract?: () => void;
}

const MetaballsSoft = forwardRef<MetaballsSoftHandle, MetaballsSoftProps>(
  ({ animated = true, onInteract }, ref) => {
    const [impactTrigger, setImpactTrigger] = useState(0);
    const [paletteIndex, setPaletteIndex] = useState(0);

    // 複数のカラーパレット
    const palettes = useMemo(
      () => [
        ["#7FEFBD", "#FFB3D9", "#FFD4A3", "#FFF4B8", "#8FFFCC", "#FFB8E6", "#FFD9A8"], // 元の色
        ["#FF6B9D", "#C44569", "#FFC312", "#EE5A6F", "#FDA7DF", "#F8B500", "#FFB6C1"], // ピンク/赤系
        ["#4ECDC4", "#44A08D", "#556270", "#46C2CB", "#5EAAA8", "#95E1D3", "#71C9CE"], // 青緑系
        ["#A8E6CF", "#FFDAC1", "#FFB7B2", "#C7CEEA", "#B5EAD7", "#E2F0CB", "#FF9AA2"], // パステル系
        ["#9B59B6", "#3498DB", "#E74C3C", "#F39C12", "#1ABC9C", "#E67E22", "#2ECC71"], // ビビッド系
      ],
      []
    );

    const currentPalette = palettes[paletteIndex % palettes.length];

    // 外部から呼び出せるメソッドを公開
    useImperativeHandle(ref, () => ({
      triggerImpact: () => {
        setImpactTrigger((prev) => prev + 1);
        onInteract?.();
      },
      changePalette: () => {
        setPaletteIndex((prev) => prev + 1);
        setImpactTrigger((prev) => prev + 1);
        onInteract?.();
      },
    }));

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
          <ambientLight intensity={0.8} />
          <Environment
            files="https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/industrial_workshop_foundry_1k.hdr"
            background={false}
          />

          <MarchingCubes
            resolution={80}
            maxPolyCount={20000}
            enableUvs={false}
            enableColors
          >
            <meshStandardMaterial vertexColors roughness={0} metalness={0} />
            <AnimatedCubes animated={animated} palette={currentPalette} impactTrigger={impactTrigger} />
          </MarchingCubes>
        </Canvas>
      </div>
    );
  }
);

MetaballsSoft.displayName = "MetaballsSoft";

export default MetaballsSoft;
