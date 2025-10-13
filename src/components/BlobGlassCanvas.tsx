import { useEffect, useRef } from "react";
import * as THREE from "three";
import glassURL from "@/assets/glaspattern_82.png";

const VERT = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// ---- メタボールSDF + ストライプリビール式ガラス屈折 ----
const FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;

uniform float u_time;
uniform vec2  u_res;
uniform sampler2D u_glass;
uniform float u_pixels;       // 最大屈折量 [px]
uniform float u_glassScale;   // ガラステクスチャのスケール
uniform float u_baseAmp;      // 内側の強さ
uniform float u_edgeBoost;    // 縁のブースト
uniform float u_edgeWidthPx;  // 縁バンド幅 [px]
uniform float u_iso;          // SDF等値面
uniform vec3  u_tint;         // ガラス色味
uniform float u_tintMix;      // 色味の強さ
uniform float u_coreGain;     // コア発光の強さ
uniform float u_seed;

// ストライプリビール用パラメータ
uniform float u_progress;     // 0→1 (リビール進行度)
uniform float u_strength;     // 屈折強度係数 (0.6〜1.0)
uniform float u_edge;         // 開く幅 (0.08〜0.15)
uniform float u_stripes;      // ストライプ本数 (48)
uniform float u_jitter;       // ストライプタイミングのランダム化 (0.08)
uniform float u_leftToRight;  // 左→右方向か (1 or 0)
uniform float u_warpContour;  // 形を波打たせるか (0〜1)
uniform float u_contourPx;    // 輪郭押し量 [px] (2.0〜6.0)

// 有色コア用パラメータ
uniform vec2  u_centroidNdc;  // 重心座標 (NDC)
uniform vec3  u_coreColA;     // コア色(内)
uniform vec3  u_coreColB;     // コア色(外)
uniform float u_coreRadius;   // 0.20〜0.35
uniform float u_coreMix;      // 0.3〜0.7 加算寄与
uniform float u_coreAlpha;    // 0.0〜0.3 αの底上げ(霧)

uniform vec3  u_colA;     // 外側
uniform vec3  u_colB;     // 縁ハイライト
uniform vec3  u_coreCol;  // 核カラー

// --- noise（簡易） ---
float hash(float n){ return fract(sin(n)*43758.5453123); }
float n2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }

// fBm（低周波）
float fbm(vec2 p){
  float a=0.5; float f=0.0;
  for(int i=0;i<4;i++){ f+=a*n2(p); p*=2.03; a*=0.5; }
  return f;
}

// グローバル変数で重心を保持
vec2 g_center;

// メタボール場
float field(vec2 p){
  // アスペクト補正
  p.x *= u_res.x/u_res.y;

  // 4つのメタボールで有機的な形状
  float t = u_time*0.35;
  vec2 c0 = vec2( 0.0 + 0.28*sin(t+u_seed),        0.02 + 0.26*cos(t*0.9+u_seed));
  vec2 c1 = vec2(-0.22 + 0.24*cos(t*0.7+2.0),     -0.12 + 0.26*sin(t*1.1+1.3));
  vec2 c2 = vec2( 0.25 + 0.21*sin(t*0.6+3.1),     -0.05 + 0.23*cos(t*0.8+0.7));
  vec2 c3 = vec2( 0.05 + 0.19*sin(t*0.5+4.5),      0.20 + 0.20*cos(t*1.2+2.1));
  g_center = (c0+c1+c2+c3)/4.0;

  // スカラー場：exp(-k r^2) の和
  float k = 6.5;
  float F = 0.0;
  F += exp(-k*dot(p-c0,p-c0));
  F += exp(-k*dot(p-c1,p-c1));
  F += exp(-k*dot(p-c2,p-c2));
  F += exp(-k*dot(p-c3,p-c3));

  // 有機的な変形ノイズ
  float ang = atan(p.y, p.x);
  float spike3 = sin(ang*3.0 + t*0.4) * 0.08;
  float spike5 = sin(ang*5.0 - t*0.6) * 0.06;
  float spike7 = sin(ang*7.0 + t*0.3) * 0.04;
  F += spike3 + spike5 + spike7;

  return F;
}

// 擬似バックドロップ（縦グラデ＋微細ストライプ）
vec3 fakeBackdrop(vec2 uv){
  float stripes = 0.55 + 0.45 * sin((uv.x*1.2 + 0.02*sin(uv.y*6.283))*6.283*14.0);
  float vgrad = mix(0.98, 0.85, uv.y);
  return vec3(vgrad) * mix(0.9, 1.05, stripes);
}

