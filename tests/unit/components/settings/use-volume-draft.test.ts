import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useVolumeDraft } from '@/components/settings/use-volume-draft';

function setup(initialStored = 50) {
  const send = vi.fn<(volume: number) => void>();
  const hook = renderHook(({ stored }) => useVolumeDraft(stored, send), {
    initialProps: { stored: initialStored },
  });
  return { send, hook };
}

describe('useVolumeDraft', () => {
  it('shows the stored value when nothing is being dragged', () => {
    const { hook } = setup(50);
    expect(hook.result.current.value).toBe(50);
  });

  it('shows the dragged value without sending it', () => {
    const { hook, send } = setup();
    act(() => {
      hook.result.current.change(70);
    });
    expect(hook.result.current.value).toBe(70);
    expect(send).not.toHaveBeenCalled();
  });

  it('sends the last dragged value once, on commit', () => {
    const { hook, send } = setup();
    act(() => {
      hook.result.current.change(60);
    });
    act(() => {
      hook.result.current.change(80);
    });
    act(() => {
      hook.result.current.commit();
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(80);
  });

  it('does not send the same drag twice', () => {
    const { hook, send } = setup();
    act(() => {
      hook.result.current.change(90);
    });
    act(() => {
      hook.result.current.commit();
    });
    act(() => {
      hook.result.current.commit();
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sends nothing when there is no drag or it ends at the stored value', () => {
    const { hook, send } = setup(50);
    act(() => {
      hook.result.current.commit();
    });
    act(() => {
      hook.result.current.change(50);
    });
    act(() => {
      hook.result.current.commit();
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('lets a stored value changed elsewhere win over the drag', () => {
    const { hook, send } = setup(50);
    act(() => {
      hook.result.current.change(90);
    });
    hook.rerender({ stored: 20 });

    expect(hook.result.current.value).toBe(20);
    act(() => {
      hook.result.current.commit();
    });
    expect(send).not.toHaveBeenCalled();
  });
});
