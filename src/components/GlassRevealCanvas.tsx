import { useEffect, useRef } from "react";
import * as THREE from "three";
import glassURL from "@/assets/glaspattern.png";

const VERT = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = /* glsl */`
precision highp float;
uniform float u_time;
uniform vec2  u_res;
uniform sampler2D u_image;
uniform sampler2D u_glass;
uniform float u_progress;   // 1 -> 0
uniform float u_amount;     // 0.02~0.06
uniform vec2  u_glassScale;
uniform float u_glassRotate;
uniform float u_maskFeather;

varying vec2 vUv;

vec3 toSRGB(vec3 c){ return pow(c, vec3(1.0/2.2)); }

// 5tap 簡易ブラー
vec3 blur5(sampler2D t, vec2 uv, vec2 px, float k){
  vec3 c0=texture2D(t,uv).rgb;
  vec3 cx=texture2D(t,uv+vec2(px.x,0.)).rgb+texture2D(t,uv-vec2(px.x,0.)).rgb;
  vec3 cy=texture2D(t,uv+vec2(0.,px.y)).rgb+texture2D(t,uv-vec2(0.,px.y)).rgb;
  return mix(c0,(cx+cy)*0.25, k);
}
mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

void main(){
  vec2 px = 1.0 / u_res;

  // ガラスUV
  vec2 c = vUv - 0.5;
  vec2 gUv = rot(u_glassRotate) * c;
  gUv = gUv * u_glassScale + 0.5;
  float h = texture2D(u_glass, gUv).r;
  vec2 grad = vec2(dFdx(h), dFdy(h));
  vec2 uvR = vUv + grad * (u_amount * u_progress);

  // 最初はブラー多め → 0へ
  float k = smoothstep(0.0, 1.0, u_progress);
  vec3 col = blur5(u_image, uvR, px*3.0, k);

  // 円形ソフトマスク（アスペクト比考慮）
  vec2 st = (vUv - 0.5); st.x *= u_res.x/u_res.y;
  float aspect = u_res.x / u_res.y;
  float radius = aspect < 1.0 ? 0.48 : 0.48 / aspect; // 短辺に合わせる
  float mask = smoothstep(radius, radius - u_maskFeather, length(st));
  float a = 1.0 - mask;

  gl_FragColor = vec4(toSRGB(col), a);
}
`;

type Props = {
  imageUrl: string;
  active?: boolean;
  durationMs?: number;
  amount?: number;
  glassScale?: [number, number];
  glassRotate?: number;
  maskFeather?: number;
  onDone?: () => void;
};

export default function GlassRevealCanvas({
  imageUrl, active=true, durationMs=1200,
  amount=0.05, glassScale=[6,1], glassRotate=0.0, maskFeather=0.08,
  onDone,
}: Props){
  const ref = useRef<HTMLCanvasElement|null>(null);

  useEffect(()=>{ if(!ref.current) return;
    const renderer = new THREE.WebGLRenderer({ canvas: ref.current, antialias:true, alpha:true });
    renderer.setClearColor(0,0); renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));

    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-1,1,1,-1,0,1);

    const texImg = new THREE.TextureLoader().load(imageUrl);
    texImg.minFilter=THREE.LinearFilter; texImg.magFilter=THREE.LinearFilter; texImg.colorSpace=THREE.SRGBColorSpace;

    const texGlass = new THREE.TextureLoader().load(glassURL);
    texGlass.wrapS=texGlass.wrapT=THREE.RepeatWrapping;
    texGlass.minFilter=THREE.LinearFilter; texGlass.magFilter=THREE.LinearFilter; texGlass.colorSpace=THREE.SRGBColorSpace;

    const geo = new THREE.PlaneGeometry(2,2);
    const mat = new THREE.ShaderMaterial({
      uniforms:{
        u_time:{value:0}, u_res:{value:new THREE.Vector2(1,1)},
        u_image:{value:texImg}, u_glass:{value:texGlass},
        u_progress:{value:1}, u_amount:{value:amount},
        u_glassScale:{value:new THREE.Vector2(glassScale[0], glassScale[1])},
        u_glassRotate:{value:glassRotate}, u_maskFeather:{value:maskFeather},
      },
      vertexShader: VERT, fragmentShader: FRAG, transparent:true
    });
    const mesh = new THREE.Mesh(geo,mat); scene.add(mesh);

    let raf=0; const t0=performance.now(); const start=performance.now();
    const render=()=>{ const now=performance.now();
      (mat.uniforms.u_time.value as number)=(now-t0)/1000;
      const p = Math.max(0, 1 - (now - start)/durationMs);
      (mat.uniforms.u_progress.value as number)=p;
      renderer.render(scene, cam);
      if(p<=0){ cancelAnimationFrame(raf); onDone?.(); return; }
      raf=requestAnimationFrame(render);
    };

    const ro=new ResizeObserver((es)=>{ const cr=es[0].contentRect; const w=Math.max(1,cr.width|0), h=Math.max(1,cr.height|0); renderer.setSize(w,h,false); (mat.uniforms.u_res.value as THREE.Vector2).set(w,h); });
    ro.observe(ref.current);

    document.hidden || (raf=requestAnimationFrame(render));
    const vis=()=>{ cancelAnimationFrame(raf); if(!document.hidden && active) raf=requestAnimationFrame(render); };
    document.addEventListener("visibilitychange",vis);

    return ()=>{ cancelAnimationFrame(raf); document.removeEventListener("visibilitychange",vis); ro.disconnect(); geo.dispose(); (mat as any).dispose?.(); texImg.dispose(); texGlass.dispose(); renderer.dispose(); };
  }, [imageUrl, active, amount, glassScale[0], glassScale[1], glassRotate, maskFeather, durationMs, onDone]);

  return <canvas ref={ref} style={{width:"100%",height:"100%",display:"block",pointerEvents:"none",willChange:"transform,opacity"}}/>;
}