void main(){
  vec2 ndc = vUv * 2.0 - 1.0;

  // --- ストライプの"開き具合" (写真リビールと同じ式) ---
  float x = vUv.x;
  float idx = floor(x * u_stripes);
  float s = idx / (u_stripes - 1.0);
  if (u_leftToRight < 0.5) s = 1.0 - s;
  float t0 = clamp(s + (hash(idx + 13.0) - 0.5) * u_jitter, 0.0, 1.0 - u_edge);
  float open = smoothstep(t0, t0 + u_edge, u_progress);
  float ampStripe = 1.0 - open;  // 開くほど0へ

  // --- ガラス勾配（2タップ差分で強化） ---
  float tap = 1.0 / u_res.x;
  vec2 gUv = vec2(vUv.x * u_glassScale, vUv.y);
  float g1 = texture2D(u_glass, gUv + vec2(tap, 0.0)).r;
  float g2 = texture2D(u_glass, gUv - vec2(tap, 0.0)).r;
  float dx = (g1 - g2);

  // Y方向の勾配も追加
  float g1y = texture2D(u_glass, gUv + vec2(0.0, tap)).r;
  float g2y = texture2D(u_glass, gUv - vec2(0.0, tap)).r;
  float dy = (g1y - g2y);

  // 初期SDF評価（縁マスク用）
  float F0 = field(ndc);
  float d0 = u_iso - F0;
  float pxToF = fwidth(d0);
  float edgeW = pxToF * u_edgeWidthPx;
  float edgeMask = 1.0 - smoothstep(edgeW, edgeW * 2.0, abs(d0));
  float ampShape = u_baseAmp + u_edgeBoost * edgeMask;

  // --- 色サンプル用オフセット ---
  float pxUV = u_pixels / u_res.x;
  float pxUVy = u_pixels / u_res.y;
  vec2 uvForColor = vUv + vec2(
    dx * u_strength * ampStripe * ampShape * pxUV,
    dy * u_strength * ampStripe * ampShape * pxUVy * 0.6
  );

  // --- 輪郭用オフセット（形に効かせる） ---
  vec2 ndcWarp = ndc + vec2(
    dx * u_contourPx / u_res.x,
    dy * u_contourPx / u_res.y * 0.6
  ) * ampStripe * ampShape * u_warpContour;

  // 進捗完了の安全弁（完全に元形状へ）
  if (u_progress >= 0.999) {
    uvForColor = vUv;
    ndcWarp = ndc;
  }

  // SDF を変形後座標で再評価
  float F = field(ndcWarp);
  float d = u_iso - F;
  float alpha = smoothstep(0.02, -0.04, d);

  // --- "中身"（擬似バックドロップ） ---
  vec3 inner = fakeBackdrop(uvForColor);

  // --- 有色コア（中心と外側に色、中間透過） ---
  vec2 pCore = ndcWarp - u_centroidNdc;
  float rCore = length(pCore);
  float core = exp(-pow(rCore / u_coreRadius, 2.0));  // ガウス（中心=1, 外=0）

  // 中間を透過させるためのマスク（山型 → 谷型）
  float midTransparency = 1.0 - smoothstep(0.3, 0.7, core) * smoothstep(0.7, 0.3, core) * 4.0;

  vec3 coreCol = mix(u_coreColB, u_coreColA, core);  // 外→中
  inner = mix(inner, coreCol, core * u_coreMix * midTransparency);  // 背景色とブレンド
  alpha *= midTransparency;  // 中間を透過

  // --- ガラスの色味 ---
  inner = mix(inner, inner * u_tint, u_tintMix);

  gl_FragColor = vec4(inner, alpha);
}
`;

type Props = {
  active?: boolean;
  targetA?: string;    // 外側色
  targetB?: string;    // 縁ハイライト
  coreCol?: string;    // 核カラー
  refract?: number;    // ガラス屈折強度
};

export default function BlobGlassCanvas({
  active = true,
  targetA = "#E2C6B8",
  targetB = "#98C7BE",
  coreCol = "#D6B7FF",
  refract = 0.8,
}: Props){
  const ref = useRef<HTMLCanvasElement | null>(null);
  const targetARef = useRef(targetA);
  const targetBRef = useRef(targetB);
  const coreColRef = useRef(coreCol);

  useEffect(() => {
    targetARef.current = targetA;
    targetBRef.current = targetB;
    coreColRef.current = coreCol;
  }, [targetA, targetB, coreCol]);

  useEffect(() => {
    if (!ref.current) return;

    const renderer = new THREE.WebGLRenderer({ canvas: ref.current, antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: "high-performance" });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1,1,1,-1,0,1);

    const tex = new THREE.TextureLoader().load(glassURL);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4; tex.colorSpace = THREE.SRGBColorSpace;

    const tintColor = new THREE.Color("#e7fff2");
    const coreColA = new THREE.Color("#B7F1E1");
    const coreColB = new THREE.Color("#7FB0A1");

    const geo = new THREE.PlaneGeometry(2,2);
    const mat = new THREE.ShaderMaterial({
      uniforms:{
        u_time:{value:0},
        u_res:{value:new THREE.Vector2(1,1)},
        u_glass:{value:tex},
        u_pixels:{value:80.0},        // 最大屈折量 [px]（写真リビールと同じ）
        u_glassScale:{value:0.65},    // ガラスタイル倍率（縦スリット本数）← 太くした
        u_baseAmp:{value:0.75},       // 内側の強さ
        u_edgeBoost:{value:0.55},     // 縁のブースト
        u_edgeWidthPx:{value:3.0},    // 縁バンド幅 [px]
        u_iso:{value:0.95},           // SDF等値面
        u_tint:{value:new THREE.Vector3(tintColor.r, tintColor.g, tintColor.b)}, // ガラス色味
        u_tintMix:{value:0.22},       // 色味の強さ
        u_coreGain:{value:0.25},      // 使用しない（互換性のため残す）
        u_seed:{value:Math.random()*1000},
        // ストライプリビール用パラメータ（写真と同じ）
        u_progress:{value:0.0},       // 0→1
        u_strength:{value:0.9},       // 屈折強度係数
        u_edge:{value:0.12},          // 開く幅
        u_stripes:{value:48.0},       // ストライプ本数
        u_jitter:{value:0.08},        // ジッター
        u_leftToRight:{value:1.0},    // 左→右
        u_warpContour:{value:1.0},    // 形を波打たせるか（0=写真っぽく、1=形も波打つ）
        u_contourPx:{value:4.0},      // 輪郭押し量 [px]
        // 有色コア用パラメータ
        u_centroidNdc:{value:new THREE.Vector2(0, 0)},  // 重心座標 (NDC)
        u_coreColA:{value:new THREE.Vector3(coreColA.r, coreColA.g, coreColA.b)},
        u_coreColB:{value:new THREE.Vector3(coreColB.r, coreColB.g, coreColB.b)},
        u_coreRadius:{value:0.35},    // 0.20〜0.35 ← コアサイズ
        u_coreMix:{value:0.85},       // 0.3〜1.0 色の強さ（中心と外側に色、中間透過）
        u_coreAlpha:{value:0.0},      // 使用しない
        u_colA:{value:new THREE.Color(targetA)},
        u_colB:{value:new THREE.Color(targetB)},
        u_coreCol:{value:new THREE.Color(coreCol)},
      },
      vertexShader: VERT, fragmentShader: FRAG, transparent: true
    });
    // dFdx/dFdy を使うため derivatives 拡張を有効化（WebGL1対応）
    // @ts-ignore - derivatives プロパティは型定義にないが実行時には存在する
    mat.extensions.derivatives = true;
    const mesh = new THREE.Mesh(geo,mat); scene.add(mesh);

    let raf=0; const t0=performance.now();
    let lastUpdate = performance.now();

    // 目標色へ滑らかに遷移（600msくらいの追従）
    const render=()=> {
      const now = performance.now();
      const dt = Math.min(1, (now - lastUpdate) / 600);
      lastUpdate = now;

      // lerp
      const colA = mat.uniforms.u_colA.value as THREE.Color;
      const colB = mat.uniforms.u_colB.value as THREE.Color;
      const colCore = mat.uniforms.u_coreCol.value as THREE.Color;
      colA.lerp(new THREE.Color(targetARef.current), dt);
      colB.lerp(new THREE.Color(targetBRef.current), dt);
      colCore.lerp(new THREE.Color(coreColRef.current), dt);

      // 重心を計算してuniformに渡す（シェーダと同じ計算）
      const t = (now - t0) / 1000 * 0.35;
      const seed = mat.uniforms.u_seed.value as number;
      const c0x = 0.0 + 0.28 * Math.sin(t + seed);
      const c0y = 0.02 + 0.26 * Math.cos(t * 0.9 + seed);
      const c1x = -0.22 + 0.24 * Math.cos(t * 0.7 + 2.0);
      const c1y = -0.12 + 0.26 * Math.sin(t * 1.1 + 1.3);
      const c2x = 0.25 + 0.21 * Math.sin(t * 0.6 + 3.1);
      const c2y = -0.05 + 0.23 * Math.cos(t * 0.8 + 0.7);
      const c3x = 0.05 + 0.19 * Math.sin(t * 0.5 + 4.5);
      const c3y = 0.20 + 0.20 * Math.cos(t * 1.2 + 2.1);
      const cx = (c0x + c1x + c2x + c3x) / 4;
      const cy = (c0y + c1y + c2y + c3y) / 4;
      (mat.uniforms.u_centroidNdc.value as THREE.Vector2).set(cx, cy);

      (mat.uniforms.u_time.value as number) = (now - t0)/1000;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };

    const ro = new ResizeObserver((es)=>{
      const cr=es[0].contentRect;
      const w=Math.max(1,cr.width|0), h=Math.max(1,cr.height|0);
      renderer.setSize(w,h,false);
      (mat.uniforms.u_res.value as THREE.Vector2).set(w,h);
    });
    ro.observe(ref.current);

    const vis=()=>{ cancelAnimationFrame(raf); if(!document.hidden && active) raf=requestAnimationFrame(render); };
    document.addEventListener("visibilitychange", vis);
    if (active) raf=requestAnimationFrame(render);

    return ()=>{ cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", vis); ro.disconnect(); geo.dispose(); (mat as any).dispose?.(); tex.dispose(); renderer.dispose(); };
  }, [active, refract]);

  return <canvas ref={ref} style={{width:"100%",height:"100%",display:"block",pointerEvents:"none",willChange:"transform,opacity"}}/>;
}
