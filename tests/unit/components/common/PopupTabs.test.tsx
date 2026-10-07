import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PopupTabs, TAB_ORDER, tabButtonId, tabPanelId } from '@/components/common/PopupTabs';
import { useAppStore } from '@/store';

describe('PopupTabs (M3.T4)', () => {
  beforeEach(() => {
    useAppStore.getState().setActiveTab('timer');
  });

  afterEach(cleanup);

  it('renders one tab per section with the correct ARIA roles', () => {
    render(<PopupTabs />);

    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(TAB_ORDER.length);
  });

  it('marks only the active tab as selected', () => {
    render(<PopupTabs />);

    const selected = screen.getAllByRole('tab').filter(
      (tab) => tab.getAttribute('aria-selected') === 'true',
    );
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveTextContent('Timer');
  });

  it('switches the active tab on click', async () => {
    render(<PopupTabs />);

    await userEvent.click(screen.getByRole('tab', { name: 'City' }));

    expect(useAppStore.getState().ui.activeTab).toBe('city');
  });

  it('wires each tab to the panel it controls', () => {
    render(<PopupTabs />);

    for (const tab of TAB_ORDER) {
      const button = document.getElementById(tabButtonId(tab));
      expect(button).not.toBeNull();
      expect(button?.getAttribute('aria-controls')).toBe(tabPanelId(tab));
    }
  });

  it('moves the selection with the arrow keys', async () => {
    render(<PopupTabs />);

    await userEvent.click(screen.getByRole('tab', { name: 'Timer' }));
    await userEvent.keyboard('{ArrowRight}');
    expect(useAppStore.getState().ui.activeTab).toBe('city');

    await userEvent.keyboard('{ArrowLeft}');
    expect(useAppStore.getState().ui.activeTab).toBe('timer');
  });

  it('wraps around at both ends', async () => {
    render(<PopupTabs />);

    await userEvent.click(screen.getByRole('tab', { name: 'Timer' }));
    await userEvent.keyboard('{ArrowLeft}');
    expect(useAppStore.getState().ui.activeTab).toBe('score');

    await userEvent.keyboard('{ArrowRight}');
    expect(useAppStore.getState().ui.activeTab).toBe('timer');
  });

  it('jumps to the first and last tab with Home/End', async () => {
    render(<PopupTabs />);

    await userEvent.click(screen.getByRole('tab', { name: 'Timer' }));
    await userEvent.keyboard('{End}');
    expect(useAppStore.getState().ui.activeTab).toBe('score');

    await userEvent.keyboard('{Home}');
    expect(useAppStore.getState().ui.activeTab).toBe('timer');
  });

  it('keeps a roving tabindex so only the active tab is tabbable', () => {
    render(<PopupTabs />);

    const tabs = screen.getAllByRole('tab');
    const tabbable = tabs.filter((tab) => tab.getAttribute('tabindex') === '0');
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toHaveTextContent('Timer');
  });
});
