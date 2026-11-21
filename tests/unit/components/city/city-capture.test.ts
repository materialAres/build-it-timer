import { afterEach, describe, expect, it } from 'vitest';
import type { FrameCapture } from '@/lib/city/export-image';
import { clearCityCapture, getCityCapture, setCityCapture } from '@/components/city/city-capture';
import { ok } from '@/utils/result';

const make = (): FrameCapture => () => ok({ dataUrl: 'data:image/png;base64,A', mimeType: 'image/png', width: 1, height: 1 });

describe('city capture bridge (CR6.T10)', () => {
  afterEach(() => { setCityCapture(null); });

  it('has no capture until the 3D view registers one', () => {
    expect(getCityCapture()).toBeNull();
  });

  it('hands out the registered capture and forgets it when cleared', () => {
    const capture = make();
    setCityCapture(capture);
    expect(getCityCapture()).toBe(capture);
    clearCityCapture(capture);
    expect(getCityCapture()).toBeNull();
  });

  it('does not clear a newer capture when an older view goes away', () => {
    const older = make();
    const newer = make();
    setCityCapture(older);
    setCityCapture(newer);
    clearCityCapture(older);
    expect(getCityCapture()).toBe(newer);
  });
});
