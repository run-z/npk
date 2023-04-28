import { beforeEach, describe, expect, it } from '@jest/globals';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { FS_ROOT } from '../impl/fs-root.js';
import { Import, recognizeImport } from './import.js';
import { NodePackageFS } from './node-package-fs.js';
import { PackageResolution, resolveRootPackage } from './package-resolution.js';

describe('NodePackageFS', () => {
  let fs: NodePackageFS;

  beforeEach(() => {
    fs = new NodePackageFS();
  });

  it('constructed by path', () => {
    expect(new NodePackageFS('.').root).toBe(pathToFileURL('.').href);
  });

  it('constructed by file URL', () => {
    const root = pathToFileURL('.').href;

    expect(new NodePackageFS(root).root).toBe(root);
  });

  describe('getPackageURI', () => {
    it('ignores non-file URLs', () => {
      expect(
        fs.recognizePackageURI(recognizeImport('http:///localhost/pkg') as Import.URI),
      ).toBeUndefined();
    });
  });

  describe('parentDir', () => {
    it('returns undefined for root dir', () => {
      expect(fs.parentDir(FS_ROOT.href)).toBeUndefined();
    });
  });

  describe('loadPackage', () => {
    it('ignores non-file package.json', () => {
      expect(fs.loadPackage(pathToFileURL(path.resolve('testing')).href)).toBeUndefined();
    });
    it('ignores incomplete package.json', () => {
      expect(
        fs.loadPackage(pathToFileURL(path.resolve('testing/wrong-package')).href),
      ).toBeUndefined();
    });
  });

  describe('resolution', () => {
    let root: PackageResolution;

    beforeEach(() => {
      root = resolveRootPackage(fs);
    });

    it('resolves package self-reference', () => {
      expect(root.resolveImport(root.packageInfo.name)).toBe(root);
      expect(root.resolveDependency(root)).toEqual({ kind: 'self' });
    });
    it('resolves implied dependency', () => {
      const nodeImport = root.resolveImport('node:fs');

      expect(nodeImport.importSpec.kind).toBe('implied');
      expect(root.resolveDependency(nodeImport)).toEqual({ kind: 'implied' });
    });
    it('resolves synthetic dependency', () => {
      const nodeImport = root.resolveImport('\0internal');

      expect(nodeImport.importSpec.kind).toBe('synthetic');
      expect(root.resolveDependency(nodeImport)).toEqual({ kind: 'synthetic' });
    });
    it('resolves runtime dependency', () => {
      const depImport = root.resolveImport('semver');

      expect(depImport.importSpec.kind).toBe('package');
      expect(root.resolveDependency(depImport)).toEqual({ kind: 'runtime' });
    });
    it('resolves dev dependency', () => {
      const depImport = root.resolveImport('typescript');

      expect(depImport.importSpec.kind).toBe('package');
      expect(root.resolveDependency(depImport)).toEqual({ kind: 'dev' });
    });
    it('does not resolve missing dependency', () => {
      const wrongImport = root.resolveImport('@run-z/wrong/subpath');

      expect(wrongImport.importSpec.kind).toBe('package');
      expect(root.resolveDependency(wrongImport)).toBeNull();
    });
    it('does not resolve non-file dependency', () => {
      const dirImport = root.resolveImport('./src');

      expect(dirImport.importSpec.kind).toBe('uri');
      expect(root.resolveDependency(dirImport)).toBeNull();
    });
  });
});
