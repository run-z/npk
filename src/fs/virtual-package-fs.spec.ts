import { beforeEach, describe, expect, it } from '@jest/globals';
import { PackageResolution } from '../resolution/package-resolution.js';
import { resolveRootPackage } from './resolve-root-package.js';
import { VirtualPackageFS } from './virtual-package-fs.js';

describe('VirtualPackageFS', () => {
  let fs: VirtualPackageFS;
  let root: PackageResolution;

  beforeEach(async () => {
    fs = new VirtualPackageFS().addRoot({ name: 'root', version: '1.0.0' });
    root = await resolveRootPackage(fs);
  });

  describe('addPackage', () => {
    it('replaces named package with the same version', async () => {
      fs.addRoot({ name: 'root', version: '1.0.0', dependencies: { test: '1.0.0' } });
      fs.addPackage('package:test', { name: 'test', version: '1.0.0' });
      root = await resolveRootPackage(fs);

      await expect(fs.resolveName(root, 'test')).resolves.toBe('package:test');

      fs.addPackage('package:test@biz', { name: 'test', version: '1.0.0' });

      await expect(fs.resolveName(root, 'test')).resolves.toBe('package:test@biz');
    });
    it('replaces package at the same URI', async () => {
      fs.addRoot({
        name: 'root',
        version: '1.0.0',
        dependencies: { test: '1.0.0', test2: '1.0.0' },
      });
      fs.addPackage('package:test', { name: 'test', version: '1.0.0' });
      root = await resolveRootPackage(fs);

      await expect(fs.resolveName(root, 'test')).resolves.toBe('package:test');

      fs.addPackage('package:test', { name: 'test2', version: '1.0.0' });

      await expect(fs.resolveName(root, 'test2')).resolves.toBe('package:test');
      await expect(fs.resolveName(root, 'test')).resolves.toBeUndefined();
    });
  });

  describe('resolveName', () => {
    it('does not resolve missing dependency', async () => {
      fs.addPackage(root.uri, { name: 'root', version: '1.0.0', dependencies: { test: '1.0.0' } });

      await expect(fs.resolveName(root, 'test2')).resolves.toBeUndefined();
    });
  });

  describe('parentDir', () => {
    it('handles leading slash in URI', () => {
      expect(fs.parentDir('package:/some/path')).toBe('package:some');
    });
  });

  describe('derefEntry', () => {
    it('dereferences package', async () => {
      fs.addPackage(
        'package:test',
        {
          name: 'test',
          version: '1.0.0',
        },
        {
          deref: { '': './dist/index.js' },
        },
      );

      const resolved = await root.resolveImport('package:test');
      const deref = resolved?.deref();

      expect(deref.uri).toBe('package:test/dist/index.js');
      expect(deref?.importSpec).toEqual({
        kind: 'path',
        spec: './dist/index.js',
        isRelative: true,
        path: './dist/index.js',
        uri: './dist/index.js',
      });
    });
    it('dereferences package entry', async () => {
      fs.addRoot({ name: 'root', version: '1.0.0', dependencies: { test: '1.0.0' } });
      fs.addPackage(
        'package:test',
        {
          name: 'test',
          version: '1.0.0',
        },
        {
          deref: { '/sub': './dist/sub.js' },
        },
      );
      root = await resolveRootPackage(fs);

      const resolved = await root.resolveImport('test/sub');
      const deref = resolved?.deref();

      expect(deref.uri).toBe('package:test/dist/sub.js');
      expect(deref?.importSpec).toEqual({
        kind: 'path',
        spec: './dist/sub.js',
        isRelative: true,
        path: './dist/sub.js',
        uri: './dist/sub.js',
      });
    });
    it('dereferences private entry to local file', async () => {
      fs.addPackage(
        'package:test',
        {
          name: 'test',
          version: '1.0.0',
        },
        {
          deref: { '#private': './dist/private.js' },
        },
      );

      const host = await root.resolveImport('package:test');
      const resolved = await host.resolveImport('#private');
      const deref = resolved?.deref();

      expect(deref.uri).toBe('package:test/dist/private.js');
      expect(deref?.importSpec).toEqual({
        kind: 'path',
        spec: './dist/private.js',
        isRelative: true,
        path: './dist/private.js',
        uri: './dist/private.js',
      });
    });
    it('dereferences private entry to package', async () => {
      fs.addPackage(
        'package:test',
        {
          name: 'test',
          version: '1.0.0',
          dependencies: {
            other: '1.0.0',
          },
        },
        {
          deref: { '#private': 'other' },
        },
      );
      fs.addPackage('package:other', {
        name: 'other',
        version: '1.0.0',
      });

      const host = await root.resolveImport('package:test');
      const other = await host.resolveImport('other');
      const resolved = await host.resolveImport('#private');
      const deref = resolved?.deref();

      expect(deref).toBe(other);
    });
  });
});
