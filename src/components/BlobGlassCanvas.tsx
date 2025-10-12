import { useEffect, useRef } from "react";
import * as THREE from "three";
import glassURL from "@/assets/glaspattern_82.png";

const VERT = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// ---- アメーバ＋PSガラス＋円形ソフトマスク ----
const FRAG = /* glsl */`
precision highp float;
uniform float u_time;
uniform vec2  u_res;
uniform sampler2D u_glass;
uniform float u_seed;
uniform vec3  u_colA, u_colB;    // テーマ色2つ (linear)
uniform float u_maskFeather;     // 0.0~0.5

// Photoshop Glass パラメータ
uniform float u_psScale;     // 0.82 = 82%
uniform float u_psSmooth;    // 0..1 (滑らかさ)
uniform float u_psDistort;   // 歪み量

varying vec2 vUv;

// --- utilities ---
mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
vec3 cosPalette(float t, vec3 a, vec3 b, vec3 c, vec3 d){
  return a + b * cos(6.28318*(c*t + d)); // iq
}
vec3 toLinear(vec3 c){ return pow(c, vec3(2.2)); }
vec3 toSRGB(vec3 c){ return pow(c, vec3(1.0/2.2)); }

// simplex 2D（Ashima）
vec3 mod289(vec3 x){ return x - floor(x*(1.0/289.0))*289.0; }
vec2 mod289(vec2 x){ return x - floor(x*(1.0/289.0))*289.0; }
vec3 permute(vec3 x){ return mod289((x*34.0+1.0)*x); }
float snoise(vec2 v){
  const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i=floor(v+dot(v,C.yy)); vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=x0.x>x0.y?vec2(1.,0.):vec2(0.,1.);
  vec2 x1=x0-i1+1.*C.xx; vec2 x2=x0-1.+2.*C.xx;
  i=mod289(i); vec3 p=permute(permute(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));
  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x1,x1),dot(x2,x2)),0.); m*=m; m*=m;
  vec3 x=2.*fract(p*C.www)-1.; vec3 h=abs(x)-0.5; vec3 ox=floor(x+0.5); vec3 a0=x-ox;
  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
  vec3 g; g.x=a0.x*x0.x+h.x*x0.y; g.y=a0.y*x1.x+h.y*x1.y; g.z=a0.z*x2.x+h.z*x2.y;
  return 130.*dot(m,g);
}

// ガウシアン 9tap（簡易）
float blur9(sampler2D t, vec2 uv, vec2 px, float k){
  vec2 o = px * mix(0.0, 2.0, k);
  float s =
    texture2D(t, uv).r * 0.227 +
    texture2D(t, uv + vec2( o.x, 0.)).r * 0.194 +
    texture2D(t, uv + vec2(-o.x, 0.)).r * 0.194 +
    texture2D(t, uv + vec2( 0.,  o.y)).r * 0.194 +
    texture2D(t, uv + vec2( 0., -o.y)).r * 0.194 +
    texture2D(t, uv + vec2( o.x,  o.y)).r * 0.121 +
    texture2D(t, uv + vec2(-o.x,  o.y)).r * 0.121 +
    texture2D(t, uv + vec2( o.x, -o.y)).r * 0.121 +
    texture2D(t, uv + vec2(-o.x, -o.y)).r * 0.121;
  return s;
}

struct Blob { vec3 col; float alpha; };

Blob evalBlob(vec2 uv, float time, float seed, vec2 distortOffset){
  // UV -> 中央基準＋アスペクト補正
  vec2 st = uv - 0.5; st.x *= u_res.x / u_res.y;

  // ガラスエフェクトの歪みをシェイプ自体に適用
  st += distortOffset * 0.12;

  // 角度と半径（極座標）
  float ang = atan(st.y, st.x);
  float r = length(st);

  // 時間変化するタービュランス（アメーバのように動的に変形）
  float turbTime1 = time * 0.35;
  float turbTime2 = time * 0.52;
  float turbTime3 = time * 0.28;
  float turbTime4 = time * 0.41;

  // 多層ノイズで複雑な変形（角度依存）
  float n0 = snoise(st*2.8 + vec2(turbTime1, seed));
  float n1 = snoise(st*6.5 + vec2(-turbTime2, seed*3.1));
  float n2 = snoise(st*4.2 + vec2(turbTime3*0.7, seed*1.5));
  float n3 = snoise(vec2(ang*4.0, r*8.0) + turbTime4); // 角度で変形

  // 外側の半径（角度依存で変形）
  float rOuter = 0.32 + 0.12*n0 + 0.08*abs(n1) + 0.05*n2 + 0.06*n3*sin(ang*3.0 + time*0.4);

  // 内側の穴の半径（ドーナツ形状、角度依存で変形してアメーバに）
  float innerNoise1 = snoise(vec2(ang*5.0, time*0.6 + seed));
  float innerNoise2 = snoise(vec2(ang*8.0, time*0.45 + seed*2.0));
  float innerNoise3 = snoise(vec2(ang*3.0 + time*0.3, r*10.0));
  float rInner = 0.08 + 0.05*innerNoise1 + 0.03*innerNoise2 + 0.02*innerNoise3;

  // SDF：ドーナツ形状
  float distOuter = r - rOuter;
  float distInner = r - rInner;
  float d = max(distOuter, -distInner); // ドーナツ

  // カラー：時間で滑らかに遷移（cosパレット）
  float ht = fract(0.08*time + seed*0.01);
  vec3 base = cosPalette(ht,
    u_colA*0.45 + u_colB*0.15,
    vec3(0.40), vec3(1.0,0.9,0.8), vec3(0.05,0.33,0.67));

  // 真ん中に不定形のコアエフェクト（色が見える有機的な形状）
  float coreDist = r;

  // 不定形のコア形状（時間で動的に変化）
  float coreShape1 = snoise(st*8.0 + vec2(time*0.5, seed));
  float coreShape2 = snoise(st*12.0 + vec2(-time*0.7, seed*1.8));
  float coreShape3 = snoise(vec2(ang*6.0 + time*0.6, coreDist*15.0));

  // 不定形の強度（0〜1）
  float corePattern = (coreShape1 + coreShape2*0.6 + coreShape3*0.4) * 0.5 + 0.5;
  corePattern = pow(corePattern, 2.0); // コントラスト強化

  // コアの可視範囲（穴の中）
  float coreVisibility = smoothstep(rInner + 0.03, rInner - 0.01, coreDist);
  float coreStrength = corePattern * coreVisibility;

  // コアの色（テーマ色の明るいバージョン）
  vec3 coreCol = mix(u_colA, u_colB, 0.5 + 0.3*sin(time*0.5 + seed)); // 時間で変化
  coreCol = mix(coreCol, vec3(1.0), 0.15); // 少し明るく

  vec3 col = mix(base, coreCol, coreStrength * 0.8);

  // 微細な縦筋（内部の流体感）
  col += 0.06 * snoise(vec2(st.y*9.0 + time*0.9, seed));

  // ソフトな縁のハイライト（外側）
  float edgeOuter = smoothstep(0.018, 0.0, abs(distOuter));
  col += 0.10 * edgeOuter;

  // 内側の縁もハイライト
  float edgeInner = smoothstep(0.015, 0.0, abs(distInner)) * step(distInner, 0.0);
  col += 0.08 * edgeInner;

  float alpha = smoothstep(0.02, -0.03, d);
  Blob b; b.col = col; b.alpha = alpha; return b;
}

void main(){
  // === Photoshop Glass エミュレーション ===
  // UV をスケール変換（82% = テクスチャを両方向に縮小）
  vec2 gUv = (vUv - 0.5) * (1.0 / u_psScale) + 0.5;

  vec2 px = 1.0 / u_res;
  float hRaw = texture2D(u_glass, gUv).r;
  // 滑らかさ適用
  float h = mix(hRaw, blur9(u_glass, gUv, px, 1.0), u_psSmooth);

  // 勾配（PSの"変形"）
  vec2 grad = vec2(dFdx(h), dFdy(h));

  // ストライプごとに上下にずらす（Y方向のオフセット追加）
  float stripeFreq = 50.0;
  float stripePhase = vUv.x * stripeFreq;
  float stripeOffset = sin(stripePhase * 6.28318) * 0.5 + 0.5;

  // Y方向オフセットを追加（ストライプごとに違う）
  vec2 distortOffset = vec2(grad.x, grad.y + stripeOffset * 0.15) * u_psDistort;

  // ガラスエフェクトを形状に適用して評価
  Blob b = evalBlob(vUv, u_time, u_seed, distortOffset);

  // コア部分に同じ動きをする同色のエフェクト追加
  vec2 stCore = (vUv - 0.5); stCore.x *= u_res.x / u_res.y;
  stCore += distortOffset * 0.12;
  float coreDist = length(stCore);
  float coreEffect = exp(-coreDist * 5.0);
  vec3 coreColor = mix(b.col, mix(u_colB, u_colA, 0.7), 0.5);
  vec3 col = b.col + coreColor * coreEffect * 0.35;

  // ---- 円形ソフトマスク（四隅を完全に隠す） ----
  vec2 st = (vUv - 0.5); st.x *= u_res.x/u_res.y;
  float aspect = u_res.x / u_res.y;
  float radius = aspect < 1.0 ? 0.42 : 0.42 / aspect;
  float dist = length(st);
  float mask = smoothstep(radius, radius - u_maskFeather, dist);

  // エフェクト自体も円内に収める
  float contentMask = smoothstep(radius + 0.08, radius - 0.02, dist);
  float a = b.alpha * contentMask * (1.0 - mask);

  gl_FragColor = vec4(toSRGB(col), a);
}
`;

