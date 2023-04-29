import { describe, expect, it } from '@jest/globals';
import { isValidPackageJson } from './package.json.js';

describe('isValidPackageJson', () => {
  it('returns true for valid package.json', () => {
    expect(isValidPackageJson({ name: 'test', version: '1.0.0' })).toBe(true);
  });
  it('returns false when name missing', () => {
    expect(isValidPackageJson({ version: '1.0.0' })).toBe(false);
  });
  it('returns false when version missing', () => {
    expect(isValidPackageJson({ name: 'test' })).toBe(false);
  });
  it('returns false when version is invalid', () => {
    expect(isValidPackageJson({ name: 'test', version: 'wrong' })).toBe(false);
  });
});
