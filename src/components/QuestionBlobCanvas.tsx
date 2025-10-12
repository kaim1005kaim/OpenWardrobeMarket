import { useEffect, useRef } from "react";
import * as THREE from "three";
import glassURL from "@/assets/glaspattern_82.png";

const VERT = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// 設問段階のProceduralアニメーション（PSガラス版）
const FRAG = /* glsl */`
precision highp float;
uniform float u_time;
uniform vec2  u_res;
uniform sampler2D u_glass;
uniform float u_seed;
uniform vec3  u_colA, u_colB;
uniform float u_morphType; // 0-4: 形状の種類
uniform float u_transition; // 0-1: 遷移の進行度
uniform float u_maskFeather; // 円形マスクのフェザー

// Photoshop Glass パラメータ
uniform float u_psScale;
uniform float u_psSmooth;
uniform float u_psDistort;

varying vec2 vUv;

// --- utilities ---
vec3 cosPalette(float t, vec3 a, vec3 b, vec3 c, vec3 d){
  return a + b * cos(6.28318*(c*t + d)); // iq
}
vec3 toSRGB(vec3 c){ return pow(c, vec3(1.0/2.2)); }

// simplex 2D
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

// ガウシアン 9tap
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

// 形状1: パルス同心円（鼓動を遅く）
float shape1(vec2 st, float time){
  float d = length(st);
  float n = snoise(st * 3.5 + time * 0.3);
  float pulse = sin(d * 12.0 - time * 1.8) * 0.5 + 0.5;
  return smoothstep(0.4, 0.6, pulse + n * 0.2);
}

// 形状2: 回転四角形（ゆっくり回転）
float shape2(vec2 st, float time){
  float angle = time * 0.2;
  float c = cos(angle), s = sin(angle);
  vec2 rotated = vec2(st.x * c - st.y * s, st.x * s + st.y * c);
  vec2 q = abs(rotated);
  float n = snoise(rotated * 4.0 + time * 0.3);
  float box = max(q.x, q.y) - 0.25 - n * 0.15;
  return smoothstep(0.03, -0.01, box);
}

// 形状3: 有機的ドーナツ（タービュランスで動的変形＋真ん中に不定形コア）
float shape3(vec2 st, float time){
  float ang = atan(st.y, st.x);
  float r = length(st);

  // 時間変化するタービュランス
  float turbTime1 = time * 0.38;
  float turbTime2 = time * 0.59;
  float turbTime3 = time * 0.31;
  float turbTime4 = time * 0.44;

  // 多層ノイズで複雑な変形（角度依存）
  float n0 = snoise(st * 5.0 + turbTime1);
  float n1 = snoise(vec2(ang * 3.0, r * 7.0) + turbTime2);
  float n2 = snoise(st * 2.5 - turbTime3);
  float n3 = snoise(vec2(ang * 6.0, r * 9.0) + turbTime4);

  // 外側の半径（角度依存で変形）
  float rOuter = 0.32 + n0 * 0.20 + n1 * 0.15 + n2 * 0.10 + n3 * 0.08 * sin(ang * 4.0 + time * 0.45);

  // 内側の穴の半径（角度依存で変形してアメーバに）
  float innerNoise1 = snoise(vec2(ang * 7.0, time * 0.65));
  float innerNoise2 = snoise(vec2(ang * 10.0, time * 0.48));
  float innerNoise3 = snoise(vec2(ang * 4.0 + time * 0.35, r * 12.0));
  float rInner = 0.08 + 0.06*innerNoise1 + 0.04*innerNoise2 + 0.03*innerNoise3;

  // ドーナツSDF
  float distOuter = r - rOuter;
  float distInner = r - rInner;
  float dist = max(distOuter, -distInner);

  // メインのドーナツ形状
  float donut = smoothstep(0.04, -0.02, dist);

  // 真ん中に不定形のコアパターンを追加
  float coreShape1 = snoise(st * 10.0 + vec2(time * 0.55, 0.0));
  float coreShape2 = snoise(st * 14.0 + vec2(-time * 0.72, 0.0));
  float corePattern = (coreShape1 + coreShape2 * 0.7) * 0.5 + 0.5;
  corePattern = pow(corePattern, 2.5);

  // コアの可視範囲（穴の中）
  float coreVisibility = smoothstep(rInner + 0.04, rInner - 0.01, r);
  float core = corePattern * coreVisibility * 0.6;

  return donut + core;
}

// 形状4: 波打つ縦ストライプ（ゆっくり波打つ）
float shape4(vec2 st, float time){
  float n = snoise(vec2(st.x * 15.0 + time * 0.4, st.y * 3.0));
  float wave = sin(st.y * 8.0 + time * 1.2) * 0.1;
  float lines = sin((st.x + n * 0.15 + wave) * 50.0 + time * 1.2);
  return smoothstep(0.2, 0.8, (lines + 1.0) * 0.5);
}

// 形状5: 複雑モアレ（ゆっくり回転）
float shape5(vec2 st, float time){
  float n = snoise(st * 8.0 + time * 0.3);
  float lines1 = sin((st.x * st.y + n * 0.3) * 70.0 + time * 1.5);
  float lines2 = sin((st.x - st.y) * 65.0 + time * 1.2);
  float lines3 = sin(length(st) * 80.0 - time * 1.8);
  return smoothstep(0.1, 0.9, (lines1 * lines2 * lines3 + 1.0) * 0.5);
}

// 形状評価
struct Shape { vec3 col; float val; };

Shape evalShape(vec2 uv, float time, vec2 distortOffset){
  vec2 st = uv - 0.5;
  st.x *= u_res.x / u_res.y;

  // ガラスエフェクトの歪みをシェイプ自体に適用
  st += distortOffset * 0.12;

  float val = 0.0;

  // morphType に応じて形状を切り替え
  if (u_morphType < 0.5) {
    val = shape1(st, time);
  } else if (u_morphType < 1.5) {
    val = shape2(st, time);
  } else if (u_morphType < 2.5) {
    val = shape3(st, time);
  } else if (u_morphType < 3.5) {
    val = shape4(st, time);
  } else {
    val = shape5(st, time);
  }

  // トランジションでブレンド
  val = mix(val * 0.3, val, u_transition);

  // カラー：cosパレットで時間変化
  float ht = fract(0.06*time + u_seed*0.01);
  vec3 base = cosPalette(ht,
    u_colA*0.5 + u_colB*0.2,
    vec3(0.45), vec3(1.0,0.9,0.85), vec3(0.1,0.3,0.6));

  // 値に応じて2色をミックス
  vec3 col = mix(base, mix(u_colB, u_colA, 0.7), val * 0.6);

  // 中心のグロー効果
  float centerGlow = exp(-length(st) * 2.0);
  col += mix(u_colA, u_colB, 0.5) * centerGlow * 0.3;

  Shape s; s.col = col; s.val = val; return s;
}

void main(){
  // === Photoshop Glass エミュレーション ===
  // UV をスケール変換（82% = テクスチャを両方向に縮小）
  vec2 gUv = (vUv - 0.5) * (1.0 / u_psScale) + 0.5;
  vec2 px = 1.0 / u_res;
  float hRaw = texture2D(u_glass, gUv).r;
  float h = mix(hRaw, blur9(u_glass, gUv, px, 1.0), u_psSmooth);

  vec2 grad = vec2(dFdx(h), dFdy(h));

  // ストライプごとに上下にずらす（Y方向のオフセット追加）
  float stripeFreq = 50.0;
  float stripePhase = vUv.x * stripeFreq;
  float stripeOffset = sin(stripePhase * 6.28318) * 0.5 + 0.5;

  // Y方向オフセットを追加（ストライプごとに違う）
  vec2 distortOffset = vec2(grad.x, grad.y + stripeOffset * 0.15) * u_psDistort;

  // ガラスエフェクトを形状に適用して評価
  Shape base = evalShape(vUv, u_time, distortOffset);

  // コア部分に同じ動きをする同色のエフェクト追加
  vec2 stCore = (vUv - 0.5); stCore.x *= u_res.x / u_res.y;
  stCore += distortOffset * 0.12;
  float coreDist = length(stCore);
  float coreEffect = exp(-coreDist * 5.0);
  vec3 coreColor = mix(base.col, mix(u_colB, u_colA, 0.7), 0.5);
  vec3 col = base.col + coreColor * coreEffect * 0.35;

  // ---- 円形ソフトマスク（四隅を完全に隠す） ----
  vec2 st = (vUv - 0.5); st.x *= u_res.x/u_res.y;
  float aspect = u_res.x / u_res.y;
  float radius = aspect < 1.0 ? 0.42 : 0.42 / aspect;
  float dist = length(st);
  float mask = smoothstep(radius, radius - u_maskFeather, dist);

  // エフェクト自体も円内に収める
  float contentMask = smoothstep(radius + 0.08, radius - 0.02, dist);
  float alpha = base.val * contentMask * (1.0 - mask) * 0.95;

  gl_FragColor = vec4(toSRGB(col), alpha);
}
`;

