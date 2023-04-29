import { describe, expect, it } from '@jest/globals';
import { parseRange } from './parse-range.js';

describe('parseRange', () => {
  it('returns undefined on wrong range', () => {
    expect(parseRange('_')).toBeUndefined();
  });
});
