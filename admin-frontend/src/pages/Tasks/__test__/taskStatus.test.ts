import { describe, expect, it } from 'vitest';
import { getTaskStatusLabel, getTaskStatusMeta } from '../taskStatus';

describe('taskStatus', () => {
  it('maps success, running, failure, cancellation, and skipped statuses to colors', () => {
    expect(getTaskStatusMeta('completed', 'zh-CN')).toMatchObject({ color: 'green' });
    expect(getTaskStatusMeta('running', 'zh-CN')).toMatchObject({ color: 'blue' });
    expect(getTaskStatusMeta('queued', 'zh-CN')).toMatchObject({ color: 'blue' });
    expect(getTaskStatusMeta('failed', 'zh-CN')).toMatchObject({ color: 'red' });
    expect(getTaskStatusMeta('timeout', 'zh-CN')).toMatchObject({ color: 'red' });
    expect(getTaskStatusMeta('cancelled', 'zh-CN')).toMatchObject({ color: 'default' });
    expect(getTaskStatusMeta('skipped', 'zh-CN')).toMatchObject({ color: 'orange' });
  });

  it('returns translated labels for supported locales', () => {
    expect(getTaskStatusLabel('completed', 'zh-CN')).toBe('已完成');
    expect(getTaskStatusLabel('completed', 'en-US')).toBe('Completed');
    expect(getTaskStatusLabel('running', 'en-US')).toBe('Running');
  });

  it('falls back to raw status for unknown values', () => {
    expect(getTaskStatusMeta('archived', 'zh-CN')).toEqual({ color: 'default', label: 'archived' });
  });
});
