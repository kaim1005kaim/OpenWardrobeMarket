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

// 20種類のアニメーションパターン
type AnimationType =
  | 'explosion'
  | 'wave'
  | 'spiral'
  | 'pulse'
  | 'scatter'
  | 'orbit'
  | 'ripple'
  | 'cascade'
  | 'helix'
  | 'swell'
  | 'tilt'
  | 'flare'
  | 'bounce'
  | 'twist'
  | 'shear'
  | 'vortex'
  | 'fragments'
  | 'breath'
  | 'tremor'
  | 'fields';

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
      const types: AnimationType[] = [
        'explosion',
        'wave',
        'spiral',
        'pulse',
        'scatter',
        'orbit',
        'ripple',
        'cascade',
        'helix',
        'swell',
        'tilt',
        'flare',
        'bounce',
        'twist',
        'shear',
        'vortex',
        'fragments',
        'breath',
        'tremor',
        'fields'
      ];
      animationTypeRef.current = types[Math.floor(Math.random() * types.length)];
    }
  }, [impactTrigger]);

  // useFrame で毎フレーム座標を計算して state 更新
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * 0.4;
    const a = animated ? 1 : 0;

    // 呼吸するような脈動エフェクト
    const breathingCycle = clock.getElapsedTime() * 0.3; // ゆっくりとした呼吸サイクル
    const breathingScale = 1 + Math.sin(breathingCycle) * 0.12; // 脈動の大きさ

    // 衝撃からの経過時間（ミリ秒）
    const timeSinceImpact = performance.now() - impactTimeRef.current;
    const impactDuration = 1000; // 1000msに延長してゆっくりに
    const linearProgress = Math.max(0, 1 - timeSinceImpact / impactDuration);
    // 滑らかなイージング（バネなし）
    const impactStrength = linearProgress > 0 ? easeInOutCubic(1 - linearProgress) * linearProgress : 0;

    const targetPositions = balls.map((b, i) => {
      const baseX = b.base[0] + a * (Math.sin(t * 1.2 + b.phase) * 0.30 + Math.sin(t * 0.35 + i) * 0.05);
      const baseY = b.base[1] + a * (Math.cos(t * 0.9 + b.phase + 1.0) * 0.28 + Math.cos(t * 0.31 + i * 1.7) * 0.05);
      const baseZ = b.base[2] + a * (Math.sin(t * 0.7 + b.phase + 2.0) * 0.22 + Math.sin(t * 0.27 + i * 0.7) * 0.04);

      // 呼吸エフェクトを基本位置に適用
      const breathX = baseX * breathingScale;
      const breathY = baseY * breathingScale;
      const breathZ = baseZ * breathingScale;

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
          case 'orbit': {
            const orbitRadius = 0.25 + impactStrength * 0.35;
            const orbitAngle = angle + impactStrength * Math.PI * 1.5;
            offsetX = Math.cos(orbitAngle) * orbitRadius;
            offsetY = Math.sin(orbitAngle) * orbitRadius * 0.8;
            offsetZ = Math.sin(orbitAngle * 0.6) * impactStrength * 0.25;
            break;
          }
          case 'ripple': {
            const rippleDelay = i * 0.08;
            const strength = Math.max(0, impactStrength - rippleDelay);
            const rippleAngle = angle + strength * Math.PI * 2;
            offsetX = Math.cos(rippleAngle) * strength * 0.45;
            offsetY = Math.sin(strength * Math.PI) * 0.35;
            offsetZ = Math.sin(rippleAngle * 0.5) * strength * 0.2;
            break;
          }
          case 'cascade': {
            const stagger = i * 0.12;
            const fall = Math.max(0, impactStrength - stagger);
            offsetY = -fall * 0.6;
            offsetX = Math.sin(angle + fall * Math.PI * 0.5) * fall * 0.25;
            offsetZ = Math.cos(angle + fall) * fall * 0.18;
            break;
          }
          case 'helix': {
            const helixAngle = angle * 2 + impactStrength * Math.PI * 1.2;
            offsetX = Math.cos(helixAngle) * impactStrength * 0.4;
            offsetZ = Math.sin(helixAngle) * impactStrength * 0.25;
            offsetY = Math.sin(i * 0.5 + impactStrength * Math.PI) * 0.5;
            break;
          }
          case 'swell': {
            const swell = 0.3 + impactStrength * 0.7;
            offsetX = baseX * swell - baseX;
            offsetY = baseY * swell - baseY;
            offsetZ = baseZ * swell * 0.4 - baseZ * 0.4;
            break;
          }
          case 'tilt': {
            const tiltAngle = impactStrength * Math.PI + i * 0.3;
            offsetX = Math.sin(tiltAngle) * 0.4;
            offsetY = Math.cos(tiltAngle) * impactStrength * 0.45;
            offsetZ = Math.sin(tiltAngle * 0.7) * impactStrength * 0.18;
            break;
          }
          case 'flare': {
            const flareStrength = impactStrength * impactStrength;
            const direction = new THREE.Vector3(1, 1, 0.3).normalize();
            offsetX = direction.x * flareStrength * 0.6 * (i % 2 === 0 ? 1 : -1);
            offsetY = direction.y * flareStrength * 0.6;
            offsetZ = direction.z * flareStrength * 0.3;
            break;
          }
          case 'bounce': {
            const bounce = Math.abs(Math.sin(impactStrength * Math.PI * 1.2)) * 0.6;
            offsetY = bounce * (1 - i * 0.05);
            offsetX = Math.sin(angle) * bounce * 0.2;
            offsetZ = Math.cos(angle) * bounce * 0.15;
            break;
          }
          case 'twist': {
            const twistAngle = impactStrength * Math.PI * 2 + i * 0.1;
            offsetX = baseX * Math.cos(twistAngle) - baseY * Math.sin(twistAngle);
            offsetY = baseX * Math.sin(twistAngle) + baseY * Math.cos(twistAngle) - baseY;
            offsetZ = Math.sin(twistAngle * 0.5) * 0.25;
            break;
          }
          case 'shear': {
            const shearFactor = (impactStrength - 0.3) * 1.2;
            offsetX = baseY * shearFactor * 0.6;
            offsetY = baseX * shearFactor * 0.4;
            offsetZ = Math.sin(angle + shearFactor) * 0.15;
            break;
          }
          case 'vortex': {
            const vortexAngle = impactStrength * Math.PI * 2 + angle;
            const radius = 0.2 + impactStrength * 0.3;
            offsetX = Math.cos(vortexAngle) * radius;
            offsetY = Math.sin(vortexAngle) * radius;
            offsetZ = -impactStrength * 0.3;
            break;
          }
          case 'fragments': {
            const randomSeed = Math.sin(b.phase + i * 3.1);
            offsetX = randomSeed * impactStrength * 0.6;
            offsetY = Math.cos(b.phase + i * 2.5) * impactStrength * 0.5;
            offsetZ = Math.sin(b.phase * 0.7 + i) * impactStrength * 0.25;
            break;
          }
          case 'breath': {
            const breathScale = 1 + Math.sin(impactStrength * Math.PI) * 0.35;
            offsetX = baseX * (breathScale - 1);
            offsetY = baseY * (breathScale - 1);
            offsetZ = baseZ * (breathScale - 1) * 0.3;
            break;
          }
          case 'tremor': {
            const tremorStrength = impactStrength * 0.45;
            const tremorPhase = t * 4 + i;
            offsetX = Math.sin(tremorPhase) * tremorStrength * 0.12;
            offsetY = Math.cos(tremorPhase * 1.2) * tremorStrength * 0.12;
            offsetZ = Math.sin(tremorPhase * 0.7) * tremorStrength * 0.08;
            break;
          }
          case 'fields': {
            const fieldAngle = (i / balls.length) * Math.PI;
            offsetX = Math.cos(fieldAngle) * impactStrength * 0.45;
            offsetY = Math.sin(fieldAngle) * impactStrength * 0.45;
            offsetZ = Math.sin(impactStrength * Math.PI * 0.8) * 0.25;
            break;
          }
        }
      }

      // 呼吸エフェクトとオフセットを組み合わせて最終位置を計算
      const finalX = Math.max(-0.6, Math.min(0.6, breathX + offsetX));
      const finalY = Math.max(-0.6, Math.min(0.6, breathY + offsetY));
      const finalZ = Math.max(-0.4, Math.min(0.4, breathZ + offsetZ));

      return [finalX, finalY, finalZ] as [number, number, number];
    });
    
    setPositions((prev) => {
      if (!prev.length) {
        return targetPositions;
      }

      return targetPositions.map((target, idx) => {
        const previous = prev[idx] || balls[idx].base;
        return [
          previous[0] + (target[0] - previous[0]) * 0.18,
          previous[1] + (target[1] - previous[1]) * 0.18,
          previous[2] + (target[2] - previous[2]) * 0.18,
        ] as [number, number, number];
      });
    });
  });

  return (
    <>
      {balls.map((b, i) => (
        <MarchingCube
          key={i}
          strength={1.1}
          subtract={9}
          color={new THREE.Color(palette[i % palette.length])}
          position={positions[i] || b.base}
        />
      ))}
    </>
  );
}

