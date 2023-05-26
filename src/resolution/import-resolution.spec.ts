import { beforeEach, describe, expect, it } from '@jest/globals';
import { resolveRootPackage } from '../fs/resolve-root-package.js';
import { VirtualPackageFS } from '../fs/virtual-package-fs.js';
import { ImportResolution } from './import-resolution.js';
import { PackageResolution } from './package-resolution.js';

describe('ImportResolution', () => {
  let fs: VirtualPackageFS;
  let root: PackageResolution;

  beforeEach(async () => {
    fs = new VirtualPackageFS().addRoot({ name: '@test-scope/root-package', version: '1.0.0' });

    root = await resolveRootPackage(fs);
  });

  describe('for URI import', () => {
    let resolution: ImportResolution;

    beforeEach(() => {
      resolution = root.resolveImport('http://localhost/pkg/test?ver=2.0.0');
    });

    describe('resolutionBaseURI', () => {
      it('the same as URI', () => {
        expect(resolution.resolutionBaseURI).toBe(resolution.uri);
      });
    });

    describe('asPackage', () => {
      it('returns none', () => {
        expect(resolution.asPackage()).toBeUndefined();
      });
    });

    describe('asSubPackage', () => {
      it('returns none', () => {
        expect(resolution.asSubPackage()).toBeUndefined();
      });
    });

    describe('importSpec', () => {
      it('contains URI import specifier', () => {
        expect(resolution.importSpec).toEqual({
          kind: 'uri',
          spec: 'http://localhost/pkg/test?ver=2.0.0',
          scheme: 'http',
          path: '/pkg/test',
        });
      });
    });

    describe('resolveImport', () => {
      it('resolves URI', () => {
        const uriResolution = resolution.resolveImport('http://localhost/pkg/test?ver=3.0.0');

        expect(uriResolution.importSpec).toEqual({
          kind: 'uri',
          spec: 'http://localhost/pkg/test?ver=3.0.0',
          scheme: 'http',
          path: '/pkg/test',
        });
      });
      it('resolves relative path', () => {
        const uriResolution = resolution.resolveImport('./test?ver=3.0.0');

        expect(uriResolution.importSpec).toEqual({
          kind: 'uri',
          spec: 'http://localhost/pkg/test?ver=3.0.0',
          scheme: 'http',
          path: '/pkg/test',
        });
      });
      it('resolves absolute path', () => {
        const uriResolution = resolution.resolveImport('/pkg/test?ver=3.0.0');

        expect(uriResolution.importSpec).toEqual({
          kind: 'uri',
          spec: 'http://localhost/pkg/test?ver=3.0.0',
          scheme: 'http',
          path: '/pkg/test',
        });
      });
      it('resolves self-import', () => {
        expect(resolution.resolveImport(resolution.uri)).toBe(resolution);
        expect(resolution.resolveImport('./test?ver=2.0.0')).toBe(resolution);
        expect(resolution.resolveImport('/pkg/test?ver=2.0.0')).toBe(resolution);
      });
      it('resolves package as unknown import', () => {
        expect(resolution.resolveImport('@test/test').uri).toBe('import:package:@test/test');
      });
      it('resolves private as unknown import', () => {
        expect(resolution.resolveImport('#test').uri).toBe('import:private:test');
      });
      it('resolves synthetic spec as unknown import', () => {
        expect(resolution.resolveImport('\0test').uri).toBe('import:synthetic:test');
      });
      it('resolves unknown spec as unknown import', () => {
        expect(resolution.resolveImport('_test').uri).toBe('import:unknown:_test');
      });
    });

    describe('resolveDependency', () => {
      it('resolves self-dependency', () => {
        expect(resolution.resolveDependency(resolution)).toEqual({ kind: 'self' });
      });
      it('does not resolve dependency on another URI import', () => {
        expect(
          resolution.resolveDependency(resolution.resolveImport('./test?ver=3.0.0')),
        ).toBeNull();
      });
      it('does not resolve dependency on package import', () => {
        expect(resolution.resolveDependency(resolution.resolveImport('test'))).toBeNull();
      });
    });
  });

  describe('for unknown import', () => {
    let resolution: ImportResolution;

    beforeEach(() => {
      resolution = root.resolveImport('_test');
    });

    describe('root', () => {
      it('refers to resolution root', () => {
        expect(resolution.root).toBe(root);
      });
    });

    describe('resolveImport', () => {
      it('resolves self-import', () => {
        expect(resolution.resolveImport(resolution.uri)).toBe(resolution);
      });
      it('resolves URI as URI import', () => {
        const uriResolution = resolution.resolveImport('http://localhost/pkg/test?ver=3.0.0');

        expect(uriResolution.importSpec).toEqual({
          kind: 'uri',
          spec: 'http://localhost/pkg/test?ver=3.0.0',
          scheme: 'http',
          path: '/pkg/test',
        });
      });
      it('resolves path as unknown import', () => {
        expect(resolution.resolveImport('./test?ver=3.0.0').uri).toBe(
          'import:path:./test?ver=3.0.0',
        );
      });
    });
  });
});
