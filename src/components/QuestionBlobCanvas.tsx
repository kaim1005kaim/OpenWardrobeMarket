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

  // 3つのメタボールを時間でスイング（サイズ大きく）
  float t = u_time*0.35;
  vec2 c0 = vec2( 0.0 + 0.35*sin(t+u_seed),  0.02 + 0.30*cos(t*0.9+u_seed));
  vec2 c1 = vec2(-0.28 + 0.28*cos(t*0.7+2.0),-0.15 + 0.32*sin(t*1.1+1.3));
  vec2 c2 = vec2( 0.32 + 0.25*sin(t*0.6+3.1),-0.06 + 0.28*cos(t*0.8+0.7));
  g_center = (c0+c1+c2)/3.0;

  // スカラー場：exp(-k r^2) の和
  float k = 5.5;  // 少し下げてサイズ大きく
  float F = 0.0;
  F += exp(-k*dot(p-c0,p-c0));
  F += exp(-k*dot(p-c1,p-c1));
  F += exp(-k*dot(p-c2,p-c2));

  // 低周波ノイズで輪郭をわずかに揺らす
  F += 0.12*fbm(p*1.0 + vec2(t*0.2, -t*0.17));  // 周波数下げる

  return F;
}

void main(){
  vec2 uv = vUv*2.0-1.0;
  float F = field(uv);
  vec2 center = g_center;

  // iso面（内外の境界） - iso値下げて滑らかに
  float iso = 0.88;
  float d = iso - F;              // 負:内側 / 正:外側
  float edge = smoothstep(0.03, 0.0, abs(d));
  float alpha = smoothstep(0.02, -0.05, d);  // 幅広げて滑らか

  // 時間で色相をわずかに往復（全体のトーン変化）
  float w = 0.5 + 0.5*sin(u_time*0.25);
  vec3 baseA = mix(u_colA, u_colB, 0.15*w);
  vec3 baseB = mix(u_colB, u_colA, 0.10*(1.0-w));

  // ---- ガラス縦スリット屈折（水平のみ） ----
  // まず屈折用のオフセットを計算
  float g = texture2D(u_glass, vUv).r;
  float gL = texture2D(u_glass, vUv + vec2(-1.0/u_res.x, 0.0)).r;
  float dx = (g - gL);

  // 屈折を適用したUVで再サンプリング
  vec2 distortedUv = uv + vec2(dx, 0.0) * u_refract * 2.5;
  vec2 distortedUvCorr = distortedUv; distortedUvCorr.x *= u_res.x/u_res.y;

  // 屈折後の色を再計算
  vec3 col = mix(baseA, baseB, 0.5 + 0.5*fbm(distortedUv*2.0 + u_time*0.1));

  // 核は屈折後の座標で
  vec2 distortedCentCorr = center; distortedCentCorr.x *= u_res.x/u_res.y;
  float rCoreDistorted = length(distortedUvCorr - distortedCentCorr);
  float coreMaskDistorted = smoothstep(0.45, 0.0, rCoreDistorted + 0.12*fbm(distortedUv*1.1 + u_time*0.15));

  // 核の加算（内側のみ）
  col = mix(col, u_coreCol, coreMaskDistorted * 0.85);
  // 縁ハイライト
  col += 0.12*edge;

  gl_FragColor = vec4(col, alpha);
}
`;

type Props = {
  active?: boolean;
  coreCol?: string;    // 核カラー
  refract?: number;    // ガラス屈折強度
};

export default function QuestionBlobCanvas({
  active = true,
  coreCol = "#FFD6B7",
  refract = 0.8,
}: Props){
  const ref = useRef<HTMLCanvasElement | null>(null);
  const coreColRef = useRef(coreCol);

  useEffect(() => {
    coreColRef.current = coreCol;
  }, [coreCol]);

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

    // 固定の青系カラー
    const colA = new THREE.Color("#A0C4E8");
    const colB = new THREE.Color("#6BA4D8");

    const geo = new THREE.PlaneGeometry(2,2);
    const mat = new THREE.ShaderMaterial({
      uniforms:{
        u_time:{value:0},
        u_res:{value:new THREE.Vector2(1,1)},
        u_glass:{value:tex},
        u_refract:{value:refract},
        u_seed:{value:Math.random()*1000},
        u_colA:{value:colA},
        u_colB:{value:colB},
        u_coreCol:{value:new THREE.Color(coreCol)},
      },
      vertexShader: VERT, fragmentShader: FRAG, transparent: true
    });
    const mesh = new THREE.Mesh(geo,mat); scene.add(mesh);

    let raf=0; const t0=performance.now();
    let lastUpdate = performance.now();

    const render=()=> {
      const now = performance.now();
      const dt = Math.min(1, (now - lastUpdate) / 600);
      lastUpdate = now;

      // lerp core color
      const colCore = mat.uniforms.u_coreCol.value as THREE.Color;
      colCore.lerp(new THREE.Color(coreColRef.current), dt);

      (mat.uniforms.u_time.value as number) = (now - t0)/1000;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };

    const ro = new ResizeObserver((es)=>{ const cr=es[0].contentRect; const w=Math.max(1,cr.width|0), h=Math.max(1,cr.height|0); renderer.setSize(w,h,false); (mat.uniforms.u_res.value as THREE.Vector2).set(w,h); });
    ro.observe(ref.current);

    const vis=()=>{ cancelAnimationFrame(raf); if(!document.hidden && active) raf=requestAnimationFrame(render); };
    document.addEventListener("visibilitychange", vis);
    if (active) raf=requestAnimationFrame(render);

    return ()=>{ cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", vis); ro.disconnect(); geo.dispose(); (mat as any).dispose?.(); tex.dispose(); renderer.dispose(); };
  }, [active, refract]);

  return <canvas ref={ref} style={{width:"100%",height:"100%",display:"block",pointerEvents:"none",willChange:"transform,opacity"}}/>;
}
