import { useEffect, useRef } from "react";
import * as THREE from "three";
import glassURL from "@/assets/glaspattern_82.png";

const VERT = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// ---- メタボールSDF + fBm + ガラス縦スリット ----
const FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;

uniform float u_time;
uniform vec2  u_res;
uniform sampler2D u_glass;
uniform float u_refract;
uniform float u_pixels;      // 最大屈折量 [px]
uniform float u_glassScale;  // ガラステクスチャのスケール
uniform float u_ribShade;    // 0.0〜0.4: 明暗コントラスト
uniform float u_ribAlpha;    // 0.0〜0.25: 透明度への効き
uniform float u_seed;

uniform vec3  u_colA;     // 外側
uniform vec3  u_colB;     // 縁ハイライト
uniform vec3  u_coreCol;  // 核カラー

// --- noise（簡易） ---
float hash(float n){ return fract(sin(n)*43758.5453); }
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

  // 4つのメタボールで有機的な形状（はみ出さないサイズに調整）
  float t = u_time*0.35;
  vec2 c0 = vec2( 0.0 + 0.28*sin(t+u_seed),        0.02 + 0.26*cos(t*0.9+u_seed));
  vec2 c1 = vec2(-0.22 + 0.24*cos(t*0.7+2.0),     -0.12 + 0.26*sin(t*1.1+1.3));
  vec2 c2 = vec2( 0.25 + 0.21*sin(t*0.6+3.1),     -0.05 + 0.23*cos(t*0.8+0.7));
  vec2 c3 = vec2( 0.05 + 0.19*sin(t*0.5+4.5),      0.20 + 0.20*cos(t*1.2+2.1));
  g_center = (c0+c1+c2+c3)/4.0;

  // スカラー場：exp(-k r^2) の和（k値を上げて一体化）
  float k = 6.5;
  float F = 0.0;
  F += exp(-k*dot(p-c0,p-c0));
  F += exp(-k*dot(p-c1,p-c1));
  F += exp(-k*dot(p-c2,p-c2));
  F += exp(-k*dot(p-c3,p-c3));

  // 有機的な変形ノイズ（控えめに）
  float ang = atan(p.y, p.x);
  float r = length(p);
  float spike3 = sin(ang*3.0 + t*0.4) * 0.08;
  float spike5 = sin(ang*5.0 - t*0.6) * 0.06;
  float spike7 = sin(ang*7.0 + t*0.3) * 0.04;
  F += spike3 + spike5 + spike7;

  return F;
}

void main(){
  vec2 uv = vUv*2.0-1.0;

  // ガラステクスチャから水平勾配を取得（dFdx使用）
  vec2 gUv = vec2(vUv.x * u_glassScale, vUv.y);
  float h = texture2D(u_glass, gUv).r;
  float dx = dFdx(h);

  // ピクセル換算してから NDC に戻す
  float px = u_pixels / u_res.x;
  vec2 refractOffset = vec2(dx * u_refract * px, 0.0);

  // 形状評価（元のUV）
  float F = field(uv);
  vec2 center = g_center;

  // iso面（内外の境界） - k値を上げたので調整
  float iso = 1.2;
  float d = iso - F;
  float alpha = smoothstep(0.02, -0.05, d);

  // 時間で色相をわずかに往復
  float w = 0.5 + 0.5*sin(u_time*0.25);
  vec3 baseA = mix(u_colA, u_colB, 0.15*w);
  vec3 baseB = mix(u_colB, u_colA, 0.10*(1.0-w));

  // 色をガラス屈折UVでサンプリング（vUv→uv変換してからfbm）
  vec2 colorUv = (vUv + refractOffset) * 2.0 - 1.0;
  vec3 col = mix(baseA, baseB, 0.5 + 0.5*fbm(colorUv*2.0 + u_time*0.1));

  // コア部分は完全に透過（背景色になる）
  vec2 uvCorr = uv; uvCorr.x *= u_res.x/u_res.y;
  vec2 centCorr = center; centCorr.x *= u_res.x/u_res.y;
  float rCore = length(uvCorr - centCorr);
  float coreMask = smoothstep(0.35, 0.0, rCore);

  // コアは透過するのでアルファを下げる
  alpha *= (1.0 - coreMask * 0.8);

  // ===== 擬似ガラス効果（縦スリット陰影） =====
  // 1) ガラステクスチャをタイルして縦スリット強調
  vec2 ribUv = vec2(vUv.x * u_glassScale, vUv.y);
  float ribHeight = texture2D(u_glass, ribUv).r;

  // ハイパスっぽくメリハリを付ける
  float rib = smoothstep(0.35, 0.65, ribHeight);
  rib = pow(abs(rib - 0.5) * 2.0, 0.9);

  // 2) 合成：色の明暗＋アルファへも少し反映
  col = mix(col * (1.0 - u_ribShade), col * (1.0 + u_ribShade), rib);
  alpha = clamp(alpha * (1.0 - u_ribAlpha * rib), 0.0, 1.0);

  gl_FragColor = vec4(col, alpha);
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

    const geo = new THREE.PlaneGeometry(2,2);
    const mat = new THREE.ShaderMaterial({
      uniforms:{
        u_time:{value:0},
        u_res:{value:new THREE.Vector2(1,1)},
        u_glass:{value:tex},
        u_refract:{value:refract},
        u_pixels:{value:12.0},       // 最大屈折量 [px]
        u_glassScale:{value:1.2},    // ガラスタイル倍率（縦スリット本数）
        u_ribShade:{value:0.18},     // 明暗コントラスト
        u_ribAlpha:{value:0.10},     // 透明度への効き
        u_seed:{value:Math.random()*1000},
        u_colA:{value:new THREE.Color(targetA)},
        u_colB:{value:new THREE.Color(targetB)},
        u_coreCol:{value:new THREE.Color(coreCol)},
      },
      vertexShader: VERT, fragmentShader: FRAG, transparent: true
    });
    // dFdx/dFdy を使うため derivatives 拡張を有効化（WebGL1対応）
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