type Props = {
  active?: boolean;
  maskFeather?: number;
  targetA?: string;  // 目標色（外側）
  targetB?: string;  // 目標色（コア）
  psScale?: number;  // 0.82 = 82%
  psSmooth?: number; // 0..1 滑らかさ
  psDistort?: number; // 歪み量
};

export default function BlobGlassCanvas({
  active = true,
  maskFeather = 0.08,
  targetA = "#E2C6B8",
  targetB = "#98C7BE",
  psScale = 0.82,
  psSmooth = 0.6,
  psDistort = 0.90,
}: Props){
  const ref = useRef<HTMLCanvasElement | null>(null);
  const targetARef = useRef(targetA);
  const targetBRef = useRef(targetB);

  useEffect(() => {
    targetARef.current = targetA;
    targetBRef.current = targetB;
  }, [targetA, targetB]);

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
        u_seed:{value:Math.random()*1000},
        u_colA:{value:new THREE.Color(targetA).convertSRGBToLinear()},
        u_colB:{value:new THREE.Color(targetB).convertSRGBToLinear()},
        u_maskFeather:{value:maskFeather},
        u_psScale:{value:psScale},
        u_psSmooth:{value:psSmooth},
        u_psDistort:{value:psDistort},
      },
      vertexShader: VERT, fragmentShader: FRAG, transparent: true
    });
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
      colA.lerp(new THREE.Color(targetARef.current).convertSRGBToLinear(), dt);
      colB.lerp(new THREE.Color(targetBRef.current).convertSRGBToLinear(), dt);

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
  }, [active, maskFeather, psScale, psSmooth, psDistort]);

  return <canvas ref={ref} style={{width:"100%",height:"100%",display:"block",pointerEvents:"none",willChange:"transform,opacity"}}/>;
}
