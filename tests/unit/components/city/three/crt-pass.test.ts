import { describe, expect, it } from 'vitest';
import { CRT_DEFAULTS, CRT_SHADER } from '@/components/city/three/crt-pass';

describe('CRT pass shader (CR6.T6b)', () => {
  it('reads the rendered frame and writes the final color', () => {
    expect(CRT_SHADER.fragmentShader).toContain('tDiffuse');
    expect(CRT_SHADER.fragmentShader).toContain('gl_FragColor');
    expect(CRT_SHADER.vertexShader).toContain('gl_Position');
  });

  it('draws scanlines, a vignette and a faint phosphor floor', () => {
    expect(CRT_SHADER.fragmentShader).toMatch(/scanlines/);
    expect(CRT_SHADER.fragmentShader).toMatch(/vignette/);
    expect(CRT_SHADER.fragmentShader).toMatch(/phosphorFloor/);
  });

  it('exposes its tunables as uniforms with the documented defaults', () => {
    expect(CRT_SHADER.uniforms.scanlines.value).toBe(CRT_DEFAULTS.scanlines);
    expect(CRT_SHADER.uniforms.vignette.value).toBe(CRT_DEFAULTS.vignette);
    expect(CRT_SHADER.uniforms.tDiffuse.value).toBeNull();
  });

  it('keeps the effect subtle: a legible city under it', () => {
    expect(CRT_DEFAULTS.scanlines).toBeGreaterThan(0);
    expect(CRT_DEFAULTS.scanlines).toBeLessThanOrEqual(0.3);
    expect(CRT_DEFAULTS.vignette).toBeLessThanOrEqual(0.6);
    expect(CRT_DEFAULTS.phosphorFloor).toBeLessThanOrEqual(0.02);
  });

  it('has no unsupported GLSL ES 3 only syntax (it must run on WebGL1-style shaders too)', () => {
    expect(CRT_SHADER.fragmentShader).not.toMatch(/#version|\bin\s+vec|\bout\s+vec/);
  });
});
