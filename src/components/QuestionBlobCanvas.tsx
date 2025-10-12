import { useEffect, useRef } from "react";
import * as THREE from "three";

const VERT = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// 回答に応じて変化するProceduralアニメーション
const FRAG = /* glsl */`
precision highp float;
uniform float u_time;
uniform vec2  u_res;
uniform float u_seed;
uniform vec3  u_colA, u_colB;
uniform float u_morphType; // 0-4: 形状の種類
uniform float u_transition; // 0-1: 遷移の進行度
varying vec2 vUv;

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

// 形状1: 同心円（オレンジ）
float shape1(vec2 st, float time){
  float d = length(st);
  float n = snoise(st * 2.0 + time * 0.3);
  return smoothstep(0.35, 0.30, abs(d - 0.3 + n * 0.08));
}

// 形状2: 歪んだ四角形（水色）
float shape2(vec2 st, float time){
  vec2 q = abs(st);
  float n = snoise(st * 3.0 + time * 0.4);
  float box = max(q.x, q.y) - 0.25 - n * 0.12;
  return smoothstep(0.02, 0.0, box);
}

// 形状3: オーガニック形状（紫）
float shape3(vec2 st, float time){
  float ang = atan(st.y, st.x);
  float r = length(st);
  float n0 = snoise(st * 4.0 + time * 0.5);
  float n1 = snoise(vec2(ang * 2.0, r * 5.0) + time * 0.6);
  float dist = r - 0.28 - n0 * 0.15 - n1 * 0.08;
  return smoothstep(0.03, -0.02, dist);
}

// 形状4: 縦ストライプ（緑）
float shape4(vec2 st, float time){
  float n = snoise(vec2(st.x * 12.0 + time * 0.4, st.y * 2.0));
  float lines = sin((st.x + n * 0.1) * 40.0 + time);
  return smoothstep(0.3, 0.7, (lines + 1.0) * 0.5);
}

// 形状5: モアレ（黒）
float shape5(vec2 st, float time){
  float n = snoise(st * 6.0 + time * 0.3);
  float lines1 = sin((st.x * st.y + n * 0.2) * 60.0 + time * 2.0);
  float lines2 = sin((st.x - st.y) * 55.0 + time * 1.5);
  return smoothstep(0.2, 0.8, (lines1 * lines2 + 1.0) * 0.5);
}

void main(){
  vec2 st = vUv - 0.5;
  st.x *= u_res.x / u_res.y;

  float val = 0.0;

  // morphType に応じて形状を切り替え
  if (u_morphType < 0.5) {
    val = shape1(st, u_time);
  } else if (u_morphType < 1.5) {
    val = shape2(st, u_time);
  } else if (u_morphType < 2.5) {
    val = shape3(st, u_time);
  } else if (u_morphType < 3.5) {
    val = shape4(st, u_time);
  } else {
    val = shape5(st, u_time);
  }

  // トランジションでブレンド
  val = mix(val * 0.3, val, u_transition);

  // カラー
  vec3 col = mix(u_colA, u_colB, val);

  // 中心から外側へのフェード
  float fade = 1.0 - smoothstep(0.3, 0.6, length(st));

  gl_FragColor = vec4(col, val * fade * 0.9);
}
`;

type Props = {
  active?: boolean;
  morphType?: number; // 0-4: 形状の種類
  colorA?: string;
  colorB?: string;
  transition?: number; // 0-1: 遷移の進行度
};

export default function QuestionBlobCanvas({
  active = true,
  morphType = 0,
  colorA = "#F4DDD4",
  colorB = "#D4887A",
  transition = 1.0,
}: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const morphTypeRef = useRef(morphType);
  const transitionRef = useRef(transition);

  useEffect(() => {
    morphTypeRef.current = morphType;
  }, [morphType]);

  useEffect(() => {
    transitionRef.current = transition;
  }, [transition]);

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

    const geo = new THREE.PlaneGeometry(2, 2);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        u_time: { value: 0 },
        u_res: { value: new THREE.Vector2(1, 1) },
        u_seed: { value: Math.random() * 1000 },
        u_morphType: { value: morphType },
        u_transition: { value: transition },
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
    const render = () => {
      (mat.uniforms.u_time.value as number) = (performance.now() - t0) / 1000;
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
      renderer.dispose();
    };
  }, [active, colorA, colorB]);

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
