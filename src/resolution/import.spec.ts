import { describe, expect, it } from '@jest/globals';
import { win32 } from 'node:path/win32';
import { Import, recognizeImport } from './import.js';

describe('recognizeImport', () => {
  it('does not alter recognized import', () => {
    const spec: Import = { kind: 'unknown', spec: '_path/to/file' };

    expect(recognizeImport(spec)).toBe(spec);
  });

  describe('node imports', () => {
    it('recognized with "node:" prefix', () => {
      expect(recognizeImport('node:fs')).toEqual({
        kind: 'implied',
        spec: 'node:fs',
        from: 'node',
      });
    });
    it('recognizes built-in module name', () => {
      expect(recognizeImport('fs')).toEqual({
        kind: 'implied',
        spec: 'fs',
        from: 'node',
      });
      expect(recognizeImport('path')).toEqual({
        kind: 'implied',
        spec: 'path',
        from: 'node',
      });
    });
    it('recognizes sub-export of built-in module', () => {
      expect(recognizeImport('fs/promises')).toEqual({
        kind: 'implied',
        spec: 'fs/promises',
        from: 'node',
      });
      expect(recognizeImport('stream/web')).toEqual({
        kind: 'implied',
        spec: 'stream/web',
        from: 'node',
      });
    });
    it('does not recognize wrong node built-in with "node:" prefix', () => {
      expect(recognizeImport('node:wrong-module')).toEqual({
        kind: 'uri',
        spec: 'node:wrong-module',
        scheme: 'node',
        path: 'wrong-module',
      });
      expect(recognizeImport('node:fs/wrong-sub-module')).toEqual({
        kind: 'uri',
        spec: 'node:fs/wrong-sub-module',
        scheme: 'node',
        path: 'fs/wrong-sub-module',
      });
    });
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
    it('recognizes subpath of scoped package', () => {
      const spec = '@test-scope/test-package/some/path';

      expect(recognizeImport(spec)).toEqual({
        kind: 'package',
        spec,
        name: '@test-scope/test-package',
        scope: '@test-scope',
        local: 'test-package',
        subpath: '/some/path',
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
    it('recognizes subpath of unscoped package', () => {
      const spec = 'test-package/some/path';

      expect(recognizeImport(spec)).toEqual({
        kind: 'package',
        spec,
        name: 'test-package',
        local: 'test-package',
        subpath: '/some/path',
      });
    });
    it('does not recognize wrong package name', () => {
      expect(recognizeImport('@test')).toEqual({ kind: 'unknown', spec: '@test' });
      expect(recognizeImport('_test')).toEqual({ kind: 'unknown', spec: '_test' });
      expect(recognizeImport('.test')).toEqual({ kind: 'unknown', spec: '.test' });
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
    it('recognizes absolute unix path', () => {
      const spec = '/test path';

      expect(recognizeImport(spec)).toEqual({
        kind: 'path',
        spec,
        isRelative: false,
        path: '/test%20path',
        uri: '/test%20path',
      });
    });
    it('recognizes windows path with drive letter', () => {
      const spec = 'c:\\dir\\test path';

      expect(recognizeImport(spec)).toEqual({
        kind: 'path',
        spec,
        isRelative: false,
        path: `/c:/dir/test%20path`,
        uri: `file:///c:/dir/test%20path`,
      });
    });
    it('recognizes absolute windows path with drive letter', () => {
      const spec = '\\c:\\dir\\test path';

      expect(recognizeImport(spec)).toEqual({
        kind: 'path',
        spec,
        isRelative: false,
        path: `/c:/dir/test%20path`,
        uri: `file:///c:/dir/test%20path`,
      });
    });
    it('recognizes absolute windows path', () => {
      const spec = '\\\\server\\test path';

      expect(recognizeImport(spec)).toEqual({
        kind: 'path',
        spec,
        isRelative: false,
        path: `//%3F/UNC/server/test%20path/`,
        uri: `file:////%3F/UNC/server/test%20path/`,
      });
    });
    it('recognizes UNC windows path', () => {
      const spec = win32.toNamespacedPath('\\\\server\\test path');

      expect(recognizeImport(spec)).toEqual({
        kind: 'path',
        spec,
        isRelative: false,
        path: `//%3F/UNC/server/test%20path/`,
        uri: `file:////%3F/UNC/server/test%20path/`,
      });
    });
    it('recognizes relative unix path', () => {
      const spec = './test path?q=a';

      expect(recognizeImport(spec)).toEqual({
        kind: 'path',
        spec,
        isRelative: true,
        path: './test%20path?q=a',
        uri: './test%20path?q=a',
      });
    });
    it('recognizes relative windows path', () => {
      const spec = '.\\test path';

      expect(recognizeImport(spec)).toEqual({
        kind: 'path',
        spec,
        isRelative: true,
        path: './test%20path',
        uri: './test%20path',
      });
    });
    it('recognizes unix path relative to parent directory', () => {
      const spec = '../test path#q=a';

      expect(recognizeImport(spec)).toEqual({
        kind: 'path',
        spec,
        isRelative: true,
        path: '../test%20path#q=a',
        uri: '../test%20path#q=a',
      });
    });
    it('recognizes windows path relative to parent directory', () => {
      const spec = '..\\test path';

      expect(recognizeImport(spec)).toEqual({
        kind: 'path',
        spec,
        isRelative: true,
        path: '../test%20path',
        uri: '../test%20path',
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
  it('recognizes subpath', () => {
    const spec = '#/internal';

    expect(recognizeImport(spec)).toEqual({
      kind: 'subpath',
      spec,
    });
  });
});
