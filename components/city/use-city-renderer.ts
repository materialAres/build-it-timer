import { useEffect, useState, type RefObject } from 'react';
import { isDebugRender } from './use-city-debug';
import { createCityRenderer, type CityRenderer } from './three/city-renderer';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

export interface CityRendererState {
  readonly renderer: CityRenderer | null;
  /** WebGL could not start, or its context was lost; the panel then shows the text fallback (CR6.T8b). */
  readonly failed: boolean;
}

/**
 * Owns the renderer's lifecycle for the view (CR6.T8a): creates it when there
 * is a city to show, keeps it sized to its host, tells it when it is on screen
 * and when the user prefers reduced motion, and disposes it on unmount. It does
 * no drawing decisions; the renderer's scheduler does.
 */
export function useCityRenderer(
  host: RefObject<HTMLElement | null>,
  enabled: boolean,
  freeCamera = false,
): CityRendererState {
  const [state, setState] = useState<CityRendererState>({ renderer: null, failed: false });

  useEffect(() => {
    const element = host.current;
    if (!enabled || element === null) return undefined;
    const motion = typeof matchMedia === 'function' ? matchMedia(REDUCED_MOTION) : null;
    const created = createCityRenderer({
      host: element,
      onContextLost: () => { setState({ renderer: null, failed: true }); },
      reducedMotion: motion?.matches ?? false,
      ambient: true,
      freeCamera,
      debug: isDebugRender(),
      effects: { bloom: true, crt: true },
    });
    if (!created.ok) {
      setState({ renderer: null, failed: true });
      return undefined;
    }
    const renderer = created.value;
    const fit = (): void => { renderer.resize(element.clientWidth, element.clientHeight); };
    fit();
    const sizeWatch = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    sizeWatch?.observe(element);
    const viewWatch =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver((entries) => {
            const latest = entries.at(-1);
            if (latest) renderer.setVisible(latest.isIntersecting);
          })
        : null;
    viewWatch?.observe(element);
    const onMotion = (event: MediaQueryListEvent): void => { renderer.setReducedMotion(event.matches); };
    motion?.addEventListener('change', onMotion);
    setState({ renderer, failed: false });
    return () => {
      motion?.removeEventListener('change', onMotion);
      sizeWatch?.disconnect();
      viewWatch?.disconnect();
      renderer.dispose();
    };
  }, [host, enabled, freeCamera]);

  return state;
}
