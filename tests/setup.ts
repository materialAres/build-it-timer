import '@testing-library/jest-dom/vitest';
import { beforeEach, vi } from 'vitest';
import React from 'react';
import type * as FramerMotion from 'framer-motion';
import { installFakeDynamicRules } from '@/tests/helpers/fake-declarative-net-request';
import { installI18nBackend, resetTestLocale } from '@/tests/helpers/i18n';

// The city's grow/destroy transitions (M3.T5, `components/city/CityCell.tsx`)
// are purely visual. In tests they would keep an exiting character mounted
// until its animation ends, making the rendered DOM timing-dependent. The
// transition is therefore replaced with a passthrough that renders only the
// current state, so assertions always observe the settled DOM (roadmap §3.3:
// "No assertions on real animation timings; only that the final state is
// correct"). The production component still uses the real `framer-motion`.
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof FramerMotion>();

  // Props that belong to the animation engine and must not reach the DOM.
  const motionOnlyProps = new Set([
    'initial',
    'animate',
    'exit',
    'transition',
    'variants',
    'whileHover',
    'whileTap',
    'whileFocus',
    'whileInView',
    'layout',
    'layoutId',
    'drag',
  ]);

  const passthrough = (tag: string) => {
    const Component = ({ children, ...props }: Record<string, unknown>) => {
      const domProps = Object.fromEntries(
        Object.entries(props).filter(([key]) => !motionOnlyProps.has(key)),
      );
      return React.createElement(
        tag,
        domProps as React.HTMLAttributes<HTMLElement>,
        children as React.ReactNode,
      );
    };
    Component.displayName = `Motion(${tag})`;
    return Component;
  };

  // Cache per tag so `motion.span` is a stable component type across renders
  // (returning a fresh function each access would remount the element).
  const motionCache = new Map<string, React.ComponentType<Record<string, unknown>>>();

  return {
    ...actual,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => children,
    motion: new Proxy(
      {},
      {
        get: (_target, tag) => {
          const name = String(tag);
          const cached = motionCache.get(name);
          if (cached) return cached;
          const Component = passthrough(name);
          motionCache.set(name, Component);
          return Component;
        },
      },
    ),
  };
});

// `fakeBrowser` does not implement `declarativeNetRequest`, yet the background
// syncs the dynamic ruleset on startup and on every store change (M2.T7). Every
// test that starts the background therefore needs a working ruleset: without
// one the sync rejects through the production applier and logs at the error
// boundary — noise on an otherwise green run, with `handle.ready` resolving
// through a caught rejection instead of a successful sync.
installFakeDynamicRules();

// `@wxt-dev/i18n` (M3.T9) resolves every string through `browser.i18n.getMessage`,
// which `fakeBrowser` leaves unimplemented. Install the real `locales/*.yml`
// dictionary as the backend so component tests render the same EN strings a
// browser would serve.
installI18nBackend();

beforeEach(() => {
  // The fake's ruleset is process-wide, while `fakeBrowser.reset()` (called by
  // the test files themselves) does not know about it: clear it per test so
  // rules cannot leak from one test to the next.
  installFakeDynamicRules().reset();
  // A test may force the locale (M3.T10); return to the EN default so it cannot
  // leak into the next test.
  resetTestLocale();
});
