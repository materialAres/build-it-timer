import { describe, expect, it, vi, type Mock } from 'vitest';
import { captureFrame, MAX_CAPTURE_SIZE, type CaptureHost } from '@/components/city/three/capture-frame';

interface Harness {
  host: CaptureHost;
  calls: string[];
  toDataURL: Mock<(type: string, quality?: number) => string>;
  restored: Mock<() => void>;
}

function harness(options: { view?: { width: number; height: number }; dataUrl?: string; throwOn?: 'draw' | 'encode' } = {}): Harness {
  const calls: string[] = [];
  let ratio = 1.5;
  const toDataURL = vi.fn<(type: string, quality?: number) => string>((type) => {
    calls.push('encode');
    if (options.throwOn === 'encode') throw new Error('tainted');
    return options.dataUrl ?? `data:${type};base64,AAAA`;
  });
  const restored = vi.fn<() => void>(() => { calls.push('restored'); });
  const host: CaptureHost = {
    canvas: { toDataURL },
    pixelRatio: {
      get: () => ratio,
      set: (value) => { ratio = value; calls.push(`ratio:${String(value)}`); },
    },
    fit: (width, height, updateStyle) => { calls.push(`fit:${String(width)}x${String(height)}:${String(updateStyle)}`); },
    draw: () => {
      calls.push('draw');
      if (options.throwOn === 'draw') throw new Error('context lost');
    },
    viewSize: () => options.view ?? { width: 480, height: 272 },
    restored,
  };
  return { host, calls, toDataURL, restored };
}

describe('captureFrame (CR6.T10)', () => {
  it('renders one frame at the chosen size and reads it in the same call', () => {
    const h = harness();
    const result = captureFrame(h.host, 1600, 900, 'png');

    expect(result).toEqual({
      ok: true,
      value: { dataUrl: 'data:image/png;base64,AAAA', mimeType: 'image/png', width: 1600, height: 900 },
    });
    expect(h.calls.slice(0, 4)).toEqual(['ratio:1', 'fit:1600x900:false', 'draw', 'encode']);
  });

  it('puts the view back as it was, then asks for a redraw', () => {
    const h = harness();
    captureFrame(h.host, 800, 450, 'png');

    expect(h.calls.slice(4)).toEqual(['ratio:1.5', 'fit:480x272:true', 'restored']);
    expect(h.host.pixelRatio.get()).toBe(1.5);
  });

  it('asks for JPEG with a quality and for PNG without one', () => {
    const jpeg = harness();
    const result = captureFrame(jpeg.host, 100, 100, 'jpeg');
    expect(jpeg.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.92);
    expect(result.ok && result.value.mimeType).toBe('image/jpeg');

    const png = harness();
    captureFrame(png.host, 100, 100, 'png');
    expect(png.toDataURL).toHaveBeenCalledWith('image/png', undefined);
  });

  it('returns an error, never throws, and still restores the view when the read fails', () => {
    const h = harness({ throwOn: 'encode' });
    const result = captureFrame(h.host, 100, 100, 'png');

    expect(result.ok).toBe(false);
    expect(h.calls.slice(-3)).toEqual(['ratio:1.5', 'fit:480x272:true', 'restored']);
  });

  it('returns an error, and restores the view, when drawing fails (a lost context)', () => {
    const h = harness({ throwOn: 'draw' });
    const result = captureFrame(h.host, 100, 100, 'png');

    expect(result.ok).toBe(false);
    expect(h.toDataURL).not.toHaveBeenCalled();
    expect(h.restored).toHaveBeenCalledTimes(1);
  });

  it('treats an empty data URL as a failure', () => {
    const h = harness({ dataUrl: 'data:,' });
    expect(captureFrame(h.host, 100, 100, 'png').ok).toBe(false);
  });

  it.each([
    [0, 100],
    [100, 0],
    [-5, 100],
    [Number.NaN, 100],
    [100, Number.POSITIVE_INFINITY],
    [MAX_CAPTURE_SIZE + 1, 100],
  ])('rejects the size %s x %s without touching the GPU', (width, height) => {
    const h = harness();
    expect(captureFrame(h.host, width, height, 'png').ok).toBe(false);
    expect(h.calls).toEqual([]);
  });

  it('rounds a fractional size to whole pixels', () => {
    const h = harness();
    const result = captureFrame(h.host, 800.4, 450.6, 'png');
    expect(result.ok && [result.value.width, result.value.height]).toEqual([800, 451]);
  });

  it('does not resize the view back when it never had a size', () => {
    const h = harness({ view: { width: 0, height: 0 } });
    captureFrame(h.host, 100, 100, 'png');
    expect(h.calls.filter((c) => c.startsWith('fit:'))).toEqual(['fit:100x100:false']);
    expect(h.restored).toHaveBeenCalledTimes(1);
  });
});
