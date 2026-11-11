import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OrthographicCamera, Scene, WebGLRenderer } from 'three';
import {
  CAMERA_HOME,
  CAMERA_TARGET,
  ORBIT_LIMITS,
  frustumFor,
} from '@/lib/city/camera-framing';
import { ENVIRONMENT_COLORS } from '@/lib/city/plan/environment-colors';

/** The pixel ratio never exceeds this: sharp enough, and 4× fewer pixels than a 3× screen. */
export const MAX_PIXEL_RATIO = 1.5;

export interface GlContext {
  readonly renderer: WebGLRenderer;
  readonly camera: OrthographicCamera;
  readonly scene: Scene;
  readonly controls: OrbitControls;
}

interface Disposable {
  dispose?: () => void;
}

/**
 * The WebGL renderer, the camera, the scene and the limited orbit controls.
 * Light by construction: no MSAA, a low-power GPU, no preserved drawing buffer
 * (a capture renders and reads in one task), a capped pixel ratio, and orbit
 * controls without pan or damping so a still view needs no frame loop.
 * Throws when WebGL is unavailable; the caller turns that into a `Result`.
 */
export function createGlContext(host: HTMLElement): GlContext {
  const renderer = new WebGLRenderer({
    antialias: false,
    powerPreference: 'low-power',
    preserveDrawingBuffer: false,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, MAX_PIXEL_RATIO));
  renderer.setClearColor(ENVIRONMENT_COLORS.floor);
  host.appendChild(renderer.domElement);

  const camera = new OrthographicCamera();
  camera.position.set(CAMERA_HOME.x, CAMERA_HOME.y, CAMERA_HOME.z);
  camera.lookAt(CAMERA_TARGET.x, CAMERA_TARGET.y, CAMERA_TARGET.z);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(CAMERA_TARGET.x, CAMERA_TARGET.y, CAMERA_TARGET.z);
  controls.enablePan = false;
  controls.enableDamping = false;
  controls.minPolarAngle = ORBIT_LIMITS.minPolar;
  controls.maxPolarAngle = ORBIT_LIMITS.maxPolar;
  controls.minAzimuthAngle = ORBIT_LIMITS.minAzimuth;
  controls.maxAzimuthAngle = ORBIT_LIMITS.maxAzimuth;
  controls.minZoom = ORBIT_LIMITS.minZoom;
  controls.maxZoom = ORBIT_LIMITS.maxZoom;
  controls.update();

  return { renderer, camera, scene: new Scene(), controls };
}

/** Fit the camera frustum to a view of `width` × `height` pixels. */
export function applyFraming(camera: OrthographicCamera, width: number, height: number): void {
  const frustum = frustumFor(width / height);
  camera.left = frustum.left;
  camera.right = frustum.right;
  camera.top = frustum.top;
  camera.bottom = frustum.bottom;
  camera.updateProjectionMatrix();
}

/** Free the geometries, materials and textures of every object in the scene. */
export function disposeScene(scene: Scene): void {
  scene.traverse((object) => {
    const { geometry, material } = object as { geometry?: Disposable; material?: Disposable | Disposable[] };
    geometry?.dispose?.();
    for (const m of Array.isArray(material) ? material : [material]) {
      if (m === undefined) continue;
      for (const value of Object.values(m)) (value as Disposable | null)?.dispose?.();
      m.dispose?.();
    }
  });
}
