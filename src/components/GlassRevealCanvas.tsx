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
uniform float u_progress;   // 1 → 0 で完成
uniform float u_amount;     // 最大屈折量
uniform float u_lines;      // 縦線の強さ
varying vec2 vUv;

// 近傍サンプルで簡易ブラー
vec3 sampleBlur(sampler2D tex, vec2 uv, vec2 px, float k){
  vec3 c0 = texture2D(tex, uv).rgb;
  vec3 c1 = texture2D(tex, uv+vec2(px.x,0.)).rgb;
  vec3 c2 = texture2D(tex, uv-vec2(px.x,0.)).rgb;
  vec3 c3 = texture2D(tex, uv+vec2(0.,px.y)).rgb;
  vec3 c4 = texture2D(tex, uv-vec2(0.,px.y)).rgb;
  return mix(c0,(c1+c2+c3+c4)*0.25, k);
}

float luma(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }

void main(){
  vec2 px = 1.0 / u_res;

  // ガラス高さ → 法線的なズレ
  float h = texture2D(u_glass, vec2(vUv.x*1.0, vUv.y)).r;
  vec2 grad = vec2(dFdx(h), dFdy(h));
  float amp = u_amount * u_progress;     // 進行に応じて弱くなる
  vec2 uvR = vUv + grad * amp;

  // 追加の縦スキャン歪み（進行に応じて消える）
  float scan = (sin((vUv.y*3.14159*16.0) + u_time*2.0) * 0.25 + 0.25) * u_progress;
  uvR.x += scan * px.x * 32.0;

  // 画像サンプル（最初はブラー強め→完成でシャープ）
  float blurK = smoothstep(0.0, 1.0, u_progress); // 1→0 で弱く
  vec3 col = sampleBlur(u_image, uvR, px*3.0, blurK);

  // グレースケール→カラーへ
  float g = luma(col);
  col = mix(col, vec3(g), u_progress*0.6); // 開始時は少しモノクロ

  // 縦ラインの乗算（リブドガラス感、進行で薄く）
  float lines = 0.5 + 0.5*sin(vUv.x*3.14159*128.0);
  col *= mix(1.0, 0.86 + 0.14*lines, u_lines * u_progress);

  // 走査線ハイライト（白い帯が下に進む）
  float y = fract(u_time*0.25);
  float band = smoothstep(y-0.03, y, vUv.y) * smoothstep(y+0.03, y, vUv.y);
  col += band * 0.10 * u_progress;

  // 軽いビネット
  vec2 uv = vUv - 0.5; uv.x *= u_res.x/u_res.y;
  float vig = smoothstep(0.9, 0.2, dot(uv,uv));
  col *= mix(1.0, vig, 0.08);

  gl_FragColor = vec4(col, 1.0);
}
`;

type Props = {
  imageUrl: string;
  active?: boolean;          // trueの間だけレンダ＋進行
  durationMs?: number;       // 1→0 になるまでの時間
  amount?: number;           // 最初の歪み強度（0.02〜0.06）
  lines?: number;            // 縦ライン強度（0〜1）
  onDone?: () => void;       // 完了コールバック
};

export default function GlassRevealCanvas({
  imageUrl,
  active = true,
  durationMs = 1200,
  amount = 0.04,
  lines = 1.0,
  onDone,
}: Props){
  const ref = useRef<HTMLCanvasElement|null>(null);

  useEffect(()=>{ if(!ref.current) return;
    const renderer = new THREE.WebGLRenderer({ canvas: ref.current, antialias:true, alpha:true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));

    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-1,1,1,-1,0,1);

    const texImg = new THREE.TextureLoader().load(imageUrl, ()=>{ /* loaded */ });
    texImg.minFilter = THREE.LinearFilter; texImg.magFilter = THREE.LinearFilter;
    texImg.colorSpace = THREE.SRGBColorSpace;

    const texGlass = new THREE.TextureLoader().load(glassURL);
    texGlass.wrapS = texGlass.wrapT = THREE.RepeatWrapping;
    texGlass.minFilter = THREE.LinearFilter; texGlass.magFilter = THREE.LinearFilter;
    texGlass.colorSpace = THREE.SRGBColorSpace;

    const geo = new THREE.PlaneGeometry(2,2);
    const mat = new THREE.ShaderMaterial({
      uniforms:{
        u_time:{value:0}, u_res:{value:new THREE.Vector2(1,1)},
        u_image:{value:texImg}, u_glass:{value:texGlass},
        u_progress:{value:1}, u_amount:{value:amount}, u_lines:{value:lines},
      },
      vertexShader: VERT, fragmentShader: FRAG, transparent:true
    });
    const mesh = new THREE.Mesh(geo,mat); scene.add(mesh);

    let raf=0; const t0=performance.now(); let started=performance.now();
    const render = ()=>{
      const now=performance.now();
      (mat.uniforms.u_time.value as number)=(now - t0)/1000;
      // 1→0 に線形（好みでease）
      const p = Math.max(0, 1 - (now - started)/durationMs);
      (mat.uniforms.u_progress.value as number) = p;
      renderer.render(scene, cam);
      if (p<=0){ cancelAnimationFrame(raf); onDone?.(); return; }
      raf=requestAnimationFrame(render);
    };

    const ro = new ResizeObserver((es)=>{
      const cr=es[0].contentRect; const w=Math.max(1,cr.width|0), h=Math.max(1,cr.height|0);
      renderer.setSize(w,h,false); (mat.uniforms.u_res.value as THREE.Vector2).set(w,h);
    }); ro.observe(ref.current);

    const vis = ()=>{ cancelAnimationFrame(raf);
      if(!document.hidden && active){ started=performance.now(); raf=requestAnimationFrame(render); }
    }; document.addEventListener("visibilitychange", vis);

    if (active) raf=requestAnimationFrame(render);

    return ()=>{ cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", vis); ro.disconnect();
      geo.dispose(); mat.dispose(); texImg.dispose(); texGlass.dispose(); renderer.dispose();
    };
  }, [imageUrl, active, amount, lines, durationMs, onDone]);

  return <canvas ref={ref} style={{width:"100%",height:"100%",display:"block",pointerEvents:"none",willChange:"transform,opacity"}}/>;
}
