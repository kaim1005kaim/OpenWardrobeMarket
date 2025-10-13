import { useEffect, useRef } from "react";
import * as THREE from "three";
import glassURL from "@/assets/glaspattern_stripe.png";

const VERT = `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy,0.,1.); }
`;

// Glass Stripe Reveal: 縦ストライプのシャッターエフェクト + 画像フェードイン
const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D u_img;
uniform sampler2D u_glass;
uniform vec2  u_res;        // 画素数
uniform float u_progress;   // 0..1 (0=ガラス最大,1=クリア)
uniform float u_fadeIn;     // 0..1 (画像のフェードイン)
uniform float u_strength;   // 屈折強度係数
uniform float u_pixels;     // 最大屈折量 [px]
uniform float u_edge;       // 0.08〜0.18 推奨（開く幅）
uniform float u_stripes;    // ストライプ本数
uniform float u_jitter;     // 0.0..0.12 推奨
uniform bool  u_leftToRight;

float hash(float x){ return fract(sin(x*43758.5453)*1e4); }

void main(){
  float idx = floor(vUv.x * u_stripes);
  float s   = idx / (u_stripes - 1.0);  // 0..1 左→右
  if(!u_leftToRight) s = 1.0 - s;

  // 0..u_jitter の範囲で列ごとに開始を遅らせる（1.0 を超えない設計）
  float jitter = u_jitter * hash(idx + 13.0);
  float t0 = clamp(s + jitter, 0.0, 1.0 - u_edge);

  // 0=閉じ/歪み大 → 1=開き/歪みゼロ
  float open = smoothstep(t0, t0 + u_edge, u_progress);
  float amp  = 1.0 - open;

  // ===== ガラス勾配（水平・ハードウェア微分） =====
  float g  = texture2D(u_glass, vUv).r;
  float dx = dFdx(g);

  // [px] 換算してから NDC に戻す
  float px = u_pixels / u_res.x;
  vec2 offset = vec2(dx * u_strength * amp * px, 0.0);

  // 安全弁：最終到達で完全ゼロ
  if (u_progress >= 0.999) offset = vec2(0.0);

  vec3 col = texture2D(u_img, vUv + offset).rgb;

  // 画像のフェードイン（アルファ制御）
  float alpha = u_fadeIn;
  gl_FragColor = vec4(col, alpha);
}
`;

type Props = {
  imageUrl: string;                // 完成画像URL
  onRevealDone?: () => void;       // リビール完了時（エフェクトOFF状態維持）
  showButtons?: boolean;           // 公開ボタン表示フラグ
  onPublish?: () => void;          // 公開ボタン押下時
  onSaveDraft?: () => void;        // ドラフト保存ボタン押下時
  active?: boolean;                // 互換性のため
  stripes?: number;                // default 48
  jitter?: number;                 // default 0.08
  strength?: number;               // default 0.9
  holdMs?: number;                 // default 3000 (エフェクトON状態で待機)
  revealMs?: number;               // default 1200 (左→右に解除)
  leftToRight?: boolean;           // default true

  // 旧パラメータ（互換性のため無視）
  durationMs?: number;
  amount?: number;
  glassScale?: [number, number];
  glassRotate?: number;
  maskFeather?: number;
  settleMs?: number;
  displayMs?: number;
  onDone?: () => void;
};

export default function GlassRevealCanvas({
  imageUrl, onRevealDone, showButtons = false, onPublish, onSaveDraft,
  active = true,
  stripes=48, jitter=0.08, strength=0.9,
  holdMs=3000, revealMs=1200,
  leftToRight=true,
}: Props){
  const ref = useRef<HTMLCanvasElement|null>(null);
  const onRevealDoneRef = useRef(onRevealDone);

  // onRevealDoneが変わったらrefを更新（useEffect再実行は防ぐ）
  useEffect(() => {
    onRevealDoneRef.current = onRevealDone;
  }, [onRevealDone]);

  useEffect(() => {
    if(!ref.current) return;

    const renderer = new THREE.WebGLRenderer({
      canvas: ref.current, antialias: true, alpha: true, premultipliedAlpha: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));

    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-1,1,1,-1,0,1);

    // 画像とガラステクスチャの読み込み
    const loader = new THREE.TextureLoader();
    let imgLoaded = false;
    let glassLoaded = false;
    let raf = 0;
    let t0 = 0;

    const texImg = loader.load(imageUrl, () => {
      const w = ref.current!.clientWidth || texImg.image.width;
      const h = ref.current!.clientHeight || texImg.image.height;
      renderer.setSize(w, h, false);
      (mat.uniforms.u_res.value as THREE.Vector2).set(w, h);
      imgLoaded = true;
      if (glassLoaded && !t0) startAnimation();
    });
    texImg.minFilter = THREE.LinearFilter; texImg.magFilter = THREE.LinearFilter;
    texImg.colorSpace = THREE.SRGBColorSpace;

    const texGlass = loader.load(glassURL, () => {
      glassLoaded = true;
      if (imgLoaded && !t0) startAnimation();
    });
    texGlass.wrapS = texGlass.wrapT = THREE.RepeatWrapping;
    texGlass.minFilter = THREE.LinearFilter;
    texGlass.magFilter = THREE.LinearFilter;
    texGlass.colorSpace = THREE.SRGBColorSpace;

    const geo = new THREE.PlaneGeometry(2,2);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        u_img: { value: texImg },
        u_glass: { value: texGlass },
        u_res: { value: new THREE.Vector2(1, 1) },
        u_progress: { value: 0 }, // 0..1
        u_fadeIn: { value: 0 },   // 0..1 画像フェードイン
        u_strength: { value: strength },
        u_pixels: { value: 80.0 }, // 最大屈折量 [px]（ストライプ横幅）
        u_edge: { value: 0.12 },   // 開く幅
        u_stripes: { value: stripes },
        u_jitter: { value: jitter },
        u_leftToRight: { value: leftToRight },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
    });
    // dFdx/dFdy を使うため derivatives 拡張を有効化（WebGL1対応）
    // @ts-ignore - derivatives プロパティは型定義にないが実行時には存在する
    mat.extensions.derivatives = true;
    scene.add(new THREE.Mesh(geo, mat));

    const fadeInMs = 400;  // フェードイン時間
    const settleMs = 700;  // リビール完了後の安定時間（エフェクト完全OFF確認用）
    const total = fadeInMs + holdMs + revealMs + settleMs;

    let revealDoneCalled = false;

    const render = () => {
      const t = performance.now() - t0;
      let p = 0;
      let fade = 0;

      if (t <= fadeInMs) {
        // フェードイン期間：画像が徐々に表示される
        fade = t / fadeInMs;
        p = 0;
      } else if (t <= fadeInMs + holdMs) {
        // ホールド期間：ガラスエフェクトON状態で待機
        fade = 1.0;
        p = 0;
      } else if (t <= fadeInMs + holdMs + revealMs) {
        // リビール期間：左から右に解除
        fade = 1.0;
        p = (t - fadeInMs - holdMs) / revealMs;
      } else if (t <= total) {
        // 安定期間：エフェクト完全OFF、ボタン表示前の余裕
        fade = 1.0;
        p = 1.0;
      } else {
        // 完了後もエフェクトOFF状態を維持
        fade = 1.0;
        p = 1.0;
      }

      (mat.uniforms.u_progress.value as number) = p;
      (mat.uniforms.u_fadeIn.value as number) = fade;

      renderer.render(scene, cam);

      // リビール＋安定期間完了時に一度だけonRevealDone呼び出し
      if (t >= total && !revealDoneCalled) {
        revealDoneCalled = true;
        onRevealDoneRef.current?.();
      }

      // アニメーションは継続（エフェクトOFF状態を表示し続ける）
      raf = requestAnimationFrame(render);
    };

    const startAnimation = () => {
      t0 = performance.now();
      raf = requestAnimationFrame(render);
    };

    const onResize = () => {
      const w = ref.current!.clientWidth, h = ref.current!.clientHeight;
      renderer.setSize(w, h, false);
      (mat.uniforms.u_res.value as THREE.Vector2).set(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      geo.dispose(); mat.dispose(); texImg.dispose(); texGlass.dispose();
      renderer.dispose();
    };
  }, [imageUrl, stripes, jitter, strength, holdMs, revealMs, leftToRight]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <canvas
        ref={ref}
        style={{ width: "100%", height: "100%", display: "block", pointerEvents: "none" }}
      />
      {showButtons && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "20px",
            background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)",
            display: "flex",
            gap: "12px",
            justifyContent: "center",
            pointerEvents: "auto",
          }}
        >
          <button
            onClick={onSaveDraft}
            style={{
              padding: "12px 24px",
              fontSize: "16px",
              fontWeight: 600,
              color: "#fff",
              background: "rgba(255,255,255,0.2)",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            ドラフトに保存
          </button>
          <button
            onClick={onPublish}
            style={{
              padding: "12px 24px",
              fontSize: "16px",
              fontWeight: 600,
              color: "#000",
              background: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            公開する
          </button>
        </div>
      )}
    </div>
  );
}
