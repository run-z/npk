import { describe, expect, it } from '@jest/globals';
import { Import } from './import.js';
import { recognizeImport } from './recognize-import.js';

describe('recognizeImport', () => {
  it('does not alter recognized import', () => {
    const spec: Import = { kind: 'unknown', spec: '_path/to/file' };

    expect(recognizeImport(spec)).toBe(spec);
  });

  describe('package imports', () => {
    it('recognizes scoped package', () => {
      const spec = '@test-scope/test-package';

      expect(recognizeImport(spec)).toEqual({
        kind: 'package',
        spec,
        name: spec,
        scope: '@test-scope',
        local: 'test-package',
      });
    });
    it('recognizes unscoped package', () => {
      const spec = 'test-package';

      expect(recognizeImport(spec)).toEqual({
        kind: 'package',
        spec,
        name: spec,
        local: 'test-package',
      });
    });
    it('recognizes package ending with slash', () => {
      const spec = 'test-package/';

      expect(recognizeImport(spec)).toEqual({
        kind: 'package',
        spec: 'test-package',
        name: 'test-package',
        local: 'test-package',
      });
    });
    it('does not recognize wrong package name', () => {
      expect(recognizeImport('@test')).toEqual({ kind: 'unknown', spec: '@test' });
      expect(recognizeImport('_test')).toEqual({ kind: 'unknown', spec: '_test' });
      expect(recognizeImport('.test')).toEqual({ kind: 'unknown', spec: '.test' });
    });
  });

  describe('package entry imports', () => {
    it('recognizes entry of scoped package', () => {
      const spec = '@test-scope/test-package/some/path';

      expect(recognizeImport(spec)).toEqual({
        kind: 'entry',
        spec,
        name: '@test-scope/test-package',
        scope: '@test-scope',
        local: 'test-package',
        subpath: '/some/path',
      });
    });
    it('recognizes entry of unscoped package', () => {
      const spec = 'test-package/some/path';

      expect(recognizeImport(spec)).toEqual({
        kind: 'entry',
        spec,
        name: 'test-package',
        local: 'test-package',
        subpath: '/some/path',
      });
    });
  });

  describe('import paths', () => {
    it('recognizes directory path', () => {
      expect(recognizeImport('.')).toEqual({
        kind: 'path',
        spec: '.',
        isRelative: true,
        path: '.',
        uri: '.',
      });
    });
    it('recognizes parent directory path', () => {
      expect(recognizeImport('..')).toEqual({
        kind: 'path',
        spec: '..',
        isRelative: true,
        path: '..',
        uri: '..',
      });
    });
    it('recognizes absolute path', () => {
      const spec = '/test path';

      expect(recognizeImport(spec)).toEqual({
        kind: 'path',
        spec,
        isRelative: false,
        path: '/test path',
        uri: '/test path',
      });
    });
    it('recognizes relative path', () => {
      const spec = './test path?q=a';

      expect(recognizeImport(spec)).toEqual({
        kind: 'path',
        spec,
        isRelative: true,
        path: './test path?q=a',
        uri: './test path?q=a',
      });
    });
  });

  it('recognizes URI', () => {
    const spec = 'file:///test-path?query';

    expect(recognizeImport(spec)).toEqual({
      kind: 'uri',
      spec,
      scheme: 'file',
      path: '/test-path',
    });
  });
  it('recognizes synthetic module', () => {
    const spec = '\0file:///test-path?query';

    expect(recognizeImport(spec)).toEqual({
      kind: 'synthetic',
      spec,
    });
  });
  it('recognizes private import', () => {
    const spec = '#/internal';

    expect(recognizeImport(spec)).toEqual({
      kind: 'private',
      spec,
    });
  });
});
