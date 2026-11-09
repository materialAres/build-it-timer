import { describe, it, expect } from 'vitest';
import {
  isAddDirectionMutation,
  isWellFormedBlocklistMutation,
  type BlocklistMutation,
} from '@/lib/messaging/blocklist-payload';

/** Forge a message whose payload does not match its declared type. */
const forged = (type: BlocklistMutation['type'], payload: unknown) =>
  ({ type, payload }) as unknown as BlocklistMutation;

describe('isWellFormedBlocklistMutation (CR4.T4)', () => {
  it.each<BlocklistMutation>([
    { type: 'BLOCKLIST_ADD_SITE', payload: { site: 'x.com' } },
    { type: 'BLOCKLIST_REMOVE_SITE', payload: { site: 'https://x.com/a' } },
    { type: 'PRESET_TOGGLE', payload: { presetId: 'social', applied: true } },
    { type: 'PRESET_TOGGLE', payload: { presetId: 'social', applied: false } },
    { type: 'PRESET_SAVE', payload: { id: 'user:1', name: 'Work' } },
    { type: 'PRESET_RENAME', payload: { presetId: 'user:1', name: '' } },
    { type: 'PRESET_DELETE', payload: { presetId: 'user:1' } },
  ])('accepts %j', (message) => {
    expect(isWellFormedBlocklistMutation(message)).toBe(true);
  });

  it.each([
    forged('BLOCKLIST_ADD_SITE', { site: '' }),
    forged('BLOCKLIST_ADD_SITE', { site: 42 }),
    forged('BLOCKLIST_REMOVE_SITE', {}),
    forged('PRESET_TOGGLE', { presetId: 'social' }),
    forged('PRESET_TOGGLE', { presetId: 'social', applied: 'yes' }),
    forged('PRESET_TOGGLE', { presetId: '', applied: true }),
    forged('PRESET_SAVE', { id: '', name: 'Work' }),
    forged('PRESET_SAVE', { id: 'user:1' }),
    forged('PRESET_RENAME', { presetId: 'user:1', name: 7 }),
    forged('PRESET_DELETE', { presetId: null }),
    forged('PRESET_DELETE', null),
    forged('PRESET_DELETE', 'user:1'),
  ])('rejects %j without throwing', (message) => {
    expect(isWellFormedBlocklistMutation(message)).toBe(false);
  });
});

describe('isAddDirectionMutation (CR5.T2)', () => {
  it.each<BlocklistMutation>([
    { type: 'BLOCKLIST_ADD_SITE', payload: { site: 'x.com' } },
    { type: 'PRESET_TOGGLE', payload: { presetId: 'social', applied: true } },
  ])('treats %j as add-direction', (message) => {
    expect(isAddDirectionMutation(message)).toBe(true);
  });

  it.each<BlocklistMutation>([
    { type: 'BLOCKLIST_REMOVE_SITE', payload: { site: 'x.com' } },
    { type: 'PRESET_TOGGLE', payload: { presetId: 'social', applied: false } },
    { type: 'PRESET_SAVE', payload: { id: 'user:1', name: 'Work' } },
    { type: 'PRESET_RENAME', payload: { presetId: 'user:1', name: 'Work' } },
    { type: 'PRESET_DELETE', payload: { presetId: 'user:1' } },
  ])('treats %j as loosening or reshaping', (message) => {
    expect(isAddDirectionMutation(message)).toBe(false);
  });

  it.each([
    forged('PRESET_TOGGLE', { presetId: 'social' }),
    forged('PRESET_TOGGLE', { presetId: 'social', applied: 'true' }),
    forged('PRESET_TOGGLE', { presetId: 'social', applied: 1 }),
    forged('PRESET_TOGGLE', null),
    forged('PRESET_TOGGLE', 'applied'),
  ])('never grants the wider window to a forged toggle %j', (message) => {
    expect(isAddDirectionMutation(message)).toBe(false);
  });
});
