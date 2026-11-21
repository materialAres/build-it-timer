import { useCallback, useEffect, useState, type ComponentType } from 'react';
import type { CityView3DProps } from './CityView3D';
import { afterFirstPaint, probeWebGl2, type ProbedCanvas } from './webgl-support';

export type CityViewState =
  | { readonly kind: 'checking' }
  | { readonly kind: 'ready'; readonly probe: ProbedCanvas; readonly View: ComponentType<CityView3DProps> }
  | { readonly kind: 'unavailable' };

/**
 * Decides what the City stage shows (CR6.T8a/T8b, open issue #22). The WebGL2
 * check is synchronous and slow on a page's first context, so it runs after
 * the first paint, while the stage already shows its loading line. Only when it
 * passes is the 3D chunk requested, with a plain dynamic `import()`: React's
 * `Suspense` would hold the 3D view back for about 300 ms after its fallback
 * appeared (React 19 throttles revealing a boundary), measured as a later first
 * frame. A chunk that fails to load counts as unavailable. The probe's context
 * is handed to the renderer; an unused one is released on unmount.
 */
export function useCityView(): [CityViewState, () => void] {
  const [state, setState] = useState<CityViewState>({ kind: 'checking' });
  useEffect(() => {
    let probe: ProbedCanvas | null = null;
    let active = true;
    const cancel = afterFirstPaint(() => {
      probe = probeWebGl2();
      if (probe === null) {
        setState({ kind: 'unavailable' });
        return;
      }
      const ready = probe;
      // The dynamic import is what makes the three.js chunk: only the City tab requests it.
      import('./CityView3D').then(
        (module) => { if (active) setState({ kind: 'ready', probe: ready, View: module.default }); },
        () => { if (active) setState({ kind: 'unavailable' }); },
      );
    });
    return () => {
      active = false;
      cancel();
      probe?.release();
    };
  }, []);
  const fail = useCallback(() => { setState({ kind: 'unavailable' }); }, []);
  return [state, fail];
}
