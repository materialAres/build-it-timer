import { describe, it, expect } from 'vitest';
import { diffDomains } from '@/lib/blocking/diff-domains';

describe('diffDomains (UI.T6)', () => {
  it('reports nothing for the same list', () => {
    expect(diffDomains(['a.com', 'b.com'], ['a.com', 'b.com'])).toEqual({
      added: [],
      removed: [],
    });
  });

  it('lists the domains that appeared, in list order', () => {
    expect(diffDomains(['a.com'], ['a.com', 'b.com', 'c.com'])).toEqual({
      added: ['b.com', 'c.com'],
      removed: [],
    });
  });

  it('lists the domains that disappeared', () => {
    expect(diffDomains(['a.com', 'b.com', 'c.com'], ['b.com'])).toEqual({
      added: [],
      removed: ['a.com', 'c.com'],
    });
  });

  it('reports both when a list is replaced', () => {
    expect(diffDomains(['a.com'], ['b.com'])).toEqual({
      added: ['b.com'],
      removed: ['a.com'],
    });
  });

  it('ignores a pure reorder', () => {
    expect(diffDomains(['a.com', 'b.com'], ['b.com', 'a.com'])).toEqual({
      added: [],
      removed: [],
    });
  });
});
