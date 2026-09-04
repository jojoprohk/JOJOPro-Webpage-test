"use client";

// JoJoPro ambient WebGL background: white paper with slow-drifting
// peach-pink mesh clouds. Zero dependencies. Pauses when the tab is
// hidden, renders a single static frame under prefers-reduced-motion,
// and degrades to nothing (white CSS fallback) when WebGL is unavailable.

import { useEffect, useRef } from "react";

const VERT = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(7.3, 3.1);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);
  float t = u_time;

  // Two independent drifting fields keep the soft pink wash and the
  // deeper peach-magenta patches separate as they move.
  vec2 driftA = vec2(t * 0.40, -t * 0.26);
  vec2 driftB = vec2(-t * 0.32, t * 0.38 + 5.7);
  float fA = fbm(p * 1.35 + driftA);
  float fB = fbm(p * 1.75 + driftB);

  vec3 paper     = vec3(1.0);
  vec3 pinkPale  = vec3(0.996, 0.890, 0.933); // very light blush
  vec3 pinkSoft  = vec3(0.988, 0.706, 0.820); // soft pink
  vec3 pink      = vec3(0.965, 0.471, 0.706); // peach pink
  vec3 pinkDeep  = vec3(0.902, 0.220, 0.533); // JoJoPro #E63888

  // Gentle rosy wash: a little pinker toward the top, settling to white below.
  vec3 base = mix(paper, pinkPale, smoothstep(0.0, 1.0, uv.y) * 0.9);
  vec3 col = base;
  float lightMask = smoothstep(0.30, 0.88, fA);
  float midMask   = smoothstep(0.48, 0.96, fA);
  float deepMask  = smoothstep(0.34, 0.86, fB);

  col = mix(col, pinkSoft, lightMask * 0.7);
  col = mix(col, pink,     midMask * 0.52);
  col = mix(col, pinkDeep, deepMask * 0.42);

  // Keep viewport edges brighter so text stays crisp.
  float edge = smoothstep(1.35, 0.32, length(p));
  col = mix(paper, col, 0.35 + edge * 0.65);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export function SiteBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const gl = canvas.getContext("webgl", {
      antialias: false,
      alpha: false,
      premultipliedAlpha: false,
    });
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error("[SiteBackground] shader error:", gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    const program = gl.createProgram();
    if (!vs || !fs || !program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("[SiteBackground] link error:", gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "u_res");
    const uTime = gl.getUniformLocation(program, "u_time");

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };

    const draw = (time: number) => {
      resize();
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, time);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    // Static frame for reduced-motion users.
    if (reduced) {
      draw(6.0);
      return () => {
        gl.deleteProgram(program);
        gl.deleteBuffer(buf);
      };
    }

    let raf = 0;
    let visible = document.visibilityState === "visible";
    const start = performance.now();

    const render = (now: number) => {
      raf = requestAnimationFrame(render);
      if (!visible) return;
      draw((now - start) / 1000 * 0.32);
    };
    const onVisibility = () => {
      visible = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      gl.deleteProgram(program);
      gl.deleteBuffer(buf);
    };
  }, []);

  return (
    <div className="site-bg" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
