// MetaballsSoft.tsx
import { useMemo, useState, useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MarchingCubes, MarchingCube, Environment } from "@react-three/drei";
import * as THREE from "three";
import type { UserUrulaProfile } from "../types/urula";
import { DEFAULT_URULA_PROFILE } from "../types/urula";
import { loadUrulaTextures, getTopMaterials, type TextureSet } from "../lib/urula/loadTextures";

// カスタムシェーダーマテリアル
interface BlendedMaterialProps {
  textures: TextureSet | null;
  profile: UserUrulaProfile | null;
  tintColor: THREE.Color;
}

function BlendedMaterial({ textures, profile, tintColor }: BlendedMaterialProps) {
  const shaderRef = useRef<THREE.ShaderMaterial>(null);

  // トップ2素材を計算
  const topMats = useMemo(() => {
    return profile && textures ? getTopMaterials(profile.mat_weights) : ['canvas', 'denim'];
  }, [profile, textures]);

  const uniforms = useMemo(() => {
    const mat1 = textures?.[topMats[0] as keyof TextureSet];
    const mat2 = textures?.[topMats[1] as keyof TextureSet];

    // ブレンド係数を計算（重みの比率）
    let blendFactor = 0.5;
    if (profile && textures) {
      const weights = profile.mat_weights;
      const weight1 = weights[topMats[0] as keyof typeof weights] || 0;
      const weight2 = weights[topMats[1] as keyof typeof weights] || 0;
      const total = weight1 + weight2;
      if (total > 0) {
        blendFactor = weight2 / total; // 0.0 = 完全にmat1, 1.0 = 完全にmat2
      }
    }

    return {
      uAlbedo1: { value: mat1?.albedo || null },
      uNormal1: { value: mat1?.normal || null },
      uAlbedo2: { value: mat2?.albedo || null },
      uNormal2: { value: mat2?.normal || null },
      uBlendFactor: { value: blendFactor },
      uTintColor: { value: tintColor },
      uTime: { value: 0 },
    };
  }, [textures, profile, tintColor, topMats]);

  const vertexShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vViewPosition;
    varying vec3 vWorldNormal;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);

      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      vPosition = position;

      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    uniform sampler2D uAlbedo1;
    uniform sampler2D uNormal1;
    uniform sampler2D uAlbedo2;
    uniform sampler2D uNormal2;
    uniform float uBlendFactor;
    uniform vec3 uTintColor;
    uniform float uTime;

    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vViewPosition;
    varying vec3 vWorldNormal;

    // ノーマルマップをタンジェント空間からワールド空間へ変換
    vec3 perturbNormal(vec3 normalMap, vec3 worldNormal, vec3 viewPos) {
      // タンジェントとバイノーマルを計算
      vec3 q1 = dFdx(viewPos);
      vec3 q2 = dFdy(viewPos);
      vec2 st1 = dFdx(vUv);
      vec2 st2 = dFdy(vUv);

      vec3 N = normalize(worldNormal);
      vec3 T = normalize(q1 * st2.t - q2 * st1.t);
      vec3 B = -normalize(cross(N, T));
      mat3 TBN = mat3(T, B, N);

      // ノーマルマップを-1..1の範囲に変換
      vec3 normal = normalMap * 2.0 - 1.0;
      return normalize(TBN * normal);
    }

    void main() {
      // UVスケーリング
      vec2 scaledUv = vUv * 2.0;

      // テクスチャサンプリング
      vec4 albedo1 = texture2D(uAlbedo1, scaledUv);
      vec4 albedo2 = texture2D(uAlbedo2, scaledUv);
      vec3 normal1 = texture2D(uNormal1, scaledUv).rgb;
      vec3 normal2 = texture2D(uNormal2, scaledUv).rgb;

      // ブレンド
      vec4 blendedAlbedo = mix(albedo1, albedo2, uBlendFactor);
      vec3 blendedNormal = mix(normal1, normal2, uBlendFactor);

      // ノーマルマップを適用
      vec3 N = perturbNormal(blendedNormal, vWorldNormal, vViewPosition);

      // ティントカラー適用
      vec3 tinted = blendedAlbedo.rgb * uTintColor;

      // ライティング設定
      vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
      vec3 viewDir = normalize(vViewPosition);
      vec3 halfDir = normalize(lightDir + viewDir);

      // ディフューズライティング（ノーマルマップ適用後）
      float diffuse = max(dot(N, lightDir), 0.0);
      diffuse = diffuse * 0.7 + 0.3; // アンビエント追加

      // スペキュラー反射（適度な光沢感）
      float specular = pow(max(dot(N, halfDir), 0.0), 32.0);
      specular *= 0.4; // 反射強度を調整

      // 環境光のような rim light（縁の光）
      float rim = 1.0 - max(dot(viewDir, N), 0.0);
      rim = pow(rim, 3.0) * 0.3;

      // 最終カラー合成
      vec3 finalColor = tinted * diffuse + vec3(specular) + vec3(rim);

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  useFrame((state) => {
    if (shaderRef.current) {
      shaderRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <shaderMaterial
      ref={shaderRef}
      vertexShader={vertexShader}
      fragmentShader={fragmentShader}
      uniforms={uniforms}
    />
  );
}

type Ball = { base: [number, number, number]; phase: number };

interface AnimatedCubesProps {
  animated: boolean;
  palette: string[];
  impactTrigger: number;
  chaos?: number;
  profile?: UserUrulaProfile | null;
  textures?: TextureSet | null;
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
  chaos = 0.35,
  profile,
  textures,
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

    // 呼吸するような脈動エフェクト (chaos によって波動の激しさが変わる)
    const breathingCycle = clock.getElapsedTime() * 0.3;
    const breathingScale = 1 + Math.sin(breathingCycle) * (0.08 + chaos * 0.08);

    // 衝撃からの経過時間（ミリ秒）
    const timeSinceImpact = performance.now() - impactTimeRef.current;
    const impactDuration = 1000;
    const linearProgress = Math.max(0, 1 - timeSinceImpact / impactDuration);
    const impactStrength = linearProgress > 0 ? easeInOutCubic(1 - linearProgress) * linearProgress : 0;

    const targetPositions = balls.map((b, i) => {
      // chaos パラメータで波動の激しさを調整
      const waveScale = 0.2 + chaos * 0.3;
      const baseX = b.base[0] + a * (Math.sin(t * 1.2 + b.phase) * waveScale + Math.sin(t * 0.35 + i) * 0.05);
      const baseY = b.base[1] + a * (Math.cos(t * 0.9 + b.phase + 1.0) * waveScale + Math.cos(t * 0.31 + i * 1.7) * 0.05);
      const baseZ = b.base[2] + a * (Math.sin(t * 0.7 + b.phase + 2.0) * (waveScale * 0.7) + Math.sin(t * 0.27 + i * 0.7) * 0.04);

      // 呼吸エフェクトを基本位置に適用
      const breathX = baseX * breathingScale;
      const breathY = baseY * breathingScale;
      const breathZ = baseZ * breathingScale;

      let offsetX = 0, offsetY = 0, offsetZ = 0;

      if (impactStrength > 0) {
        const angle = (i / balls.length) * Math.PI * 2;

        switch (animationTypeRef.current) {
          case 'explosion': {
            const direction = new THREE.Vector3(baseX, baseY, baseZ).normalize();
            offsetX = direction.x * impactStrength * 0.5;
            offsetY = direction.y * impactStrength * 0.5;
            offsetZ = direction.z * impactStrength * 0.2;
            break;
          }
          case 'wave': {
            const delay = i * 0.15;
            const waveStrength = Math.max(0, impactStrength - delay);
            offsetY = Math.sin(waveStrength * Math.PI) * 0.45;
            offsetX = Math.cos(angle) * waveStrength * 0.4;
            offsetZ = Math.sin(angle) * waveStrength * 0.15;
            break;
          }
          case 'spiral': {
            const spiralAngle = angle + impactStrength * Math.PI * 2;
            offsetX = Math.cos(spiralAngle) * impactStrength * 0.5;
            offsetZ = Math.sin(spiralAngle) * impactStrength * 0.2;
            offsetY = impactStrength * 0.45 * Math.sin(i * 0.8);
            break;
          }
          case 'pulse': {
            const pulseScale = 1 + Math.sin(impactStrength * Math.PI) * 0.45;
            offsetX = baseX * (pulseScale - 1);
            offsetY = baseY * (pulseScale - 1);
            offsetZ = baseZ * (pulseScale - 1) * 0.3;
            break;
          }
          case 'scatter': {
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
  profile?: UserUrulaProfile | null;
  morphing?: boolean; // 初期状態からプロファイルへスムーズにモーフィング
  morphDelayMs?: number; // モーフィング開始の遅延時間（ミリ秒）
}

const MetaballsSoft = forwardRef<MetaballsSoftHandle, MetaballsSoftProps>(
  ({ animated = true, onInteract, profile, morphing = false, morphDelayMs = 0 }, ref) => {
    const [impactTrigger, setImpactTrigger] = useState(0);
    const [paletteIndex, setPaletteIndex] = useState(0);
    const [customColor, setCustomColor] = useState<string | null>(null);
    const [textures, setTextures] = useState<TextureSet | null>(null);

    // モーフィング用のステート
    const [morphProgress, setMorphProgress] = useState(morphing ? 0 : 1);
    const [currentProfile, setCurrentProfile] = useState<UserUrulaProfile | null>(
      morphing ? { ...DEFAULT_URULA_PROFILE, user_id: '', updated_at: new Date().toISOString() } : profile ?? null
    );
    const morphStartTimeRef = useRef<number>(0);
    const targetProfileRef = useRef<UserUrulaProfile | null>(profile ?? null);

    // タッチインタラクション用のステート
    const [rotation, setRotation] = useState(0);
    const [targetRotation, setTargetRotation] = useState(0);
    const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
    const canvasRef = useRef<HTMLDivElement>(null);

    // Load textures on mount
    useEffect(() => {
      loadUrulaTextures().then(setTextures).catch(err => {
        console.error('[MetaballsSoft] Failed to load textures:', err);
      });
    }, []);

    // モーフィング: profileが変更されたときにアニメーション開始
    useEffect(() => {
      if (!morphing) {
        setCurrentProfile(profile ?? null);
        return;
      }

      if (profile && profile !== targetProfileRef.current) {
        targetProfileRef.current = profile;

        // 遅延後にモーフィング開始
        const timeoutId = setTimeout(() => {
          morphStartTimeRef.current = performance.now();
          setMorphProgress(0);
          // モーフィング中に衝撃エフェクトを発火（ぼこぼこ変化）
          setImpactTrigger((prev) => prev + 1);
        }, morphDelayMs);

        return () => clearTimeout(timeoutId);
      }
    }, [profile, morphing, morphDelayMs]);

    // モーフィングアニメーション
    useEffect(() => {
      if (!morphing || morphProgress >= 1) return;

      let animationId: number;
      const duration = 2000; // 2秒かけてモーフィング

      const animate = () => {
        const elapsed = performance.now() - morphStartTimeRef.current;
        const progress = Math.min(1, elapsed / duration);

        // イージング (easeOutCubic)
        const eased = 1 - Math.pow(1 - progress, 3);
        setMorphProgress(eased);

        if (progress < 1) {
          animationId = requestAnimationFrame(animate);
        }
      };

      animationId = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(animationId);
    }, [morphing, morphProgress]);

    // 補間されたプロファイルを計算
    useEffect(() => {
      if (!morphing || !targetProfileRef.current) {
        setCurrentProfile(profile ?? null);
        return;
      }

      const defaultProfile = { ...DEFAULT_URULA_PROFILE, user_id: '', updated_at: new Date().toISOString() };
      const target = targetProfileRef.current;
      const t = morphProgress;

      const interpolated: UserUrulaProfile = {
        user_id: target.user_id,
        updated_at: target.updated_at,
        mat_weights: {
          canvas: defaultProfile.mat_weights.canvas * (1 - t) + target.mat_weights.canvas * t,
          denim: defaultProfile.mat_weights.denim * (1 - t) + target.mat_weights.denim * t,
          leather: defaultProfile.mat_weights.leather * (1 - t) + target.mat_weights.leather * t,
          pinstripe: defaultProfile.mat_weights.pinstripe * (1 - t) + target.mat_weights.pinstripe * t,
        },
        glass_gene: defaultProfile.glass_gene * (1 - t) + target.glass_gene * t,
        chaos: defaultProfile.chaos * (1 - t) + target.chaos * t,
        tint: {
          h: defaultProfile.tint.h * (1 - t) + target.tint.h * t,
          s: defaultProfile.tint.s * (1 - t) + target.tint.s * t,
          l: defaultProfile.tint.l * (1 - t) + target.tint.l * t,
        },
        palette: t > 0.5 ? target.palette : defaultProfile.palette,
        history: target.history,
      };

      setCurrentProfile(interpolated);
    }, [morphProgress, morphing, profile]);

    // 慣性付き回転アニメーション（requestAnimationFrame使用）
    useEffect(() => {
      let animationId: number;
      const animate = () => {
        setRotation((prev) => {
          const diff = targetRotation - prev;
          if (Math.abs(diff) < 0.001) {
            return targetRotation; // 目標に到達
          }
          return prev + diff * 0.1; // スムーズな減速
        });
        animationId = requestAnimationFrame(animate);
      };
      animationId = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(animationId);
    }, [targetRotation]);

    // タッチ/マウスイベントハンドラー
    const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
      const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
      touchStartRef.current = { x, y, time: Date.now() };
    };

    const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
      if (!touchStartRef.current) return;
      const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const deltaX = x - touchStartRef.current.x;

      // スワイプでY軸回転（現在の回転値から相対的に更新）
      setTargetRotation((prev) => prev + deltaX * 0.005);
      // 開始位置を更新して、連続した回転を実現
      touchStartRef.current.x = x;
    };

    const handleTouchEnd = (e: React.TouchEvent | React.MouseEvent) => {
      if (!touchStartRef.current) return;

      const endTime = Date.now();
      const duration = endTime - touchStartRef.current.time;
      const x = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as React.MouseEvent).clientX;
      const y = 'changedTouches' in e ? e.changedTouches[0].clientY : (e as React.MouseEvent).clientY;
      const deltaX = Math.abs(x - touchStartRef.current.x);
      const deltaY = Math.abs(y - touchStartRef.current.y);

      // タップ判定（移動が少なく、短時間）
      if (deltaX < 10 && deltaY < 10 && duration < 300) {
        // リップルエフェクト（衝撃トリガー）
        setImpactTrigger((prev) => prev + 1);
        onInteract?.();
      }

      touchStartRef.current = null;
    };

    // 複数のカラーパレット
    const palettes = useMemo(
      () => [
        ["#7FEFBD", "#FFB3D9", "#FFD4A3", "#FFF4B8", "#8FFFCC", "#FFB8E6", "#FFD9A8"],
        ["#FF6B9D", "#C44569", "#FFC312", "#EE5A6F", "#FDA7DF", "#F8B500", "#FFB6C1"],
        ["#4ECDC4", "#44A08D", "#556270", "#46C2CB", "#5EAAA8", "#95E1D3", "#71C9CE"],
        ["#A8E6CF", "#FFDAC1", "#FFB7B2", "#C7CEEA", "#B5EAD7", "#E2F0CB", "#FF9AA2"],
        ["#9B59B6", "#3498DB", "#E74C3C", "#F39C12", "#1ABC9C", "#E67E22", "#2ECC71"],
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
        const ratios = [0.35, 0.45, 0.55, 0.65, 0.5, 0.4, 0.6];
        const ratio = ratios[i];

        const blendedR = Math.round(milkyWhite.r * (1 - ratio) + r * ratio);
        const blendedG = Math.round(milkyWhite.g * (1 - ratio) + g * ratio);
        const blendedB = Math.round(milkyWhite.b * (1 - ratio) + b * ratio);

        palette.push(
          `#${blendedR.toString(16).padStart(2, '0')}${blendedG.toString(16).padStart(2, '0')}${blendedB.toString(16).padStart(2, '0')}`
        );
      }

      return palette;
    };

    // Apply profile tint if available
    const currentPalette = useMemo(() => {
      if (customColor) {
        return generateGradientPalette(customColor);
      }

      // Use profile tint if available
      if (currentProfile?.tint) {
        const { h, s, l } = currentProfile.tint;
        const hslColor = `hsl(${h}, ${s * 100}%, ${l * 100}%)`;
        // Convert HSL to hex for gradient generation
        const tempDiv = document.createElement('div');
        tempDiv.style.color = hslColor;
        document.body.appendChild(tempDiv);
        const rgb = window.getComputedStyle(tempDiv).color;
        document.body.removeChild(tempDiv);

        const match = rgb.match(/\d+/g);
        if (match) {
          const [r, g, b] = match.map(Number);
          const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          return generateGradientPalette(hex);
        }
      }

      return palettes[paletteIndex % palettes.length];
    }, [customColor, currentProfile, palettes, paletteIndex]);

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
      <div
        ref={canvasRef}
        style={{ width: "100%", height: "100%", position: "relative", pointerEvents: 'auto' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseMove={handleTouchMove}
        onMouseUp={handleTouchEnd}
      >
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

          <group rotation={[0, rotation, 0]}>
            <MarchingCubes
              resolution={80}
              maxPolyCount={60000}
              enableUvs={true}
              enableColors={false}
            >
              {textures && currentProfile && (currentProfile.history.generations > 0 || (morphing && profile && profile.history.generations > 0)) ? (
                <BlendedMaterial
                  textures={textures}
                  profile={currentProfile}
                  tintColor={new THREE.Color().setHSL(
                    currentProfile.tint.h / 360,
                    currentProfile.tint.s,
                    currentProfile.tint.l
                  )}
                />
              ) : (
                <meshStandardMaterial
                  roughness={0}
                  metalness={0}
                  color="#F5F5F0"
                  opacity={0.95}
                  transparent={true}
                />
              )}
              <AnimatedCubes
                animated={animated}
                palette={currentPalette}
                impactTrigger={impactTrigger}
                chaos={currentProfile?.chaos}
                profile={currentProfile}
                textures={textures}
              />
            </MarchingCubes>
          </group>
        </Canvas>
      </div>
    );
  }
);

MetaballsSoft.displayName = "MetaballsSoft";

export default MetaballsSoft;
