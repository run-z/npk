import { describe, expect, it } from '@jest/globals';
import { dirURI } from './dir-uri.js';

describe('dirURI', () => {
  it('appends slash', () => {
    expect(dirURI('package:test')).toBe('package:test/');
    expect(dirURI('package:test?some')).toBe('package:test/');
    expect(dirURI('package:test#some')).toBe('package:test/');
  });
  it('retains trailing slash', () => {
    expect(dirURI('package:test/')).toBe('package:test/');
    expect(dirURI('package:test/?some')).toBe('package:test/');
    expect(dirURI('package:test/#some')).toBe('package:test/');
  });
});
