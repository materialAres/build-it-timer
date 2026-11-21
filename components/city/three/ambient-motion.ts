import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  MeshBasicMaterial,
} from 'three';
import { RAIN_STREAK, carPosition, rainHeight, type AmbientPlan } from '@/lib/city/ambient-plan';
import { boxMatrix } from '@/lib/city/plan/box-geometry';
import { hexToUnitRgb } from '@/lib/city/plan/color-math';
import { ENVIRONMENT_COLORS } from '@/lib/city/plan/environment-colors';

const CAR_SIZE = { length: 0.36, height: 0.1, width: 0.18 } as const;

/** The rain: one line mesh of streaks that fall, rewritten per ambient tick. */
export function createRain(ambient: AmbientPlan): { lines: LineSegments; step: (ms: number) => void } {
  const positions = new Float32Array(ambient.rain.length * 6);
  const geometry = new BufferGeometry();
  const attribute = new BufferAttribute(positions, 3);
  geometry.setAttribute('position', attribute);
  const material = new LineBasicMaterial({ color: ENVIRONMENT_COLORS.rain, transparent: true, opacity: 0.35 });
  const lines = new LineSegments(geometry, material);
  lines.frustumCulled = false;
  const step = (ms: number): void => {
    ambient.rain.forEach((drop, i) => {
      const y = rainHeight(drop, ms);
      positions.set([drop.x, y, drop.z, drop.x, y - RAIN_STREAK, drop.z], i * 6);
    });
    attribute.needsUpdate = true;
  };
  return { lines, step };
}

/** The cars: one instanced mesh whose matrices follow their routes. */
export function createCars(ambient: AmbientPlan): { mesh: InstancedMesh; step: (ms: number) => void } {
  const count = Math.max(ambient.cars.length, 1);
  const mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ color: 0xffffff }), count);
  mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(count * 3), 3);
  ambient.cars.forEach((car, i) => mesh.instanceColor?.array.set(hexToUnitRgb(car.color), i * 3));
  mesh.count = ambient.cars.length;
  mesh.frustumCulled = false;
  const step = (ms: number): void => {
    ambient.cars.forEach((car, i) => {
      const { x, z } = carPosition(car, ms);
      const along = car.axis === 'x';
      const box = {
        cx: x, cy: CAR_SIZE.height, cz: z,
        sx: along ? CAR_SIZE.length : CAR_SIZE.width, sy: CAR_SIZE.height, sz: along ? CAR_SIZE.width : CAR_SIZE.length,
      };
      mesh.instanceMatrix.array.set(boxMatrix(box), i * 16);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };
  return { mesh, step };
}

