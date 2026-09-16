// Result type for operations that can fail at non-trusted boundaries.
// Used instead of exceptions for expected failure modes (parsing, storage, etc.).
// Real bugs (state impossibility, programming errors) can still throw.

export type Result<T> = Success<T> | Failure;

export interface Success<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Failure {
  readonly ok: false;
  readonly error: Error;
}

export function ok<T>(value: T): Success<T> {
  return { ok: true, value };
}

export function err(error: Error): Failure {
  return { ok: false, error };
}