type Props = {
  active?: boolean;
  morphType?: number;
  colorA?: string;
  colorB?: string;
  transition?: number;
  maskFeather?: number;
  psScale?: number;
  psSmooth?: number;
  psDistort?: number;
};

export default function QuestionBlobCanvas({
  active = true,
  morphType = 0,
  colorA = "#F4DDD4",
  colorB = "#D4887A",
  transition = 1.0,
  maskFeather = 0.12,
  psScale = 0.82,
  psSmooth = 0.6,
  psDistort = 0.90,
}: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const morphTypeRef = useRef(morphType);
  const transitionRef = useRef(transition);
  const colorARef = useRef(colorA);
  const colorBRef = useRef(colorB);

  useEffect(() => {
    morphTypeRef.current = morphType;
  }, [morphType]);

  useEffect(() => {
    transitionRef.current = transition;
  }, [transition]);

  useEffect(() => {
    colorARef.current = colorA;
    colorBRef.current = colorB;
  }, [colorA, colorB]);

  useEffect(() => {
    if (!ref.current) return;

    const renderer = new THREE.WebGLRenderer({
      canvas: ref.current,
      antialias: true,
      alpha: true,
      premultipliedAlpha: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const tex = new THREE.TextureLoader().load(glassURL);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4; tex.colorSpace = THREE.SRGBColorSpace;

    const geo = new THREE.PlaneGeometry(2, 2);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        u_time: { value: 0 },
        u_res: { value: new THREE.Vector2(1, 1) },
        u_glass: { value: tex },
        u_seed: { value: Math.random() * 1000 },
        u_morphType: { value: morphType },
        u_transition: { value: transition },
        u_maskFeather: { value: maskFeather },
        u_psScale: { value: psScale },
        u_psSmooth: { value: psSmooth },
        u_psDistort: { value: psDistort },
        u_colA: { value: new THREE.Color(colorA).convertSRGBToLinear() },
        u_colB: { value: new THREE.Color(colorB).convertSRGBToLinear() },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);

    let raf = 0;
    const t0 = performance.now();
    let lastUpdate = performance.now();

    const render = () => {
      const now = performance.now();
      const dt = Math.min(1, (now - lastUpdate) / 600);
      lastUpdate = now;

      // 色を滑らかに遷移
      const colA = mat.uniforms.u_colA.value as THREE.Color;
      const colB = mat.uniforms.u_colB.value as THREE.Color;
      colA.lerp(new THREE.Color(colorARef.current).convertSRGBToLinear(), dt);
      colB.lerp(new THREE.Color(colorBRef.current).convertSRGBToLinear(), dt);

      (mat.uniforms.u_time.value as number) = (now - t0) / 1000;
      (mat.uniforms.u_morphType.value as number) = morphTypeRef.current;
      (mat.uniforms.u_transition.value as number) = transitionRef.current;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };

    const ro = new ResizeObserver((ents) => {
      const cr = ents[0].contentRect;
      const w = Math.max(1, Math.floor(cr.width));
      const h = Math.max(1, Math.floor(cr.height));
      renderer.setSize(w, h, false);
      (mat.uniforms.u_res.value as THREE.Vector2).set(w, h);
    });
    ro.observe(ref.current);

    const vis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && active) raf = requestAnimationFrame(render);
    };
    document.addEventListener("visibilitychange", vis);
    if (active) raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", vis);
      ro.disconnect();
      geo.dispose();
      mat.dispose();
      tex.dispose();
      renderer.dispose();
    };
  }, [active, maskFeather, psScale, psSmooth, psDistort]);

  return (
    <canvas
      ref={ref}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        pointerEvents: "none",
        willChange: "transform,opacity",
      }}
    />
  );
}
