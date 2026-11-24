import { describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Mesh, MeshBasicMaterial, Scene, Texture } from 'three';
import { disposeScene } from '@/components/city/three/renderer-context';

/**
 * Real three.js objects, no WebGL: a material that has been rendered carries a
 * `_listeners` object whose `dispose` key is an array of callbacks. The e2e
 * (CR6.T12) found `disposeScene` calling that array and crashing the popup the
 * moment the City tab was left.
 */
describe('disposeScene (CR6.T6a, fixed by CR6.T12)', () => {
  function sceneWith(): { scene: Scene; geometry: BoxGeometry; material: MeshBasicMaterial; texture: Texture } {
    const geometry = new BoxGeometry(1, 1, 1);
    const texture = new Texture();
    const material = new MeshBasicMaterial({ map: texture });
    const scene = new Scene();
    scene.add(new Mesh(geometry, material));
    return { scene, geometry, material, texture };
  }

  it('frees the geometry, the material and its texture', () => {
    const { scene, geometry, material, texture } = sceneWith();
    const freed = { geometry: vi.fn(), material: vi.fn(), texture: vi.fn() };
    geometry.addEventListener('dispose', freed.geometry);
    material.addEventListener('dispose', freed.material);
    texture.addEventListener('dispose', freed.texture);

    disposeScene(scene);

    expect(freed.geometry).toHaveBeenCalledTimes(1);
    expect(freed.material).toHaveBeenCalledTimes(1);
    expect(freed.texture).toHaveBeenCalledTimes(1);
  });

  it('does not throw on a material whose `_listeners.dispose` is an array (a rendered material)', () => {
    const { scene, material } = sceneWith();
    material.addEventListener('dispose', () => {});
    expect((material as unknown as { _listeners: { dispose: unknown } })._listeners.dispose).toBeInstanceOf(Array);

    expect(() => { disposeScene(scene); }).not.toThrow();
  });

  it('handles a material array and an object without geometry or material', () => {
    const scene = new Scene();
    const a = new MeshBasicMaterial();
    const b = new MeshBasicMaterial();
    const onA = vi.fn();
    const onB = vi.fn();
    a.addEventListener('dispose', onA);
    b.addEventListener('dispose', onB);
    scene.add(new Mesh(new BoxGeometry(), [a, b]));

    expect(() => { disposeScene(scene); }).not.toThrow();
    expect(onA).toHaveBeenCalledTimes(1);
    expect(onB).toHaveBeenCalledTimes(1);
  });
});