export interface MetaballsSoftHandle {
  triggerImpact: (color?: string) => void;
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
    const [customColor, setCustomColor] = useState<string | null>(null);

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

    // 色からグラデーションパレットを生成する関数
    const generateGradientPalette = (baseColor: string): string[] => {
      const hex = baseColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);

      const palette: string[] = [];

      // 乳白色ベース (#F5F5F0)
      const milkyWhite = { r: 245, g: 245, b: 240 };

      for (let i = 0; i < 7; i++) {
        // 各ボールで異なる混合比率を使用（色の割合を増やす）
        const ratios = [0.35, 0.45, 0.55, 0.65, 0.5, 0.4, 0.6];
        const ratio = ratios[i];

        // 乳白色とベースカラーをブレンド
        const blendedR = Math.round(milkyWhite.r * (1 - ratio) + r * ratio);
        const blendedG = Math.round(milkyWhite.g * (1 - ratio) + g * ratio);
        const blendedB = Math.round(milkyWhite.b * (1 - ratio) + b * ratio);

        palette.push(
          `#${blendedR.toString(16).padStart(2, '0')}${blendedG.toString(16).padStart(2, '0')}${blendedB.toString(16).padStart(2, '0')}`
        );
      }

      return palette;
    };

    const currentPalette = useMemo(() => {
      if (customColor) {
        // カスタムカラーが指定された場合、乳白色ベースで美しくブレンドしたパレットを生成
        return generateGradientPalette(customColor);
      }
      return palettes[paletteIndex % palettes.length];
    }, [customColor, palettes, paletteIndex]);

    // 外部から呼び出せるメソッドを公開
    useImperativeHandle(ref, () => ({
      triggerImpact: (color?: string) => {
        if (color) {
          setCustomColor(color);
        }
        setImpactTrigger((prev) => prev + 1);
        onInteract?.();
      },
      changePalette: () => {
        setCustomColor(null);
        setPaletteIndex((prev) => prev + 1);
        setImpactTrigger((prev) => prev + 1);
        onInteract?.();
      },
    }));

    return (
      <div style={{ width: "100%", height: "100%", position: "relative", pointerEvents: 'none' }}>
        <Canvas
          gl={{ alpha: true, premultipliedAlpha: false, antialias: true }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
          }}
          frameloop="always"
          dpr={[1, 1.5]}
          camera={{ position: [0, -0.3, 2.4], fov: 45 }}
          style={{ width: "100%", height: "100%", background: "transparent" }}
        >
          <ambientLight intensity={0.8} />
          <Environment
            files="https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/industrial_workshop_foundry_1k.hdr"
            background={false}
          />

          <MarchingCubes
            resolution={80}
            maxPolyCount={60000}
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
