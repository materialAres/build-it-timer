import { selectCityLayers, selectCityThemeId, useAppStore } from '@/store';
import { getBuildingColor } from '@/lib/city/palette';
import { DEFAULT_THEME_ID, getThemeById } from '@/lib/city/theme-registry';
import type { CityLayerName, Theme } from './city.types';
import { CityLayer } from './CityLayer';

/** Base CRT phosphor green used when a cell has no building color yet. */
const CRT_GREEN = '#7dfba0';

/**
 * Renderable fallback for a theme id that is not in the registry. It is kept as
 * a module constant (not built per render) so the palette reference is stable.
 */
const FALLBACK_THEME: Theme = {
  id: DEFAULT_THEME_ID,
  name: 'Neon Metropolis',
  palette: [CRT_GREEN],
  backgroundColor: '#000000',
};

/** Painter's order: background first, foreground on top. */
const LAYER_ORDER: ReadonlyArray<CityLayerName> = [
  'background',
  'middleground',
  'foreground',
];

/**
 * The city's stylesheet, rendered *inside* the component (M2.T14). It carries
 * the `text-shadow: 0 0 4px currentColor` CRT glow required by the document
 * (acceptance criterion 2): because the glow uses `currentColor`, a building
 * color set on a cell also tints its halo. The three `<pre>` layers are stacked
 * absolutely and faded by depth to fake parallax.
 */
const CITY_STYLES = `
  .city-canvas {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    border: 1px solid #1f3d2b;
    border-radius: 0.25rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.75rem;
    line-height: 1;
  }
  .city-layer {
    position: absolute;
    inset: 0;
    margin: 0;
    white-space: pre;
    line-height: 1;
    font: inherit;
    pointer-events: none;
  }
  .city-layer--background {
    opacity: 0.4;
  }
  .city-layer--middleground {
    opacity: 0.75;
  }
  .city-layer--foreground {
    opacity: 1;
  }
  .city-cell {
    color: ${CRT_GREEN};
    text-shadow: 0 0 4px currentColor;
  }
  .city-cell--empty {
    color: transparent;
    text-shadow: none;
  }
`;

/**
 * The city view (roadmap M2.T14): the only component that reads the store
 * (acceptance criterion 1). It composes the three layers as an ASCII CRT screen,
 * resolves the active biome (M2.T13b) and applies the theme's palette colors
 * (M2.T13) — one deterministic color per layer until M2.T16 attaches a domain
 * (and therefore a per-building color) to each cell.
 */
export function CityCanvas() {
  const layers = useAppStore(selectCityLayers);
  const themeId = useAppStore(selectCityThemeId);
  const theme = getThemeById(themeId ?? DEFAULT_THEME_ID) ?? FALLBACK_THEME;

  const layerColors: Record<CityLayerName, string> = {
    background: getBuildingColor('background', theme.palette),
    middleground: getBuildingColor('middleground', theme.palette),
    foreground: getBuildingColor('foreground', theme.palette),
  };

  return (
    <div
      className="city-canvas"
      role="img"
      aria-label="Focus city under construction"
      data-theme={theme.id}
      style={{
        width: `${layers.background.width.toString()}ch`,
        height: `${layers.background.height.toString()}em`,
        backgroundColor: theme.backgroundColor,
      }}
    >
      <style>{CITY_STYLES}</style>
      {LAYER_ORDER.map((name) => (
        <CityLayer
          key={name}
          name={name}
          grid={layers[name]}
          color={layerColors[name]}
        />
      ))}
    </div>
  );
}
