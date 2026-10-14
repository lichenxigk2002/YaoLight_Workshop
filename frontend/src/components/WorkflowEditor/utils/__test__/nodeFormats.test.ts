import { describe, expect, it } from 'vitest';
import {
  getNodeInputFormats,
  getNodeOutputFormat,
  isFormatCompatible,
  validateNodeConnection,
} from '../nodeFormats';

describe('nodeFormats', () => {
  it('returns explicit formats for known nodes and safe defaults for unknown nodes', () => {
    expect(getNodeInputFormats('start')).toEqual(['null']);
    expect(getNodeOutputFormat('start')).toBe('json');
    expect(getNodeInputFormats('missing')).toEqual(['any']);
    expect(getNodeOutputFormat('missing')).toBe('any');
  });

  it('checks format compatibility with any and exact matches', () => {
    expect(isFormatCompatible('json', ['any'])).toBe(true);
    expect(isFormatCompatible('json', ['json', 'text'])).toBe(true);
    expect(isFormatCompatible('array', ['json', 'text'])).toBe(false);
    expect(isFormatCompatible('any', ['json'])).toBe(false);
  });

  it('allows compatible node connections', () => {
    expect(validateNodeConnection('start', 'ai')).toEqual({ compatible: true });
    expect(validateNodeConnection('crawler', 'dataclean')).toEqual({ compatible: true });
    expect(validateNodeConnection('output', 'end')).toEqual({ compatible: true });
  });

  it('rejects connections from null-output nodes to nodes that require input', () => {
    const result = validateNodeConnection('end', 'ai');

    expect(result.compatible).toBe(false);
    expect(result.message).toContain('结束节点');
    expect(result.message).toContain('AI处理节点');
  });
});
