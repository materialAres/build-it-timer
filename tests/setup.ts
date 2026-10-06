import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';
import { installFakeDynamicRules } from '@/tests/helpers/fake-declarative-net-request';

// `fakeBrowser` does not implement `declarativeNetRequest`, yet the background
// syncs the dynamic ruleset on startup and on every store change (M2.T7). Every
// test that starts the background therefore needs a working ruleset: without
// one the sync rejects through the production applier and logs at the error
// boundary — noise on an otherwise green run, with `handle.ready` resolving
// through a caught rejection instead of a successful sync.
installFakeDynamicRules();

beforeEach(() => {
  // The fake's ruleset is process-wide, while `fakeBrowser.reset()` (called by
  // the test files themselves) does not know about it: clear it per test so
  // rules cannot leak from one test to the next.
  installFakeDynamicRules().reset();
});