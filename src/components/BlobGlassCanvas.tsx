import { useEffect, useRef } from "react";
import * as THREE from "three";
import glassURL from "@/assets/glaspattern.png";

const VERT = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// うねうね（SDF＋simplex）+ リブドガラス風UVシフト
const FRAG = /* glsl */`
precision highp float;
uniform float u_time;
uniform vec2  u_res;
uniform sampler2D u_glass;
uniform float u_refract;
uniform float u_seed;
uniform vec3  u_colA, u_colB;
varying vec2 vUv;

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
vec3 palette(float t, vec3 a, vec3 b){ float k=0.5+0.5*sin(6.28318*(t+0.015)); return mix(a,b,k); }

struct Blob{ vec3 color; float alpha; };

Blob evalBlob(vec2 uv,float time,float seed){
  vec2 st=uv-0.5; st.x*=u_res.x/u_res.y;
  float baseR=0.28+0.02*sin(time*0.6+seed);
  float n0=snoise(st*3.0+vec2(time*0.4,seed*10.0));
  float n1=snoise(st*7.5+vec2(-time*0.8,seed*3.7));
  float r=baseR+0.11*n0+0.06*abs(n1);
  float d=length(st)-r;
  float edge=smoothstep(0.018,0.0,abs(d));
  float ang=atan(st.y,st.x);
  float tcol=0.5+0.5*sin(ang*2.0+time*0.7)+0.25*n0;
  vec3 col=palette(fract(tcol),u_colA,u_colB);
  col += 0.2 * snoise(vec2(st.y*9.0 + time*0.9, seed));
  float alpha=smoothstep(0.015,-0.025,d);
  col += 0.12*edge;
  Blob b; b.color=col; b.alpha=alpha; return b;
}

void main(){
  Blob base = evalBlob(vUv, u_time, u_seed);
  vec2 gUv = vec2(vUv.x, vUv.y);
  float h = texture2D(u_glass, gUv).r;
  vec2 offset = vec2(dFdx(h), dFdy(h)) * 0.75 * u_refract;
  Blob warped = evalBlob(vUv + offset, u_time, u_seed);
  vec3 color = mix(base.color, warped.color, 0.85);
  gl_FragColor = vec4(color, base.alpha);
}
`;

type Props = {
  active?: boolean;
  refract?: number;
  colorA?: string;
  colorB?: string;
};

export default function BlobGlassCanvas({
  active = true,
  refract = 0.9,
  colorA = "#CFE5DE",
  colorB = "#AF9ACD",
}: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    const renderer = new THREE.WebGLRenderer({
      canvas: ref.current, antialias: true, alpha: true, premultipliedAlpha: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1,1,1,-1,0,1);

    const tex = new THREE.TextureLoader().load(glassURL);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;

    const geo = new THREE.PlaneGeometry(2,2);
    const mat = new THREE.ShaderMaterial({
      uniforms:{
        u_time:{value:0}, u_res:{value:new THREE.Vector2(1,1)},
        u_glass:{value:tex}, u_refract:{value:refract},
        u_seed:{value:Math.random()*1000},
        u_colA:{value:new THREE.Color(colorA).convertSRGBToLinear()},
        u_colB:{value:new THREE.Color(colorB).convertSRGBToLinear()},
      },
      vertexShader: VERT, fragmentShader: FRAG, transparent: true,
    });
    const mesh = new THREE.Mesh(geo,mat); scene.add(mesh);

    let raf=0; const t0=performance.now();
    const render=()=>{ (mat.uniforms.u_time.value as number)=(performance.now()-t0)/1000; renderer.render(scene,camera); raf=requestAnimationFrame(render); };

    const ro = new ResizeObserver((ents)=>{
      const cr = ents[0].contentRect;
      const w = Math.max(1, Math.floor(cr.width));
      const h = Math.max(1, Math.floor(cr.height));
      renderer.setSize(w,h,false);
      (mat.uniforms.u_res.value as THREE.Vector2).set(w,h);
    });
    ro.observe(ref.current);

    const vis = ()=>{ cancelAnimationFrame(raf); if(!document.hidden && active) raf=requestAnimationFrame(render); };
    document.addEventListener("visibilitychange", vis);
    if (active) raf=requestAnimationFrame(render);

    return ()=>{ cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", vis); ro.disconnect(); geo.dispose(); mat.dispose(); tex.dispose(); renderer.dispose(); };
  }, [active, refract, colorA, colorB]);

  return <canvas ref={ref} style={{width:"100%",height:"100%",display:"block",pointerEvents:"none",willChange:"transform,opacity"}}/>;
}
