import { describe, it, expect } from 'vitest';
import { classifyEntryError } from '@/lib/blocking/entry-error';

describe('classifyEntryError (UI.T6)', () => {
  it.each(['', '   ', '\n'])('calls %j an empty entry', (input) => {
    expect(classifyEntryError(input)).toEqual({ kind: 'empty' });
  });

  it.each([
    ['com', 'com'],
    ['co.uk', 'co.uk'],
    ['https://github.io/page', 'github.io'],
    ['  CO.UK ', 'co.uk'],
  ])('names the bare public suffix in %j', (input, subject) => {
    expect(classifyEntryError(input)).toEqual({ kind: 'suffix', subject });
  });

  it.each(['192.168.1.1', 'http://[::1]/'])('recognises the IP address %j', (input) => {
    expect(classifyEntryError(input)).toEqual({ kind: 'ip' });
  });

  it.each(['not a url', 'localhost', 'https://', 'a b.com'])(
    'falls back to the generic message for %j',
    (input) => {
      expect(classifyEntryError(input)).toEqual({ kind: 'invalid' });
    },
  );

  it('is total for a non-string input', () => {
    expect(classifyEntryError(undefined as unknown as string)).toEqual({
      kind: 'empty',
    });
  });
});
