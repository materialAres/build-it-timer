/**
 * The CRT look of the city (CR6.T6b, sketch D): faint scanlines, a vignette and
 * a barely-there phosphor glow on the black floor. Plain data (a shader
 * definition for `ShaderPass`), so it is checkable without WebGL and the pass
 * can be switched off without touching anything else.
 */

/** Kept subtle: the city must stay legible under it. */
export const CRT_DEFAULTS = {
  scanlines: 0.18,
  scanlineCount: 220,
  vignette: 0.45,
  phosphorFloor: 0.012,
} as const;

export const CRT_SHADER = {
  uniforms: {
    tDiffuse: { value: null as unknown },
    scanlines: { value: CRT_DEFAULTS.scanlines as number },
    scanlineCount: { value: CRT_DEFAULTS.scanlineCount as number },
    vignette: { value: CRT_DEFAULTS.vignette as number },
    phosphorFloor: { value: CRT_DEFAULTS.phosphorFloor as number },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float scanlines;
    uniform float scanlineCount;
    uniform float vignette;
    uniform float phosphorFloor;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float line = 0.5 + 0.5 * sin(vUv.y * scanlineCount * 6.2831853);
      color.rgb *= 1.0 - scanlines * (1.0 - line);
      float edge = distance(vUv, vec2(0.5));
      color.rgb *= 1.0 - vignette * smoothstep(0.35, 0.85, edge);
      color.rgb = max(color.rgb, vec3(0.0, phosphorFloor, phosphorFloor * 0.4));
      gl_FragColor = color;
    }
  `,
};
